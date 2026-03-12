# Implementation Notes

## Step 1: Serializer — Counting permits per community area

A user request for a particular year is received by `MapDataView`, which uses `CommunityAreaSerializer` to get the count of restaurant permits issued in that year for each community area. The serializer's `get_num_permits` method does this using a Django ORM filter on the `RestaurantPermit` model, narrowed by both `community_area_id` and `issue_date__year`.

The year is passed from the view into the serializer via `context` — Django's mechanism for supplying extra data to a serializer beyond the model object itself. Inside `get_num_permits`, it's retrieved with `self.context.get("year")`.

One subtle thing worth noting: `CommunityArea.area_id` is stored as an integer, but `RestaurantPermit.community_area_id` is a CharField. The filter still works because Django coerces the types, but it's an inconsistency in the data model that's worth being aware of.

## Step 2: Tests — Validating the endpoint

Tests verify that the `/map-data/` endpoint returns correct permit counts without manually checking in a browser. The test creates its own isolated data (2 community areas, 5 permits split between them in 2021) in a temporary database, makes a real HTTP request to the endpoint, and asserts the response contains the expected counts.

The existing test skeleton had a bug: `reverse("map_data", query={"year": 2021})` is not valid Django — `reverse()` only builds a URL path, not query strings. The fix was to pass the year as the second argument to `client.get()` instead: `client.get(reverse("map_data"), {"year": 2021})`.

The test runs in its own Docker environment (separate from the app) via:
```bash
docker compose -f docker-compose.yml -f tests/docker-compose.yml run --rm app
```
This spins up a temporary database just for the test, then tears it down — no need to load real data first.

### Environment fix: Apple Silicon compatibility

Running the tests initially failed with `no matching manifest for linux/arm64/v8` — the `postgis/postgis:latest` Docker image doesn't publish an ARM64 build. The fix was to add `platform: linux/amd64` to the postgres service in `docker-compose.yml`, which tells Docker to run the AMD64 image under emulation. A comment was added to explain why, so future contributors on Apple Silicon machines don't hit the same wall.

## Steps 3–5: React — Fetching data, displaying stats, and rendering the map

### Step 3: Fixing the fetch

The existing `useEffect` called `fetch()` with no arguments, which is a broken call. The fix was straightforward: pass `yearlyDataEndpoint` as the URL, and store the parsed JSON response in state with `setCurrentYearData(data)`.

`useEffect` is the right place for this because it runs *after* the component renders and re-runs whenever its dependency (`yearlyDataEndpoint`) changes. Since `yearlyDataEndpoint` is derived from `year` state, changing the year dropdown automatically triggers a new API call — no extra wiring needed.

### Step 4: Displaying stats

Two derived values are computed from `currentYearData` (the array of `{name, num_permits}` returned by the API):
- `totalPermits` — a `.reduce()` that sums all permit counts
- `maxNumPermits` — `Math.max()` over all permit counts, with a guard for empty arrays (an empty spread into `Math.max()` returns `-Infinity`)

`maxNumPermits` also fixed a pre-existing reference error in the JSX where `key={maxNumPermits}` was used on the `GeoJSON` component before the variable existed. The `key` prop here forces React to re-mount the GeoJSON layer when the max changes (i.e. when the year changes), ensuring the shading updates correctly.

### Step 5: Map shading and popups

Before writing the shading logic, the GeoJSON file was inspected to understand its structure. Each feature has a `community` property in uppercase (e.g. `"ROGERS PARK"`) and an `area_num_1` property. The API returns names in title case (e.g. `"Rogers Park"`). The match is done case-insensitively using `.toLowerCase()` on both sides.

**Shading:** Each area's permit count is expressed as a percentage of the busiest area that year (`numPermits / maxNumPermits * 100`). This relative percentage is then mapped to one of 4 blue shades — lightest for 0–25%, darkest for 75–100%. Using a relative scale (rather than fixed thresholds) means the shading always produces meaningful contrast regardless of the year's overall volume.

**Popup:** On `mouseover`, a popup is bound and opened showing the area name and raw permit count. This gives users concrete numbers rather than just a color.

## Validation

Once the app was running (`docker compose up` after loading fixture data), the following checks were done manually in the browser at http://localhost:8000:

- **Map loads** — Chicago neighborhood shapes render correctly over the base map
- **Shading is varied** — areas display different shades of blue, not a uniform color, confirming the permit counts differ across areas and the color scale is working
- **Stats are non-zero** — "Restaurant permits issued this year" and "Maximum number of restaurant permits in a single area" both show real values
- **Hover popup works** — mousing over any neighborhood shows a popup with the area name and permit count
- **Year filter updates the map** — changing the dropdown year re-fetches data and re-shades the map accordingly

The API response was also verified directly by visiting http://localhost:8000/map-data/?year=2026 in the browser, confirming the JSON array contains named areas with non-zero `num_permits` values.

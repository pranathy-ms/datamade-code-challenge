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

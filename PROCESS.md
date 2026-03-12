# Implementation Notes

## Step 1: Serializer — Counting permits per community area

A user request for a particular year is received by `MapDataView`, which uses `CommunityAreaSerializer` to get the count of restaurant permits issued in that year for each community area. The serializer's `get_num_permits` method does this using a Django ORM filter on the `RestaurantPermit` model, narrowed by both `community_area_id` and `issue_date__year`.

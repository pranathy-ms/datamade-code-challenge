from rest_framework import serializers

from map.models import CommunityArea, RestaurantPermit


class CommunityAreaSerializer(serializers.ModelSerializer):
    class Meta:
        model = CommunityArea
        fields = ["name", "num_permits"]

    num_permits = serializers.SerializerMethodField()

    def get_num_permits(self, obj):
        # WAS: pass (unimplemented stub)
        # NOW: counts RestaurantPermit rows for this community area in the requested year
        #
        # The year comes from the serializer's context, which MapDataView sets from
        # the ?year= query param. issue_date__year is Django ORM syntax that extracts
        # just the year part of a DateField for filtering.
        year = self.context.get("year")
        return RestaurantPermit.objects.filter(
            community_area_id=obj.area_id,
            issue_date__year=year,
        ).count()

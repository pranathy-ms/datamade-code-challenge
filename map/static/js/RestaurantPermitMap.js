import React, { useEffect, useState } from "react"

import { MapContainer, TileLayer, GeoJSON } from "react-leaflet"

import "leaflet/dist/leaflet.css"

import RAW_COMMUNITY_AREAS from "../../../data/raw/community-areas.geojson"

function YearSelect({ setFilterVal }) {
  // Filter by the permit issue year for each restaurant
  const startYear = 2026
  const years = [...Array(11).keys()].map((increment) => {
    return startYear - increment
  })
  const options = years.map((year) => {
    return (
      <option value={year} key={year}>
        {year}
      </option>
    )
  })

  return (
    <>
      <label htmlFor="yearSelect" className="fs-3">
        Filter by year:{" "}
      </label>
      <select
        id="yearSelect"
        className="form-select form-select-lg mb-3"
        onChange={(e) => setFilterVal(e.target.value)}
      >
        {options}
      </select>
    </>
  )
}

export default function RestaurantPermitMap() {
  const communityAreaColors = ["#eff3ff", "#bdd7e7", "#6baed6", "#2171b5"]

  const [currentYearData, setCurrentYearData] = useState([])
  const [year, setYear] = useState(2026)

  const yearlyDataEndpoint = `/map-data/?year=${year}`

  useEffect(() => {
    // fetch() with no args was broken — now passes the endpoint URL
    // fetch(yearlyDataEndpoint) re-runs whenever year changes (see dependency array)
    fetch(yearlyDataEndpoint)
      .then((res) => res.json())
      .then((data) => {
        // store the API response in state so the map can use it
        setCurrentYearData(data)
      })
  }, [yearlyDataEndpoint])


  // total permits across all areas for the selected year
  const totalPermits = currentYearData.reduce((sum, area) => sum + area.num_permits, 0)

  // highest permit count in any single area — used for shading and the UI stat
  // guard against empty array: Math.max() with no args returns -Infinity
  const maxNumPermits =
    currentYearData.length > 0
      ? Math.max(...currentYearData.map((area) => area.num_permits))
      : 0

  function getColor(percentageOfPermits) {
    // divide 0-100% into 4 equal buckets, each mapped to a shade of blue
    // communityAreaColors goes from lightest (#eff3ff) to darkest (#2171b5)
    if (percentageOfPermits > 75) return communityAreaColors[3]
    if (percentageOfPermits > 50) return communityAreaColors[2]
    if (percentageOfPermits > 25) return communityAreaColors[1]
    return communityAreaColors[0]
  }

  function setAreaInteraction(feature, layer) {
    // feature.properties.community is uppercase e.g. "ROGERS PARK"
    // currentYearData area.name is title case e.g. "Rogers Park"
    // compare lowercase to match them reliably
    const areaData = currentYearData.find(
      (area) =>
        area.name.toLowerCase() === feature.properties.community.toLowerCase()
    )

    const numPermits = areaData ? areaData.num_permits : 0

    // shade the area relative to the busiest area this year
    const percentage = maxNumPermits > 0 ? (numPermits / maxNumPermits) * 100 : 0
    layer.setStyle({
      fillColor: getColor(percentage),
      fillOpacity: 0.7,
      color: "black",  // border color — changed from white to black for visible area boundaries
      weight: 1.5,     // border width
    })

    // show a popup on hover with the area name and permit count
    layer.on("mouseover", () => {
      layer.bindPopup(
        `<strong>${feature.properties.community}</strong><br>Permits: ${numPermits}`
      )
      layer.openPopup()
    })
  }

  return (
    <>
      <YearSelect filterVal={year} setFilterVal={setYear} />
      <p className="fs-4">
        Restaurant permits issued this year: {totalPermits}
      </p>
      <p className="fs-4">
        Maximum number of restaurant permits in a single area: {maxNumPermits}
      </p>
      <MapContainer
        id="restaurant-map"
        center={[41.88, -87.62]}
        zoom={10}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png"
        />
        {currentYearData.length > 0 ? (
          <GeoJSON
            data={RAW_COMMUNITY_AREAS}
            onEachFeature={setAreaInteraction}
            key={maxNumPermits}
          />
        ) : null}
      </MapContainer>
    </>
  )
}

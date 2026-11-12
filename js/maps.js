(() => {
  const MAP_CENTER = [28.408, 77.31];
  const DEFAULT_FARIDABAD_COORDINATES = [28.395, 77.315];
  const WALKING_SPEED_KMH = 5;
  const listingsMaps = new WeakMap();

  function getCoordinates(location) {
    if (!location) return null;
    const rawLatitude = location.latitude ?? location.lat;
    const rawLongitude = location.longitude ?? location.lng ?? location.lon;
    if (rawLatitude === null || rawLatitude === undefined || rawLatitude === '' ||
        rawLongitude === null || rawLongitude === undefined || rawLongitude === '') return null;
    const latitude = Number(rawLatitude);
    const longitude = Number(rawLongitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
        latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return null;
    }
    return [latitude, longitude];
  }

  function getPropertyCoordinates(property) {
    const coordinates = getCoordinates(property);
    if (coordinates) return coordinates;

    const campusCoordinates = getCoordinates(getCollege(property?.collegeId)) || DEFAULT_FARIDABAD_COORDINATES;
    const key = String(property?.id || property?.title || property?.address || '');
    let hash = 0;
    for (let index = 0; index < key.length; index += 1) {
      hash = (hash * 31 + key.charCodeAt(index)) | 0;
    }

    const angle = (Math.abs(hash) % 360) * Math.PI / 180;
    const radius = 0.002 + (Math.abs(hash >> 8) % 5) * 0.001;
    return [
      campusCoordinates[0] + Math.sin(angle) * radius,
      campusCoordinates[1] + Math.cos(angle) * radius
    ];
  }

  function getCollege(collegeId) {
    return (window.RENTDIRECT_CONFIG?.COLLEGES || []).find(college => college.id === collegeId) || null;
  }

  function getDistanceKm(property, collegeId) {
    if (property.collegeId === collegeId) {
      const sourceDistance = String(property.distanceToCollege || '').match(/([\d.]+)\s*(km|m)\b/i);
      if (sourceDistance) {
        const distance = Number(sourceDistance[1]);
        if (Number.isFinite(distance)) {
          return sourceDistance[2].toLowerCase() === 'm' ? distance / 1000 : distance;
        }
      }
    }

    const propertyCoordinates = getPropertyCoordinates(property);
    const college = getCollege(collegeId);
    const collegeCoordinates = getCoordinates(college);

    if (propertyCoordinates && collegeCoordinates) {
      const radians = degrees => degrees * Math.PI / 180;
      const [lat1, lon1] = propertyCoordinates.map(radians);
      const [lat2, lon2] = collegeCoordinates.map(radians);
      const deltaLat = lat2 - lat1;
      const deltaLon = lon2 - lon1;
      const a = Math.sin(deltaLat / 2) ** 2 +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
      return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    return null;
  }

  function getCommuteEstimate(property, collegeId) {
    const distanceKm = getDistanceKm(property, collegeId);
    if (distanceKm === null) return null;
    const walkingMinutes = Math.max(1, Math.round(distanceKm / WALKING_SPEED_KMH * 60));
    const fareLow = Math.round((20 + distanceKm * 12) * 2 / 5) * 5;
    const fareHigh = Math.round((30 + distanceKm * 18) * 2 / 5) * 5;
    const distanceLabel = distanceKm.toFixed(2).replace(/\.?0+$/, '');
    return {
      distance: `${distanceLabel} km`,
      walkingTime: `${walkingMinutes} min`,
      dailyFare: `₹${fareLow}–₹${fareHigh}`,
      approximate: !getCoordinates(property)
    };
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[character]);
  }

  function getLeaflet() {
    return window.L || null;
  }

  function addBaseTiles(map, leaflet) {
    leaflet.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri'
    }).addTo(map);
  }

  function createIcon(leaflet, kind) {
    return leaflet.divIcon({
      className: `rentdirect-map-pin rentdirect-map-pin-${kind}`,
      html: '<span></span>',
      iconSize: [20, 20],
      iconAnchor: [10, 10],
      popupAnchor: [0, -10]
    });
  }

  function addCollegeMarkers(map, leaflet, selectedCollegeId, layer = map) {
    const collegeIcon = createIcon(leaflet, 'college');
    const markers = [];
    (window.RENTDIRECT_CONFIG?.COLLEGES || []).forEach(college => {
      const coordinates = getCoordinates(college);
      if (!coordinates) return;
      const selected = college.id === selectedCollegeId;
      const marker = leaflet.marker(coordinates, { icon: collegeIcon, zIndexOffset: selected ? 1000 : 0 })
        .bindPopup(`<strong>${escapeHtml(college.shortName || college.name)}</strong><br>${escapeHtml(college.location)}<br><span>College campus · approximate pin</span>`);
      marker.collegeId = college.id;
      marker.addTo(layer);
      markers.push(marker);
    });
    return markers;
  }

  function setMapUnavailable(container, message) {
    if (container) {
      container.innerHTML = `<p class="map-unavailable">${escapeHtml(message)}</p>`;
    }
    return null;
  }

  function createListingsMap(container, properties, selectedCollegeId) {
    const leaflet = getLeaflet();
    if (!leaflet) return setMapUnavailable(container, 'The map could not load. Check your connection and refresh the page.');

    let state = listingsMaps.get(container);
    if (!state) {
      const map = leaflet.map(container, { scrollWheelZoom: false }).setView(MAP_CENTER, 11);
      addBaseTiles(map, leaflet);
      const markerLayer = leaflet.layerGroup().addTo(map);
      state = { map, markerLayer };
      listingsMaps.set(container, state);
    }

    const { map, markerLayer } = state;
    if (map.getContainer() !== container) return null;
    markerLayer.clearLayers();
    const markers = addCollegeMarkers(map, leaflet, selectedCollegeId, markerLayer);
    const propertyIcon = createIcon(leaflet, 'property');

    properties.forEach(property => {
      const coordinates = getPropertyCoordinates(property);
      const title = escapeHtml(property.title || 'PG listing');
      const href = `property-details.html?id=${encodeURIComponent(property.id)}`;
      const marker = leaflet.marker(coordinates, { icon: propertyIcon })
        .bindPopup(`<strong>${title}</strong><br>${escapeHtml(property.address || '')}<br><span>Approximate listing pin</span><br><a href="${href}">View listing →</a>`);
      marker.addTo(markerLayer);
      markers.push(marker);
    });

    if (markers.length) {
      const bounds = leaflet.featureGroup(markers).getBounds();
      if (bounds.isValid()) map.fitBounds(bounds.pad(0.12), { maxZoom: selectedCollegeId ? 14 : 12 });
    }
    return map;
  }

  function createPropertyMap(container, property) {
    const leaflet = getLeaflet();
    if (!leaflet) return setMapUnavailable(container, 'The map could not load. Check your connection and refresh the page.');
    const coordinates = getPropertyCoordinates(property);

    const map = leaflet.map(container, { scrollWheelZoom: false }).setView(coordinates, 15);
    addBaseTiles(map, leaflet);
    const propertyIcon = createIcon(leaflet, 'property');
    const propertyMarker = leaflet.marker(coordinates, { icon: propertyIcon })
      .bindPopup(`<strong>${escapeHtml(property.title || 'PG listing')}</strong><br>${escapeHtml(property.address || '')}<br><span>Approximate listing pin</span>`)
      .addTo(map);
    const collegeMarkers = addCollegeMarkers(map, leaflet, property.collegeId);
    const selectedCollegeMarker = collegeMarkers.find(marker => marker.collegeId === property.collegeId);
    if (selectedCollegeMarker) {
      const bounds = leaflet.featureGroup([propertyMarker, selectedCollegeMarker]).getBounds();
      map.fitBounds(bounds, { padding: [28, 28], maxZoom: 15 });
    }
    return map;
  }

  window.RentDirectMap = {
    createListingsMap,
    createPropertyMap,
    hasCoordinates: location => Boolean(getCoordinates(location) || getPropertyCoordinates(location)),
    getCommuteEstimate
  };
})();

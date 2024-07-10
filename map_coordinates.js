// map_coordinates.js
(function() {
  function waitForMapDiv(callback, maxAttempts = 10, interval = 1000) {
    let attempts = 0;
    const checkForMapDiv = () => {
      const mapDiv = document.querySelector('#scene, .scene, [aria-label="Map"]');
      if (mapDiv) {
        callback(mapDiv);
      } else if (attempts < maxAttempts) {
        attempts++;
        setTimeout(checkForMapDiv, interval);
      } else {
        console.error('Map div not found after maximum attempts');
        window.postMessage({ type: 'MAP_COORDINATES', error: 'Map div not found after maximum attempts' }, '*');
      }
    };
    checkForMapDiv();
  }

  function getCoordinates(left, top, width, height) {
    waitForMapDiv((mapDiv) => {
      try {
        const mapRect = mapDiv.getBoundingClientRect();
        const mapWidth = mapRect.width;
        const mapHeight = mapRect.height;

        // Get the current viewport bounds
        const bounds = getViewportBounds();
        if (!bounds) throw new Error('Unable to get map bounds');

        // Calculate relative positions
        const relativeLeft = left / mapWidth;
        const relativeTop = top / mapHeight;
        const relativeRight = (left + width) / mapWidth;
        const relativeBottom = (top + height) / mapHeight;

        // Interpolate to get lat/lng
        const topLeft = interpolateLatLng(bounds.north, bounds.south, bounds.west, bounds.east, relativeTop, relativeLeft);
        const bottomRight = interpolateLatLng(bounds.north, bounds.south, bounds.west, bounds.east, relativeBottom, relativeRight);

        const coords = {
          topLeft: { lat: topLeft.lat, lng: topLeft.lng },
          bottomRight: { lat: bottomRight.lat, lng: bottomRight.lng }
        };

        window.postMessage({ type: 'MAP_COORDINATES', coords: coords }, '*');
      } catch (error) {
        console.error('Error getting coordinates:', error);
        window.postMessage({ type: 'MAP_COORDINATES', error: error.message }, '*');
      }
    });
  }

  function getViewportBounds() {
    const script = document.createElement('script');
    script.textContent = `
      var bounds = document.querySelector('meta[property="og:image"]').content.match(/center=([^&]+)&zoom=([^&]+)/);
      if (bounds) {
        var center = bounds[1].split('%2C').map(Number);
        var zoom = Number(bounds[2]);
        var latRange = 180 / Math.pow(2, zoom);
        var lngRange = 360 / Math.pow(2, zoom);
        window.mapBounds = {
          north: center[0] + latRange / 2,
          south: center[0] - latRange / 2,
          east: center[1] + lngRange / 2,
          west: center[1] - lngRange / 2
        };
      }
    `;
    document.body.appendChild(script);
    document.body.removeChild(script);
    return window.mapBounds;
  }

  function interpolateLatLng(north, south, west, east, y, x) {
    const lat = north - (north - south) * y;
    const lng = west + (east - west) * x;
    return { lat, lng };
  }

  window.addEventListener('message', function(event) {
    if (event.data.type === 'GET_COORDINATES') {
      const { left, top, width, height } = event.data;
      getCoordinates(left, top, width, height);
    }
  });

  console.log('map_coordinates.js loaded and waiting for messages');
})();
// content.js
(function() {
  let isSelecting = false;
  let isDrawing = false;
  let startPoint, endPoint;
  let selectionOverlay;
  let mapElement;
  let ratioMode = 'free'; // 'free', '1:1', or '2:1'

  function initializeMapSelector() {
    mapElement = document.getElementById('scene');
    if (!mapElement) {
      console.error('Map element not found');
      return;
    }

    selectionOverlay = document.createElement('div');
    selectionOverlay.id = 'map-selection-overlay';
    mapElement.appendChild(selectionOverlay);

    const controlsDiv = document.createElement('div');
    controlsDiv.id = 'map-selector-controls';
    controlsDiv.innerHTML = `
      <button id="map-selector-button">Start Selection</button>
      <select id="ratio-mode-select">
        <option value="free">Free Selection</option>
        <option value="1:1">1:1 Ratio</option>
        <option value="2:1">2:1 Ratio</option>
      </select>
      <button id="capture-button" style="display:none;">Capture Selection</button>
    `;
    document.body.appendChild(controlsDiv);

    document.getElementById('map-selector-button').onclick = toggleSelection;
    document.getElementById('ratio-mode-select').onchange = changeRatioMode;
    document.getElementById('capture-button').onclick = captureSelection;

    mapElement.addEventListener('mousedown', startDrawing);
    document.addEventListener('mousemove', updateDrawing);
    document.addEventListener('mouseup', endDrawing);

    // Inject map_coordinates.js
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('map_coordinates.js');
    (document.head || document.documentElement).appendChild(script);
  }

  function toggleSelection() {
    isSelecting = !isSelecting;
    const button = document.getElementById('map-selector-button');
    const captureButton = document.getElementById('capture-button');
    if (isSelecting) {
      button.textContent = 'Stop Selection';
      selectionOverlay.style.display = 'block';
      captureButton.style.display = 'inline-block';
      disableMapInteractions(true);
    } else {
      button.textContent = 'Start Selection';
      selectionOverlay.style.display = 'none';
      captureButton.style.display = 'none';
      clearSelection();
      disableMapInteractions(false);
    }
  }

  function changeRatioMode(e) {
    ratioMode = e.target.value;
    if (startPoint && endPoint) {
      updateDrawing({ clientX: endPoint.x, clientY: endPoint.y });
    }
  }

  function startDrawing(e) {
    if (!isSelecting) return;
    isDrawing = true;
    const rect = mapElement.getBoundingClientRect();
    startPoint = { 
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
    endPoint = { ...startPoint };
    drawSelection();
    e.preventDefault();
    e.stopPropagation();
  }

  function updateDrawing(e) {
    if (!isSelecting || !isDrawing) return;
    const rect = mapElement.getBoundingClientRect();
    endPoint = { 
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
    applyRatioConstraint();
    drawSelection();
    e.preventDefault();
    e.stopPropagation();
  }

  function applyRatioConstraint() {
    let width = Math.abs(endPoint.x - startPoint.x);
    let height = Math.abs(endPoint.y - startPoint.y);

    if (ratioMode === '1:1') {
      const size = Math.min(width, height);
      width = height = size;
    } else if (ratioMode === '2:1') {
      if (width > height * 2) {
        width = height * 2;
      } else {
        height = width / 2;
      }
    }

    const directionX = endPoint.x > startPoint.x ? 1 : -1;
    const directionY = endPoint.y > startPoint.y ? 1 : -1;

    endPoint.x = startPoint.x + (width * directionX);
    endPoint.y = startPoint.y + (height * directionY);
  }

  function drawSelection() {
    const left = Math.min(startPoint.x, endPoint.x);
    const top = Math.min(startPoint.y, endPoint.y);
    const width = Math.abs(endPoint.x - startPoint.x);
    const height = Math.abs(endPoint.y - startPoint.y);

    selectionOverlay.style.left = left + 'px';
    selectionOverlay.style.top = top + 'px';
    selectionOverlay.style.width = width + 'px';
    selectionOverlay.style.height = height + 'px';

    // Change color based on ratio
    const currentRatio = width / height;
    if (ratioMode === 'free' || 
        (ratioMode === '1:1' && Math.abs(currentRatio - 1) < 0.1) ||
        (ratioMode === '2:1' && Math.abs(currentRatio - 2) < 0.1)) {
      selectionOverlay.style.borderColor = 'green';
      selectionOverlay.style.backgroundColor = 'rgba(0, 255, 0, 0.1)';
    } else {
      selectionOverlay.style.borderColor = 'red';
      selectionOverlay.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';
    }
  }

  function endDrawing(e) {
    if (!isSelecting || !isDrawing) return;
    isDrawing = false;
    console.log('Selection made:', startPoint, endPoint);
    e.preventDefault();
    e.stopPropagation();
  }

  function clearSelection() {
    selectionOverlay.style.width = '0';
    selectionOverlay.style.height = '0';
    startPoint = null;
    endPoint = null;
  }

  function disableMapInteractions(disable) {
    const mapInteractionOverlay = document.getElementById('map-interaction-overlay') || document.createElement('div');
    mapInteractionOverlay.id = 'map-interaction-overlay';
    
    if (disable) {
      mapInteractionOverlay.style.position = 'absolute';
      mapInteractionOverlay.style.top = '0';
      mapInteractionOverlay.style.left = '0';
      mapInteractionOverlay.style.width = '100%';
      mapInteractionOverlay.style.height = '100%';
      mapInteractionOverlay.style.zIndex = '1000';
      mapElement.appendChild(mapInteractionOverlay);
    } else {
      if (mapInteractionOverlay.parentNode) {
        mapInteractionOverlay.parentNode.removeChild(mapInteractionOverlay);
      }
    }
  }

  function captureSelection() {
    if (!startPoint || !endPoint) {
      alert('Please make a selection first.');
      return;
    }

    const mapRect = mapElement.getBoundingClientRect();
    const left = Math.min(startPoint.x, endPoint.x);
    const top = Math.min(startPoint.y, endPoint.y);
    const width = Math.abs(endPoint.x - startPoint.x);
    const height = Math.abs(endPoint.y - startPoint.y);

    // Capture screenshot
    chrome.runtime.sendMessage({
      action: 'captureScreenshot',
      area: { 
        x: Math.round(mapRect.left + left),
        y: Math.round(mapRect.top + top),
        width: Math.round(width),
        height: Math.round(height)
      }
    }, response => {
      if (response && response.success) {
        downloadImage(response.imageData, 'map_selection.png');
      } else {
        console.error('Failed to capture screenshot:', response ? response.error : 'Unknown error');
        alert('Failed to capture screenshot. Please try again.');
      }
    });

    // Extract GPS coordinates
    getMapCoordinates(left, top, width, height);
  }

  function getMapCoordinates(left, top, width, height) {
    console.log('Initializing map coordinates selection');
    window.postMessage({ 
      type: 'GET_COORDINATES', 
      left: left, 
      top: top, 
      width: width, 
      height: height 
    }, '*');
  }

  function downloadImage(dataUrl, filename) {
    if (!dataUrl) {
      console.error('No image data received');
      alert('Failed to capture image. Please try again.');
      return;
    }
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    link.click();
  }

  function downloadText(text, filename) {
    console.log('Attempting to download text:', text, 'with filename:', filename);
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    console.log('Created download link:', link);
    link.click();
    console.log('Triggered click on download link');
    URL.revokeObjectURL(url);
  }

  window.addEventListener('message', function(event) {
    if (event.data.type === 'MAP_COORDINATES') {
      console.log('Received MAP_COORDINATES message:', event.data);
      if (event.data.error) {
        console.error('Error extracting GPS coordinates:', event.data.error);
        alert(`Failed to extract GPS coordinates: ${event.data.error}. Please try again.`);
      } else if (event.data.coords && event.data.coords.topLeft && event.data.coords.bottomRight) {
        console.log('Map coordinates:', event.data.coords);
        const coordsText = `Top Left: ${event.data.coords.topLeft.lat.toFixed(6)}, ${event.data.coords.topLeft.lng.toFixed(6)}\nBottom Right: ${event.data.coords.bottomRight.lat.toFixed(6)}, ${event.data.coords.bottomRight.lng.toFixed(6)}`;
        console.log('Coordinates text:', coordsText);
        downloadText(coordsText, 'coordinates.txt');
      } else {
        console.error('Unexpected response format for MAP_COORDINATES');
        alert('Unexpected error occurred while extracting GPS coordinates. Please try again.');
      }
    }
  });

  // New message listener for scroll and zoom information
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getScrollAndZoom') {
      const zoom = window.devicePixelRatio;
      sendResponse({
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        zoom: zoom
      });
    }
  });

  // Call initializeMapSelector when the DOM is ready
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initializeMapSelector();
  } else {
    document.addEventListener('DOMContentLoaded', initializeMapSelector);
  }
})();
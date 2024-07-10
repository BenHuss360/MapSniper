// background.js
chrome.action.onClicked.addListener((tab) => {
  if (tab.url.includes("google.com/maps")) {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });
    chrome.scripting.insertCSS({
      target: { tabId: tab.id },
      files: ['styles.css']
    });
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'captureScreenshot') {
    chrome.tabs.captureVisibleTab(null, {format: 'png'}, function(dataUrl) {
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError);
        sendResponse({success: false, error: chrome.runtime.lastError.message});
        return;
      }

      // Get the current tab's scroll position and zoom level
      chrome.tabs.sendMessage(sender.tab.id, {action: 'getScrollAndZoom'}, function(response) {
        if (chrome.runtime.lastError) {
          console.error(chrome.runtime.lastError);
          sendResponse({success: false, error: chrome.runtime.lastError.message});
          return;
        }

        const scrollX = response.scrollX;
        const scrollY = response.scrollY;
        const zoom = response.zoom;

        // Adjust the crop area based on scroll position and zoom level
        const adjustedArea = {
          x: Math.round((request.area.x + scrollX) * zoom),
          y: Math.round((request.area.y + scrollY) * zoom),
          width: Math.round(request.area.width * zoom),
          height: Math.round(request.area.height * zoom)
        };

        // Convert dataUrl to ArrayBuffer
        fetch(dataUrl)
          .then(res => res.arrayBuffer())
          .then(buffer => createImageBitmap(new Blob([buffer])))
          .then(imageBitmap => {
            const canvas = new OffscreenCanvas(adjustedArea.width, adjustedArea.height);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(imageBitmap, 
              adjustedArea.x, adjustedArea.y, adjustedArea.width, adjustedArea.height, 
              0, 0, adjustedArea.width, adjustedArea.height
            );
            return canvas.convertToBlob();
          })
          .then(blob => {
            const reader = new FileReader();
            reader.onloadend = function() {
              sendResponse({success: true, imageData: reader.result});
            };
            reader.readAsDataURL(blob);
          })
          .catch(error => {
            console.error('Error processing screenshot:', error);
            sendResponse({success: false, error: error.message});
          });
      });
    });
    return true; // Indicates that the response is sent asynchronously
  }
});
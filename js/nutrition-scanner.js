
/* nutrition-scanner.js v1 — Sprint 26: ZXing.js Barcode Scanner */
var NutritionScanner = (function() {
  "use strict";
  var TAG = "[NutritionScanner]";
  var stream = null;
  var codeReader = null;

  function isSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  async function start(videoElement, onScanCallback, onErrorCallback) {
    if (!isSupported()) {
      onErrorCallback && onErrorCallback('Camera not supported');
      return false;
    }
    
    if (typeof ZXing === 'undefined') {
      onErrorCallback && onErrorCallback('ZXing not loaded');
      return false;
    }
    
    try {
      // Request camera
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' } // back camera
      });
      
      videoElement.srcObject = stream;
      await videoElement.play();
      
      // Setup ZXing reader
      var hints = new Map();
      var formats = [
        ZXing.BarcodeFormat.EAN_13,
        ZXing.BarcodeFormat.EAN_8,
        ZXing.BarcodeFormat.UPC_A,
        ZXing.BarcodeFormat.UPC_E,
        ZXing.BarcodeFormat.CODE_128
      ];
      hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, formats);
      
      codeReader = new ZXing.BrowserMultiFormatReader(hints);
      
      // Start decoding
      codeReader.decodeFromVideoDevice(null, videoElement, function(result, err) {
        if (result) {
          var barcode = result.getText();
          console.log(TAG, 'Scanned:', barcode);
          stop();
          onScanCallback && onScanCallback(barcode);
        }
        // Ignore "NotFoundException" — to są normalne frames bez barcode
        if (err && err.name && err.name !== 'NotFoundException') {
          console.warn(TAG, 'Scan error:', err);
        }
      });
      
      return true;
    } catch(e) {
      console.error(TAG, 'Camera start error:', e);
      onErrorCallback && onErrorCallback(e.message);
      return false;
    }
  }

  function stop() {
    try {
      if (codeReader) {
        codeReader.reset();
        codeReader = null;
      }
      if (stream) {
        stream.getTracks().forEach(function(t) { t.stop(); });
        stream = null;
      }
    } catch(e) { console.warn(TAG, 'Stop error:', e); }
  }

  return {
    isSupported: isSupported,
    start: start,
    stop: stop
  };
})();

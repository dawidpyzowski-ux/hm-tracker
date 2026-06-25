
/* ocr-label-scanner.js v1 — Sprint 26.6: Cloudflare AI Vision OCR */
var OCRLabelScanner = (function() {
  "use strict";
  var TAG = "[OCR]";
  var WORKER_URL = "https://hm-tracker-ai.dawid-pyzowski.workers.dev";
  var stream = null;
  
  function isSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }
  
  async function startCamera(videoElement) {
    if (!isSupported()) throw new Error('Camera not supported');
    
    stream = await navigator.mediaDevices.getUserMedia({
      video: { 
        facingMode: 'environment',
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    });
    
    videoElement.srcObject = stream;
    await videoElement.play();
    return stream;
  }
  
  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach(function(t) { t.stop(); });
      stream = null;
    }
  }
  
  function captureFrame(videoElement) {
    var canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    var ctx = canvas.getContext('2d');
    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
    return canvas;
  }
  
  function canvasToBlob(canvas) {
    return new Promise(function(resolve) {
      canvas.toBlob(function(blob) { resolve(blob); }, 'image/jpeg', 0.85);
    });
  }
  
  async function blobToBase64(blob) {
    return new Promise(function(resolve) {
      var reader = new FileReader();
      reader.onloadend = function() {
        var base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.readAsDataURL(blob);
    });
  }
  
  // ============================================
  // ANALYZE LABEL via Cloudflare Llama Vision
  // ============================================
  async function analyzeImage(blob) {
    try {
      var base64 = await blobToBase64(blob);
      
      var resp = await fetch(WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'label-ocr',
          image_base64: base64
        })
      });
      
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      var data = await resp.json();
      
      if (data.error) throw new Error(data.error);
      
      return parseAIResponse(data.analysis);
    } catch(e) {
      console.error(TAG, 'Analyze error:', e);
      throw e;
    }
  }
  
  // Parsuj odpowiedź AI na strukturalne dane
  function parseAIResponse(text) {
    if (!text) return null;
    
    var result = {
      name: null,
      brand: null,
      per_100g: {
        calories: null,
        protein: null,
        carbs: null,
        fat: null,
        fiber: null,
        sugar: null,
        salt: null
      },
      raw_text: text
    };
    
    // Próbuj wyciągnąć JSON
    var jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        var parsed = JSON.parse(jsonMatch[0]);
        if (parsed.name) result.name = parsed.name;
        if (parsed.brand) result.brand = parsed.brand;
        if (parsed.calories !== undefined) result.per_100g.calories = parseFloat(parsed.calories);
        if (parsed.protein !== undefined) result.per_100g.protein = parseFloat(parsed.protein);
        if (parsed.carbs !== undefined) result.per_100g.carbs = parseFloat(parsed.carbs);
        if (parsed.fat !== undefined) result.per_100g.fat = parseFloat(parsed.fat);
        if (parsed.fiber !== undefined) result.per_100g.fiber = parseFloat(parsed.fiber);
        if (parsed.sugar !== undefined) result.per_100g.sugar = parseFloat(parsed.sugar);
        if (parsed.salt !== undefined) result.per_100g.salt = parseFloat(parsed.salt);
        return result;
      } catch(e) {
        console.warn(TAG, 'JSON parse failed, trying text patterns');
      }
    }
    
    // Fallback: regex patterns dla polskich etykiet
    var patterns = {
      calories: /(?:kalor[a-z]+|energi[a-z]+|wartość energetyczna)[:\s]*(\d+(?:[.,]\d+)?)\s*kcal/i,
      protein: /białko[:\s]*(\d+(?:[.,]\d+)?)\s*g/i,
      carbs: /(?:węglowodany|cukier ogółem)[:\s]*(\d+(?:[.,]\d+)?)\s*g/i,
      fat: /(?:tłuszcze?|tłuszcz)[:\s]*(\d+(?:[.,]\d+)?)\s*g/i,
      fiber: /błonnik[:\s]*(\d+(?:[.,]\d+)?)\s*g/i,
      sugar: /(?:cukier[y]?|cukier proste)[:\s]*(\d+(?:[.,]\d+)?)\s*g/i,
      salt: /(?:sól|so[ld])[:\s]*(\d+(?:[.,]\d+)?)\s*g/i
    };
    
    Object.keys(patterns).forEach(function(key) {
      var match = text.match(patterns[key]);
      if (match) {
        result.per_100g[key] = parseFloat(match[1].replace(',', '.'));
      }
    });
    
    return result;
  }
  
  function toProduct(ocrResult) {
    if (!ocrResult) return null;
    return {
      barcode: null,
      name: ocrResult.name || 'Produkt z etykiety',
      brand: ocrResult.brand || '',
      per_100g: ocrResult.per_100g,
      source: 'ocr_label'
    };
  }
  
  function calculatePortion(product, grams) {
    if (!product || !product.per_100g) return null;
    var p = product.per_100g;
    var r = grams / 100;
    return {
      calories: Math.round((p.calories || 0) * r),
      protein: +((p.protein || 0) * r).toFixed(1),
      carbs: +((p.carbs || 0) * r).toFixed(1),
      fat: +((p.fat || 0) * r).toFixed(1)
    };
  }
  
  return {
    isSupported: isSupported,
    startCamera: startCamera,
    stopCamera: stopCamera,
    captureFrame: captureFrame,
    canvasToBlob: canvasToBlob,
    analyzeImage: analyzeImage,
    parseAIResponse: parseAIResponse,
    toProduct: toProduct,
    calculatePortion: calculatePortion
  };
})();


/* ocr-label-scanner.js v2 — Sprint 26.6: Tesseract.js + AI Parse */
var OCRLabelScanner = (function() {
  "use strict";
  var TAG = "[OCR]";
  var WORKER_URL = "https://hm-tracker-ai.dawid-pyzowski.workers.dev";
  var stream = null;
  var tesseractWorker = null;
  
  function isSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }
  
  async function startCamera(videoElement) {
    if (!isSupported()) throw new Error('Camera not supported');
    
    stream = await navigator.mediaDevices.getUserMedia({
      video: { 
        facingMode: 'environment',
        width: { ideal: 1920 },
        height: { ideal: 1080 }
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
    
    // Preprocess: zwiększ kontrast dla lepszego OCR
    var imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    var data = imgData.data;
    for (var i = 0; i < data.length; i += 4) {
      var avg = (data[i] + data[i+1] + data[i+2]) / 3;
      // Threshold dla black/white (lepiej dla OCR tabel)
      var bw = avg > 140 ? 255 : (avg < 80 ? 0 : avg);
      data[i] = bw;
      data[i+1] = bw;
      data[i+2] = bw;
    }
    ctx.putImageData(imgData, 0, 0);
    
    return canvas;
  }
  
  // ============================================
  // TESSERACT.JS OCR (offline)
  // ============================================
  async function initTesseract(onProgress) {
    if (tesseractWorker) return tesseractWorker;
    if (typeof Tesseract === 'undefined') {
      throw new Error('Tesseract.js not loaded');
    }
    
    onProgress && onProgress('⏳ Pobieram model OCR (jednorazowo, ~3MB)...');
    
    tesseractWorker = await Tesseract.createWorker('pol', 1, {
      logger: function(m) {
        if (m.status === 'recognizing text' && onProgress) {
          onProgress('🔍 Czytam tekst... ' + Math.round(m.progress * 100) + '%');
        }
      }
    });
    
    return tesseractWorker;
  }
  
  async function extractTextFromImage(canvas, onProgress) {
    var worker = await initTesseract(onProgress);
    var result = await worker.recognize(canvas);
    return result.data.text;
  }
  
  // ============================================
  // AI PARSE — Cloudflare Llama 3.3 70B
  // ============================================
  async function parseTextWithAI(rawText) {
    try {
      var resp = await fetch(WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'nutrition-parse-text',
          text: rawText
        })
      });
      
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      var data = await resp.json();
      if (data.error) throw new Error(data.error);
      
      return parseAIResponse(data.analysis, rawText);
    } catch(e) {
      console.warn(TAG, 'AI parse error:', e);
      // Fallback: regex
      return parseRawTextWithRegex(rawText);
    }
  }
  
  function parseAIResponse(text, originalText) {
    var result = {
      name: null,
      brand: null,
      per_100g: { calories: null, protein: null, carbs: null, fat: null, fiber: null, sugar: null, salt: null },
      raw_text: originalText || text
    };
    
    var jsonMatch = text.match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
      try {
        var parsed = JSON.parse(jsonMatch[0]);
        if (parsed.name) result.name = parsed.name;
        if (parsed.brand) result.brand = parsed.brand;
        ['calories', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'salt'].forEach(function(key) {
          if (parsed[key] !== undefined && parsed[key] !== null) {
            var v = parseFloat(parsed[key]);
            if (!isNaN(v)) result.per_100g[key] = v;
          }
        });
        return result;
      } catch(e) {}
    }
    
    // Fallback regex
    return parseRawTextWithRegex(originalText || text);
  }
  
  // ============================================
  // REGEX fallback (jeśli AI nie zwróci JSON)
  // ============================================
  function parseRawTextWithRegex(text) {
    if (!text) return null;
    
    var result = {
      name: null,
      brand: null,
      per_100g: { calories: null, protein: null, carbs: null, fat: null, fiber: null, sugar: null, salt: null },
      raw_text: text
    };
    
    // Czyść tekst
    var cleaned = text.replace(/\s+/g, ' ').trim();
    
    // Patterns dla polskich etykiet
    var patterns = {
      calories: [
        /(?:wartość energetyczna|energia)[\s:]*(?:[\d.,]+\s*kJ?\s*\/?\s*)?(\d+(?:[.,]\d+)?)\s*kcal/i,
        /(\d+(?:[.,]\d+)?)\s*kcal/i,
        /energia[\s:]*(\d+(?:[.,]\d+)?)/i
      ],
      protein: [
        /białko[\s:]*(\d+(?:[.,]\d+)?)\s*g/i,
        /białka[\s:]*(\d+(?:[.,]\d+)?)\s*g/i,
        /protein[\s:]*(\d+(?:[.,]\d+)?)/i
      ],
      carbs: [
        /węglowodany[\s:]*(?:ogółem)?[\s:]*(\d+(?:[.,]\d+)?)\s*g/i,
        /(?:carbohydrate|carbs)[\s:]*(\d+(?:[.,]\d+)?)/i
      ],
      fat: [
        /tłuszcz[\s:]*(?:ogółem)?[\s:]*(\d+(?:[.,]\d+)?)\s*g/i,
        /tłuszcze[\s:]*(\d+(?:[.,]\d+)?)\s*g/i,
        /fat[\s:]*(\d+(?:[.,]\d+)?)/i
      ],
      fiber: [
        /błonnik[\s:]*(?:pokarmowy)?[\s:]*(\d+(?:[.,]\d+)?)\s*g/i,
        /fiber[\s:]*(\d+(?:[.,]\d+)?)/i
      ],
      sugar: [
        /w tym cukry[\s:]*(\d+(?:[.,]\d+)?)\s*g/i,
        /cukry[\s:]*(\d+(?:[.,]\d+)?)\s*g/i
      ],
      salt: [
        /sól[\s:]*(\d+(?:[.,]\d+)?)\s*g/i
      ]
    };
    
    Object.keys(patterns).forEach(function(key) {
      for (var i = 0; i < patterns[key].length; i++) {
        var match = cleaned.match(patterns[key][i]);
        if (match) {
          result.per_100g[key] = parseFloat(match[1].replace(',', '.'));
          break;
        }
      }
    });
    
    return result;
  }
  
  // ============================================
  // MAIN: analyze image (2-step pipeline)
  // ============================================
  async function analyzeImage(canvas, onProgress) {
    onProgress && onProgress('🔍 Czytam etykietę...');
    
    var rawText = await extractTextFromImage(canvas, onProgress);
    console.log(TAG, 'OCR raw text:', rawText.substring(0, 300));
    
    if (!rawText || rawText.length < 20) {
      throw new Error('Nie udało się odczytać tekstu z etykiety. Spróbuj lepszego oświetlenia.');
    }
    
    onProgress && onProgress('🤖 AI analizuje wartości odżywcze...');
    var result = await parseTextWithAI(rawText);
    
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
  
  function cleanupTesseract() {
    if (tesseractWorker) {
      try { tesseractWorker.terminate(); } catch(e) {}
      tesseractWorker = null;
    }
  }
  
  return {
    isSupported: isSupported,
    startCamera: startCamera,
    stopCamera: stopCamera,
    captureFrame: captureFrame,
    analyzeImage: analyzeImage,
    toProduct: toProduct,
    calculatePortion: calculatePortion,
    cleanupTesseract: cleanupTesseract,
    parseRawTextWithRegex: parseRawTextWithRegex
  };
})();

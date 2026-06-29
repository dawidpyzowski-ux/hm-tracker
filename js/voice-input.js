
/* voice-input.js v1 — Sprint 26.7: Web Speech API + AI Parse */
var VoiceInput = (function() {
  "use strict";
  var TAG = "[VoiceInput]";
  var WORKER_URL = "https://hm-tracker-ai.dawid-pyzowski.workers.dev";
  var recognition = null;
  var isListening = false;

  function isSupported() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  function createRecognition() {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;
    
    var r = new SR();
    r.lang = 'pl-PL';
    r.continuous = false;
    r.interimResults = true;
    r.maxAlternatives = 3;
    return r;
  }

  function start(callbacks) {
    callbacks = callbacks || {};
    
    if (!isSupported()) {
      callbacks.onError && callbacks.onError('Web Speech API nie wspierane na tym urządzeniu');
      return false;
    }
    
    if (isListening) {
      console.warn(TAG, 'Already listening');
      return false;
    }
    
    recognition = createRecognition();
    if (!recognition) {
      callbacks.onError && callbacks.onError('Nie udało się utworzyć rozpoznawania');
      return false;
    }
    
    var finalTranscript = '';
    
    recognition.onstart = function() {
      isListening = true;
      console.log(TAG, 'Listening started');
      callbacks.onStart && callbacks.onStart();
    };
    
    recognition.onresult = function(event) {
      var interim = '';
      var final = '';
      
      for (var i = event.resultIndex; i < event.results.length; i++) {
        var transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }
      
      if (interim) {
        callbacks.onInterim && callbacks.onInterim(interim);
      }
      if (final) {
        finalTranscript += final;
        callbacks.onFinal && callbacks.onFinal(finalTranscript);
      }
    };
    
    recognition.onerror = function(event) {
      isListening = false;
      console.warn(TAG, 'Error:', event.error);
      
      var msg = 'Błąd rozpoznawania';
      if (event.error === 'no-speech') msg = 'Nie wykryto mowy';
      else if (event.error === 'audio-capture') msg = 'Brak mikrofonu';
      else if (event.error === 'not-allowed') msg = 'Brak pozwolenia na mikrofon';
      else if (event.error === 'network') msg = 'Błąd sieci (Web Speech wymaga online)';
      else if (event.error === 'language-not-supported') msg = 'Polski nie wspierany';
      
      callbacks.onError && callbacks.onError(msg);
    };
    
    recognition.onend = function() {
      isListening = false;
      console.log(TAG, 'Listening ended');
      callbacks.onEnd && callbacks.onEnd(finalTranscript);
    };
    
    try {
      recognition.start();
      return true;
    } catch(e) {
      callbacks.onError && callbacks.onError('Nie można uruchomić: ' + e.message);
      return false;
    }
  }

  function stop() {
    if (recognition && isListening) {
      try { recognition.stop(); } catch(e) {}
    }
  }

  // ============================================
  // AI PARSE — transcript → meal data
  // ============================================

  async function parseTranscript(transcript) {
    if (!transcript || transcript.trim().length < 3) return null;
    
    var maxRetries = 3;
    var lastError = null;
    
    for (var attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        var resp = await fetch(WORKER_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'voice-parse',
            transcript: transcript
          })
        });
        
        if (resp.ok) {
          var data = await resp.json();
          if (data.error) throw new Error(data.error);
          return parseAIResponse(data.analysis, transcript);
        }
        
        // Retry on 5xx
        if (resp.status >= 500 && attempt < maxRetries) {
          console.warn(TAG, 'Server error ' + resp.status + ', retry ' + attempt + '/' + maxRetries);
          await new Promise(function(r) { setTimeout(r, 1500 * attempt); });
          continue;
        }
        
        var errData = await resp.json().catch(function() { return {}; });
        throw new Error('HTTP ' + resp.status + ': ' + (errData.error || 'unknown'));
      } catch(e) {
        lastError = e;
        if (attempt < maxRetries && (e.message.indexOf('HTTP 5') >= 0 || e.message.indexOf('Failed to fetch') >= 0)) {
          console.warn(TAG, 'Attempt ' + attempt + ' failed, retrying:', e.message);
          await new Promise(function(r) { setTimeout(r, 1500 * attempt); });
        } else if (attempt >= maxRetries) {
          break;
        } else {
          // Non-retryable error
          throw e;
        }
      }
    }
    
    throw lastError || new Error('Failed after ' + maxRetries + ' retries');
  }


  function parseAIResponse(text, originalTranscript) {
    if (!text) return null;
    
    var result = {
      transcript: originalTranscript,
      items: [],
      total: { calories: 0, protein: 0, carbs: 0, fat: 0 },
      raw_ai_response: text
    };
    
    // Spróbuj wyciągnąć JSON
    var jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    
    try {
      var parsed = JSON.parse(jsonMatch[0]);
      
      if (Array.isArray(parsed.items)) {
        parsed.items.forEach(function(item) {
          result.items.push({
            name: item.name || 'Składnik',
            quantity_g: parseFloat(item.quantity_g) || 100,
            calories: parseFloat(item.calories) || 0,
            protein: parseFloat(item.protein) || 0,
            carbs: parseFloat(item.carbs) || 0,
            fat: parseFloat(item.fat) || 0
          });
        });
      }
      
      if (parsed.total) {
        result.total.calories = parseFloat(parsed.total.calories) || 0;
        result.total.protein = parseFloat(parsed.total.protein) || 0;
        result.total.carbs = parseFloat(parsed.total.carbs) || 0;
        result.total.fat = parseFloat(parsed.total.fat) || 0;
      } else {
        // Calculate from items
        result.items.forEach(function(item) {
          result.total.calories += item.calories;
          result.total.protein += item.protein;
          result.total.carbs += item.carbs;
          result.total.fat += item.fat;
        });
        result.total.calories = Math.round(result.total.calories);
        result.total.protein = +result.total.protein.toFixed(1);
        result.total.carbs = +result.total.carbs.toFixed(1);
        result.total.fat = +result.total.fat.toFixed(1);
      }
      
      if (parsed.meal_name) {
        result.meal_name = parsed.meal_name;
      }
      
      return result;
    } catch(e) {
      console.warn(TAG, 'JSON parse failed:', e);
      return null;
    }
  }

  return {
    isSupported: isSupported,
    start: start,
    stop: stop,
    parseTranscript: parseTranscript,
    isListening: function() { return isListening; }
  };
})();

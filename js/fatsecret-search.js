
/* fatsecret-search.js v1 — Sprint 26.7 Workaround: Client-side OAuth */
var FatSecretSearch = (function() {
  "use strict";
  var TAG = "[FatSecret]";
  
  // ⚠️ TEMPORARY — Replace with your keys
  // Po Premier-Free → przeniesione do Cloudflare Worker
  var CONSUMER_KEY = window.FATSECRET_KEY || "";
  var CONSUMER_SECRET = window.FATSECRET_SECRET || "";
  
  var API_URL = "https://platform.fatsecret.com/rest/server.api";
  var CACHE_KEY = "fatsecret_cache";
  var CACHE_TTL = 7 * 86400000;
  
  function isConfigured() {
    return !!(CONSUMER_KEY && CONSUMER_SECRET);
  }
  
  function getCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); }
    catch(e) { return {}; }
  }
  
  function setCacheItem(key, value) {
    try {
      var cache = getCache();
      cache[key] = { value: value, ts: Date.now() };
      var keys = Object.keys(cache);
      if (keys.length > 200) {
        keys.sort(function(a,b) { return cache[a].ts - cache[b].ts; });
        for (var i = 0; i < 50; i++) delete cache[keys[i]];
      }
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch(e) {}
  }
  
  function getCached(key) {
    var c = getCache();
    if (c[key] && (Date.now() - c[key].ts) < CACHE_TTL) return c[key].value;
    return null;
  }
  
  // ============================================
  // OAuth 1.0 Signature (HMAC-SHA1)
  // ============================================
  function generateNonce(length) {
    length = length || 32;
    var chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    var result = '';
    for (var i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
  
  function percentEncode(str) {
    return encodeURIComponent(str)
      .replace(/!/g, '%21')
      .replace(/\*/g, '%2A')
      .replace(/'/g, '%27')
      .replace(/\(/g, '%28')
      .replace(/\)/g, '%29');
  }
  
  // HMAC-SHA1 implementation (browser native via SubtleCrypto)
  async function hmacSha1(key, data) {
    var enc = new TextEncoder();
    var keyData = enc.encode(key);
    var msgData = enc.encode(data);
    
    var cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-1" },
      false,
      ["sign"]
    );
    
    var signature = await crypto.subtle.sign("HMAC", cryptoKey, msgData);
    
    // Convert to base64
    var bytes = new Uint8Array(signature);
    var binary = '';
    for (var i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
  
  async function signRequest(method, url, params) {
    var oauthParams = {
      oauth_consumer_key: CONSUMER_KEY,
      oauth_nonce: generateNonce(),
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_version: '1.0'
    };
    
    // Combine all params for signature
    var allParams = Object.assign({}, params, oauthParams);
    
    // Sort and encode params
    var sortedKeys = Object.keys(allParams).sort();
    var paramString = sortedKeys.map(function(k) {
      return percentEncode(k) + '=' + percentEncode(allParams[k]);
    }).join('&');
    
    // Build signature base string
    var baseString = method.toUpperCase() + '&' + 
      percentEncode(url) + '&' + 
      percentEncode(paramString);
    
    // Signing key
    var signingKey = percentEncode(CONSUMER_SECRET) + '&';
    
    // HMAC-SHA1
    var signature = await hmacSha1(signingKey, baseString);
    
    // Add signature to oauth params
    oauthParams.oauth_signature = signature;
    
    return oauthParams;
  }
  
  // ============================================
  // PARSE PRODUCT
  // ============================================
  function parseFood(food) {
    if (!food) return null;
    
    var description = food.food_description || '';
    
    // Description format: "Per 100g - Calories: 165kcal | Fat: 4g | Carbs: 0g | Protein: 31g"
    // Albo per serving
    
    var per100g = { calories: null, protein: null, carbs: null, fat: null };
    
    // Try per 100g first
    var per100Match = description.match(/per 100g[^|]*calories[:\s]*(\d+(?:\.\d+)?)[^|]*?\|[^|]*?fat[:\s]*(\d+(?:\.\d+)?)[^|]*?\|[^|]*?carbs[:\s]*(\d+(?:\.\d+)?)[^|]*?\|[^|]*?protein[:\s]*(\d+(?:\.\d+)?)/i);
    
    if (per100Match) {
      per100g.calories = parseFloat(per100Match[1]);
      per100g.fat = parseFloat(per100Match[2]);
      per100g.carbs = parseFloat(per100Match[3]);
      per100g.protein = parseFloat(per100Match[4]);
    } else {
      // Try generic format
      var calMatch = description.match(/calories[:\s]*(\d+(?:\.\d+)?)/i);
      var protMatch = description.match(/protein[:\s]*(\d+(?:\.\d+)?)/i);
      var carbMatch = description.match(/carbs[:\s]*(\d+(?:\.\d+)?)/i);
      var fatMatch = description.match(/fat[:\s]*(\d+(?:\.\d+)?)/i);
      
      if (calMatch) per100g.calories = parseFloat(calMatch[1]);
      if (protMatch) per100g.protein = parseFloat(protMatch[1]);
      if (carbMatch) per100g.carbs = parseFloat(carbMatch[1]);
      if (fatMatch) per100g.fat = parseFloat(fatMatch[1]);
    }
    
    if (!per100g.calories) return null;
    
    return {
      barcode: null,
      name: food.food_name || 'FatSecret product',
      brand: food.brand_name || '',
      fdcId: food.food_id,
      per_100g: {
        calories: Math.round(per100g.calories),
        protein: per100g.protein !== null ? +per100g.protein.toFixed(1) : null,
        carbs: per100g.carbs !== null ? +per100g.carbs.toFixed(1) : null,
        fat: per100g.fat !== null ? +per100g.fat.toFixed(1) : null
      },
      source: 'fatsecret',
      description_raw: description
    };
  }
  
  // ============================================
  // SEARCH
  // ============================================
  async function search(query, options) {
    if (!isConfigured()) {
      console.warn(TAG, 'Not configured');
      return [];
    }
    
    if (!query || query.length < 2) return [];
    options = options || {};
    var limit = options.limit || 15;
    
    var cacheKey = 'q_' + query.toLowerCase().slice(0, 50);
    var cached = getCached(cacheKey);
    if (cached) return cached;
    
    try {
      var params = {
        method: 'foods.search',
        search_expression: query,
        max_results: limit.toString(),
        format: 'json'
      };
      
      var oauthParams = await signRequest('GET', API_URL, params);
      
      // Build URL with all params
      var allParams = Object.assign({}, params, oauthParams);
      var queryString = Object.keys(allParams).map(function(k) {
        return percentEncode(k) + '=' + percentEncode(allParams[k]);
      }).join('&');
      
      var url = API_URL + '?' + queryString;
      
      var resp = await fetch(url);
      if (!resp.ok) {
        console.warn(TAG, 'HTTP error:', resp.status);
        return [];
      }
      
      var data = await resp.json();
      
      if (data.error) {
        console.warn(TAG, 'API error:', data.error);
        return [];
      }
      
      var foods = data.foods?.food;
      if (!foods) return [];
      
      // foods can be array or single object
      var foodArray = Array.isArray(foods) ? foods : [foods];
      
      var products = foodArray.map(parseFood).filter(function(p) {
        return p && p.per_100g.calories !== null;
      });
      
      setCacheItem(cacheKey, products);
      return products;
    } catch(e) {
      console.warn(TAG, 'Search error:', e);
      return [];
    }
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
  
  function setConfig(key, secret) {
    CONSUMER_KEY = key;
    CONSUMER_SECRET = secret;
    try {
      localStorage.setItem('fatsecret_config', JSON.stringify({ key: key, secret: secret }));
    } catch(e) {}
  }
  
  // Load saved config
  try {
    var saved = JSON.parse(localStorage.getItem('fatsecret_config') || 'null');
    if (saved) {
      CONSUMER_KEY = saved.key;
      CONSUMER_SECRET = saved.secret;
    }
  } catch(e) {}
  
  return {
    isConfigured: isConfigured,
    setConfig: setConfig,
    search: search,
    calculatePortion: calculatePortion
  };
})();

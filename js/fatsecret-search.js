
/* fatsecret-search.js v2 — Sprint 26.7 PART 2: Worker proxy (SECURE) */
var FatSecretSearch = (function() {
  "use strict";
  var TAG = "[FatSecret]";
  var WORKER_URL = "https://hm-tracker-ai.dawid-pyzowski.workers.dev";
  var CACHE_KEY = "fatsecret_cache";
  var CACHE_TTL = 7 * 86400000;
  
  function isConfigured() {
    // No longer needs client config - Worker has keys
    return true;
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
  
  function parseFood(food) {
    if (!food) return null;
    
    var description = food.food_description || '';
    var per100g = { calories: null, protein: null, carbs: null, fat: null };
    
    var per100Match = description.match(/per 100g[^|]*calories[:\s]*(\d+(?:\.\d+)?)[^|]*?\|[^|]*?fat[:\s]*(\d+(?:\.\d+)?)[^|]*?\|[^|]*?carbs[:\s]*(\d+(?:\.\d+)?)[^|]*?\|[^|]*?protein[:\s]*(\d+(?:\.\d+)?)/i);
    
    if (per100Match) {
      per100g.calories = parseFloat(per100Match[1]);
      per100g.fat = parseFloat(per100Match[2]);
      per100g.carbs = parseFloat(per100Match[3]);
      per100g.protein = parseFloat(per100Match[4]);
    } else {
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
  
  async function search(query, options) {
    if (!query || query.length < 2) return [];
    options = options || {};
    var limit = options.limit || 15;
    
    var cacheKey = 'q_' + query.toLowerCase().slice(0, 50);
    var cached = getCached(cacheKey);
    if (cached) return cached;
    
    try {
      var resp = await fetch(WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'fatsecret-search',
          query: query,
          limit: limit
        })
      });
      
      if (!resp.ok) {
        var errData = await resp.json().catch(function() { return {}; });
        console.warn(TAG, 'HTTP error:', resp.status, errData);
        return [];
      }
      
      var data = await resp.json();
      
      if (data.error) {
        console.warn(TAG, 'API error:', data.error);
        return [];
      }
      
      var foods = data.foods?.food;
      if (!foods) return [];
      
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
  
  // Cleanup old client-side config (security)
  try {
    if (localStorage.getItem('fatsecret_config')) {
      localStorage.removeItem('fatsecret_config');
      console.log(TAG, 'Cleaned old client-side config (now using Worker)');
    }
  } catch(e) {}
  
  return {
    isConfigured: isConfigured,
    search: search,
    calculatePortion: calculatePortion
  };
})();

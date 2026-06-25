
/* yazio-search.js v1 — Sprint 26.6: Yazio search through Worker proxy */
var YazioSearch = (function() {
  "use strict";
  var TAG = "[YazioSearch]";
  var WORKER_URL = "https://hm-tracker-ai.dawid-pyzowski.workers.dev";
  var CREDS_KEY = "yazio_creds";
  var TOKEN_KEY = "yazio_token";
  var CACHE_KEY = "yazio_cache";
  var CACHE_TTL = 7 * 86400000;

  function getCreds() {
    try {
      return JSON.parse(localStorage.getItem(CREDS_KEY) || 'null');
    } catch(e) { return null; }
  }

  function setCreds(email, password) {
    try {
      localStorage.setItem(CREDS_KEY, JSON.stringify({ email: email, password: password }));
    } catch(e) {}
  }

  function clearCreds() {
    localStorage.removeItem(CREDS_KEY);
    localStorage.removeItem(TOKEN_KEY);
  }

  function getToken() {
    try {
      var t = JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null');
      if (!t || !t.access_token) return null;
      if (t.expires_at && Date.now() > t.expires_at - 60000) return null;
      return t;
    } catch(e) { return null; }
  }

  function setToken(token) {
    try {
      var expires = Date.now() + (token.expires_in || 3600) * 1000;
      localStorage.setItem(TOKEN_KEY, JSON.stringify({
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        expires_at: expires
      }));
    } catch(e) {}
  }

  function getCache() {
    try {
      return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    } catch(e) { return {}; }
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
    var cache = getCache();
    if (cache[key] && (Date.now() - cache[key].ts) < CACHE_TTL) {
      return cache[key].value;
    }
    return null;
  }

  // ============================================
  // LOGIN
  // ============================================
  async function login(email, password) {
    try {
      var resp = await fetch(WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'yazio-login',
          email: email,
          password: password
        })
      });
      
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      var data = await resp.json();
      
      if (data.error) throw new Error(data.error);
      if (!data.access_token) throw new Error('No token in response');
      
      setToken(data);
      setCreds(email, password);
      console.log(TAG, 'Login OK');
      return true;
    } catch(e) {
      console.warn(TAG, 'Login failed:', e);
      return false;
    }
  }

  async function refreshTokenIfNeeded() {
    var token = getToken();
    if (token) return token;
    
    var creds = getCreds();
    if (!creds) {
      console.warn(TAG, 'No credentials saved');
      return null;
    }
    
    var ok = await login(creds.email, creds.password);
    return ok ? getToken() : null;
  }

  function isLoggedIn() {
    return !!getCreds();
  }

  // ============================================
  // SEARCH
  // ============================================
  async function search(query, options) {
    if (!query || query.length < 2) return [];
    options = options || {};
    var limit = options.limit || 20;
    
    var cacheKey = 'q_' + query.toLowerCase().slice(0, 50);
    var cached = getCached(cacheKey);
    if (cached) {
      console.log(TAG, 'Cache hit:', query);
      return cached;
    }
    
    var token = await refreshTokenIfNeeded();
    if (!token) {
      console.warn(TAG, 'Not logged in');
      return [];
    }
    
    try {
      var resp = await fetch(WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'yazio-search',
          token: token.access_token,
          query: query,
          limit: limit
        })
      });
      
      if (!resp.ok) {
        console.warn(TAG, 'Search HTTP error:', resp.status);
        return [];
      }
      
      var data = await resp.json();
      if (data.error) {
        console.warn(TAG, 'Search error:', data.error);
        return [];
      }
      
      var products = (data.products || []).map(parseProduct).filter(function(p) {
        return p && p.per_100g.calories !== null;
      });
      
      setCacheItem(cacheKey, products);
      return products;
    } catch(e) {
      console.warn(TAG, 'Search exception:', e);
      return [];
    }
  }

  function parseProduct(item) {
    if (!item || !item.nutrients) return null;
    var n = item.nutrients;
    
    var caloriesPer100g = null;
    if (n['energy.energy']) caloriesPer100g = Math.round(n['energy.energy']);
    
    return {
      barcode: item.barcode || null,
      name: item.name || 'Yazio product',
      brand: item.producer || item.brand || '',
      per_100g: {
        calories: caloriesPer100g,
        protein: n['nutrient.protein'] !== undefined ? +n['nutrient.protein'].toFixed(1) : null,
        carbs: n['nutrient.carb'] !== undefined ? +n['nutrient.carb'].toFixed(1) : null,
        fat: n['nutrient.fat'] !== undefined ? +n['nutrient.fat'].toFixed(1) : null,
        fiber: n['nutrient.fiber'] !== undefined ? +n['nutrient.fiber'].toFixed(1) : null,
        sugar: n['nutrient.sugar'] !== undefined ? +n['nutrient.sugar'].toFixed(1) : null
      },
      serving_size: item.servings || null,
      source: 'yazio'
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
    login: login,
    isLoggedIn: isLoggedIn,
    clearCreds: clearCreds,
    search: search,
    calculatePortion: calculatePortion
  };
})();

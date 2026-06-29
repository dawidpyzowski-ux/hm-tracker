
/* nutrition-search.js v1 — Sprint 26: Open Food Facts + search */
var NutritionSearch = (function() {
  "use strict";
  var TAG = "[NutritionSearch]";
  var CACHE_KEY = "off_cache";
  var CACHE_MAX_AGE = 7 * 86400000; // 7 dni

  function getCache() {
    try {
      return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    } catch(e) { return {}; }
  }

  function setCache(key, value) {
    try {
      var cache = getCache();
      cache[key] = { value: value, ts: Date.now() };
      // Limit cache size (max 200 entries)
      var keys = Object.keys(cache);
      if (keys.length > 200) {
        keys.sort(function(a, b) { return cache[a].ts - cache[b].ts; });
        for (var i = 0; i < 50; i++) delete cache[keys[i]];
      }
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch(e) {}
  }

  function getCached(key) {
    var cache = getCache();
    if (cache[key] && (Date.now() - cache[key].ts) < CACHE_MAX_AGE) {
      return cache[key].value;
    }
    return null;
  }

  // ============================================
  // PARSE OFF product
  // ============================================
  function parseProduct(product) {
    if (!product) return null;
    var n = product.nutriments || {};
    return {
      barcode: product.code || product._id,
      name: product.product_name || product.product_name_pl || product.generic_name || 'Produkt bez nazwy',
      brand: product.brands || '',
      quantity: product.quantity || '',
      image_url: product.image_url || product.image_thumb_url || null,
      per_100g: {
        calories: parseFloat(n['energy-kcal_100g']) || parseFloat(n['energy-kcal']) || null,
        protein: parseFloat(n['proteins_100g']) || null,
        carbs: parseFloat(n['carbohydrates_100g']) || null,
        fat: parseFloat(n['fat_100g']) || null,
        fiber: parseFloat(n['fiber_100g']) || null,
        sugar: parseFloat(n['sugars_100g']) || null,
        salt: parseFloat(n['salt_100g']) || null
      },
      serving_size: product.serving_size || null,
      source: 'open_food_facts'
    };
  }

  // ============================================
  // GET BY BARCODE
  // ============================================
  async function getByBarcode(barcode) {
    if (!barcode) return null;
    
    // Cache hit?
    var cached = getCached('bc_' + barcode);
    if (cached) {
      console.log(TAG, 'Cache hit:', barcode);
      return cached;
    }
    
    try {
      var url = 'https://world.openfoodfacts.org/api/v0/product/' + barcode + '.json';
      var resp = await fetch(url);
      if (!resp.ok) return null;
      var data = await resp.json();
      
      if (data.status !== 1) {
        console.warn(TAG, 'Product not found:', barcode);
        return null;
      }
      
      var product = parseProduct(data.product);
      if (product && product.per_100g.calories !== null) {
        setCache('bc_' + barcode, product);
        return product;
      }
      
      return null;
    } catch(e) {
      console.warn(TAG, 'Barcode lookup error:', e);
      return null;
    }
  }

  // ============================================
  // SEARCH BY NAME
  // ============================================

  async function search(query, options) {
    if (!query || query.length < 2) return [];
    options = options || {};
    var pageSize = options.limit || 20;
    
    var cacheKey = 'q_' + query.toLowerCase();
    var cached = getCached(cacheKey);
    if (cached) return cached;
    
    
    try {
      // Przez Cloudflare Worker proxy (bypass CORS)
      var resp = await fetch('https://hm-tracker-ai.dawid-pyzowski.workers.dev', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'off-search',
          query: query,
          limit: pageSize
        })
      });
      
      if (!resp.ok) {
        console.warn(TAG, 'Search API returned:', resp.status);
        return [];
      }
      var data = await resp.json();
      
      if (data.error) {
        console.warn(TAG, 'Search error:', data.error);
        return [];
      }
      
      var products = (data.products || [])
        .map(parseProduct)
        .filter(function(p) {
          return p && p.per_100g.calories !== null && p.name !== 'Produkt bez nazwy';
        });
      
      setCache(cacheKey, products);
      return products;
    } catch(e) {
      console.warn(TAG, 'Search error:', e);
      return [];
    }



  // ============================================
  // CALCULATE for portion
  // ============================================
  function calculatePortion(product, grams) {
    if (!product || !product.per_100g) return null;
    var p = product.per_100g;
    var ratio = grams / 100;
    return {
      calories: Math.round((p.calories || 0) * ratio),
      protein: +((p.protein || 0) * ratio).toFixed(1),
      carbs: +((p.carbs || 0) * ratio).toFixed(1),
      fat: +((p.fat || 0) * ratio).toFixed(1),
      fiber: p.fiber !== null ? +((p.fiber) * ratio).toFixed(1) : null,
      sugar: p.sugar !== null ? +((p.sugar) * ratio).toFixed(1) : null
    };
  }

  return {
    getByBarcode: getByBarcode,
    search: search,
    parseProduct: parseProduct,
    calculatePortion: calculatePortion
  };
})();

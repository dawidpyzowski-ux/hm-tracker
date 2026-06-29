
/* fatsecret-search.js v4 — Sprint 26.7: Worker proxy + Polish translator */
var FatSecretSearch = (function() {
  "use strict";
  var TAG = "[FatSecret]";
  var WORKER_URL = "https://hm-tracker-ai.dawid-pyzowski.workers.dev";
  var CACHE_KEY = "fatsecret_cache";
  var CACHE_TTL = 7 * 86400000;
  
  // Polski → angielski (FatSecret API jest po angielsku)
  var POLISH_MAP = {
    'kurczak': 'chicken',
    'pierś kurczaka': 'chicken breast',
    'piers kurczaka': 'chicken breast',
    'indyk': 'turkey',
    'wołowina': 'beef',
    'wolowina': 'beef',
    'wieprzowina': 'pork',
    'łosoś': 'salmon',
    'losos': 'salmon',
    'tuńczyk': 'tuna',
    'tunczyk': 'tuna',
    'jajko': 'egg',
    'jajka': 'eggs',
    'mleko': 'milk',
    'ser': 'cheese',
    'twaróg': 'cottage cheese',
    'twarog': 'cottage cheese',
    'jogurt': 'yogurt',
    'masło': 'butter',
    'maslo': 'butter',
    'oliwa': 'olive oil',
    'olej': 'oil',
    'ryż': 'rice',
    'ryz': 'rice',
    'ryż brązowy': 'brown rice',
    'ryz brazowy': 'brown rice',
    'makaron': 'pasta',
    'chleb': 'bread',
    'kasza': 'groats',
    'kasza gryczana': 'buckwheat',
    'owsianka': 'oatmeal',
    'płatki owsiane': 'oats',
    'platki owsiane': 'oats',
    'banan': 'banana',
    'jabłko': 'apple',
    'jablko': 'apple',
    'pomarańcza': 'orange',
    'pomarancza': 'orange',
    'truskawki': 'strawberries',
    'borówki': 'blueberries',
    'borowki': 'blueberries',
    'awokado': 'avocado',
    'pomidor': 'tomato',
    'ogórek': 'cucumber',
    'ogorek': 'cucumber',
    'marchew': 'carrot',
    'brokuły': 'broccoli',
    'brokuly': 'broccoli',
    'szpinak': 'spinach',
    'ziemniaki': 'potato',
    'orzechy': 'nuts',
    'migdały': 'almonds',
    'migdaly': 'almonds',
    'orzechy włoskie': 'walnuts',
    'orzechy wloskie': 'walnuts',
    'orzeszki ziemne': 'peanuts',
    'pestki dyni': 'pumpkin seeds',
    'siemię lniane': 'flaxseed',
    'siemie lniane': 'flaxseed',
    'fasola': 'beans',
    'soczewica': 'lentils',
    'ciecierzyca': 'chickpeas',
    'czekolada': 'chocolate'
  };
  
  function translateQuery(query) {
    var q = query.toLowerCase().trim();
    if (POLISH_MAP[q]) return POLISH_MAP[q];
    for (var key in POLISH_MAP) {
      if (q.indexOf(key) >= 0) {
        return POLISH_MAP[key] + ' ' + q.replace(key, '').trim();
      }
    }
    return query;
  }
  
  function isConfigured() {
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
    
    if (per100g.calories > 900) {
      console.warn(TAG, 'Suspicious value, skipping:', food.food_name, per100g.calories);
      return null;
    }
    
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
    
    var searchQuery = translateQuery(query);
    if (searchQuery !== query) {
      console.log(TAG, 'Translated:', query, '→', searchQuery);
    }
    
    var cacheKey = 'q_' + searchQuery.toLowerCase().slice(0, 50);
    var cached = getCached(cacheKey);
    if (cached) return cached;
    
    try {
      var resp = await fetch(WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'fatsecret-search',
          query: searchQuery,
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
      
      if (!data.foods || !data.foods.food) return [];
      
      var foodArray = Array.isArray(data.foods.food) ? data.foods.food : [data.foods.food];
      
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
  
  try {
    if (localStorage.getItem('fatsecret_config')) {
      localStorage.removeItem('fatsecret_config');
    }
  } catch(e) {}
  
  return {
    isConfigured: isConfigured,
    search: search,
    calculatePortion: calculatePortion,
    translateQuery: translateQuery
  };
})();

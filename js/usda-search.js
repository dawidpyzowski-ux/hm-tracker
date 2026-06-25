
/* usda-search.js v1 — Sprint 26.6: USDA FoodData Central integration */
var USDASearch = (function() {
  "use strict";
  var TAG = "[USDA]";
  
  // USDA FoodData Central API
  // DARMOWE: limit 3600 req/h dla DEMO_KEY, lub bezpłatny klucz na https://api.data.gov/signup/
  var API_KEY = "DEMO_KEY";  // wystarczy dla naszego use case
  var BASE_URL = "https://api.nal.usda.gov/fdc/v1";
  var CACHE_KEY = "usda_cache";
  var CACHE_TTL = 30 * 86400000; // 30 dni
  
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
  
  // Mapowanie polskich nazw na angielskie (dla lepszych wyników USDA)
  var TRANSLATIONS = {
    'kurczak': 'chicken breast',
    'pierś z kurczaka': 'chicken breast raw',
    'kurczak grillowany': 'chicken breast grilled',
    'indyk': 'turkey breast',
    'wołowina': 'beef',
    'wieprzowina': 'pork',
    'łosoś': 'salmon',
    'tuńczyk': 'tuna',
    'jajko': 'egg whole raw',
    'jajka': 'eggs whole raw',
    'mleko': 'milk whole',
    'ser': 'cheese',
    'twaróg': 'cottage cheese',
    'jogurt': 'yogurt plain',
    'masło': 'butter',
    'oliwa': 'olive oil',
    'olej': 'vegetable oil',
    'ryż': 'rice brown raw',
    'ryż brązowy': 'rice brown cooked',
    'ryż biały': 'rice white cooked',
    'makaron': 'pasta cooked',
    'chleb': 'bread whole wheat',
    'kasza gryczana': 'buckwheat',
    'kasza jaglana': 'millet',
    'płatki owsiane': 'oats',
    'owsianka': 'oatmeal',
    'banan': 'banana raw',
    'jabłko': 'apple raw',
    'pomarańcza': 'orange raw',
    'truskawki': 'strawberries',
    'borówki': 'blueberries',
    'awokado': 'avocado raw',
    'pomidor': 'tomato raw',
    'ogórek': 'cucumber raw',
    'marchew': 'carrots raw',
    'brokuły': 'broccoli raw',
    'szpinak': 'spinach raw',
    'ziemniaki': 'potato boiled',
    'orzechy': 'mixed nuts',
    'migdały': 'almonds',
    'orzechy włoskie': 'walnuts',
    'orzechy nerkowca': 'cashews',
    'pestki dyni': 'pumpkin seeds',
    'siemię lniane': 'flaxseed',
    'cottage cheese': 'cottage cheese',
    'skyr': 'skyr yogurt',
    'fasola': 'beans',
    'soczewica': 'lentils',
    'ciecierzyca': 'chickpeas',
    'hummus': 'hummus',
    'kakao': 'cocoa powder',
    'czekolada': 'dark chocolate'
  };
  
  function translateQuery(query) {
    var q = query.toLowerCase().trim();
    if (TRANSLATIONS[q]) return TRANSLATIONS[q];
    // Częściowe matche
    for (var key in TRANSLATIONS) {
      if (q.indexOf(key) >= 0) {
        return TRANSLATIONS[key];
      }
    }
    return query; // bez tłumaczenia
  }
  
  // Polski label dla wyników (reverse mapping)
  var POLISH_LABELS = {
    'chicken breast': 'Pierś z kurczaka',
    'chicken breast raw': 'Pierś z kurczaka (surowa)',
    'chicken breast grilled': 'Pierś z kurczaka (grillowana)',
    'turkey breast': 'Pierś z indyka',
    'salmon': 'Łosoś',
    'tuna': 'Tuńczyk',
    'egg whole raw': 'Jajko całe',
    'milk whole': 'Mleko pełne',
    'rice brown raw': 'Ryż brązowy (surowy)',
    'rice brown cooked': 'Ryż brązowy (gotowany)',
    'rice white cooked': 'Ryż biały (gotowany)',
    'oats': 'Płatki owsiane',
    'banana raw': 'Banan',
    'apple raw': 'Jabłko',
    'avocado raw': 'Awokado',
    'almonds': 'Migdały',
    'walnuts': 'Orzechy włoskie'
  };
  
  function parseProduct(food) {
    if (!food) return null;
    
    var nutrients = {};
    var nutrientList = food.foodNutrients || [];
    
    nutrientList.forEach(function(n) {
      var name = n.nutrientName || n.nutrient?.name || '';
      var value = n.value !== undefined ? n.value : (n.amount !== undefined ? n.amount : null);
      if (value === null) return;
      
      var lower = name.toLowerCase();
      if (lower.indexOf('energy') >= 0 && lower.indexOf('kcal') >= 0) nutrients.calories = value;
      else if (lower === 'energy') nutrients.calories = value; // kcal default
      else if (lower.indexOf('protein') >= 0) nutrients.protein = value;
      else if (lower.indexOf('carbohydrate') >= 0 && lower.indexOf('fiber') < 0) nutrients.carbs = value;
      else if (lower.indexOf('total lipid') >= 0 || lower === 'total fat') nutrients.fat = value;
      else if (lower.indexOf('fiber') >= 0) nutrients.fiber = value;
      else if (lower.indexOf('sugars, total') >= 0) nutrients.sugar = value;
    });
    
    if (!nutrients.calories) return null;
    
    var origName = food.description || food.name || 'USDA food';
    var polishName = POLISH_LABELS[origName.toLowerCase()] || origName;
    
    return {
      barcode: food.gtinUpc || null,
      name: polishName,
      original_name: origName,
      brand: food.brandOwner || food.brandName || '',
      fdcId: food.fdcId,
      per_100g: {
        calories: Math.round(nutrients.calories),
        protein: nutrients.protein !== undefined ? +nutrients.protein.toFixed(1) : null,
        carbs: nutrients.carbs !== undefined ? +nutrients.carbs.toFixed(1) : null,
        fat: nutrients.fat !== undefined ? +nutrients.fat.toFixed(1) : null,
        fiber: nutrients.fiber !== undefined ? +nutrients.fiber.toFixed(1) : null,
        sugar: nutrients.sugar !== undefined ? +nutrients.sugar.toFixed(1) : null
      },
      data_type: food.dataType || 'unknown',
      source: 'usda'
    };
  }
  
  async function search(query, options) {
    if (!query || query.length < 2) return [];
    options = options || {};
    var limit = options.limit || 15;
    
    var translatedQuery = translateQuery(query);
    var cacheKey = 'q_' + translatedQuery.toLowerCase();
    var cached = getCached(cacheKey);
    if (cached) return cached;
    
    try {
      var url = BASE_URL + '/foods/search?' +
        'query=' + encodeURIComponent(translatedQuery) +
        '&pageSize=' + limit +
        '&dataType=Foundation,SR%20Legacy,Branded' +
        '&api_key=' + API_KEY;
      
      var resp = await fetch(url);
      if (!resp.ok) {
        console.warn(TAG, 'API error:', resp.status);
        return [];
      }
      
      var data = await resp.json();
      var foods = (data.foods || []).map(parseProduct).filter(function(p) {
        return p && p.per_100g.calories !== null;
      });
      
      // Preferuj Foundation Foods (najdokładniejsze)
      foods.sort(function(a, b) {
        var order = { 'Foundation': 1, 'SR Legacy': 2, 'Branded': 3 };
        return (order[a.data_type] || 4) - (order[b.data_type] || 4);
      });
      
      setCacheItem(cacheKey, foods);
      return foods;
    } catch(e) {
      console.warn(TAG, 'Search exception:', e);
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
  
  return {
    search: search,
    calculatePortion: calculatePortion,
    translateQuery: translateQuery
  };
})();

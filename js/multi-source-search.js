
/* multi-source-search.js v1 — Sprint 26.6: Orchestrate USDA + OFF + AI */
var MultiSourceSearch = (function() {
  "use strict";
  var TAG = "[MultiSearch]";
  
  // Zbiera ulubione z NutritionEngine
  function getFavorites(query) {
    if (typeof NutritionEngine === 'undefined') return [];
    var favs = NutritionEngine.getFavorites();
    if (!query) return favs.slice(0, 5);
    
    var q = query.toLowerCase();
    return favs.filter(function(f) {
      return (f.name || '').toLowerCase().indexOf(q) >= 0;
    }).slice(0, 5);
  }
  
  function getRecent(query, limit) {
    if (typeof NutritionEngine === 'undefined') return [];
    var recent = NutritionEngine.getRecent(20);
    if (!query) return recent.slice(0, limit || 5);
    
    var q = query.toLowerCase();
    return recent.filter(function(m) {
      return (m.name || '').toLowerCase().indexOf(q) >= 0;
    }).slice(0, limit || 5);
  }
  
  // Multi-source search (równolegle)
  async function search(query, options) {
    options = options || {};
    var perSource = options.limit || 10;
    
    if (!query || query.length < 2) {
      return {
        favorites: getFavorites(),
        recent: getRecent(null, 5),
        usda: [],
        openfoodfacts: [],
        total: 0
      };
    }
    
    var queryLower = query.toLowerCase().trim();
    
    // Run searches in parallel
    var promises = [
      // Open Food Facts
      typeof NutritionSearch !== 'undefined' ? 
        NutritionSearch.search(query, { limit: perSource }).catch(function() { return []; }) :
        Promise.resolve([]),
      
      // USDA
      typeof USDASearch !== 'undefined' ?
        USDASearch.search(query, { limit: perSource }).catch(function() { return []; }) :
        Promise.resolve([])
    ];
    
    var results = await Promise.all(promises);
    var off = results[0];
    var usda = results[1];
    
    return {
      favorites: getFavorites(query),
      recent: getRecent(query, 3),
      usda: usda,
      openfoodfacts: off,
      total: off.length + usda.length
    };
  }
  
  // Get product by barcode (cascade through sources)
  async function getByBarcode(barcode) {
    if (!barcode) return null;
    
    // Try OFF first (best for barcodes)
    if (typeof NutritionSearch !== 'undefined') {
      var off = await NutritionSearch.getByBarcode(barcode);
      if (off) return off;
    }
    
    return null;
  }
  
  return {
    search: search,
    getByBarcode: getByBarcode,
    getFavorites: getFavorites,
    getRecent: getRecent
  };
})();

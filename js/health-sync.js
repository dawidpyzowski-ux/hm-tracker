
/* health-sync.js v3 — Sprint 26: Health + Nutrition Cloud Sync via JSONBin */
var HealthSync = (function() {
  "use strict";

  var BIN_ID = "6a32eeddf5f4af5e2903de81";
  var API_KEY = "$2a$10$6NbODl6x2IbzQwZ4TV9OieTf5BG9zhHT54SibqBhcT/cUTUWsLxBS";
  var BASE_URL = "https://api.jsonbin.io/v3/b/" + BIN_ID;

  function getNutritionLogs() {
    try {
      return JSON.parse(localStorage.getItem('nutrition_logs') || '{}');
    } catch(e) { return {}; }
  }


  function getCaffeineLogs() {
    try { return JSON.parse(localStorage.getItem('caffeine_logs') || '{}'); }
    catch(e) { return {}; }
  }
  
  function getCaffeineSettings() {
    try { return JSON.parse(localStorage.getItem('caffeine_settings') || 'null'); }
    catch(e) { return null; }
  }

  
  function getNutritionSettings() {
    try {
      return JSON.parse(localStorage.getItem('nutrition_settings') || 'null');
    } catch(e) { return null; }
  }

  function getNutritionFavorites() {
    try {
      return JSON.parse(localStorage.getItem('nutrition_favorites') || '[]');
    } catch(e) { return []; }
  }

  async function push() {
    try {
      var healthData = HealthImport.getAll();
      var nutritionLogs = getNutritionLogs();
      var nutritionSettings = getNutritionSettings();
      var nutritionFavorites = getNutritionFavorites();
      

      var payload = {
        health: healthData,
        nutrition: {
          logs: nutritionLogs,
          settings: nutritionSettings,
          favorites: nutritionFavorites
        },
        caffeine: {
          logs: getCaffeineLogs(),
          settings: getCaffeineSettings()
        },
        meta: {
          updated: new Date().toISOString(),
          version: 4,
          device: navigator.userAgent.includes("iPhone") ? "iphone" : "desktop"
        }
      };


      var res = await fetch(BASE_URL, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Master-Key": API_KEY,
          "X-Bin-Versioning": "false"
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        console.error("[Sync] ❌ PUSH failed:", res.status);
        return false;
      }

      var nutritionDays = Object.keys(nutritionLogs).length;

      var caffeineDays = Object.keys(getCaffeineLogs()).length;
      console.log("[Sync] ✅ PUSH OK", healthData.length, "health records,", nutritionDays, "nutrition days,", caffeineDays, "caffeine days");

      return true;
    } catch (e) {
      console.error("[Sync] ❌ PUSH ERROR", e);
      return false;
    }
  }

  async function pull() {
    try {
      var res = await fetch(BASE_URL + "/latest", {
        headers: { "X-Master-Key": API_KEY }
      });

      if (!res.ok) {
        console.error("[Sync] ❌ PULL failed:", res.status);
        return false;
      }

      var json = await res.json();
      var record = json.record || {};
      var cloudHealth = Array.isArray(record.health) ? record.health : [];
      var cloudNutrition = record.nutrition || {};

      // === HEALTH MERGE ===
      var localHealth = HealthImport.getAll();
      var mergedHealth = mergeByDate(localHealth, cloudHealth);
      localStorage.setItem("health_data", JSON.stringify(mergedHealth));

      // === NUTRITION MERGE ===
      var nutritionDaysMerged = 0;
      if (cloudNutrition.logs && typeof cloudNutrition.logs === 'object') {
        var localLogs = getNutritionLogs();
        var mergedLogs = mergeNutritionLogs(localLogs, cloudNutrition.logs);
        localStorage.setItem("nutrition_logs", JSON.stringify(mergedLogs));
        nutritionDaysMerged = Object.keys(mergedLogs).length;
      }


      // === CAFFEINE MERGE ===
      if (record.caffeine && record.caffeine.logs) {
        var localCaff = getCaffeineLogs();
        var mergedCaff = mergeNutritionLogs(localCaff, record.caffeine.logs);
        localStorage.setItem('caffeine_logs', JSON.stringify(mergedCaff));
        
        if (record.caffeine.settings && !getCaffeineSettings()) {
          localStorage.setItem('caffeine_settings', JSON.stringify(record.caffeine.settings));
        }
      }

      
      // Settings (cloud override if exists)
      if (cloudNutrition.settings) {
        var localSettings = getNutritionSettings();
        if (!localSettings) {
          // Tylko jeśli lokalne brak — bierz z chmury
          localStorage.setItem("nutrition_settings", JSON.stringify(cloudNutrition.settings));
        }
      }

      // Favorites merge (unikalne po nazwie+barcode)
      if (Array.isArray(cloudNutrition.favorites)) {
        var localFavs = getNutritionFavorites();
        var mergedFavs = mergeFavorites(localFavs, cloudNutrition.favorites);
        localStorage.setItem("nutrition_favorites", JSON.stringify(mergedFavs));
      }

      console.log("[Sync] ✅ PULL OK — health:", cloudHealth.length, "| local:", localHealth.length, "| merged:", mergedHealth.length, "| nutrition days:", nutritionDaysMerged);
      return true;
    } catch (e) {
      console.error("[Sync] ❌ PULL ERROR", e);
      return false;
    }
  }

  function mergeByDate(local, cloud) {
    var map = {};
    cloud.forEach(function(e) { if (e.date) map[e.date] = e; });
    local.forEach(function(e) {
      if (!e.date) return;
      if (!map[e.date] || (e.ts && map[e.date].ts && e.ts > map[e.date].ts)) {
        map[e.date] = e;
      }
    });
    return Object.values(map).sort(function(a, b) { return a.date.localeCompare(b.date); });
  }


  // Merge logs (po dacie + item id, najnowsze wygrywają)
  // Działa dla nutrition (meals) i caffeine (entries)
  function mergeNutritionLogs(local, cloud) {
    var merged = {};
    
    var allDates = new Set([].concat(Object.keys(local || {}), Object.keys(cloud || {})));
    
    allDates.forEach(function(date) {
      var localDay = local[date] || {};
      var cloudDay = cloud[date] || {};
      
      // Detect format: nutrition uses "meals", caffeine uses "entries"
      var itemKey = (localDay.entries || cloudDay.entries) ? 'entries' : 'meals';
      
      var localItems = localDay[itemKey] || [];
      var cloudItems = cloudDay[itemKey] || [];
      
      // Merge items — unique po id, najnowsze wygrywają
      var itemMap = {};
      cloudItems.forEach(function(item) {
        if (item.id) itemMap[item.id] = item;
      });
      localItems.forEach(function(item) {
        if (!item.id) return;
        if (!itemMap[item.id] || (item.ts && itemMap[item.id].ts && item.ts > itemMap[item.id].ts)) {
          itemMap[item.id] = item;
        }
      });
      
      var sortedItems = Object.values(itemMap).sort(function(a, b) {
        return (a.time || '00:00').localeCompare(b.time || '00:00');
      });
      
      merged[date] = { date: date };
      merged[date][itemKey] = sortedItems;
    });
    
    return merged;
  }


  function mergeFavorites(local, cloud) {
    var map = {};
    cloud.forEach(function(f) {
      var key = (f.barcode || '') + '_' + (f.name || '');
      map[key] = f;
    });
    local.forEach(function(f) {
      var key = (f.barcode || '') + '_' + (f.name || '');
      if (!map[key]) map[key] = f;
    });
    var arr = Object.values(map);
    return arr.slice(0, 50);
  }

  async function sync() {
    await pull();
    await push();
  }

  function auto() {
    setTimeout(sync, 1500);
  }

  // Public method dla nutrition-engine.js żeby wywoływał auto-sync po zmianie
  function pushNutrition() {
    return push();
  }

  return { 
    push: push, 
    pull: pull, 
    sync: sync, 
    auto: auto,
    pushNutrition: pushNutrition
  };
})();

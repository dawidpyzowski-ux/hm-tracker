
/* nutrition-engine.js v1 — Sprint 26: TDEE, Budget, Macro logic */
var NutritionEngine = (function() {
  "use strict";
  var TAG = "[NutritionEngine]";

  // ============================================
  // USER PROFILE
  // ============================================
  var PROFILE = {
    age: 35,
    height_cm: 174,
    gender: "M",
    activity_factor: 1.55,  // moderately active
    protein_per_kg: 1.8,     // 1.8 g/kg
    macro_split: {
      protein_pct: 0.25,     // 25%
      carbs_pct: 0.55,       // 55%
      fat_pct: 0.20          // 20%
    }
  };

  var STORAGE_KEY = 'nutrition_logs';
  var SETTINGS_KEY = 'nutrition_settings';
  var FAVORITES_KEY = 'nutrition_favorites';

  function getCurrentWeight() {
    if (typeof BodyTracker !== "undefined" && BodyTracker.getCurrentWeight) {
      return BodyTracker.getCurrentWeight() || 74.7;
    }
    return 74.7;
  }

  // ============================================
  // BMR (Mifflin-St Jeor) — dokładniejszy niż Harris-Benedict
  // ============================================
  function calculateBMR() {
    var w = getCurrentWeight();
    if (PROFILE.gender === "M") {
      return Math.round(10 * w + 6.25 * PROFILE.height_cm - 5 * PROFILE.age + 5);
    } else {
      return Math.round(10 * w + 6.25 * PROFILE.height_cm - 5 * PROFILE.age - 161);
    }
  }

  // ============================================
  // TDEE — z Apple Health jeśli dostępne, fallback BMR×factor
  // ============================================
  function calculateTDEE() {
    var bmr = calculateBMR();
    
    // Try to use Apple Health data
    if (typeof HealthImport !== "undefined") {
      var latest = HealthImport.getLatest();
      if (latest && latest.activeEnergy > 0 && latest.basalEnergy > 0) {
        return {
          tdee: Math.round(latest.activeEnergy + latest.basalEnergy),
          source: "apple_health",
          bmr: bmr,
          active: latest.activeEnergy,
          basal: latest.basalEnergy
        };
      }
    }
    
    // Fallback: BMR × activity factor
    return {
      tdee: Math.round(bmr * PROFILE.activity_factor),
      source: "calculated",
      bmr: bmr,
      activity_factor: PROFILE.activity_factor
    };
  }

  // ============================================
  // DAILY BUDGET — deficyt z BodyTracker GOALS
  // ============================================
  function calculateBudget(autoCorrection) {
    var tdee = calculateTDEE();
    
    // Get deficit from BodyTracker GOALS
    var weeklyTargetLoss = 0.43; // kg/tydzień
    if (typeof BodyTracker !== "undefined" && BodyTracker.GOALS) {
      weeklyTargetLoss = BodyTracker.GOALS.weekly_target_loss || 0.43;
    }
    
    // 7700 kcal = 1 kg fat
    var dailyDeficit = Math.round((weeklyTargetLoss * 7700) / 7);
    
    // Auto-correction (jeśli przekazane)
    var correction = autoCorrection || 0;
    
    var target = tdee.tdee - dailyDeficit + correction;
    
    // Safety minimum
    var minSafe = 1500;
    if (PROFILE.gender === "F") minSafe = 1200;
    var safetyApplied = false;
    if (target < minSafe) {
      target = minSafe;
      safetyApplied = true;
    }
    
    // Macros
    var w = getCurrentWeight();
    var proteinG = Math.round(w * PROFILE.protein_per_kg);
    var proteinKcal = proteinG * 4;
    var remainingKcal = target - proteinKcal;
    
    // Z reszty: węgle vs tłuszcz wg macro_split
    var carbsFatRatio = PROFILE.macro_split.carbs_pct / (PROFILE.macro_split.carbs_pct + PROFILE.macro_split.fat_pct);
    var carbsKcal = Math.round(remainingKcal * carbsFatRatio);
    var fatKcal = remainingKcal - carbsKcal;
    var carbsG = Math.round(carbsKcal / 4);
    var fatG = Math.round(fatKcal / 9);
    
    return {
      tdee: tdee.tdee,
      tdee_source: tdee.source,
      deficit: dailyDeficit,
      auto_correction: correction,
      target_calories: target,
      safety_applied: safetyApplied,
      target_protein_g: proteinG,
      target_carbs_g: carbsG,
      target_fat_g: fatG,
      protein_per_kg: PROFILE.protein_per_kg,
      weight_used: w
    };
  }

  // ============================================
  // LOGS — storage and retrieval
  // ============================================
  function getAllLogs() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch(e) { return {}; }
  }

  function getLogsForDate(dateStr) {
    var all = getAllLogs();
    return all[dateStr] || { meals: [], date: dateStr };
  }

  function addMeal(dateStr, meal) {
    // meal: { id, time, name, calories, protein, carbs, fat, source, productId, quantity_g }
    var all = getAllLogs();
    if (!all[dateStr]) all[dateStr] = { meals: [], date: dateStr };
    
    meal.id = meal.id || Date.now();
    meal.time = meal.time || new Date().toTimeString().slice(0, 5);
    meal.ts = Date.now();
    
    all[dateStr].meals.push(meal);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    
    // Sync to cloud if available
    if (typeof HealthSync !== "undefined" && HealthSync.pushNutrition) {
      try { HealthSync.pushNutrition(); } catch(e) {}
    }
    
    return meal;
  }

  function deleteMeal(dateStr, mealId) {
    var all = getAllLogs();
    if (!all[dateStr]) return false;
    all[dateStr].meals = all[dateStr].meals.filter(function(m) {
      return m.id !== mealId;
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    return true;
  }

  function updateMeal(dateStr, mealId, updates) {
    var all = getAllLogs();
    if (!all[dateStr]) return false;
    var meal = all[dateStr].meals.find(function(m) { return m.id === mealId; });
    if (!meal) return false;
    Object.assign(meal, updates);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    return true;
  }

  // ============================================
  // DAILY TOTALS
  // ============================================
  function getTotalsForDate(dateStr) {
    var log = getLogsForDate(dateStr);
    var totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    log.meals.forEach(function(m) {
      totals.calories += parseFloat(m.calories || 0);
      totals.protein += parseFloat(m.protein || 0);
      totals.carbs += parseFloat(m.carbs || 0);
      totals.fat += parseFloat(m.fat || 0);
    });
    totals.meal_count = log.meals.length;
    return totals;
  }

  function localToday() {
    var d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString().slice(0, 10);
  }

  // ============================================
  // AUTO-CORRECTION — tygodniowa
  // ============================================
  function calculateAutoCorrection() {
    if (typeof BodyTracker === "undefined") return 0;
    
    var trend7 = BodyTracker.getTrend(7);
    if (!trend7 || !trend7.weight) return 0;
    
    var actualLossPerDay = -trend7.weight.slope_per_day;
    var targetLossPerDay = 0.43 / 7;
    
    var ratio = actualLossPerDay / targetLossPerDay;
    
    // Jeśli za wolno: -100 kcal
    // Jeśli za szybko: +100 kcal
    if (ratio < 0.7) return -100;  // za wolno
    if (ratio > 1.5) return +100;  // za szybko
    return 0;
  }

  // ============================================
  // FAVORITES — często używane produkty
  // ============================================
  function getFavorites() {
    try {
      return JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
    } catch(e) { return []; }
  }

  function addToFavorites(product) {
    var favs = getFavorites();
    var exists = favs.find(function(f) { return f.barcode === product.barcode || f.name === product.name; });
    if (!exists) {
      favs.unshift(product);
      if (favs.length > 50) favs = favs.slice(0, 50);
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs));
    }
  }

  function getRecent(limit) {
    limit = limit || 10;
    var all = getAllLogs();
    var dates = Object.keys(all).sort().reverse().slice(0, 7);
    var seen = {};
    var recent = [];
    dates.forEach(function(d) {
      all[d].meals.forEach(function(m) {
        var key = m.name + '_' + (m.productId || '');
        if (!seen[key]) {
          seen[key] = true;
          recent.push(m);
        }
      });
    });
    return recent.slice(0, limit);
  }

  // ============================================
  // MEAL TYPE detection by time
  // ============================================
  function getMealTypeByTime(time) {
    var hour = parseInt(time.split(':')[0]);
    if (hour >= 5 && hour < 11) return { type: 'breakfast', emoji: '🌅', label: 'Śniadanie' };
    if (hour >= 11 && hour < 16) return { type: 'lunch', emoji: '☀️', label: 'Lunch' };
    if (hour >= 16 && hour < 22) return { type: 'dinner', emoji: '🌙', label: 'Kolacja' };
    return { type: 'snack', emoji: '🍫', label: 'Przekąska' };
  }

  function groupMealsByType(meals) {
    var groups = {
      breakfast: { type: 'breakfast', emoji: '🌅', label: 'Śniadanie', meals: [] },
      lunch: { type: 'lunch', emoji: '☀️', label: 'Lunch', meals: [] },
      dinner: { type: 'dinner', emoji: '🌙', label: 'Kolacja', meals: [] },
      snack: { type: 'snack', emoji: '🍫', label: 'Przekąski', meals: [] }
    };
    meals.forEach(function(m) {
      var mealType = m.meal_type || getMealTypeByTime(m.time).type;
      if (groups[mealType]) groups[mealType].meals.push(m);
    });
    return groups;
  }

  // ============================================
  // MAIN: COMPUTE EVERYTHING
  // ============================================
  function compute(dateStr) {
    dateStr = dateStr || localToday();
    var correction = calculateAutoCorrection();
    var budget = calculateBudget(correction);
    var totals = getTotalsForDate(dateStr);
    var log = getLogsForDate(dateStr);
    
    var remaining = {
      calories: budget.target_calories - totals.calories,
      protein: budget.target_protein_g - totals.protein,
      carbs: budget.target_carbs_g - totals.carbs,
      fat: budget.target_fat_g - totals.fat
    };
    
    var pct = {
      calories: budget.target_calories > 0 ? Math.round(totals.calories / budget.target_calories * 100) : 0,
      protein: budget.target_protein_g > 0 ? Math.round(totals.protein / budget.target_protein_g * 100) : 0,
      carbs: budget.target_carbs_g > 0 ? Math.round(totals.carbs / budget.target_carbs_g * 100) : 0,
      fat: budget.target_fat_g > 0 ? Math.round(totals.fat / budget.target_fat_g * 100) : 0
    };
    
    return {
      date: dateStr,
      profile: PROFILE,
      budget: budget,
      totals: totals,
      remaining: remaining,
      percentages: pct,
      meals: log.meals,
      mealsByGroup: groupMealsByType(log.meals)
    };
  }

  // ============================================
  // SETTINGS update
  // ============================================
  function updateProfile(newProfile) {
    Object.assign(PROFILE, newProfile);
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(PROFILE));
    } catch(e) {}
  }

  // Load saved profile if exists
  try {
    var saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
    if (saved) Object.assign(PROFILE, saved);
  } catch(e) {}

  return {
    PROFILE: PROFILE,
    calculateBMR: calculateBMR,
    calculateTDEE: calculateTDEE,
    calculateBudget: calculateBudget,
    calculateAutoCorrection: calculateAutoCorrection,
    addMeal: addMeal,
    deleteMeal: deleteMeal,
    updateMeal: updateMeal,
    getLogsForDate: getLogsForDate,
    getTotalsForDate: getTotalsForDate,
    getAllLogs: getAllLogs,
    getFavorites: getFavorites,
    addToFavorites: addToFavorites,
    getRecent: getRecent,
    getMealTypeByTime: getMealTypeByTime,
    groupMealsByType: groupMealsByType,
    compute: compute,
    updateProfile: updateProfile
  };
})();

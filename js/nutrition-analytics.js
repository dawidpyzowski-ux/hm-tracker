/* nutrition-analytics.js v1 — Sprint 26.5: Analytics, korelacje, history */
var NutritionAnalytics = (function() {
  "use strict";
  var TAG = "[NutritionAnalytics]";

  function getAllDates(limit) {
    if (typeof NutritionEngine === "undefined") return [];
    var logs = NutritionEngine.getAllLogs();
    var dates = Object.keys(logs).sort();
    if (limit) dates = dates.slice(-limit);
    return dates;
  }

  function getTDEEForDate(dateStr) {
    // Try Apple Health first
    if (typeof HealthImport !== "undefined") {
      var entry = HealthImport.getByDate(dateStr);
      if (entry && entry.activeEnergy > 0 && entry.basalEnergy > 0) {
        return {
          tdee: Math.round(entry.activeEnergy + entry.basalEnergy),
          source: "apple_health",
          active: entry.activeEnergy,
          basal: entry.basalEnergy
        };
      }
    }
    
    // Fallback: calculated
    if (typeof NutritionEngine !== "undefined") {
      var budget = NutritionEngine.calculateBudget();
      return {
        tdee: budget.tdee,
        source: "calculated"
      };
    }
    
    return { tdee: 0, source: "unknown" };
  }

  function getDataForDate(dateStr) {
    if (typeof NutritionEngine === "undefined") return null;
    var data = NutritionEngine.compute(dateStr);
    var tdee = getTDEEForDate(dateStr);
    
    return {
      date: dateStr,
      tdee: tdee.tdee,
      tdee_source: tdee.source,
      intake: Math.round(data.totals.calories),
      deficit_actual: Math.round(tdee.tdee - data.totals.calories),
      deficit_target: data.budget.deficit,
      target_calories: data.budget.target_calories,
      protein: Math.round(data.totals.protein),
      carbs: Math.round(data.totals.carbs),
      fat: Math.round(data.totals.fat),
      target_protein: data.budget.target_protein_g,
      target_carbs: data.budget.target_carbs_g,
      target_fat: data.budget.target_fat_g,
      meal_count: data.totals.meal_count,
      meals: data.meals
    };
  }

  // ============================================
  // CALORIE BALANCE 30 days
  // ============================================
  function getCalorieBalance30d() {
    var dates = getAllDates(30);
    return dates.map(getDataForDate).filter(function(d) { return d && d.intake > 0; });
  }

  // ============================================
  // WEEKLY STATS
  // ============================================
  function getWeeklyStats(weeksBack) {
    weeksBack = weeksBack || 0;
    var today = new Date();
    today.setDate(today.getDate() - weeksBack * 7);
    
    var weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay() + 1);
    
    var days = [];
    for (var i = 0; i < 7; i++) {
      var d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      days.push(d.toISOString().slice(0, 10));
    }
    
    var data = days.map(getDataForDate).filter(function(d) { return d; });
    var withMeals = data.filter(function(d) { return d.meal_count > 0; });
    
    if (!withMeals.length) return null;
    
    var totalCal = withMeals.reduce(function(s,d) { return s + d.intake; }, 0);
    var totalProt = withMeals.reduce(function(s,d) { return s + d.protein; }, 0);
    var totalDeficit = withMeals.reduce(function(s,d) { return s + d.deficit_actual; }, 0);
    
    return {
      days: days,
      data: data,
      days_logged: withMeals.length,
      avg_calories: Math.round(totalCal / withMeals.length),
      avg_protein: Math.round(totalProt / withMeals.length),
      avg_deficit: Math.round(totalDeficit / withMeals.length),
      total_deficit: totalDeficit
    };
  }

  // ============================================
  // CORRELATIONS
  // ============================================
  function pearson(x, y) {
    var n = x.length;
    if (n < 3) return null;
    var sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
    for (var i = 0; i < n; i++) {
      sumX += x[i]; sumY += y[i];
      sumXY += x[i] * y[i];
      sumX2 += x[i] * x[i]; sumY2 += y[i] * y[i];
    }
    var num = n * sumXY - sumX * sumY;
    var den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    if (den === 0) return null;
    return num / den;
  }

  function computeCorrelations() {
    var balance = getCalorieBalance30d();
    if (balance.length < 3) return null;
    
    // Build pairs with weight + HRV next day
    var corrData = [];
    balance.forEach(function(d) {
      var nextDay = new Date(d.date);
      nextDay.setDate(nextDay.getDate() + 1);
      var nextStr = nextDay.toISOString().slice(0, 10);
      
      var nextHealth = HealthImport.getByDate(nextStr);
      if (!nextHealth) return;
      
      corrData.push({
        date: d.date,
        calories: d.intake,
        protein: d.protein,
        carbs: d.carbs,
        fat: d.fat,
        deficit: d.deficit_actual,
        weight_next: nextHealth.weight || null,
        hrv_next: nextHealth.hrv || null,
        sleep_next: nextHealth.sleepMin || null,
        rhr_next: nextHealth.rhr || null,
        deep_next: nextHealth.deepMin || null
      });
    });
    
    function extract(field1, field2) {
      var x = [], y = [];
      corrData.forEach(function(d) {
        if (d[field1] && d[field2]) {
          x.push(d[field1]); y.push(d[field2]);
        }
      });
      return { x: x, y: y, n: x.length, r: pearson(x, y) };
    }
    
    return {
      cal_weight: Object.assign({ title: "Kalorie ↔ Waga (next day)" }, extract('calories', 'weight_next')),
      cal_hrv: Object.assign({ title: "Kalorie ↔ HRV (next day)" }, extract('calories', 'hrv_next')),
      cal_sleep: Object.assign({ title: "Kalorie ↔ Sen (next day)" }, extract('calories', 'sleep_next')),
      protein_hrv: Object.assign({ title: "Białko ↔ HRV (next day)" }, extract('protein', 'hrv_next')),
      protein_deep: Object.assign({ title: "Białko ↔ Deep Sleep" }, extract('protein', 'deep_next')),
      deficit_hrv: Object.assign({ title: "Deficyt ↔ HRV (next day)" }, extract('deficit', 'hrv_next'))
    };
  }

  // ============================================
  // PROTEIN STREAK
  // ============================================
  function getProteinStreak() {
    var balance = getCalorieBalance30d();
    if (!balance.length) return { streak: 0, hits: 0, total: 0, days: [] };
    
    var days = balance.map(function(d) {
      return {
        date: d.date,
        protein: d.protein,
        target: d.target_protein,
        hit: d.protein >= d.target_protein * 0.95  // 95% of target = hit
      };
    });
    
    var hits = days.filter(function(d) { return d.hit; }).length;
    
    // Current streak (from end)
    var currentStreak = 0;
    for (var i = days.length - 1; i >= 0; i--) {
      if (days[i].hit) currentStreak++;
      else break;
    }
    
    return {
      streak: currentStreak,
      hits: hits,
      total: days.length,
      days: days
    };
  }

  // ============================================
  // MEAL TIMING analysis
  // ============================================
  function getMealTimingStats() {
    var dates = getAllDates(30);
    var timeSlots = {
      '5-9': 0, '9-12': 0, '12-15': 0, '15-18': 0, '18-21': 0, '21-24': 0
    };
    var slotCalories = {
      '5-9': 0, '9-12': 0, '12-15': 0, '15-18': 0, '18-21': 0, '21-24': 0
    };
    
    dates.forEach(function(date) {
      var data = getDataForDate(date);
      if (!data) return;
      data.meals.forEach(function(m) {
        var hour = parseInt((m.time || '12:00').split(':')[0]);
        var slot;
        if (hour < 9) slot = '5-9';
        else if (hour < 12) slot = '9-12';
        else if (hour < 15) slot = '12-15';
        else if (hour < 18) slot = '15-18';
        else if (hour < 21) slot = '18-21';
        else slot = '21-24';
        
        timeSlots[slot]++;
        slotCalories[slot] += (m.calories || 0);
      });
    });
    
    return {
      meal_count: timeSlots,
      calories: slotCalories
    };
  }

  // ============================================
  // SUMMARY 7 days (for AI Coach)
  // ============================================
  function getSummary7d() {
    var stats = getWeeklyStats(0);
    if (!stats) return null;
    
    var streak = getProteinStreak();
    var correlations = computeCorrelations();
    
    return {
      stats: stats,
      protein_streak: streak,
      correlations: correlations,
      days_logged: stats.days_logged,
      avg_calories: stats.avg_calories,
      avg_protein: stats.avg_protein,
      avg_deficit: stats.avg_deficit
    };
  }

  return {
    getDataForDate: getDataForDate,
    getTDEEForDate: getTDEEForDate,
    getCalorieBalance30d: getCalorieBalance30d,
    getWeeklyStats: getWeeklyStats,
    computeCorrelations: computeCorrelations,
    getProteinStreak: getProteinStreak,
    getMealTimingStats: getMealTimingStats,
    getSummary7d: getSummary7d,
    pearson: pearson
  };
})();

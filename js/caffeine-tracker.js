
/* caffeine-tracker.js v1 — Sprint 28: Caffeine tracking + half-life + sleep correlation */
var CaffeineTracker = (function() {
  "use strict";
  var TAG = "[Caffeine]";
  var STORAGE_KEY = "caffeine_logs";
  var SETTINGS_KEY = "caffeine_settings";
  
  // Half-life of caffeine in body (hours)
  var HALF_LIFE_HOURS = 5;
  
  // Default daily target (mg)
  var DEFAULT_DAILY_TARGET = 400;
  
  // ============================================
  // PRESET CALCULATOR
  // Wzór: caffeine(mg) = 1000 × dose(g) × green% × roastFactor × brewFactor
  // green% Arabica: 1.5% | Robusta: 2.5%
  // roastFactor: 1.15 (light=1.20, medium=1.15, dark=1.10)
  // brewFactor varies by method
  // ============================================
  
  var BREW_FACTORS = {
    espresso: 0.88,
    nespresso: 0.85,      // dla kapsułek
    drip_v60: 0.70,
    aeropress: 0.80,
    french_press: 0.85,
    chemex: 0.65,
    moka: 0.88,
    cold_brew: 0.95,
    instant: 0.90
  };
  
  var ROAST_FACTORS = {
    light: 1.20,
    medium: 1.15,
    dark: 1.10
  };
  
  function calculate(method, dose_g, beans, roast) {
    beans = beans || 'arabica';
    roast = roast || 'medium';
    
    var greenPct = beans === 'robusta' ? 0.025 : 0.015;
    var roastF = ROAST_FACTORS[roast] || 1.15;
    var brewF = BREW_FACTORS[method] || 0.85;
    
    return Math.round(1000 * dose_g * greenPct * roastF * brewF);
  }
  
  // ============================================
  // PRESETS — Twoje typowe
  // ============================================
  var PRESETS = [
    // 🏢 W pracy
    { id: 'work_espresso_double', name: 'Espresso (Lavazza)', emoji: '☕', mg: 120, group: 'work', dose_g: 12, method: 'espresso' },
    { id: 'work_americano', name: 'Americano (Lavazza)', emoji: '☕', mg: 100, group: 'work', dose_g: 12, method: 'espresso', notes: '+gorąca woda' },
    { id: 'work_cappuccino', name: 'Cappuccino (Lavazza)', emoji: '🥛', mg: 120, group: 'work', dose_g: 12, method: 'espresso', notes: 'double + mleko' },
    { id: 'work_flat_white', name: 'Flat White (Lavazza)', emoji: '🥛', mg: 120, group: 'work', dose_g: 12, method: 'espresso', notes: 'double + mleko' },
    { id: 'work_latte', name: 'Latte (Lavazza)', emoji: '🥛', mg: 120, group: 'work', dose_g: 12, method: 'espresso', notes: 'double + mleko' },
    { id: 'work_nespresso', name: 'Nespresso karmelowa', emoji: '💊', mg: 70, group: 'work', dose_g: 5.5, method: 'nespresso' },
    
    // 🏠 W domu
    { id: 'home_drip_15g', name: 'Drip V60 (15g)', emoji: '☕', mg: 95, group: 'home', dose_g: 15, method: 'drip_v60' },
    { id: 'home_drip_18g', name: 'Drip V60 (18g)', emoji: '☕', mg: 115, group: 'home', dose_g: 18, method: 'drip_v60' },
    { id: 'home_aeropress_15g', name: 'AeroPress (15g)', emoji: '💉', mg: 105, group: 'home', dose_g: 15, method: 'aeropress' },
    { id: 'home_aeropress_18g', name: 'AeroPress (18g)', emoji: '💉', mg: 125, group: 'home', dose_g: 18, method: 'aeropress' },
    
    // ☕ W kawiarni
    { id: 'cafe_espresso', name: 'Espresso (cafe)', emoji: '☕', mg: 80, group: 'cafe', dose_g: 9, method: 'espresso' },
    { id: 'cafe_espresso_double', name: 'Espresso double (cafe)', emoji: '☕', mg: 130, group: 'cafe', dose_g: 18, method: 'espresso' },
    { id: 'cafe_cappuccino', name: 'Cappuccino (cafe)', emoji: '🥛', mg: 130, group: 'cafe', dose_g: 18, method: 'espresso' },
    { id: 'cafe_flat_white', name: 'Flat White (cafe)', emoji: '🥛', mg: 130, group: 'cafe', dose_g: 18, method: 'espresso' },
    { id: 'cafe_latte', name: 'Latte (cafe)', emoji: '🥛', mg: 130, group: 'cafe', dose_g: 18, method: 'espresso' },
    { id: 'cafe_americano', name: 'Americano (cafe)', emoji: '☕', mg: 130, group: 'cafe', dose_g: 18, method: 'espresso' },
    
    // ⚡ Inne
    { id: 'gel_caffeine', name: 'Żel z kofeiną', emoji: '⚡', mg: 50, group: 'other' },
    { id: 'energy_drink', name: 'Energy drink (250ml)', emoji: '🥤', mg: 80, group: 'other' },
    { id: 'cola', name: 'Cola (330ml)', emoji: '🥤', mg: 35, group: 'other' },
    { id: 'green_tea', name: 'Zielona herbata', emoji: '🍵', mg: 30, group: 'other' },
    { id: 'black_tea', name: 'Czarna herbata', emoji: '🍵', mg: 45, group: 'other' },
    { id: 'pill_200', name: 'Tabletka kofeiny 200mg', emoji: '💊', mg: 200, group: 'other' }
  ];
  
  // ============================================
  // STORAGE
  // ============================================
  function getAllLogs() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
    catch(e) { return {}; }
  }
  
  function getLogsForDate(date) {
    var all = getAllLogs();
    return all[date] || { date: date, entries: [] };
  }
  
  function addEntry(date, entry) {
    var all = getAllLogs();
    if (!all[date]) all[date] = { date: date, entries: [] };
    
    entry.id = entry.id || Date.now();
    entry.ts = entry.ts || Date.now();
    entry.time = entry.time || new Date().toTimeString().slice(0, 5);
    
    all[date].entries.push(entry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    
    // Sync
    if (typeof HealthSync !== "undefined" && HealthSync.pushNutrition) {
      try { HealthSync.pushNutrition(); } catch(e) {}
    }
    
    return entry;
  }
  
  function deleteEntry(date, entryId) {
    var all = getAllLogs();
    if (!all[date]) return false;
    all[date].entries = all[date].entries.filter(function(e) { return e.id !== entryId; });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    return true;
  }
  
  function getTotalsForDate(date) {
    var log = getLogsForDate(date);
    var total_mg = 0;
    log.entries.forEach(function(e) { total_mg += parseFloat(e.mg || 0); });
    return {
      total_mg: total_mg,
      entry_count: log.entries.length,
      last_time: log.entries.length ? log.entries[log.entries.length - 1].time : null
    };
  }
  
  function localToday() {
    var d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString().slice(0, 10);
  }
  
  // ============================================
  // HALF-LIFE simulation
  // Po 5h zostaje 50%, po 10h zostaje 25%, etc.
  // ============================================
  function currentInBody(date) {
    date = date || localToday();
    var log = getLogsForDate(date);
    var now = new Date();
    var total = 0;
    
    log.entries.forEach(function(entry) {
      // Calculate hours since intake
      var entryDate = new Date(date + 'T' + (entry.time || '12:00') + ':00');
      var hoursSince = (now - entryDate) / 3600000;
      if (hoursSince < 0) return; // future entry
      
      // Half-life decay: amount = initial × 0.5^(hours/half_life)
      var remaining = entry.mg * Math.pow(0.5, hoursSince / HALF_LIFE_HOURS);
      total += remaining;
    });
    
    return Math.round(total);
  }
  
  function projectAtTime(date, hour, minute) {
    date = date || localToday();
    minute = minute || 0;
    var log = getLogsForDate(date);
    var targetTime = new Date(date + 'T' + String(hour).padStart(2,'0') + ':' + String(minute).padStart(2,'0') + ':00');
    var total = 0;
    
    log.entries.forEach(function(entry) {
      var entryDate = new Date(date + 'T' + (entry.time || '12:00') + ':00');
      var hoursSince = (targetTime - entryDate) / 3600000;
      if (hoursSince < 0) return;
      
      var remaining = entry.mg * Math.pow(0.5, hoursSince / HALF_LIFE_HOURS);
      total += remaining;
    });
    
    return Math.round(total);
  }
  
  // ============================================
  // SETTINGS — target, cutoff time, beans default
  // ============================================
  function getSettings() {
    try {
      var s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
      if (s) return s;
    } catch(e) {}
    
    return {
      daily_target_mg: DEFAULT_DAILY_TARGET,
      cutoff_hour: 14,    // recommendation, AI dostosuje
      default_beans: 'arabica',
      default_roast: 'medium'
    };
  }
  
  function updateSettings(updates) {
    var s = getSettings();
    Object.assign(s, updates);
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
    } catch(e) {}
    return s;
  }
  
  // ============================================
  // CORRELATIONS — kofeina ↔ sleep ↔ HRV
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
    if (typeof HealthImport === "undefined") return null;
    
    var allLogs = getAllLogs();
    var dates = Object.keys(allLogs).sort();
    if (dates.length < 5) return null;
    
    var pairs = [];
    dates.forEach(function(date) {
      var caffeine = getTotalsForDate(date);
      if (caffeine.total_mg === 0) return;
      
      // Next day health
      var nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      var nextStr = nextDay.toISOString().slice(0, 10);
      var nextHealth = HealthImport.getByDate(nextStr);
      if (!nextHealth) return;
      
      // Calculate "caffeine after cutoff hour"
      var afterCutoff = 0;
      allLogs[date].entries.forEach(function(e) {
        var hr = parseInt((e.time || '12:00').split(':')[0]);
        if (hr >= 14) afterCutoff += parseFloat(e.mg);
      });
      
      pairs.push({
        date: date,
        total_caffeine: caffeine.total_mg,
        after_14h: afterCutoff,
        sleep_min: nextHealth.sleepMin || 0,
        deep_min: nextHealth.deepMin || 0,
        rem_min: nextHealth.remMin || 0,
        hrv: nextHealth.hrv || 0,
        rhr: nextHealth.rhr || 0
      });
    });
    
    if (pairs.length < 5) return null;
    
    function ext(f1, f2) {
      var x = [], y = [];
      pairs.forEach(function(p) {
        if (p[f1] > 0 && p[f2] > 0) { x.push(p[f1]); y.push(p[f2]); }
      });
      return { x: x, y: y, n: x.length, r: pearson(x, y) };
    }
    
    return {
      caffeine_deep: Object.assign({ title: 'Kofeina ↔ Deep Sleep', desc: 'Czy więcej kofeiny = krótszy deep sleep?' }, ext('total_caffeine', 'deep_min')),
      caffeine_hrv: Object.assign({ title: 'Kofeina ↔ HRV', desc: 'Czy więcej kofeiny = niższe HRV?' }, ext('total_caffeine', 'hrv')),
      cutoff_deep: Object.assign({ title: 'Kofeina po 14:00 ↔ Deep Sleep', desc: 'Czy późna kawa szkodzi snowi?' }, ext('after_14h', 'deep_min')),
      cutoff_hrv: Object.assign({ title: 'Kofeina po 14:00 ↔ HRV', desc: 'Czy późna kawa obniża HRV?' }, ext('after_14h', 'hrv')),
      caffeine_sleep: Object.assign({ title: 'Kofeina ↔ Total Sleep', desc: '' }, ext('total_caffeine', 'sleep_min')),
      sample_size: pairs.length
    };
  }
  
  // ============================================
  // RECOMMENDATIONS
  // ============================================
  function getCutoffRecommendation() {
    var corr = computeCorrelations();
    if (!corr || corr.sample_size < 7) return null;
    
    // Jeśli silna negatywna korelacja kofeiny po 14:00 vs deep sleep
    var c = corr.cutoff_deep;
    if (c.r !== null && c.r < -0.3 && c.n >= 5) {
      return {
        cutoff_hour: 13,
        reason: 'Twoje dane: kofeina po 14:00 → deep sleep -' + Math.round(Math.abs(c.r) * 100) + '% (n=' + c.n + ')',
        confidence: c.n >= 10 ? 'high' : 'medium'
      };
    }
    
    if (c.r !== null && c.r < -0.1) {
      return {
        cutoff_hour: 14,
        reason: 'Niewielki negatywny wpływ późnej kawy (r=' + c.r.toFixed(2) + ')',
        confidence: 'low'
      };
    }
    
    return {
      cutoff_hour: 15,
      reason: 'Twoje dane: brak silnej korelacji, możesz pić do 15:00',
      confidence: 'medium'
    };
  }
  
  // ============================================
  // MAIN COMPUTE
  // ============================================
  function compute(date) {
    date = date || localToday();
    var settings = getSettings();
    var totals = getTotalsForDate(date);
    var inBody = currentInBody(date);
    var bedtimeProjection = projectAtTime(date, 22, 0);
    var recommendation = getCutoffRecommendation();
    var correlations = computeCorrelations();
    
    return {
      date: date,
      settings: settings,
      totals: totals,
      in_body_now: inBody,
      bedtime_projection_mg: bedtimeProjection,
      cutoff_recommendation: recommendation,
      correlations: correlations,
      log: getLogsForDate(date)
    };
  }
  
  return {
    PRESETS: PRESETS,
    BREW_FACTORS: BREW_FACTORS,
    ROAST_FACTORS: ROAST_FACTORS,
    calculate: calculate,
    addEntry: addEntry,
    deleteEntry: deleteEntry,
    getLogsForDate: getLogsForDate,
    getTotalsForDate: getTotalsForDate,
    getAllLogs: getAllLogs,
    currentInBody: currentInBody,
    projectAtTime: projectAtTime,
    getSettings: getSettings,
    updateSettings: updateSettings,
    computeCorrelations: computeCorrelations,
    getCutoffRecommendation: getCutoffRecommendation,
    compute: compute
  };
})();

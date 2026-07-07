
/* plan-overrides-store.js v1 — Sprint 30: Storage for manual plan overrides */
var PlanOverridesStore = (function() {
  "use strict";
  var TAG = "[PlanOverrides]";
  var STORAGE_KEY = "plan_overrides";
  
  // Structure:
  // {
  //   [activity_id]: {
  //     activity_date: "2026-07-06",
  //     matched_plan_date: "2026-07-07",  // <- assigned to this date's plan
  //     matched_plan_type: "Tempo Run",
  //     matched_plan_km: 8,
  //     matched_plan_pace: "5:05-5:10",
  //     confidence: 92,  // %
  //     matched_by: "manual" | "auto",
  //     skip_plan: false,  // if true, this activity doesn't match any plan
  //     original_plan_marked_skipped: true,  // Pn Easy is now skipped
  //     notes: "Optional override notes",
  //     ts: 1720256400000
  //   }
  // }
  
  function getAll() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch(e) { return {}; }
  }
  
  function getForActivity(activityId) {
    if (!activityId) return null;
    var all = getAll();
    return all[activityId] || null;
  }
  
  function set(activityId, override) {
    if (!activityId || !override) return false;
    var all = getAll();
    override.ts = Date.now();
    all[activityId] = override;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
      // Sync to cloud
      if (typeof HealthSync !== 'undefined' && HealthSync.pushNutrition) {
        try { HealthSync.pushNutrition(); } catch(e) {}
      }
      return true;
    } catch(e) {
      console.warn(TAG, 'Save failed:', e);
      return false;
    }
  }
  
  function remove(activityId) {
    if (!activityId) return false;
    var all = getAll();
    delete all[activityId];
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
      if (typeof HealthSync !== 'undefined' && HealthSync.pushNutrition) {
        try { HealthSync.pushNutrition(); } catch(e) {}
      }
      return true;
    } catch(e) { return false; }
  }
  
  // Get all overrides for a specific plan date (to mark skipped plans)
  function getSkippedPlanDates() {
    var all = getAll();
    var skipped = {};
    Object.keys(all).forEach(function(activityId) {
      var o = all[activityId];
      if (o.original_plan_marked_skipped && o.activity_date !== o.matched_plan_date) {
        skipped[o.activity_date] = true; // date whose plan was skipped
      }
    });
    return skipped;
  }
  
  // Get plans that were completed by this override (for the plan_date)
  function getCompletedPlansMap() {
    var all = getAll();
    var completed = {};
    Object.keys(all).forEach(function(activityId) {
      var o = all[activityId];
      if (o.matched_plan_date && !o.skip_plan) {
        if (!completed[o.matched_plan_date]) completed[o.matched_plan_date] = [];
        completed[o.matched_plan_date].push({
          activity_id: activityId,
          activity_date: o.activity_date,
          confidence: o.confidence,
          matched_by: o.matched_by
        });
      }
    });
    return completed;
  }
  
  return {
    getAll: getAll,
    getForActivity: getForActivity,
    set: set,
    remove: remove,
    getSkippedPlanDates: getSkippedPlanDates,
    getCompletedPlansMap: getCompletedPlansMap
  };
})();

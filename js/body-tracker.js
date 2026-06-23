/* body-tracker.js v1 — Sprint 22: Weight + Body Fat tracking with goals */
var BodyTracker = (function() {
  "use strict";
  var TAG = "[BodyTracker]";

  // Twoje cele (zapisane raz)
  var GOALS = {
    start: { date: "2026-06-23", weight_kg: 74.2, body_fat_pct: 19.8 },
    target: { date: "2026-09-06", weight_kg: 71.0, body_fat_pct: 16.0 },
    weekly_target_loss: 0.43,
    safety_max_weekly_loss: 0.75,
    red_flag_min_calories: 2200
  };

  function getCurrentWeight() {
    var latest = getLatest();
    if (latest && latest.weight) return latest.weight;
    return GOALS.start.weight_kg;
  }

  function getCurrentBF() {
    var latest = getLatest();
    if (latest && latest.bodyFat) return latest.bodyFat;
    return GOALS.start.body_fat_pct;
  }

  function getAll() {
    // Bierze z HealthImport — pola weight i bodyFat
    if (typeof HealthImport === "undefined") return [];
    return HealthImport.getAll()
      .filter(function(e) { return e.weight > 0 || e.bodyFat > 0; })
      .map(function(e) {
        return { date: e.date, weight: e.weight || null, bodyFat: e.bodyFat || null };
      })
      .sort(function(a, b) { return a.date.localeCompare(b.date); });
  }

  function getLatest() {
    var all = getAll();
    if (!all.length) return null;
    // Latest non-null
    for (var i = all.length - 1; i >= 0; i--) {
      if (all[i].weight || all[i].bodyFat) return all[i];
    }
    return null;
  }

  function getTrend(days) {
    days = days || 30;
    var all = getAll();
    var todayD = new Date();
    var cutoff = new Date(todayD.getTime() - days * 86400000);
    var recent = all.filter(function(e) { return new Date(e.date) >= cutoff; });

    if (recent.length < 2) return null;

    var weights = recent.filter(function(e) { return e.weight > 0; }).map(function(e) { return e.weight; });
    var bfs = recent.filter(function(e) { return e.bodyFat > 0; }).map(function(e) { return e.bodyFat; });

    function avg(arr) { return arr.length ? arr.reduce(function(a,b){return a+b;}, 0) / arr.length : 0; }
    function slope(arr) {
      if (arr.length < 2) return 0;
      var n = arr.length, sx = 0, sy = 0, sxy = 0, sx2 = 0;
      for (var i = 0; i < n; i++) {
        sx += i; sy += arr[i]; sxy += i * arr[i]; sx2 += i * i;
      }
      return (n * sxy - sx * sy) / (n * sx2 - sx * sx);
    }

    return {
      days_analyzed: days,
      weight: {
        current: recent[recent.length-1].weight || null,
        first: recent[0].weight || null,
        avg: +avg(weights).toFixed(1),
        slope_per_day: +slope(weights).toFixed(3),
        change_total_kg: weights.length >= 2 ? +(weights[weights.length-1] - weights[0]).toFixed(1) : 0
      },
      bodyFat: {
        current: recent[recent.length-1].bodyFat || null,
        first: recent[0].bodyFat || null,
        avg: +avg(bfs).toFixed(1),
        slope_per_day: +slope(bfs).toFixed(3),
        change_total_pct: bfs.length >= 2 ? +(bfs[bfs.length-1] - bfs[0]).toFixed(1) : 0
      },
      data_points: recent.length
    };
  }

  function getProgressVsGoal() {
    var current = getLatest();
    if (!current) return null;

    var startD = new Date(GOALS.start.date);
    var targetD = new Date(GOALS.target.date);
    var todayD = new Date();

    var daysTotal = Math.round((targetD - startD) / 86400000);
    var daysElapsed = Math.round((todayD - startD) / 86400000);
    var daysRemaining = Math.round((targetD - todayD) / 86400000);
    var progressPct = Math.min(100, Math.round(daysElapsed / daysTotal * 100));

    // Waga
    var weightTarget = GOALS.target.weight_kg;
    var weightStart = GOALS.start.weight_kg;
    var weightCurrent = current.weight || weightStart;
    var weightTotalLoss = weightStart - weightTarget;
    var weightCurrentLoss = weightStart - weightCurrent;
    var weightProgressPct = weightTotalLoss > 0 ? Math.round(weightCurrentLoss / weightTotalLoss * 100) : 0;

    // Expected loss by now (linear)
    var weightExpectedLoss = weightTotalLoss * (daysElapsed / daysTotal);
    var weightDelta = weightCurrentLoss - weightExpectedLoss;

    var status;
    if (Math.abs(weightDelta) < 0.3) status = "on_track";
    else if (weightDelta >= 0.3) status = "ahead";
    else status = "behind";

    // Tygodniowe tempo
    var weeksElapsed = Math.max(1, daysElapsed / 7);
    var weeklyLossActual = weightCurrentLoss / weeksElapsed;

    var safety;
    if (weeklyLossActual > GOALS.safety_max_weekly_loss) safety = "too_fast";
    else if (weeklyLossActual >= 0.3 && weeklyLossActual <= GOALS.safety_max_weekly_loss) safety = "healthy";
    else if (weeklyLossActual >= 0 && weeklyLossActual < 0.3) safety = "slow";
    else safety = "gaining";

    return {
      goals: GOALS,
      days_total: daysTotal,
      days_elapsed: daysElapsed,
      days_remaining: daysRemaining,
      time_progress_pct: progressPct,
      weight: {
        start: weightStart,
        current: weightCurrent,
        target: weightTarget,
        loss_to_date: +weightCurrentLoss.toFixed(1),
        expected_loss_by_now: +weightExpectedLoss.toFixed(1),
        delta_vs_plan: +weightDelta.toFixed(1),
        progress_pct: weightProgressPct,
        weekly_loss_actual: +weeklyLossActual.toFixed(2),
        weekly_loss_target: GOALS.weekly_target_loss,
        status: status,
        safety: safety
      },
      body_fat: {
        start: GOALS.start.body_fat_pct,
        current: current.bodyFat || GOALS.start.body_fat_pct,
        target: GOALS.target.body_fat_pct
      },
      prediction_at_target_date: {
        weight_kg: current.weight && weeksElapsed > 0 ?
          +(weightCurrent + weeklyLossActual * -1 * (daysRemaining / 7) * -1).toFixed(1) : null,
        on_track: status === "on_track" || status === "ahead"
      }
    };
  }

  function detectAnomalies() {
    var anomalies = [];
    var progress = getProgressVsGoal();
    if (!progress) return anomalies;

    if (progress.weight.safety === "too_fast") {
      anomalies.push({
        type: "warning", metric: "Body",
        message: "Spadek wagi " + progress.weight.weekly_loss_actual + " kg/tydzień — za szybko (limit " + GOALS.safety_max_weekly_loss + "). Zwiększ kalorie o 200/dzień.",
        severity: "high"
      });
    }

    if (progress.weight.safety === "gaining" && progress.days_elapsed > 14) {
      anomalies.push({
        type: "warning", metric: "Body",
        message: "Brak postępu wagowego — sprawdź deficyt kaloryczny.",
        severity: "medium"
      });
    }

    if (progress.weight.status === "behind" && Math.abs(progress.weight.delta_vs_plan) > 1.0) {
      anomalies.push({
        type: "info", metric: "Body",
        message: "Za mała redukcja vs plan (-" + Math.abs(progress.weight.delta_vs_plan) + " kg). Cel nadal osiągalny.",
        severity: "low"
      });
    }

    if (progress.weight.safety === "healthy" && progress.weight.status === "on_track") {
      anomalies.push({
        type: "positive", metric: "Body",
        message: "Idealna redukcja " + progress.weight.weekly_loss_actual + " kg/tydzień — utrzymaj kurs.",
        severity: "low"
      });
    }

    return anomalies;
  }

  function compute() {
    var current = getLatest();
    var trend30 = getTrend(30);
    var trend7 = getTrend(7);
    var progress = getProgressVsGoal();
    var anomalies = detectAnomalies();

    return {
      current: current,
      trend_30d: trend30,
      trend_7d: trend7,
      progress_vs_goal: progress,
      anomalies: anomalies,
      goals: GOALS
    };
  }

  return {
    compute: compute,
    getAll: getAll,
    getLatest: getLatest,
    getCurrentWeight: getCurrentWeight,
    getCurrentBF: getCurrentBF,
    getTrend: getTrend,
    getProgressVsGoal: getProgressVsGoal,
    detectAnomalies: detectAnomalies,
    GOALS: GOALS
  };
})();

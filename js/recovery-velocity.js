
/* recovery-velocity.js v1 — Sprint 25: Recovery Velocity Index */
var RecoveryVelocity = (function() {
  "use strict";

  function compute() {
    if (typeof HealthImport === "undefined") return null;
    if (typeof S === "undefined" || !S.getAllLogs) return null;

    var data = HealthImport.getAll().filter(function(d) { return d.hrv > 0; });
    if (data.length < 7) return null;

    var baselines = HealthImport.getBaselines();
    var baselineHrv = baselines.hrv;
    if (!baselineHrv) return null;

    // ±5% baseline = "recovered"
    var minRecovered = baselineHrv * 0.95;

    var logs = S.getAllLogs();
    var hardKeywords = ['interv', 'interw', 'tempo', 'long', 'race', 'fartlek'];
    
    // Znajdz hard workouts
    var hardDates = [];
    Object.keys(logs).forEach(function(date) {
      var log = logs[date];
      if (!log.distance) return;
      var type = (log.type || '').toLowerCase();
      // Sprawdz tez PLAN_FLAT
      if (window.PLAN_FLAT) {
        var planned = window.PLAN_FLAT.find(function(p) { return p.date === date; });
        if (planned) type = type || (planned.type || '').toLowerCase();
      }
      var isHard = hardKeywords.some(function(k) { return type.indexOf(k) >= 0; });
      // Dla niezidentyfikowanych — uznaj long (>13km) za hard
      if (!isHard && parseFloat(log.distance) >= 13) isHard = true;
      if (isHard) hardDates.push(date);
    });
    hardDates.sort();

    // Dla każdego hard workout — znajdz ile dni do HRV recovered
    var velocities = [];
    hardDates.forEach(function(hardDate) {
      var hardD = new Date(hardDate);
      // Sprawdz HRV w kolejnych dniach (max 7)
      for (var i = 1; i <= 7; i++) {
        var checkD = new Date(hardD);
        checkD.setDate(checkD.getDate() + i);
        var checkStr = checkD.toISOString().slice(0, 10);
        
        var entry = data.find(function(d) { return d.date === checkStr; });
        if (entry && entry.hrv >= minRecovered) {
          velocities.push({ 
            hardDate: hardDate, 
            recoveryDays: i,
            hrv_at_recovery: entry.hrv 
          });
          break;
        }
      }
    });

    if (velocities.length === 0) return null;

    var avgVelocity = velocities.reduce(function(s, v) { return s + v.recoveryDays; }, 0) / velocities.length;
    var recent3 = velocities.slice(-3);
    var avgRecent = recent3.reduce(function(s, v) { return s + v.recoveryDays; }, 0) / recent3.length;
    
    // Trend: czy ostatnie szybsze niż średnia?
    var trend = "stable";
    if (avgRecent < avgVelocity - 0.5) trend = "improving";
    else if (avgRecent > avgVelocity + 0.5) trend = "declining";

    var lastVelocity = velocities[velocities.length - 1];

    return {
      avg_recovery_days: +avgVelocity.toFixed(1),
      avg_recent_3: +avgRecent.toFixed(1),
      trend: trend,
      last_workout: lastVelocity,
      sample_size: velocities.length,
      baseline_hrv: baselineHrv,
      threshold: +minRecovered.toFixed(1),
      all_velocities: velocities.slice(-10)
    };
  }

  return { compute: compute };
})();
`

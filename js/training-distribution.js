
/* training-distribution.js v1 — Sprint 25: 80/20 Polarization Check */
var TrainingDistribution = (function() {
  "use strict";

  function getHRZone(hr, baseline_hr) {
    // Karvonen-based zones (rough)
    var rhr = (typeof HealthImport !== 'undefined') ? HealthImport.getBaselines().rhr || 60 : 60;
    var maxHR = 220 - 35; // assume age 35 — można zrobić config
    var hrr = maxHR - rhr;
    
    if (hr < rhr + hrr * 0.6) return 'z1';      // < 60% HRR
    if (hr < rhr + hrr * 0.7) return 'z2';      // 60-70% HRR (easy)
    if (hr < rhr + hrr * 0.8) return 'z3';      // 70-80% HRR (gray zone)
    if (hr < rhr + hrr * 0.9) return 'z4';      // 80-90% HRR (threshold)
    return 'z5';                                  // > 90% HRR (VO2max)
  }

  async function computeWeekly() {
    if (typeof DB === "undefined" || !DB.getAll) return null;
    
    var acts = await DB.getAll();
    var todayD = new Date();
    var weekAgo = new Date(todayD.getTime() - 7 * 86400000);
    var weekAgoStr = weekAgo.toISOString().slice(0, 10);
    
    var weekActs = acts.filter(function(a) {
      return a.date >= weekAgoStr && a.strava_id;
    });

    if (!weekActs.length) return null;

    var zoneMinutes = { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0 };
    var totalMinutes = 0;

  
    weekActs.forEach(function(a) {
      var streams = DB.getStreams ? DB.getStreams(a.strava_id) : null;
      if (!streams || !streams.heartrate) return;
      
      var hrData = streams.heartrate.data || streams.heartrate;
      var timeData = streams.time ? (streams.time.data || streams.time) : null;
      
      // Calculate realny sample interval
      var defaultInterval = 1; // sec, fallback
      if (timeData && timeData.length >= 2) {
        // Average interval z pierwszych 100 samples
        var sampleCount = Math.min(100, timeData.length - 1);
        var totalDelta = 0;
        for (var k = 1; k <= sampleCount; k++) {
          totalDelta += (timeData[k] - timeData[k-1]);
        }
        defaultInterval = totalDelta / sampleCount;
      }
      
      hrData.forEach(function(hr, i) {
        if (!hr || hr < 50) return;
        var zone = getHRZone(hr);
        
        // Use real time delta if available
        var deltaSec = defaultInterval;
        if (timeData && i > 0 && i < timeData.length) {
          deltaSec = timeData[i] - timeData[i-1];
          // Sanity: jeśli delta > 30s (np. przerwa, GPS lost), użyj default
          if (deltaSec > 30 || deltaSec < 0) deltaSec = defaultInterval;
        }
        
        zoneMinutes[zone] += deltaSec / 60;
        totalMinutes += deltaSec / 60;
      });
    });


    if (totalMinutes < 1) return null;

    var pcts = {};
    Object.keys(zoneMinutes).forEach(function(z) {
      pcts[z] = (zoneMinutes[z] / totalMinutes) * 100;
    });

    var easyPct = pcts.z1 + pcts.z2;
    var grayPct = pcts.z3;
    var hardPct = pcts.z4 + pcts.z5;

    // Polarization assessment
    var verdict, recommendation;
    if (easyPct >= 75 && grayPct <= 10 && hardPct >= 15) {
      verdict = "polarized";
      recommendation = "Świetna polaryzacja (norweski model 80/20). Utrzymuj kurs.";
    } else if (grayPct > 25) {
      verdict = "gray_zone";
      recommendation = "Za dużo czasu w Z3 gray zone. Zwolnij easy runs albo przyspiesz tempo.";
    } else if (hardPct > 35) {
      verdict = "too_much_hard";
      recommendation = "Za dużo hard. Dodaj easy days dla aerobic base.";
    } else if (easyPct > 90) {
      verdict = "too_easy";
      recommendation = "Za dużo easy. Dodaj 1 quality session w tygodniu.";
    } else {
      verdict = "balanced";
      recommendation = "Dobry balans, ale nie polaryzowany.";
    }

    return {
      zones_minutes: zoneMinutes,
      zones_pct: pcts,
      total_minutes: Math.round(totalMinutes),
      easy_pct: +easyPct.toFixed(1),
      gray_pct: +grayPct.toFixed(1),
      hard_pct: +hardPct.toFixed(1),
      verdict: verdict,
      recommendation: recommendation
    };
  }

  return { computeWeekly: computeWeekly };
})();

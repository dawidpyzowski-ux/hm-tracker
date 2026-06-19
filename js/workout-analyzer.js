
/* workout-analyzer.js v2 — Sprint 17: Smart Pre-processed AI Analysis */
var WorkoutAnalyzer = (function() {
  "use strict";
  var TAG = "[WorkoutAnalyzer]";

  var WORKER_URL = "https://hm-tracker-ai.dawid-pyzowski.workers.dev";

  function paceToSec(p) {
    if (!p) return 0;
    var parts = p.toString().split(":");
    if (parts.length !== 2) return 0;
    return parseInt(parts[0]) * 60 + parseInt(parts[1]);
  }

  function speedToSec(speed) {
    if (!speed || speed <= 0) return 0;
    return Math.round(1000 / speed);
  }

  function secToPace(s) {
    if (!s || s <= 0) return "-";
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  }

  function stddev(arr) {
    if (arr.length < 2) return 0;
    var mean = arr.reduce(function(a, b) { return a + b; }, 0) / arr.length;
    var variance = arr.reduce(function(s, v) { return s + Math.pow(v - mean, 2); }, 0) / arr.length;
    return Math.round(Math.sqrt(variance));
  }

  // === SMART ANALYTICS ===
  function analyzeSplits(splits) {
    if (!splits || splits.length < 2) return null;

    var paces = splits.map(function(s) { return speedToSec(s.average_speed); });
    var hrs = splits.map(function(s) { return Math.round(s.average_heartrate || 0); }).filter(function(h) { return h > 0; });

    // Pace consistency
    var paceStddev = stddev(paces);
    var paceConsistencyGrade = paceStddev < 10 ? "A (excellent)" : paceStddev < 20 ? "B (good)" : paceStddev < 35 ? "C (average)" : "D (inconsistent)";

    // Pace drift (first half vs second half)
    var half = Math.floor(splits.length / 2);
    var firstHalfPaces = paces.slice(0, half);
    var secondHalfPaces = paces.slice(half);
    var avgFirst = Math.round(firstHalfPaces.reduce(function(a, b) { return a + b; }, 0) / firstHalfPaces.length);
    var avgSecond = Math.round(secondHalfPaces.reduce(function(a, b) { return a + b; }, 0) / secondHalfPaces.length);
    var paceDrift = avgSecond - avgFirst;

    // Cardiac drift (HR)
    var cardiacDrift = null;
    if (hrs.length >= 4) {
      var firstHR = hrs.slice(0, half);
      var secondHR = hrs.slice(half);
      var avgHRFirst = Math.round(firstHR.reduce(function(a, b) { return a + b; }, 0) / firstHR.length);
      var avgHRSecond = Math.round(secondHR.reduce(function(a, b) { return a + b; }, 0) / secondHR.length);
      cardiacDrift = {
        first_half_avg: avgHRFirst,
        second_half_avg: avgHRSecond,
        drift_bpm: avgHRSecond - avgHRFirst,
        drift_pct: avgHRFirst > 0 ? +((avgHRSecond - avgHRFirst) / avgHRFirst * 100).toFixed(1) : 0
      };
    }

    // Elevation impact
    var totalElev = splits.reduce(function(s, sp) { return s + Math.max(0, sp.elevation_difference || 0); }, 0);
    var netElev = splits.reduce(function(s, sp) { return s + (sp.elevation_difference || 0); }, 0);

    // Fastest/slowest km
    var fastestIdx = paces.indexOf(Math.min.apply(null, paces.filter(function(p) { return p > 0; })));
    var slowestIdx = paces.indexOf(Math.max.apply(null, paces));

    return {
      total_km: splits.length,
      avg_pace: secToPace(Math.round(paces.reduce(function(a, b) { return a + b; }, 0) / paces.length)),
      pace_range: secToPace(Math.min.apply(null, paces.filter(function(p) { return p > 0; }))) + " — " + secToPace(Math.max.apply(null, paces)),
      pace_consistency: {
        stddev_sec: paceStddev,
        grade: paceConsistencyGrade
      },
      pace_drift: {
        first_half_avg: secToPace(avgFirst),
        second_half_avg: secToPace(avgSecond),
        drift_sec: paceDrift,
        type: paceDrift > 5 ? "positive split (slowing down)" : paceDrift < -5 ? "negative split (speeding up)" : "even pace"
      },
      cardiac_drift: cardiacDrift,
      avg_hr: hrs.length ? Math.round(hrs.reduce(function(a, b) { return a + b; }, 0) / hrs.length) : null,
      max_hr: hrs.length ? Math.max.apply(null, hrs) : null,
      elevation: {
        total_gain_m: Math.round(totalElev),
        net_m: Math.round(netElev),
        impact: totalElev < 20 ? "negligible" : totalElev < 50 ? "minor" : totalElev < 100 ? "moderate" : "significant"
      },
      fastest_km: { km: fastestIdx + 1, pace: secToPace(paces[fastestIdx]), hr: hrs[fastestIdx] },
      slowest_km: { km: slowestIdx + 1, pace: secToPace(paces[slowestIdx]), hr: hrs[slowestIdx] }
    };
  }

  
function analyzeWorkLaps(classified, planType) {
  if (!classified || !classified.length) return null;

  function getRole(l) {
    return String(l.role || l.type || l.segment || "").toLowerCase();
  }

  function isWorkLap(l) {
    var r = getRole(l);
    return r === "work" ||
           r === "interval" ||
           r === "rep" ||
           r === "fast" ||
           r.indexOf("work") >= 0 ||
           r.indexOf("interv") >= 0 ||
           r.indexOf("interw") >= 0;
  }

  function isRestLap(l) {
    var r = getRole(l);
    return r === "rest" ||
           r === "recovery" ||
           r === "jog" ||
           r.indexOf("rest") >= 0 ||
           r.indexOf("recover") >= 0 ||
           r.indexOf("trucht") >= 0;
  }

  function getDistKm(l) {
    var d =
      l.distKm ||
      l.distanceKm ||
      l.km ||
      l.dist ||
      0;

    if (!d && l.distance) d = l.distance / 1000;
    d = parseFloat(d);

    return isFinite(d) && d > 0 ? d : null;
  }

  function getDurationSec(l) {
    var d =
      l.durationSec ||
      l.duration_s ||
      l.moving_time ||
      l.elapsed_time ||
      l.time ||
      l.duration ||
      0;

    d = parseFloat(d);

    // Jeśli duration wygląda jak minuty, a nie sekundy
    // np. 4.8 zamiast 288, przelicz na sekundy
    if (d > 0 && d < 60) d = d * 60;

    return isFinite(d) && d > 0 ? d : null;
  }

  function getPaceSec(l) {
    // Najważniejsze: TrainScore często ma pace już jako sec/km
    var p =
      l.pace ||
      l.paceSec ||
      l.avgPace ||
      l.avg_pace ||
      null;

    if (typeof p === "string" && p.indexOf(":") > -1) {
      var parts = p.split(":");
      if (parts.length === 2) {
        var sec = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
        return isFinite(sec) && sec > 0 ? sec : null;
      }
    }

    if (p !== null && p !== undefined) {
      p = parseFloat(p);
      if (isFinite(p) && p > 0 && p < 1500) return Math.round(p);
    }

    // Fallback: duration / distance
    var dist = getDistKm(l);
    var dur = getDurationSec(l);

    if (dist && dur) {
      var pace = Math.round(dur / dist);
      return isFinite(pace) && pace > 0 && pace < 1500 ? pace : null;
    }

    return null;
  }

  function getHR(l) {
    var h =
      l.avgHR ||
      l.avg_hr ||
      l.hr ||
      l.average_heartrate ||
      l.averageHR ||
      null;

    h = parseFloat(h);
    return isFinite(h) && h > 0 ? Math.round(h) : null;
  }

  function secToPace(s) {
    if (!s || !isFinite(s) || s <= 0) return "-";
    var m = Math.floor(s / 60);
    var sec = Math.round(s % 60);
    return m + ":" + String(sec).padStart(2, "0");
  }

  function avg(arr) {
    if (!arr || !arr.length) return null;
    return Math.round(arr.reduce(function(a, b) { return a + b; }, 0) / arr.length);
  }

  function stddev(arr) {
    if (!arr || arr.length < 2) return 0;
    var mean = arr.reduce(function(a, b) { return a + b; }, 0) / arr.length;
    var variance = arr.reduce(function(s, v) {
      return s + Math.pow(v - mean, 2);
    }, 0) / arr.length;
    return Math.round(Math.sqrt(variance));
  }

  var workLaps = classified.filter(isWorkLap);
  var restLaps = classified.filter(isRestLap);

  var workPaces = workLaps
    .map(getPaceSec)
    .filter(function(p) { return p && p > 0 && isFinite(p); });

  var restPaces = restLaps
    .map(getPaceSec)
    .filter(function(p) { return p && p > 0 && isFinite(p); });

  var workHRs = workLaps
    .map(getHR)
    .filter(function(h) { return h && h > 0 && isFinite(h); });

  var restHRs = restLaps
    .map(getHR)
    .filter(function(h) { return h && h > 0 && isFinite(h); });

  if (!workPaces.length) {
    return {
      reps: workLaps.length,
      error: "Brak poprawnych danych pace dla odcinkow work",
      raw_work_laps_sample: workLaps.slice(0, 3)
    };
  }

  var minWork = Math.min.apply(null, workPaces);
  var maxWork = Math.max.apply(null, workPaces);
  var workStddev = stddev(workPaces);

  var consistency;
  if (workStddev < 5) consistency = "A+ (super consistent)";
  else if (workStddev < 10) consistency = "A (consistent)";
  else if (workStddev < 20) consistency = "B (acceptable)";
  else consistency = "C (variable)";

  var fade = null;
  if (workPaces.length >= 2) {
    var first = workPaces[0];
    var last = workPaces[workPaces.length - 1];
    var fadeSec = last - first;

    fade = {
      first_rep_pace: secToPace(first),
      last_rep_pace: secToPace(last),
      fade_sec: fadeSec,
      grade:
        Math.abs(fadeSec) < 5 ? "excellent (no fade)" :
        fadeSec > 10 ? "fatigue visible" :
        fadeSec < -10 ? "strong finish" :
        "minor fade"
    };
  }

  return {
    reps: workLaps.length,
    rest_reps: restLaps.length,

    work_pace_avg: secToPace(avg(workPaces)),
    work_pace_range: secToPace(minWork) + " — " + secToPace(maxWork),
    work_pace_stddev_sec: workStddev,
    work_pace_consistency: consistency,

    work_hr_avg: workHRs.length ? avg(workHRs) : null,
    work_hr_max: workHRs.length ? Math.max.apply(null, workHRs) : null,

    rest_pace_avg: restPaces.length ? secToPace(avg(restPaces)) : null,
    rest_hr_avg: restHRs.length ? avg(restHRs) : null,

    fade_analysis: fade,

    raw_counts: {
      classified_total: classified.length,
      work_laps: workLaps.length,
      rest_laps: restLaps.length,
      valid_work_paces: workPaces.length,
      valid_work_hrs: workHRs.length
    }
  };
}


  function compareToBaseline(workout, baseline) {
    if (!baseline) return null;
    var workoutPaceSec = paceToSec(workout.pace);
    var baselinePaceSec = paceToSec(baseline.pace);
    var hmTarget = 4 * 60 + 59; // 4:59
    return {
      vs_your_recent_avg: workoutPaceSec > 0 && baselinePaceSec > 0 ? {
        your_pace: workout.pace,
        baseline_pace: baseline.pace,
        delta_sec: workoutPaceSec - baselinePaceSec,
        verdict: workoutPaceSec < baselinePaceSec ? "faster than baseline" : workoutPaceSec > baselinePaceSec + 5 ? "slower than baseline" : "near baseline"
      } : null,
      vs_hm_target: workoutPaceSec > 0 ? {
        your_pace: workout.pace,
        hm_target: "4:59",
        delta_sec: workoutPaceSec - hmTarget,
        feasibility: workoutPaceSec < hmTarget + 10 ? "very feasible" : workoutPaceSec < hmTarget + 30 ? "achievable with focus" : "needs significant improvement"
      } : null
    };
  }

  function findSimilarWorkout(workout) {
    if (typeof DB === "undefined" || !DB.getAll) return Promise.resolve(null);
    return DB.getAll().then(function(acts) {
      var type = (workout.type || "").toLowerCase();
      var sameType = acts.filter(function(a) {
        if (a.date === workout.date) return false;
        var t = (a.type || "").toLowerCase();
        return t.indexOf(type.split("_")[0]) >= 0 && Math.abs(a.km - workout.km) < 3;
      });
      sameType.sort(function(a, b) { return b.date.localeCompare(a.date); });
      return sameType[0] || null;
    });
  }

  
function getIntervalRaceGap(workLapAnalysis) {
  if (!workLapAnalysis || !workLapAnalysis.work_pace_avg || workLapAnalysis.work_pace_avg === "-") {
    return null;
  }

  var workPaceSec = paceToSec(workLapAnalysis.work_pace_avg);
  var targetSec = paceToSec("4:59");

  if (!workPaceSec || !targetSec) return null;

  var gap = workPaceSec - targetSec;

  return {
    work_pace: workLapAnalysis.work_pace_avg,
    hm_target_pace: "4:59",
    gap_sec_per_km: gap,
    interpretation:
      gap <= 5 ? "very close to HM target pace" :
      gap <= 15 ? "close, achievable with consistency" :
      gap <= 30 ? "moderate gap, needs endurance-specific work" :
      "large gap, needs significant improvement"
  };
}


  async function analyze(activity) {
    if (!activity) return { error: "Brak aktywności" };

    var detail = null;
    if (activity.strava_id && typeof DB !== "undefined" && DB.getDetail) {
      try { detail = DB.getDetail(activity.strava_id); } catch (e) {}
    }

    if (!detail || !detail.splits) {
      return { error: "Brak szczegółowych danych (splits)" };
    }

    // === SMART PRE-COMPUTED ANALYTICS ===
    var splitAnalysis = analyzeSplits(detail.splits);

    var trainScore = null;
    var workLapAnalysis = null;
    
var planType = (activity.type || "").toLowerCase();

function isIntervalType(t) {
  return t.indexOf("interv") >= 0 ||
         t.indexOf("interw") >= 0 ||
         t.indexOf("interval") >= 0 ||
         t.indexOf("interwa") >= 0;
}

if (isIntervalType(planType) && typeof TrainScore !== "undefined") {

      try {
        var ts = TrainScore.evaluate(activity.date);
        if (ts) {
          trainScore = {
            total_score: ts.total,
            volume: ts.volume,
            intensity_score: ts.intensity ? ts.intensity.score : null,
            hr_score: ts.hr ? ts.hr.score : null,
            coach_message: ts.coachMsg,
            plan: ts.plan
          };
          if (ts.classified) {
            workLapAnalysis = analyzeWorkLaps(ts.classified, planType);
          }
        }
      } catch (e) { console.warn(TAG, "TrainScore failed:", e); }
    }

    // Health day before
    var health = null;
    if (typeof HealthImport !== "undefined") {
      var pd = new Date(activity.date);
      pd.setDate(pd.getDate() - 1);
      var prevStr = pd.toISOString().slice(0, 10);
      var h = HealthImport.getByDate(prevStr);
      if (h) {
        var baselines = HealthImport.getBaselines();
        health = {
          date: prevStr,
          sleep_h: (h.sleepMin / 60).toFixed(1),
          sleep_vs_baseline: ((h.sleepMin - baselines.sleepMin) / 60).toFixed(1) + "h",
          deep_min: h.deepMin,
          rem_min: h.remMin,
          rhr: h.rhr,
          rhr_vs_baseline: h.rhr - baselines.rhr,
          hrv: h.hrv,
          hrv_vs_baseline: h.hrv - baselines.hrv,
          recovery_assessment: (h.hrv > baselines.hrv && h.rhr <= baselines.rhr) ? "good" :
                              (h.hrv < baselines.hrv * 0.85 || h.rhr > baselines.rhr + 5) ? "poor" : "neutral"
        };
      }
    }

    // Comparison to similar
    var comparison = null;
    try {
      var similar = await findSimilarWorkout(activity);
      if (similar) {
        comparison = compareToBaseline(activity, similar);
        comparison.previous_similar = {
          date: similar.date,
          km: similar.km,
          pace: similar.pace,
          avg_hr: similar.avg_hr
        };
      }
    } catch (e) {}

    var payload = {
      mode: "workout",

workout: {
  date: activity.date,
  type: activity.type || "",
  km: activity.km,
  pace: activity.pace || activity.avg_pace,
  avg_pace: activity.pace || activity.avg_pace,
  avg_hr: activity.avg_hr || activity.average_heartrate,
  duration_min: activity.duration_min,
  notes: activity.notes
},

      // SMART PRECOMPUTED ANALYTICS
      
analytics: {
  splits_analysis: splitAnalysis,
  work_lap_analysis: workLapAnalysis,
  comparison: comparison,
  interval_race_gap: getIntervalRaceGap(workLapAnalysis)
},

      train_score: trainScore,
      pre_workout_health: health,
      race_target: {
        name: "Wizz Air Prague Night HM",
        date: "2026-09-06",
        target_pace: "4:59",
        target_time: "1:45:10"
      }
    };

    console.log(TAG, "Payload:", payload);

    try {
      var res = await fetch(WORKER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        var errText = await res.text();
        throw new Error("HTTP " + res.status + ": " + errText);
      }

      var data = await res.json();
      return { analysis: data.analysis, timestamp: data.timestamp, debug: payload };
    } catch (e) {
      console.error(TAG, "Error:", e);
      return { error: e.message };
    }
  }

  async function renderAsModal(activity) {
    var modal = document.createElement("div");
    modal.id = "wa-modal";
    modal.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto;";

    modal.innerHTML = "<div style='background:#111827;border-radius:14px;padding:18px;max-width:700px;width:100%;max-height:90vh;overflow-y:auto;border:1px solid #3b82f6;'>" +
      "<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;'>" +
      "<h3 style='margin:0;color:#f9fafb;'>\u{1F916} AI Analiza: " + activity.date + " (" + activity.km + "km)</h3>" +
      "<button onclick='document.getElementById(\"wa-modal\").remove()' style='background:#ef4444;border:none;color:white;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:1em;'>\u00D7</button>" +
      "</div>" +
      "<div id='wa-content' style='color:#e5e7eb;line-height:1.6;'>" +
      "<p style='color:#9ca3af;text-align:center;padding:30px;'>\u23F3 AI analizuje Twój trening (DeepSeek R1)...</p>" +
      "</div>" +
      "</div>";

    document.body.appendChild(modal);

    var result = await analyze(activity);
    var contentEl = document.getElementById("wa-content");
    if (!contentEl) return;

    if (result.error) {
      contentEl.innerHTML = "<p style='color:#fca5a5;text-align:center;'>\u274C " + result.error + "</p>";
      return;
    }

    var formatted = (result.analysis || "")
      .replace(/\n\n/g, "<br><br>")
      .replace(/\n/g, "<br>")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

    contentEl.innerHTML = "<div style='font-size:0.92em;'>" + formatted + "</div>" +
      "<details style='margin-top:14px;'>" +
      "<summary style='cursor:pointer;color:#9ca3af;font-size:0.75em;'>Dane wysłane do AI (debug)</summary>" +
      "<pre style='background:#000;padding:10px;border-radius:6px;font-size:0.7em;overflow-x:auto;color:#86efac;'>" +
      JSON.stringify(result.debug, null, 2) + "</pre>" +
      "</details>" +
      "<div style='margin-top:8px;color:#6b7280;font-size:0.7em;text-align:right;'>" +
      new Date(result.timestamp).toLocaleString() + " | DeepSeek R1</div>";
  }

  return { analyze: analyze, renderAsModal: renderAsModal };
})();

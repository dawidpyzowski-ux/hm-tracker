
/* daily-coach-engine.js v9 — Sprint 18+20+21+22 MERGED */
var DailyCoachEngine = (function() {
  "use strict";
  var TAG = "[DailyEngine]";

  // ============================================
  // HELPERS
  // ============================================
  function paceToSec(p) {
    if (!p) return 0;
    var parts = p.toString().split(":");
    if (parts.length !== 2) return 0;
    return parseInt(parts[0]) * 60 + parseInt(parts[1]);
  }

  function secToPace(s) {
    if (!s || s <= 0) return "-";
    return Math.floor(s/60) + ":" + String(Math.round(s%60)).padStart(2,"0");
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function linearSlope(arr) {
    if (!arr || arr.length < 2) return 0;
    var n = arr.length, sx = 0, sy = 0, sxy = 0, sx2 = 0;
    for (var i = 0; i < n; i++) {
      sx += i; sy += arr[i]; sxy += i * arr[i]; sx2 += i * i;
    }
    var denom = n * sx2 - sx * sx;
    return denom === 0 ? 0 : (n * sxy - sx * sy) / denom;
  }

  function localToday() {
    var d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString().slice(0, 10);
  }

  // ============================================
  // 1. READINESS SCORE
  // ============================================
  function getReadinessScore(health, baselines) {
    var components = {};
    var totalScore = 0;
    var totalWeight = 0;

    if (health.hrv && baselines.hrv) {
      var hrvRatio = health.hrv / baselines.hrv;
      var hrvScore = clamp(hrvRatio * 85, 30, 110);
      components.hrv = {
        value: health.hrv, baseline: baselines.hrv, delta: health.hrv - baselines.hrv,
        ratio_pct: Math.round(hrvRatio * 100), score: Math.round(hrvScore),
        status: hrvRatio >= 1.05 ? "excellent" : hrvRatio >= 0.95 ? "good" : hrvRatio >= 0.85 ? "moderate" : "low"
      };
      totalScore += hrvScore * 0.35; totalWeight += 0.35;
    }

    if (health.rhr && baselines.rhr) {
      var rhrDelta = health.rhr - baselines.rhr;
      var rhrScore = clamp(100 - rhrDelta * 5, 30, 110);
      components.rhr = {
        value: health.rhr, baseline: baselines.rhr, delta: rhrDelta, score: Math.round(rhrScore),
        status: rhrDelta <= -3 ? "excellent" : rhrDelta <= 1 ? "good" : rhrDelta <= 4 ? "moderate" : "elevated"
      };
      totalScore += rhrScore * 0.25; totalWeight += 0.25;
    }

    if (health.sleepMin) {
      var sleepH = health.sleepMin / 60;
      var sleepScore = sleepH >= 8 ? 105 : sleepH >= 7 ? 95 : sleepH >= 6 ? 70 : sleepH >= 5 ? 45 : 25;
      components.sleep = {
        value_h: +sleepH.toFixed(1),
        baseline_h: +(baselines.sleepMin / 60).toFixed(1),
        delta_h: +((health.sleepMin - baselines.sleepMin) / 60).toFixed(1),
        deep_min: health.deepMin || 0, rem_min: health.remMin || 0, score: sleepScore,
        status: sleepH >= 7.5 ? "excellent" : sleepH >= 7 ? "good" : sleepH >= 6 ? "moderate" : "poor"
      };
      totalScore += sleepScore * 0.25; totalWeight += 0.25;
    }

    if (health.deepMin && baselines.deepMin) {
      var deepRatio = health.deepMin / baselines.deepMin;
      var deepScore = clamp(deepRatio * 90, 30, 110);
      components.deep_quality = {
        value_min: health.deepMin, baseline_min: baselines.deepMin,
        ratio_pct: Math.round(deepRatio * 100), score: Math.round(deepScore),
        status: deepRatio >= 1.0 ? "good" : deepRatio >= 0.8 ? "moderate" : "low"
      };
      totalScore += deepScore * 0.15; totalWeight += 0.15;
    }

    var finalScore = totalWeight > 0 ? Math.round(totalScore / totalWeight) : 50;
    var level, color, label;
    if (finalScore >= 85) { level = "excellent"; color = "green"; label = "Swietna gotowosc"; }
    else if (finalScore >= 70) { level = "good"; color = "lightgreen"; label = "Dobra gotowosc"; }
    else if (finalScore >= 55) { level = "moderate"; color = "yellow"; label = "Umiarkowana gotowosc"; }
    else if (finalScore >= 40) { level = "low"; color = "orange"; label = "Niska gotowosc"; }
    else { level = "critical"; color = "red"; label = "Krytyczna gotowosc"; }

    return { score: finalScore, level: level, color: color, label: label, components: components };
  }

  // ============================================
  // 2. TRENDS
  // ============================================
  function analyzeMetric(values) {
    if (!values || values.length < 2) return null;
    var avg = values.reduce(function(a,b) { return a+b; }, 0) / values.length;
    var slope = linearSlope(values);
    var direction = Math.abs(slope) < 0.3 ? "stable" : slope > 0 ? "up" : "down";
    return {
      avg: Math.round(avg * 10) / 10, slope_per_day: +slope.toFixed(2),
      direction: direction, min: Math.min.apply(null, values), max: Math.max.apply(null, values),
      n: values.length
    };
  }

  function computeTrends(history) {
    if (!history || history.length < 3) return null;
    var last7 = history.slice(-7);
    var last3 = history.slice(-3);
    return {
      hrv_7d: analyzeMetric(last7.map(function(h) { return h.hrv; }).filter(function(v) { return v > 0; })),
      hrv_3d: analyzeMetric(last3.map(function(h) { return h.hrv; }).filter(function(v) { return v > 0; })),
      rhr_7d: analyzeMetric(last7.map(function(h) { return h.rhr; }).filter(function(v) { return v > 0; })),
      rhr_3d: analyzeMetric(last3.map(function(h) { return h.rhr; }).filter(function(v) { return v > 0; })),
      sleep_7d: analyzeMetric(last7.map(function(h) { return h.sleepMin / 60; }).filter(function(v) { return v > 0; })),
      deep_7d: analyzeMetric(last7.map(function(h) { return h.deepMin; }).filter(function(v) { return v > 0; }))
    };
  }

  // ============================================
  // 3. ANOMALY DETECTION
  // ============================================
  function detectAnomalies(health, baselines, history) {
    var anomalies = [];
    if (!health) return anomalies;

    if (health.hrv && baselines.hrv) {
      var ratio = health.hrv / baselines.hrv;
      if (ratio < 0.7) anomalies.push({ type: "danger", metric: "HRV", message: "HRV " + health.hrv + " ms to " + Math.round((1-ratio)*100) + "% ponizej baseline " + baselines.hrv + " ms — mozliwe przeciazenie/choroba", severity: "high" });
      else if (ratio < 0.85) anomalies.push({ type: "warning", metric: "HRV", message: "HRV obnizone " + Math.round((1-ratio)*100) + "% vs baseline", severity: "medium" });
      else if (ratio > 1.15) anomalies.push({ type: "positive", metric: "HRV", message: "HRV +" + Math.round((ratio-1)*100) + "% vs baseline — swietna regeneracja", severity: "low" });
    }

    if (health.rhr && baselines.rhr) {
      var rDelta = health.rhr - baselines.rhr;
      if (rDelta >= 7) anomalies.push({ type: "danger", metric: "RHR", message: "RHR +" + rDelta + " bpm vs baseline — mozliwe przeciazenie lub poczatek choroby", severity: "high" });
      else if (rDelta >= 4) anomalies.push({ type: "warning", metric: "RHR", message: "RHR podwyzszone o " + rDelta + " bpm", severity: "medium" });
      else if (rDelta <= -4) anomalies.push({ type: "positive", metric: "RHR", message: "RHR " + rDelta + " bpm vs baseline — bardzo dobra forma aerobowa", severity: "low" });
    }

    if (health.sleepMin) {
      var sleepH = health.sleepMin / 60;
      if (sleepH < 5.5) anomalies.push({ type: "danger", metric: "Sen", message: "Sen tylko " + sleepH.toFixed(1) + "h — znaczacy deficyt", severity: "high" });
      else if (sleepH < 6.5) anomalies.push({ type: "warning", metric: "Sen", message: "Sen " + sleepH.toFixed(1) + "h — ponizej optymalnego (7h+)", severity: "medium" });
    }

    if (health.deepMin && baselines.deepMin && health.deepMin < baselines.deepMin * 0.6) {
      anomalies.push({ type: "warning", metric: "Deep Sleep", message: "Deep sleep " + health.deepMin + "m vs baseline " + baselines.deepMin + "m — slaba jakosc regeneracji", severity: "medium" });
    }

    if (history && history.length >= 3 && baselines.hrv) {
      var last3 = history.slice(-3);
      var hrvDownStreak = 0;
      last3.forEach(function(h) {
        if (h.hrv && h.hrv < baselines.hrv * 0.9) hrvDownStreak++;
      });
      if (hrvDownStreak >= 3) anomalies.push({ type: "warning", metric: "Trend HRV", message: "HRV ponizej baseline przez 3 dni z rzedu — skumulowane zmeczenie ukladu nerwowego", severity: "high" });
    }

    if (history && history.length >= 3) {
      var shortSleepCount = 0;
      history.slice(-3).forEach(function(h) {
        if (h.sleepMin && h.sleepMin < 360) shortSleepCount++;
      });
      if (shortSleepCount >= 2) anomalies.push({ type: "warning", metric: "Sen", message: shortSleepCount + " z ostatnich 3 nocy <6h — deficyt snu kumuluje sie", severity: "high" });
    }

    if (health.hrv && health.rhr && baselines.hrv && baselines.rhr) {
      if (health.hrv < baselines.hrv * 0.85 && health.rhr > baselines.rhr + 4) {
        anomalies.push({ type: "danger", metric: "Overtraining", message: "HRV nisko + RHR wysoko jednoczesnie — klasyczny marker przeciazenia/infekcji", severity: "high" });
      }
    }

    if (health.hrv && health.rhr && baselines.hrv && baselines.rhr) {
      if (health.hrv > baselines.hrv * 1.05 && health.rhr <= baselines.rhr - 3 && health.sleepMin >= 420) {
        anomalies.push({ type: "positive", metric: "Peak Form", message: "HRV wysoko + RHR nisko + sen >7h — peak forma na quality trening", severity: "low" });
      }
    }

    // SPRINT 22: Wrist Temp anomaly
    if (health.wristTemp && history && history.length >= 5) {
      var tempValues = history.map(function(h) { return h.wristTemp; }).filter(function(v) { return v > 0; });
      if (tempValues.length >= 3) {
        var tempBaseline = tempValues.reduce(function(a,b){return a+b;}, 0) / tempValues.length;
        var tempDelta = health.wristTemp - tempBaseline;
        if (tempDelta >= 0.6) {
          anomalies.push({ type: "danger", metric: "Wrist Temp", message: "Wrist temp +" + tempDelta.toFixed(1) + "°C vs baseline — wczesny sygnał choroby/infekcji", severity: "high" });
        } else if (tempDelta >= 0.3) {
          anomalies.push({ type: "warning", metric: "Wrist Temp", message: "Wrist temp +" + tempDelta.toFixed(1) + "°C vs baseline — obserwuj objawy", severity: "medium" });
        }
      }
    }

    // SPRINT 22: Respiratory Rate anomaly
    if (health.respRate && history && history.length >= 5) {
      var rrValues = history.map(function(h) { return h.respRate; }).filter(function(v) { return v > 0; });
      if (rrValues.length >= 3) {
        var rrBaseline = rrValues.reduce(function(a,b){return a+b;}, 0) / rrValues.length;
        var rrDelta = health.respRate - rrBaseline;
        if (rrDelta >= 3) {
          anomalies.push({ type: "warning", metric: "Resp Rate", message: "Oddechów/min +" + Math.round(rrDelta) + " vs baseline (" + Math.round(rrBaseline) + ") — pre-illness signal", severity: "high" });
        }
      }
    }

    // SPRINT 22: Body anomalies
    if (typeof BodyTracker !== "undefined") {
      try {
        var bodyAnomalies = BodyTracker.detectAnomalies();
        if (bodyAnomalies && bodyAnomalies.length) {
          bodyAnomalies.forEach(function(a) { anomalies.push(a); });
        }
      } catch(e) {}
    }

    return anomalies;
  }

  // ============================================
  // 4. TRAINING CONTEXT
  // ============================================
  function normalizeTrainings() {
    if (typeof S === "undefined" || !S.getAllLogs) return [];
    var logs = S.getAllLogs();
    var arr = [];
    Object.keys(logs).forEach(function(d) {
      var l = logs[d];
      if (!l || (!l.distance && !l.km)) return;
      var planType = "", planKm = null, planPace = "", planNotes = "";
      try {
        if (window.PLAN_FLAT) {
          var p = window.PLAN_FLAT.find(function(x) { return x.date === d; });
          if (p) {
            planType = p.type || ""; planKm = p.km || null;
            planPace = p.pace || ""; planNotes = p.notes || p.desc || "";
          }
        }
      } catch(e) {}
      var finalType = l.type || l.workout_type || planType || "";
      arr.push({
        date: d, km: parseFloat(l.km || l.distance) || 0, pace: l.pace || "",
        type: finalType, plan_type: planType, plan_km: planKm,
        plan_pace: planPace, plan_notes: planNotes,
        avg_hr: l.hr || l.avg_hr || null, strava_id: l.strava_id || null
      });
    });
    return arr.sort(function(a,b) { return b.date.localeCompare(a.date); });
  }

  function getTrainingContext(today) {
    var trainings = normalizeTrainings();
    if (!trainings.length) return null;
    var todayD = new Date(today);
    var weekStart = new Date(todayD.getTime() - 7 * 86400000).toISOString().slice(0, 10);
    var weekTrainings = trainings.filter(function(t) { return t.date >= weekStart && t.date <= today; });
    var weekKm = weekTrainings.reduce(function(s, t) { return s + t.km; }, 0);

    var lastT = trainings[0];
    var daysSinceLast = lastT ? Math.round((todayD - new Date(lastT.date)) / 86400000) : null;

    var hardKeywords = ["interv", "interw", "tempo", "long", "race", "fartlek"];
    var lastHard = trainings.find(function(t) {
      var type = (t.type || t.plan_type || "").toLowerCase();
      return hardKeywords.some(function(h) { return type.indexOf(h) >= 0; });
    });
    var daysSinceHard = lastHard ? Math.round((todayD - new Date(lastHard.date)) / 86400000) : null;

    var consecDays = 0;
    var dateSet = {};
    trainings.forEach(function(t) { dateSet[t.date] = true; });
    for (var i = 1; i < 60; i++) {
      var d = new Date(todayD.getTime() - i * 86400000).toISOString().slice(0, 10);
      if (dateSet[d]) consecDays++;
      else break;
    }

    var month30 = trainings.filter(function(t) {
      var dd = (todayD - new Date(t.date)) / 86400000;
      return dd >= 0 && dd <= 30;
    });
    var longestRun = month30.length ? month30.reduce(function(max, t) { return t.km > max.km ? t : max; }, month30[0]) : null;

    function isIntervalType(t) {
      t = String(t || "").toLowerCase();
      return t.indexOf("interv") >= 0 || t.indexOf("interw") >= 0 ||
             t.indexOf("interval") >= 0 || t.indexOf("interwa") >= 0;
    }

    function getLapPaceSec(l) {
      var p = l.pace || l.paceSec || l.avgPace || l.avg_pace || null;
      if (typeof p === "string" && p.indexOf(":") > -1) return paceToSec(p);
      if (p !== null && p !== undefined) {
        p = parseFloat(p);
        if (isFinite(p) && p > 0 && p < 1500) return Math.round(p);
      }
      var dist = parseFloat(l.distKm || l.distanceKm || l.km || 0);
      if (!dist && l.distance) dist = parseFloat(l.distance) / 1000;
      var dur = parseFloat(l.durationSec || l.duration_s || l.moving_time || l.elapsed_time || l.time || l.duration || 0);
      if (dur > 0 && dur < 60) dur = dur * 60;
      if (dist > 0 && dur > 0) {
        var pace = Math.round(dur / dist);
        if (isFinite(pace) && pace > 0 && pace < 1500) return pace;
      }
      return null;
    }

    function getIntervalCandidate(t) {
      var type = t.type || t.plan_type || "";
      if (!isIntervalType(type)) return null;
      var daysAgo = Math.round((todayD - new Date(t.date)) / 86400000);
      if (daysAgo < 0) return null;
      var workPace = null, source = "overall", trainScoreTotal = null, workLapCount = 0;
      try {
        if (typeof TrainScore !== "undefined") {
          var ts = TrainScore.evaluate(t.date);
          if (ts) trainScoreTotal = ts.total || null;
          if (ts && ts.classified) {
            var workLaps = ts.classified.filter(function(l) {
              var r = String(l.role || l.type || "").toLowerCase();
              return r === "work" || r.indexOf("work") >= 0 || r.indexOf("interv") >= 0 || r.indexOf("interw") >= 0;
            });
            workLapCount = workLaps.length;
            var paces = workLaps.map(getLapPaceSec).filter(function(p) { return p && p > 0 && isFinite(p); });
            if (paces.length > 0) {
              workPace = Math.round(paces.reduce(function(a, b) { return a + b; }, 0) / paces.length);
              source = "work";
            }
          }
        }
      } catch(e) {}
      if (!workPace && t.pace) { workPace = paceToSec(t.pace); source = "overall"; }
      if (!workPace || workPace <= 0) return null;
      return {
        date: t.date, km: t.km, type: type,
        pace: secToPace(workPace), pace_sec: workPace, pace_source: source,
        overall_pace: t.pace, plan_type: t.plan_type || null,
        train_score: trainScoreTotal, work_laps: workLapCount, days_ago: daysAgo
      };
    }

    var intervalCandidates = trainings.map(getIntervalCandidate).filter(function(c) { return !!c; });
    var recentWorkCandidates = intervalCandidates.filter(function(c) { return c.pace_source === "work" && c.days_ago <= 14; }).sort(function(a, b) { return b.date.localeCompare(a.date); });
    var olderWorkCandidates = intervalCandidates.filter(function(c) { return c.pace_source === "work" && c.days_ago <= 30; }).sort(function(a, b) { return b.date.localeCompare(a.date); });
    var recentOverallCandidates = intervalCandidates.filter(function(c) { return c.pace_source === "overall" && c.days_ago <= 14; }).sort(function(a, b) { return b.date.localeCompare(a.date); });

    var recentWorkPaces = recentWorkCandidates.map(function(c) { return c.pace_sec; });
    var speedStability = { sample_n: recentWorkPaces.length, stddev_sec: null, stable: false, confidence: "low" };
    if (recentWorkPaces.length >= 3) {
      var avg = recentWorkPaces.reduce(function(a, b) { return a + b; }, 0) / recentWorkPaces.length;
      var variance = recentWorkPaces.reduce(function(s, v) { return s + Math.pow(v - avg, 2); }, 0) / recentWorkPaces.length;
      var std = Math.round(Math.sqrt(variance));
      speedStability.stddev_sec = std;
      speedStability.stable = std <= 8;
      speedStability.confidence = std <= 8 ? "high" : "medium";
    } else if (recentWorkPaces.length === 2) {
      var diff = Math.abs(recentWorkPaces[0] - recentWorkPaces[1]);
      speedStability.stddev_sec = diff;
      speedStability.confidence = "medium_low";
    }

    var bestInterval = null, intervalReferenceLogic = null;
    if (recentWorkCandidates.length) { bestInterval = recentWorkCandidates[0]; intervalReferenceLogic = "latest_work_pace_last_14d"; }
    else if (olderWorkCandidates.length) { bestInterval = olderWorkCandidates[0]; intervalReferenceLogic = "latest_work_pace_last_30d"; }
    else if (recentOverallCandidates.length) { bestInterval = recentOverallCandidates[0]; intervalReferenceLogic = "latest_overall_interval_pace_last_14d"; }

    return {
      week_km: +weekKm.toFixed(1),
      week_sessions: weekTrainings.length,
      days_since_last: daysSinceLast,
      days_since_hard: daysSinceHard,
      consecutive_days: consecDays,
      last_3_trainings: trainings.slice(0, 3).map(function(t) { return { date: t.date, type: t.type, plan_type: t.plan_type, km: t.km, pace: t.pace, hr: t.avg_hr }; }),
      longest_recent: longestRun ? { date: longestRun.date, km: longestRun.km, pace: longestRun.pace } : null,
      best_interval: bestInterval ? {
        date: bestInterval.date, km: bestInterval.km, type: bestInterval.type, pace: bestInterval.pace,
        pace_sec: bestInterval.pace_sec, pace_source: bestInterval.pace_source, overall_pace: bestInterval.overall_pace,
        plan_type: bestInterval.plan_type, train_score: bestInterval.train_score, work_laps: bestInterval.work_laps,
        days_ago: bestInterval.days_ago, reference_logic: intervalReferenceLogic, speed_stability: speedStability
      } : null,
      speed_stability: speedStability,
      interval_candidates_debug: intervalCandidates.slice(0, 6)
    };
  }

  // ============================================
  // 5. RACE CONTEXT
  // ============================================
  function getRaceContext(today, raceDate, raceTarget, training) {
    var todayD = new Date(today);
    var raceD = new Date(raceDate);
    var daysToRace = Math.round((raceD - todayD) / 86400000);

    var phase;
    if (daysToRace <= 0) phase = "race_done";
    else if (daysToRace <= 14) phase = "taper";
    else if (daysToRace <= 42) phase = "peak";
    else if (daysToRace <= 84) phase = "build";
    else phase = "base";

    var longestKm = training && training.longest_recent ? training.longest_recent.km : 0;
    var enduranceStatus = longestKm >= 18 ? "ready" : longestKm >= 15 ? "near_ready" : longestKm >= 12 ? "developing" : "early";

    var speedStatus = "unknown", speedGap = null, speedSource = null, speedReference = null, speedConfidence = "low";
    if (training && training.best_interval && training.best_interval.pace) {
      var bestSec = paceToSec(training.best_interval.pace);
      var targetSec = paceToSec(raceTarget);
      speedGap = bestSec - targetSec;
      speedSource = training.best_interval.pace_source || "overall";
      var stability = training.best_interval.speed_stability || training.speed_stability || { sample_n: 0, stddev_sec: null, stable: false, confidence: "low" };
      speedConfidence = stability.confidence || "low";
      speedReference = {
        date: training.best_interval.date, pace: training.best_interval.pace,
        source: speedSource, days_ago: training.best_interval.days_ago,
        reference_logic: training.best_interval.reference_logic,
        train_score: training.best_interval.train_score || null, stability: stability
      };
      if (speedSource === "work") {
        if (speedGap <= 0 && stability.stable === true && stability.sample_n >= 3) speedStatus = "ready";
        else if (speedGap <= 10) speedStatus = "close";
        else if (speedGap <= 20) speedStatus = "developing";
        else speedStatus = "early";
      } else {
        if (speedGap <= 30) speedStatus = "close";
        else if (speedGap <= 60) speedStatus = "developing";
        else speedStatus = "early";
      }
    }

    var overall;
    if (speedStatus === "ready" && enduranceStatus === "ready") overall = "race_ready";
    else if ((speedStatus === "ready" || speedStatus === "close") && enduranceStatus === "ready") overall = "endurance_ready_speed_close";
    else if ((speedStatus === "ready" || speedStatus === "close") && enduranceStatus === "near_ready") overall = "speed_ok_need_endurance";
    else if (speedStatus === "ready" || speedStatus === "close") overall = "speed_ok_endurance_building";
    else if (enduranceStatus === "ready" || enduranceStatus === "near_ready") overall = "endurance_ok_need_speed";
    else overall = "still_building";

    return {
      days_to_race: daysToRace, phase: phase, target_pace: raceTarget,
      endurance_status: enduranceStatus, longest_run_km: longestKm,
      speed_status: speedStatus, speed_gap_sec_per_km: speedGap,
      speed_source: speedSource, speed_reference: speedReference,
      speed_confidence: speedConfidence, overall_readiness: overall
    };
  }

  // ============================================
  // 6. DECISION TREE
  // ============================================
  function recommendToday(readiness, anomalies, training, planToday) {
    if (!readiness) return null;
    var rec = { action: null, intensity: null, km: null, pace: null, hr_cap: null, reasoning: [], avoid: [] };

    var dangers = anomalies.filter(function(a) { return a.severity === "high" && a.type === "danger"; });
    if (dangers.length >= 2) {
      rec.action = "REST_MANDATORY"; rec.intensity = "none";
      rec.reasoning.push("Wiele sygnalow ostrzegawczych: " + dangers.map(function(a) { return a.metric; }).join(", "));
      rec.avoid.push("Jakikolwiek bieg", "Trening silowy");
      return rec;
    }

    if (readiness.score < 45) {
      rec.action = "REST_OR_VERY_EASY"; rec.intensity = "low"; rec.km = 4; rec.pace = "6:40+"; rec.hr_cap = 135;
      rec.reasoning.push("Readiness " + readiness.score + "/100 (krytyczna) — priorytet regeneracja");
      rec.avoid.push("Tempo", "Interwaly", "Long run");
      return rec;
    }

    var hardYesterday = training && training.days_since_hard !== null && training.days_since_hard <= 1;
    if (hardYesterday && readiness.score < 60) {
      rec.action = "EASY_RECOVERY"; rec.intensity = "low"; rec.km = 5; rec.pace = "6:30"; rec.hr_cap = 140;
      rec.reasoning.push("Hard wczoraj + readiness " + readiness.score + "/100 — recovery day");
      rec.avoid.push("Tempo", "Interwaly");
      return rec;
    }

    if (planToday) {
      var planType = (planToday.type || "").toLowerCase();
      var planIsHard = ["interv", "interw", "tempo", "long", "race"].some(function(k) { return planType.indexOf(k) >= 0; });
      if (planIsHard && readiness.score < 60) {
        rec.action = "MODIFY_PLAN_TO_EASY"; rec.intensity = "low"; rec.km = planToday.km; rec.pace = "6:30"; rec.hr_cap = 145;
        rec.reasoning.push("Plan: " + planToday.type + " " + planToday.km + "km — ale readiness " + readiness.score + "/100");
        rec.reasoning.push("Zamiana na easy run tej samej dlugosci");
        return rec;
      }
      if (planIsHard && hardYesterday) {
        rec.action = "MODIFY_PLAN_TO_EASY"; rec.intensity = "low"; rec.km = Math.min(planToday.km, 8); rec.pace = "6:30"; rec.hr_cap = 145;
        rec.reasoning.push("Plan hard + wczoraj hard — 2 hard z rzedu nie zalecane");
        return rec;
      }
      rec.action = "FOLLOW_PLAN"; rec.intensity = planIsHard ? "hard" : "moderate";
      rec.km = planToday.km; rec.pace = planToday.pace;
      rec.reasoning.push("Readiness " + readiness.score + "/100 pozwala na realizacje planu");
      if (planToday.notes) rec.reasoning.push("Plan: " + planToday.notes);
      return rec;
    }

    if (readiness.score >= 75) {
      rec.action = "FREE_QUALITY"; rec.intensity = "moderate"; rec.km = 8; rec.pace = "5:30-6:00";
      rec.reasoning.push("Dobra gotowosc (" + readiness.score + "/100), brak planu — mozliwy quality run");
    } else if (readiness.score >= 55) {
      rec.action = "EASY"; rec.intensity = "low"; rec.km = 6; rec.pace = "6:30"; rec.hr_cap = 145;
      rec.reasoning.push("Umiarkowana gotowosc — easy run optymalne");
    } else {
      rec.action = "EASY_OR_REST"; rec.intensity = "low"; rec.km = 5; rec.pace = "6:40"; rec.hr_cap = 140;
      rec.reasoning.push("Niska gotowosc — lekki bieg lub odpoczynek");
      rec.avoid.push("Quality");
    }
    return rec;
  }

  // ============================================
  // 7. CROSS INSIGHTS
  // ============================================
  function getCrossInsights() {
    if (typeof HealthCross === "undefined") return [];
    try {
      var res = HealthCross.analyze();
      if (!res || !res.insights) return [];
      return res.insights.filter(function(i) { return i.type !== "info"; }).slice(0, 3).map(function(i) { return { title: i.title, message: i.msg }; });
    } catch(e) { return []; }
  }

  // ============================================
  // 8. WEEKLY REPORT
  // ============================================
  function getWeeklyReportData(today, allActivities) {
    if (!allActivities || !allActivities.length) return null;
    var todayD = new Date(today);

    function getMondayOf(date) {
      var d = new Date(date);
      var day = d.getDay();
      var diff = day === 0 ? -6 : 1 - day;
      d.setDate(d.getDate() + diff);
      d.setHours(0, 0, 0, 0);
      return d;
    }

    var thisMonday = getMondayOf(todayD);
    var thisSunday = new Date(thisMonday); thisSunday.setDate(thisSunday.getDate() + 6); thisSunday.setHours(23, 59, 59, 999);
    var lastMonday = new Date(thisMonday); lastMonday.setDate(lastMonday.getDate() - 7);
    var lastSunday = new Date(thisSunday); lastSunday.setDate(lastSunday.getDate() - 7);

    function inRange(dateStr, start, end) {
      var d = new Date(dateStr);
      return d >= start && d <= end;
    }

    function calcStats(acts) {
      var km = 0, sessions = 0, totalPaceSecKm = 0, paceKm = 0, totalHR = 0, hrCount = 0;
      acts.forEach(function(a) {
        sessions++;
        var aKm = parseFloat(a.km || 0);
        km += aKm;
        var ps = paceToSec(a.pace);
        if (ps > 0 && aKm > 0) { totalPaceSecKm += ps * aKm; paceKm += aKm; }
        if (a.avg_hr) { totalHR += parseFloat(a.avg_hr); hrCount++; }
      });
      return {
        km: +km.toFixed(1), workouts: sessions,
        avgPace: paceKm > 0 ? secToPace(Math.round(totalPaceSecKm / paceKm)) : "-",
        avgHR: hrCount > 0 ? Math.round(totalHR / hrCount) : 0
      };
    }

    var currentActs = allActivities.filter(function(a) { return inRange(a.date, thisMonday, thisSunday); });
    var previousActs = allActivities.filter(function(a) { return inRange(a.date, lastMonday, lastSunday); });
    var statsCur = calcStats(currentActs);
    var statsPrev = calcStats(previousActs);

    var planKm = 0, planSessions = 0, planKmPrev = 0, planSessionsPrev = 0;
    if (window.PLAN_FLAT) {
      window.PLAN_FLAT.forEach(function(p) {
        if (inRange(p.date, thisMonday, thisSunday)) { planKm += parseFloat(p.km || 0); planSessions++; }
        if (inRange(p.date, lastMonday, lastSunday)) { planKmPrev += parseFloat(p.km || 0); planSessionsPrev++; }
      });
    }

    var adherence = {
      km_pct: planKm > 0 ? Math.round(statsCur.km / planKm * 100) : 0,
      sessions_pct: planSessions > 0 ? Math.round(statsCur.workouts / planSessions * 100) : 0,
      km_done: statsCur.km, km_planned: +planKm.toFixed(1),
      km_remaining: +(planKm - statsCur.km).toFixed(1),
      sessions_done: statsCur.workouts, sessions_planned: planSessions,
      sessions_remaining: Math.max(0, planSessions - statsCur.workouts)
    };

    var grade;
    if (adherence.km_pct >= 95) grade = "A";
    else if (adherence.km_pct >= 80) grade = "B";
    else if (adherence.km_pct >= 60) grade = "C";
    else if (adherence.km_pct >= 40) grade = "D";
    else grade = "F";

    return {
      current: {
        stats: statsCur,
        plan: { km: +planKm.toFixed(1), sessions: planSessions },
        adherence: adherence, grade: grade,
        date_range: { monday: thisMonday.toISOString().slice(0, 10), sunday: thisSunday.toISOString().slice(0, 10) }
      },
      previous: {
        stats: statsPrev,
        plan: { km: +planKmPrev.toFixed(1), sessions: planSessionsPrev },
        date_range: { monday: lastMonday.toISOString().slice(0, 10), sunday: lastSunday.toISOString().slice(0, 10) }
      },
      week_over_week: {
        km_change: +(statsCur.km - statsPrev.km).toFixed(1),
        km_change_pct: statsPrev.km > 0 ? Math.round((statsCur.km - statsPrev.km) / statsPrev.km * 100) : null,
        sessions_change: statsCur.workouts - statsPrev.workouts,
        avgHR_change: statsCur.avgHR && statsPrev.avgHR ? statsCur.avgHR - statsPrev.avgHR : null
      }
    };
  }

  function getWeekScore() {
    if (typeof TrainScore === "undefined" || !TrainScore.weekScore) return null;
    try { return TrainScore.weekScore(); } catch(e) { return null; }
  }

  function calculateACWR(activities, today) {
    if (!activities || !activities.length) return null;
    var todayD = new Date(today);
    var acuteLoad = 0, chronicLoad = 0;
    activities.forEach(function(a) {
      var daysAgo = (todayD - new Date(a.date)) / 86400000;
      if (daysAgo < 0 || daysAgo > 28) return;
      var paceStr = a.pace || "6:00";
      var paceSec = paceToSec(paceStr);
      var intensityFactor;
      if (paceSec === 0 || paceSec > 400) intensityFactor = 0.7;
      else if (paceSec > 360) intensityFactor = 0.85;
      else if (paceSec > 320) intensityFactor = 1.0;
      else if (paceSec > 280) intensityFactor = 1.2;
      else intensityFactor = 1.4;
      var load = parseFloat(a.km || 0) * intensityFactor;
      chronicLoad += load;
      if (daysAgo <= 7) acuteLoad += load;
    });
    var acuteAvg = acuteLoad / 7;
    var chronicAvg = chronicLoad / 28;
    var acwr = chronicAvg > 0 ? +(acuteAvg / chronicAvg).toFixed(2) : 0;
    var zone, interpretation, risk_pct;
    if (acwr < 0.8) { zone = "undertrained"; interpretation = "Możesz dodać objętość — jesteś poniżej optymalnej strefy"; risk_pct = 10; }
    else if (acwr <= 1.3) { zone = "sweet_spot"; interpretation = "Optymalna strefa progresji — utrzymaj rytm"; risk_pct = 5; }
    else if (acwr <= 1.5) { zone = "caution"; interpretation = "Ostrożnie z dodawaniem — zbliżasz się do strefy ryzyka"; risk_pct = 35; }
    else { zone = "high_risk"; interpretation = "Wysokie ryzyko kontuzji — odpocznij/zmniejsz objętość"; risk_pct = 65; }
    return {
      acwr: acwr, zone: zone,
      acute_7d_load: +acuteLoad.toFixed(1),
      chronic_28d_load: +chronicLoad.toFixed(1),
      injury_risk_pct: risk_pct, interpretation: interpretation
    };
  }

  function canAddTraining(acwr, weeklyReport, readiness, training, race) {
    var blockers = [], allowances = [];
    if (acwr) {
      if (acwr.zone === "high_risk") blockers.push("ACWR " + acwr.acwr + " (high risk — ryzyko kontuzji 65%)");
      else if (acwr.zone === "caution") blockers.push("ACWR " + acwr.acwr + " (caution — ryzyko 35%)");
    }
    if (readiness && readiness.score < 55) blockers.push("Readiness " + readiness.score + "/100 zbyt niskie");
    if (training && training.consecutive_days >= 4) blockers.push(training.consecutive_days + " dni z rzędu treningowe — potrzebny rest");
    if (weeklyReport && weeklyReport.week_over_week && weeklyReport.week_over_week.km_change_pct > 15) {
      blockers.push("Wzrost vs poprzedni tydzień +" + weeklyReport.week_over_week.km_change_pct + "% (10% rule!)");
    }
    if (acwr) {
      if (acwr.zone === "undertrained") allowances.push("ACWR " + acwr.acwr + " (undertrained — możesz dodać)");
      else if (acwr.zone === "sweet_spot") allowances.push("ACWR " + acwr.acwr + " (sweet spot)");
    }
    if (readiness && readiness.score >= 75) allowances.push("Readiness " + readiness.score + "/100 — bardzo dobre");
    if (training && training.days_since_hard !== null && training.days_since_hard >= 2) {
      allowances.push(training.days_since_hard + " dni od hard — odpowiedni recovery");
    }
    var verdict, what, km, reason;
    if (blockers.length >= 2) { verdict = "no"; what = null; km = null; reason = "Wiele sygnałów ostrzegawczych — trzymaj się planu lub zmniejsz objętość"; }
    else if (blockers.length === 1) { verdict = "modify_plan_only"; what = null; km = null; reason = "Jeden sygnał ostrzegawczy — nie dodawaj, ale realizuj plan ostrożnie"; }
    else if (allowances.length >= 3) { verdict = "yes"; what = "easy"; km = "8-10"; reason = "Wszystkie sygnały zielone — możesz dorzucić easy run"; }
    else if (allowances.length >= 2) { verdict = "yes_easy"; what = "easy"; km = "6-8"; reason = "Większość sygnałów zielonych — easy run OK"; }
    else if (allowances.length >= 1) { verdict = "yes_if_feel_good"; what = "easy"; km = "5-6"; reason = "Pojedynczy zielony sygnał — easy run jeśli czujesz się dobrze"; }
    else { verdict = "stick_to_plan"; what = null; km = null; reason = "Brak jasnych sygnałów — trzymaj się planu"; }
    return {
      verdict: verdict, what: what, km: km, reason: reason,
      blockers: blockers, allowances: allowances,
      blocker_count: blockers.length, allowance_count: allowances.length
    };
  }

  // ============================================
  // MAIN: COMPUTE EVERYTHING
  // ============================================
  async function compute() {
    if (typeof HealthImport === "undefined") return { error: "HealthImport not loaded" };

    var today = localToday();
    var todayHealth = HealthImport.getByDate(today);
    var latestHealth = HealthImport.getLatest();
    var effective = (todayHealth && todayHealth.sleepMin > 0) ? todayHealth : latestHealth;
    if (!effective) return { error: "Brak danych health" };

    var healthAge = Math.round((new Date(today) - new Date(effective.date)) / 86400000);
    var baselines = HealthImport.getBaselines();
    var history = HealthImport.getHistory(14);

    var readiness = getReadinessScore(effective, baselines);
    var trends = computeTrends(history);
    var anomalies = detectAnomalies(effective, baselines, history);
    var training = getTrainingContext(today);

    var planToday = null;
    if (window.PLAN_FLAT) {
      planToday = window.PLAN_FLAT.find(function(p) { return p.date === today; }) || null;
    }

    var race = getRaceContext(today, "2026-09-06", "4:59", training);
    var recommendation = recommendToday(readiness, anomalies, training, planToday);
    var crossInsights = getCrossInsights();

    // SPRINT 20: Wciągamy istniejące moduły
    var coachAdvice = null;
    var allActivities = [];
    try {
      if (typeof DB !== "undefined" && DB.getAll) {
        allActivities = await DB.getAll();
        if (typeof Coach !== "undefined" && Coach.getAdvice) {
          coachAdvice = Coach.getAdvice(allActivities, window.PLAN_FLAT);
        }
      }
    } catch(e) { console.warn(TAG, "DB/Coach failed:", e); }

    var weeklyReport = getWeeklyReportData(today, allActivities);
    var weekScore = getWeekScore();
    var acwr = calculateACWR(allActivities, today);
    var canAdd = canAddTraining(acwr, weeklyReport, readiness, training, race);

    // SPRINT 21+22: Nowe moduły
    var powerData = null, bodyData = null, biomechData = null;
    try {
      if (typeof PowerEngine !== "undefined" && allActivities.length > 0) {
        powerData = await PowerEngine.compute(allActivities);
      }
    } catch(e) { console.warn(TAG, "PowerEngine failed:", e); }
    try {
      if (typeof BodyTracker !== "undefined") bodyData = BodyTracker.compute();
    } catch(e) { console.warn(TAG, "BodyTracker failed:", e); }
    try {
      if (typeof BiomechanicsEngine !== "undefined") biomechData = BiomechanicsEngine.compute();
    } catch(e) { console.warn(TAG, "BiomechanicsEngine failed:", e); }


    // === SPRINT 25: Recovery insights ===
    var recoveryVelocity = null, sleepRecoveryScore = null, trainingDist = null, hrDrift = null;
    
    try {
      if (typeof RecoveryVelocity !== "undefined") {
        recoveryVelocity = RecoveryVelocity.compute();
      }
    } catch(e) { console.warn(TAG, "RecoveryVelocity failed:", e); }
    
    try {
      if (typeof SleepRecoveryScore !== "undefined") {
        sleepRecoveryScore = SleepRecoveryScore.compute();
      }
    } catch(e) { console.warn(TAG, "SleepRecoveryScore failed:", e); }
    
    try {
      if (typeof TrainingDistribution !== "undefined") {
        trainingDist = await TrainingDistribution.computeWeekly();
      }
    } catch(e) { console.warn(TAG, "TrainingDistribution failed:", e); }
    
    try {
      if (typeof HRDriftIndex !== "undefined") {
        hrDrift = await HRDriftIndex.computeLastHardWorkout();
      }
    } catch(e) { console.warn(TAG, "HRDriftIndex failed:", e); }

    
    var payload = {
      today: today,
      health: {
        date: effective.date, age_days: healthAge, is_today_data: healthAge === 0,
        sleep_h: +(effective.sleepMin / 60).toFixed(1),
        deep_min: effective.deepMin || 0, rem_min: effective.remMin || 0,
        rhr: effective.rhr, hrv: effective.hrv,
        wristTemp: effective.wristTemp || null,
        respRate: effective.respRate || null,
        
// Sprint 25 additions
        cardioRecovery: effective.cardioRecovery || null,
        vo2maxApple: effective.vo2maxApple || null,
        steps: effective.steps || null,
        walkingHR: effective.walkingHR || null,
        spo2: effective.spo2 || null

      },
      baselines: {
        sleep_h: +(baselines.sleepMin / 60).toFixed(1),
        deep_min: baselines.deepMin, rem_min: baselines.remMin,
        rhr: baselines.rhr, hrv: baselines.hrv
      },
      readiness: readiness,
      trends: trends,
      anomalies: anomalies,
      training: training,
      plan_today: planToday,
      race: race,
      recommendation: recommendation,
      cross_insights: crossInsights,
      coach_advice: coachAdvice ? {
        headline: coachAdvice.headline,
        suggestion: coachAdvice.suggestion,
        context: coachAdvice.context,
        patterns: coachAdvice.patterns,
        race_prediction: coachAdvice.race,
        insights: coachAdvice.insights,
        warnings: coachAdvice.warnings,
        tips: coachAdvice.tips,
        confidence: coachAdvice.confidence
      } : null,
      weekly_report: weeklyReport,
      week_score: weekScore,
      acwr: acwr,
      can_add_training: canAdd,
      power: powerData,
      body: bodyData,
      biomechanics: biomechData,
      
      // Sprint 25 additions
      recovery_velocity: recoveryVelocity,
      sleep_recovery_score: sleepRecoveryScore,
      training_distribution: trainingDist,
      hr_drift_last_hard: hrDrift,

    };

    console.log(TAG, "Computed:", payload);
    return payload;
  }

  return {
    compute: compute,
    _internals: {
      getReadinessScore: getReadinessScore,
      detectAnomalies: detectAnomalies,
      getTrainingContext: getTrainingContext
    }
  };
})();

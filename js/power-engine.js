/* power-engine.js v1 — Sprint 21: Critical Power Training Engine */
var PowerEngine = (function() {
  "use strict";
  var TAG = "[PowerEngine]";

  var WEIGHT_KEY = "user_weight";
  var DEFAULT_WEIGHT = 74.2;

  function _weight() {
    // Najpierw BodyTracker, potem fallback
    if (typeof BodyTracker !== "undefined" && BodyTracker.getCurrentWeight) {
      var bw = BodyTracker.getCurrentWeight();
      if (bw > 0) return bw;
    }
    var w = parseFloat(localStorage.getItem(WEIGHT_KEY));
    return w > 0 ? w : DEFAULT_WEIGHT;
  }

  function _minettiCost(grade) {
    var i = grade;
    return 155.4*Math.pow(i,5) - 30.4*Math.pow(i,4) - 43.3*Math.pow(i,3)
         + 46.3*Math.pow(i,2) + 19.5*i + 3.6;
  }

  function _sa(streams, key) {
    if (!streams || !streams[key]) return null;
    if (Array.isArray(streams[key])) return streams[key];
    if (streams[key].data && Array.isArray(streams[key].data)) return streams[key].data;
    return null;
  }

  function calculatePowerFromStreams(streams) {
    if (!streams) return null;
    var vel = _sa(streams, 'velocity_smooth');
    var alt = _sa(streams, 'altitude');
    var tm = _sa(streams, 'time');
    var dst = _sa(streams, 'distance');
    if (!vel || !alt || !tm || vel.length < 3) return null;

    var mass = _weight();
    var n = vel.length;
    var pw = [];
    for (var i = 0; i < n; i++) pw.push(0);
    for (var i = 1; i < n - 1; i++) {
      var dd = (dst ? dst[i+1]-dst[i-1] : vel[i]*(tm[i+1]-tm[i-1])) || 1;
      var gr = (alt[i+1]-alt[i-1]) / Math.max(dd, 0.1);
      gr = Math.max(-0.5, Math.min(0.5, gr));
      var c = _minettiCost(gr);
      var metab = c * mass * vel[i];
      var mech = metab * 0.25;
      var air = 0.5 * 1.225 * 0.9 * 0.5 * Math.pow(vel[i], 3);
      pw[i] = Math.max(0, mech + air);
    }

    var NP = calculateNP(pw);
    var avg = pw.reduce(function(s,v){return s+v;}, 0) / pw.length;
    var max = Math.max.apply(null, pw);

    return {
      stream: pw,
      avg: Math.round(avg),
      np: Math.round(NP),
      max: Math.round(max),
      samples: pw.length
    };
  }

  function calculateNP(powerStream) {
    if (!powerStream || powerStream.length < 30) {
      return powerStream.reduce(function(s,v){return s+v;}, 0) / powerStream.length;
    }
    var rolling = [];
    for (var i = 0; i < powerStream.length - 30; i++) {
      var sum = 0;
      for (var j = 0; j < 30; j++) sum += powerStream[i+j];
      rolling.push(sum / 30);
    }
    var sum4 = rolling.reduce(function(s,v){return s + Math.pow(v, 4);}, 0);
    return Math.pow(sum4 / rolling.length, 0.25);
  }

  function detectCP(activities, options) {
    options = options || {};
    var daysBack = options.daysBack || 90;
    var minDuration = options.minDuration || 20;
    var maxDuration = options.maxDuration || 70;
    var todayD = new Date();
    var efforts = [];

    for (var i = 0; i < activities.length; i++) {
      var a = activities[i];
      var daysAgo = (todayD - new Date(a.date)) / 86400000;
      if (daysAgo > daysBack) continue;
      var dur = a.duration_min || a.moving_time_min;
      if (!dur || dur < minDuration || dur > maxDuration) continue;

      var type = ((typeof PlanMatcher !== 'undefined' && PlanMatcher.getEffectiveType ? PlanMatcher.getEffectiveType(a) : a.type) || '').toLowerCase();
      var isQuality = type.indexOf('tempo') >= 0 || type.indexOf('threshold') >= 0 ||
                      type.indexOf('interv') >= 0 || type.indexOf('interw') >= 0 ||
                      type.indexOf('race') >= 0 || type.indexOf('fartlek') >= 0;
      if (!isQuality) continue;

      var streams = a.strava_id && typeof DB !== 'undefined' && DB.getStreams
        ? DB.getStreams(a.strava_id) : null;
      var powerData = calculatePowerFromStreams(streams);
      if (!powerData || !powerData.np) continue;

      efforts.push({
        date: a.date, km: a.km, type: type, duration_min: dur,
        np: powerData.np, avg_power: powerData.avg, max_power: powerData.max,
        days_ago: Math.round(daysAgo)
      });
    }

    if (efforts.length === 0) return null;
    efforts.sort(function(a, b) { return b.np - a.np; });
    var topN = Math.max(3, Math.ceil(efforts.length * 0.3));
    var topEfforts = efforts.slice(0, Math.min(topN, efforts.length));
    var avgTopNP = topEfforts.reduce(function(s, e) { return s + e.np; }, 0) / topEfforts.length;

    var stability = topEfforts.length >= 5 ? 'high' : (topEfforts.length >= 3 ? 'medium' : 'low');

    return {
      cp: Math.round(avgTopNP),
      cp_w_per_kg: +(avgTopNP / _weight()).toFixed(2),
      stability: stability,
      based_on_n_efforts: topEfforts.length,
      total_candidates: efforts.length,
      top_efforts: topEfforts.slice(0, 5).map(function(e) {
        return { date: e.date, km: e.km, duration_min: e.duration_min, np: e.np, days_ago: e.days_ago };
      })
    };
  }

  function getPowerZones(cp) {
    if (!cp || cp < 50) return null;
    return {
      z1_recovery:  { min: 0, max: Math.round(cp * 0.81), label: "Z1 Recovery", color: "#9ca3af" },
      z2_endurance: { min: Math.round(cp * 0.81), max: Math.round(cp * 0.90), label: "Z2 Endurance", color: "#22c55e" },
      z3_tempo:     { min: Math.round(cp * 0.90), max: Math.round(cp * 0.95), label: "Z3 Tempo", color: "#84cc16" },
      z4_threshold: { min: Math.round(cp * 0.95), max: Math.round(cp * 1.05), label: "Z4 Threshold", color: "#f59e0b" },
      z5_vo2max:    { min: Math.round(cp * 1.05), max: Math.round(cp * 1.20), label: "Z5 VO2max", color: "#f97316" },
      z6_anaerobic: { min: Math.round(cp * 1.20), max: 9999, label: "Z6 Anaerobic", color: "#ef4444" },
      cp: cp,
      hm_target_power: Math.round(cp * 0.92)
    };
  }

  function calculateRTSS(activity, cp) {
    if (!cp || !activity) return null;
    var streams = activity.strava_id && typeof DB !== 'undefined' && DB.getStreams
      ? DB.getStreams(activity.strava_id) : null;
    var powerData = calculatePowerFromStreams(streams);
    if (!powerData || !powerData.np) return null;

    var hours = (activity.duration_min || 0) / 60;
    var ratio = powerData.np / cp;
    var rtss = Math.round(ratio * ratio * hours * 100);

    return {
      rtss: rtss, np: powerData.np, avg_power: powerData.avg,
      intensity_factor: +ratio.toFixed(2), duration_hours: +hours.toFixed(2)
    };
  }

  function predictHMfromPower(cp, targetPaceStr) {
    if (!cp || cp < 50) return null;
    var hmPower = cp * 0.92;
    var mass = _weight();
    var vel = hmPower / (0.9 * mass);
    var paceSecPerKm = 1000 / vel;
    var hmTimeSec = 21.0975 * paceSecPerKm;
    var hours = Math.floor(hmTimeSec / 3600);
    var mins = Math.floor((hmTimeSec % 3600) / 60);
    var secs = Math.round(hmTimeSec % 60);
    var predictedTime = hours + ":" + String(mins).padStart(2,'0') + ":" + String(secs).padStart(2,'0');
    var paceMin = Math.floor(paceSecPerKm / 60);
    var paceSec = Math.round(paceSecPerKm % 60);
    var predictedPace = paceMin + ":" + String(paceSec).padStart(2,'0');

    var targetSecPerKm = targetPaceStr ?
      parseInt(targetPaceStr.split(':')[0]) * 60 + parseInt(targetPaceStr.split(':')[1]) : 299;
    var paceGap = Math.round(paceSecPerKm - targetSecPerKm);
    var targetVel = 1000 / targetSecPerKm;
    var targetPower = 0.9 * mass * targetVel;
    var targetCP = Math.round(targetPower / 0.92);
    var cpGap = targetCP - cp;

    var feasibility;
    if (cpGap <= 5) feasibility = "achievable_now";
    else if (cpGap <= 15) feasibility = "achievable_with_focus";
    else if (cpGap <= 30) feasibility = "ambitious";
    else feasibility = "stretch_goal";

    var targetSec = 21.0975 * targetSecPerKm;
    var th = Math.floor(targetSec / 3600);
    var tm = Math.floor((targetSec % 3600) / 60);
    var ts = Math.round(targetSec % 60);

    return {
      predicted_hm_time: predictedTime,
      predicted_pace: predictedPace,
      hm_power_target: Math.round(hmPower),
      target_pace: targetPaceStr,
      target_time: th + ":" + String(tm).padStart(2,'0') + ":" + String(ts).padStart(2,'0'),
      pace_gap_sec_per_km: paceGap,
      cp_gap_watts: cpGap,
      target_cp_needed: targetCP,
      feasibility: feasibility,
      weight_used: mass
    };
  }

  async function getCPTrend(activities, weeks) {
    weeks = weeks || 12;
    var todayD = new Date();
    var trend = [];
    for (var w = weeks - 1; w >= 0; w--) {
      var weekEnd = new Date(todayD.getTime() - w * 7 * 86400000);
      var weekStart = new Date(weekEnd.getTime() - 28 * 86400000);
      var weekActs = activities.filter(function(a) {
        var d = new Date(a.date);
        return d >= weekStart && d <= weekEnd;
      });
      var cp = detectCP(weekActs, { daysBack: 28 });
      trend.push({
        week_ending: weekEnd.toISOString().slice(0, 10),
        cp: cp ? cp.cp : null,
        based_on: cp ? cp.based_on_n_efforts : 0
      });
    }
    return trend;
  }

  function adjustPowerForHeat(power, tempC) {
    if (!tempC || tempC <= 20) return { adjusted: power, factor: 1.0, heat_penalty_pct: 0 };
    var penalty = (tempC - 20) * 0.005;
    var factor = 1 - Math.min(0.15, penalty);
    return {
      adjusted: Math.round(power * factor),
      factor: +factor.toFixed(3),
      heat_penalty_pct: Math.round((1 - factor) * 100)
    };
  }

  async function compute(activities) {
    if (!activities || !activities.length) return null;
    var cp = detectCP(activities);
    if (!cp) return { error: "Brak wystarczających danych do CP" };

    var zones = getPowerZones(cp.cp);
    var hmPrediction = predictHMfromPower(cp.cp, "4:59");
    var trend = await getCPTrend(activities, 12);

    var todayD = new Date();
    var week7 = activities.filter(function(a) {
      return (todayD - new Date(a.date)) / 86400000 <= 7;
    });
    var weekRTSS = 0;
    var weekRTSSDetails = [];
    week7.forEach(function(a) {
      var rtss = calculateRTSS(a, cp.cp);
      if (rtss) {
        weekRTSS += rtss.rtss;
        weekRTSSDetails.push({ date: a.date, rtss: rtss.rtss, np: rtss.np });
      }
    });

    return {
      cp: cp, zones: zones, hm_prediction: hmPrediction,
      cp_trend_12w: trend, week_rtss: weekRTSS, week_rtss_details: weekRTSSDetails,
      weight_used: _weight()
    };
  }

  return {
    compute: compute, detectCP: detectCP, getPowerZones: getPowerZones,
    calculateRTSS: calculateRTSS, predictHMfromPower: predictHMfromPower,
    getCPTrend: getCPTrend, adjustPowerForHeat: adjustPowerForHeat,
    calculatePowerFromStreams: calculatePowerFromStreams
  };
})();


/* hr-drift-index.js v1 — Sprint 25: HR Drift Index per workout */
var HRDriftIndex = (function() {
  "use strict";

  function computeForActivity(activity) {
    if (!activity || !activity.strava_id) return null;
    if (typeof DB === "undefined" || !DB.getStreams) return null;
    
    var streams = DB.getStreams(activity.strava_id);
    if (!streams || !streams.heartrate || !streams.time) return null;
    
    var hr = streams.heartrate.data || streams.heartrate;
    var time = streams.time.data || streams.time;
    
    if (hr.length < 600 || time.length < 600) return null; // min 10 min
    
    // Podziel na 2 połowy
    var half = Math.floor(hr.length / 2);
    var firstHalf = hr.slice(0, half).filter(function(h) { return h > 50; });
    var secondHalf = hr.slice(half).filter(function(h) { return h > 50; });
    
    if (firstHalf.length < 100 || secondHalf.length < 100) return null;
    
    var avgFirst = firstHalf.reduce(function(s, h) { return s + h; }, 0) / firstHalf.length;
    var avgSecond = secondHalf.reduce(function(s, h) { return s + h; }, 0) / secondHalf.length;
    
    var drift = avgSecond - avgFirst;
    var driftPct = (drift / avgFirst) * 100;
    
    // Heat adjustment
    var heatAdjust = 0;
    if (activity._weather && activity._weather.temp) {
      var temp = activity._weather.temp;
      if (temp > 20) heatAdjust = (temp - 20) * 0.5; // ~0.5 bpm per degC over 20
    }
    var driftAdjusted = drift - heatAdjust;
    
    // Cardiac decoupling: < 5% = good, 5-8% = acceptable, > 8% = poor aerobic base
    var verdict;
    var driftRealPct = (driftAdjusted / avgFirst) * 100;
    if (driftRealPct < 5) verdict = "excellent";
    else if (driftRealPct < 8) verdict = "good";
    else if (driftRealPct < 12) verdict = "acceptable";
    else verdict = "poor_aerobic_base";

    return {
      avg_hr_first_half: Math.round(avgFirst),
      avg_hr_second_half: Math.round(avgSecond),
      drift_bpm: +drift.toFixed(1),
      drift_pct: +driftPct.toFixed(1),
      heat_adjustment: +heatAdjust.toFixed(1),
      drift_heat_adjusted: +driftAdjusted.toFixed(1),
      drift_real_pct: +driftRealPct.toFixed(1),
      verdict: verdict,
      weather_temp: activity._weather ? activity._weather.temp : null
    };
  }

  async function computeLastHardWorkout() {
    if (typeof DB === "undefined" || !DB.getAll) return null;
    var acts = await DB.getAll();
    var hardKeywords = ['interv', 'interw', 'tempo', 'long', 'race', 'fartlek'];
    
    var sorted = acts.sort(function(a, b) { return b.date.localeCompare(a.date); });
    
    for (var i = 0; i < sorted.length; i++) {
      var a = sorted[i];
      var type = (a.type || '').toLowerCase();
      var isHard = hardKeywords.some(function(k) { return type.indexOf(k) >= 0; });
      // Long > 13km
      if (!isHard && a.km > 13) isHard = true;
      if (!isHard) continue;
      
      var drift = computeForActivity(a);
      if (drift) {
        drift.workout_date = a.date;
        drift.workout_km = a.km;
        drift.workout_type = a.type;
        return drift;
      }
    }
    return null;
  }

  return { 
    computeForActivity: computeForActivity, 
    computeLastHardWorkout: computeLastHardWorkout 
  };
})();

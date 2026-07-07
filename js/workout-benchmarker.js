
/* workout-benchmarker.js v1 — Sprint 31: Compare real workout vs ideal
   Provides: execution score, per-km comparison, insights, recommendations
*/
var WorkoutBenchmarker = (function() {
  "use strict";
  var TAG = "[Benchmarker]";
  
  function paceToSec(p) {
    if (typeof p === 'number') return p;
    if (!p) return 0;
    var parts = String(p).split(':');
    if (parts.length !== 2) return 0;
    return parseInt(parts[0]) * 60 + parseInt(parts[1]);
  }
  
  function formatPace(sec) {
    if (!sec || sec <= 0) return '--:--';
    var m = Math.floor(sec / 60);
    var s = Math.round(sec % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }
  
  // ============================================
  // SCORE per-km comparison
  // ============================================
  function scoreKm(realKm, idealKm) {
    var scores = { pace: 0, hr: 0 };
    var issues = [];
    var wins = [];
    
    // PACE SCORE
    if (realKm.pace > 0 && idealKm.pace_target > 0) {
      var paceDiff = realKm.pace - idealKm.pace_target;
      var paceAbsDiff = Math.abs(paceDiff);
      
      if (paceAbsDiff <= 3) {
        scores.pace = 100;
        wins.push('Pace idealny');
      } else if (paceAbsDiff <= 8) {
        scores.pace = 90;
      } else if (paceAbsDiff <= 15) {
        scores.pace = 75;
        if (paceDiff < 0) issues.push('Pace ' + paceAbsDiff + ' sek szybszy niż plan');
        else issues.push('Pace ' + paceAbsDiff + ' sek wolniejszy niż plan');
      } else if (paceAbsDiff <= 25) {
        scores.pace = 55;
        if (paceDiff < 0) issues.push('Pace znacząco szybszy (-' + paceAbsDiff + 's)');
        else issues.push('Pace znacząco wolniejszy (+' + paceAbsDiff + 's)');
      } else {
        scores.pace = 30;
        if (paceDiff < 0) issues.push('🔴 Pace za szybko o ' + paceAbsDiff + 's!');
        else issues.push('🟠 Pace za wolno o ' + paceAbsDiff + 's');
      }
    } else {
      scores.pace = 70;
    }
    
    // HR SCORE
    if (realKm.hr > 0 && idealKm.hr_range) {
      var hr = realKm.hr;
      var hrMin = idealKm.hr_range[0];
      var hrMax = idealKm.hr_range[1];
      
      if (hr >= hrMin && hr <= hrMax) {
        scores.hr = 100;
        wins.push('HR w strefie ' + idealKm.zone);
      } else if (hr < hrMin) {
        var diff = hrMin - hr;
        if (diff <= 5) scores.hr = 85;
        else if (diff <= 10) {
          scores.hr = 65;
          issues.push('HR ' + diff + ' bpm poniżej strefy (za lekko?)');
        } else {
          scores.hr = 45;
          issues.push('🟡 HR znacznie niżej (' + diff + ' bpm)');
        }
      } else { // hr > hrMax
        var diffH = hr - hrMax;
        if (diffH <= 5) scores.hr = 80;
        else if (diffH <= 10) {
          scores.hr = 60;
          issues.push('HR ' + diffH + ' bpm powyżej strefy');
        } else {
          scores.hr = 35;
          issues.push('🔴 HR ' + diffH + ' bpm powyżej strefy (za mocno!)');
        }
      }
    } else {
      scores.hr = 70;
    }
    
    var totalScore = Math.round(scores.pace * 0.6 + scores.hr * 0.4);
    
    return {
      km: realKm.km,
      real: {
        pace: realKm.pace,
        pace_str: formatPace(realKm.pace),
        hr: realKm.hr
      },
      ideal: {
        pace_target: idealKm.pace_target,
        pace_str: formatPace(idealKm.pace_target),
        hr_target: idealKm.hr_target,
        hr_range: idealKm.hr_range,
        zone: idealKm.zone,
        segment: idealKm.segment
      },
      diff: {
        pace: realKm.pace - idealKm.pace_target,
        hr: realKm.hr - idealKm.hr_target
      },
      scores: scores,
      total_score: totalScore,
      issues: issues,
      wins: wins
    };
  }
  
  // ============================================
  // BUILD real workout data from Strava
  // ============================================
  function buildRealKmData(activity) {
    var kmData = [];
    
    if (!activity || !activity.strava_id) return kmData;
    if (typeof DB === 'undefined' || !DB.getDetail) return kmData;
    
    var det = DB.getDetail(activity.strava_id);
    if (!det) return kmData;
    
    // Use splits (per km data)
    if (det.splits && det.splits.length > 0) {
      det.splits.forEach(function(sp, i) {
        var pace = sp.average_speed > 0 ? 1000 / sp.average_speed : 0;
        kmData.push({
          km: i + 1,
          pace: Math.round(pace),
          hr: Math.round(sp.average_heartrate || 0),
          distance_m: sp.distance,
          time: sp.moving_time || 0
        });
      });
    }
    
    return kmData;
  }
  
  // ============================================
  // OVERALL BENCHMARK
  // ============================================
  function benchmark(activity, plan) {
    if (!activity) return null;
    if (typeof IdealWorkoutGenerator === 'undefined') return null;
    
    // Generate ideal profile
    var workoutType = plan ? plan.type : activity.type;
    var km = plan ? plan.km : activity.km;
    var planDesc = plan ? (plan.notes || plan.desc || '') : '';
    
    var ideal = IdealWorkoutGenerator.generate(workoutType, km, planDesc);
    var realKmData = buildRealKmData(activity);
    
    if (realKmData.length === 0) {
      return {
        error: 'Brak splits per km w danych treningu',
        ideal: ideal
      };
    }
    
    // Compare each km
    var kmComparisons = [];
    var maxLen = Math.min(realKmData.length, ideal.km_profile.length);
    
    for (var i = 0; i < maxLen; i++) {
      kmComparisons.push(scoreKm(realKmData[i], ideal.km_profile[i]));
    }
    
    // Overall metrics
    var totalRealTime = 0, totalRealHR = 0, hrCount = 0;
    realKmData.forEach(function(k) {
      totalRealTime += k.pace;
      if (k.hr > 0) { totalRealHR += k.hr; hrCount++; }
    });
    
    var realAvgPace = Math.round(totalRealTime / realKmData.length);
    var realAvgHR = hrCount > 0 ? Math.round(totalRealHR / hrCount) : 0;
    var realMaxHR = Math.max.apply(null, realKmData.map(function(k) { return k.hr || 0; }));
    
    // Compute execution score
    var totalKmScore = 0;
    kmComparisons.forEach(function(c) { totalKmScore += c.total_score; });
    var executionScore = kmComparisons.length > 0 ? Math.round(totalKmScore / kmComparisons.length) : 0;
    
    // Compute cardiac drift w tempo/interval sections
    var driftAnalysis = analyzeCardiacDrift(realKmData, ideal.km_profile);
    
    // Pace consistency w work sections
    var consistencyAnalysis = analyzePaceConsistency(realKmData, ideal.km_profile);
    
    // Generate insights
    var insights = generateInsights(kmComparisons, driftAnalysis, consistencyAnalysis, ideal);
    
    // Overall wins & issues
    var allIssues = [];
    var allWins = [];
    kmComparisons.forEach(function(c) {
      allIssues = allIssues.concat(c.issues.map(function(i) { return 'Km' + c.km + ': ' + i; }));
      allWins = allWins.concat(c.wins.map(function(w) { return 'Km' + c.km + ': ' + w; }));
    });
    
    return {
      execution_score: executionScore,
      ideal: ideal,
      real: {
        avg_pace: realAvgPace,
        avg_pace_str: formatPace(realAvgPace),
        avg_hr: realAvgHR,
        max_hr: realMaxHR,
        total_time_sec: totalRealTime,
        km_data: realKmData
      },
      km_comparisons: kmComparisons,
      cardiac_drift: driftAnalysis,
      pace_consistency: consistencyAnalysis,
      insights: insights,
      issues: allIssues,
      wins: allWins,
      summary: buildSummary(executionScore, kmComparisons, driftAnalysis, consistencyAnalysis)
    };
  }
  
  // ============================================
  // CARDIAC DRIFT analysis (tempo/interval sections)
  // ============================================
  function analyzeCardiacDrift(realData, idealProfile) {
    // Find tempo/interval sections
    var workKms = [];
    for (var i = 0; i < realData.length && i < idealProfile.length; i++) {
      var seg = idealProfile[i].segment;
      if (seg === 'tempo' || seg === 'interval_mix' || seg === 'marathon_pace') {
        workKms.push({ km: realData[i].km, hr: realData[i].hr });
      }
    }
    
    if (workKms.length < 2) {
      return { has_data: false, message: 'Brak długiej work section do analizy drift' };
    }
    
    var firstHR = workKms[0].hr;
    var lastHR = workKms[workKms.length - 1].hr;
    var drift = lastHR - firstHR;
    var driftPct = firstHR > 0 ? Math.round(drift / firstHR * 100 * 10) / 10 : 0;
    
    var status, message;
    if (drift <= 5) {
      status = 'excellent';
      message = 'Drift ' + drift + ' bpm - świetna kontrola HR';
    } else if (drift <= 10) {
      status = 'good';
      message = 'Drift ' + drift + ' bpm - dobry (target <7)';
    } else if (drift <= 15) {
      status = 'moderate';
      message = 'Drift ' + drift + ' bpm - podwyższony (za mocne tempo?)';
    } else {
      status = 'high';
      message = '🔴 Drift ' + drift + ' bpm - za wysoki, tempo zbyt mocne';
    }
    
    return {
      has_data: true,
      first_hr: firstHR,
      last_hr: lastHR,
      drift_bpm: drift,
      drift_pct: driftPct,
      status: status,
      message: message,
      work_kms: workKms
    };
  }
  
  // ============================================
  // PACE CONSISTENCY analysis
  // ============================================
  function analyzePaceConsistency(realData, idealProfile) {
    // Get work section paces
    var workPaces = [];
    for (var i = 0; i < realData.length && i < idealProfile.length; i++) {
      var seg = idealProfile[i].segment;
      if (seg === 'tempo' || seg === 'interval_mix' || seg === 'marathon_pace' || seg === 'long_steady') {
        workPaces.push(realData[i].pace);
      }
    }
    
    if (workPaces.length < 2) {
      return { has_data: false };
    }
    
    var avg = workPaces.reduce(function(a, b) { return a + b; }, 0) / workPaces.length;
    var variance = 0;
    workPaces.forEach(function(p) { variance += Math.pow(p - avg, 2); });
    variance = variance / workPaces.length;
    var stdDev = Math.sqrt(variance);
    
    var maxDeviation = Math.max.apply(null, workPaces) - Math.min.apply(null, workPaces);
    
    var status, message;
    if (maxDeviation <= 5) {
      status = 'excellent';
      message = 'Consistency <5s - pace discipline świetna!';
    } else if (maxDeviation <= 10) {
      status = 'good';
      message = 'Consistency ' + Math.round(maxDeviation) + 's - dobra';
    } else if (maxDeviation <= 20) {
      status = 'moderate';
      message = 'Consistency ' + Math.round(maxDeviation) + 's - można poprawić';
    } else {
      status = 'poor';
      message = 'Consistency ' + Math.round(maxDeviation) + 's - duże wahania pace!';
    }
    
    return {
      has_data: true,
      max_deviation_sec: Math.round(maxDeviation),
      std_dev_sec: Math.round(stdDev * 10) / 10,
      avg_pace: Math.round(avg),
      status: status,
      message: message
    };
  }
  
  // ============================================
  // GENERATE actionable insights
  // ============================================
  function generateInsights(kmComps, drift, consistency, ideal) {
    var insights = [];
    
    // Cardiac drift
    if (drift.has_data && drift.status !== 'excellent') {
      if (drift.status === 'high') {
        insights.push({
          type: 'critical',
          text: '🔴 HR drift ' + drift.drift_bpm + ' bpm w work section - tempo za mocne na Twój poziom',
          fix: 'Zwolnij o 5-10 sek/km na następnym treningu'
        });
      } else if (drift.status === 'moderate') {
        insights.push({
          type: 'warning',
          text: '🟡 HR drift ' + drift.drift_bpm + ' bpm - kontroluj tempo lepiej',
          fix: 'Postaw HR limit ' + (drift.first_hr + 7) + ' bpm'
        });
      }
    }
    
    // Pace consistency
    if (consistency.has_data && consistency.status !== 'excellent') {
      if (consistency.status === 'poor' || consistency.status === 'moderate') {
        insights.push({
          type: 'warning',
          text: '📊 Pace variance ' + consistency.max_deviation_sec + ' sek - trudno utrzymać stałe tempo',
          fix: 'Użyj GPS alertów na następnym treningu (min: ' + formatPace(consistency.avg_pace - 5) + ', max: ' + formatPace(consistency.avg_pace + 5) + ')'
        });
      }
    }
    
    // Check specific issues per km
    var fastKms = 0, slowKms = 0, hrTooHighKms = 0;
    kmComps.forEach(function(c) {
      if (c.diff.pace < -15) fastKms++;
      if (c.diff.pace > 15) slowKms++;
      if (c.diff.hr > 10) hrTooHighKms++;
    });
    
    if (fastKms >= 2) {
      insights.push({
        type: 'warning',
        text: '⚡ ' + fastKms + ' km za szybkie',
        fix: 'Dyscyplina pace - trzymaj planu'
      });
    }
    
    if (hrTooHighKms >= 2) {
      insights.push({
        type: 'critical',
        text: '❤️ ' + hrTooHighKms + ' km z HR za wysokim',
        fix: 'Bacz na HR podczas treningu, użyj alarmu >175'
      });
    }
    
    // Warmup check
    if (kmComps.length > 0) {
      var wuKm = kmComps[0];
      if (wuKm.ideal.segment === 'warmup' && wuKm.diff.pace < -20) {
        insights.push({
          type: 'info',
          text: '🏃 WU za szybki - Km 1 pace: ' + wuKm.real.pace_str,
          fix: 'WU celowo bardzo wolno (>' + formatPace(wuKm.ideal.pace_target + 10) + ')'
        });
      }
    }
    
    // Cooldown check
    var lastKm = kmComps[kmComps.length - 1];
    if (lastKm && lastKm.ideal.segment === 'cooldown' && lastKm.diff.pace > 30) {
      insights.push({
        type: 'info',
        text: '🚶 CD za wolny - Km ostatni: ' + lastKm.real.pace_str,
        fix: 'CD ma być active recovery, nie spacer'
      });
    }
    
    // Positive reinforcement
    var perfectKms = kmComps.filter(function(c) { return c.total_score >= 90; }).length;
    if (perfectKms >= kmComps.length * 0.6) {
      insights.unshift({
        type: 'positive',
        text: '✨ ' + perfectKms + '/' + kmComps.length + ' km z execution >90 - świetnie!',
        fix: 'Utrzymuj kurs, jesteś na dobrej drodze'
      });
    }
    
    return insights;
  }
  
  // ============================================
  // BUILD SUMMARY string
  // ============================================
  function buildSummary(score, kmComps, drift, consistency) {
    var summary = '';
    
    if (score >= 95) summary = '🏆 Perfect execution! ';
    else if (score >= 85) summary = '✅ Świetne wykonanie. ';
    else if (score >= 75) summary = '👍 Dobre wykonanie z drobnymi odchyleniami. ';
    else if (score >= 60) summary = '⚠️ Wykonanie średnie - jest nad czym pracować. ';
    else summary = '🔴 Wykonanie odbiega od ideału - przeanalizuj insights. ';
    
    if (drift.has_data && drift.status === 'excellent') summary += 'HR drift excellent. ';
    if (consistency.has_data && consistency.status === 'excellent') summary += 'Pace consistency perfect. ';
    
    return summary;
  }
  
  return {
    benchmark: benchmark,
    scoreKm: scoreKm,
    buildRealKmData: buildRealKmData,
    formatPace: formatPace
  };
})();

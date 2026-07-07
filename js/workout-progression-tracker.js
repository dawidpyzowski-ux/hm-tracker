
/* workout-progression-tracker.js v1 — Sprint 31 PART 3
   Trackuje trendy execution scores w czasie + insights per typ treningu
*/
var WorkoutProgressionTracker = (function() {
  "use strict";
  var TAG = "[ProgressionTracker]";
  
  // ============================================
  // GET all benchmarks for last N days
  // ============================================
  async function getBenchmarksHistory(daysBack) {
    daysBack = daysBack || 60;
    if (typeof DB === 'undefined' || !DB.getAll) return [];
    if (typeof WorkoutBenchmarker === 'undefined') return [];
    if (typeof PlanMatcher === 'undefined') return [];
    
    var acts = await DB.getAll();
    var today = new Date();
    var cutoff = new Date(today.getTime() - daysBack * 86400000);
    
    var recent = acts.filter(function(a) {
      return a.date && new Date(a.date) >= cutoff && a.strava_id;
    });
    
    var benchmarks = [];
    
    for (var i = 0; i < recent.length; i++) {
      var activity = recent[i];
      
      // Enrich activity with log data (pace, hr)
      if (typeof S !== 'undefined' && S.getLog) {
        var log = S.getLog(activity.date);
        if (log) {
          if (!activity.pace) activity.pace = log.pace;
          if (!activity.avg_hr) activity.avg_hr = log.hr;
        }
      }
      
      // Get effective plan
      var eff = PlanMatcher.getEffectivePlan(activity);
      var plan = eff && eff.plan ? eff.plan : null;
      if (!plan) continue;
      
      try {
        var result = WorkoutBenchmarker.benchmark(activity, plan);
        if (!result || result.error) continue;
        
        // Classify workout type
        var category = null;
        if (typeof TrainingClassifier !== 'undefined') {
          category = TrainingClassifier.classify(plan.type);
        }
        
        benchmarks.push({
          date: activity.date,
          type: plan.type,
          category: category || 'unknown',
          km: activity.km,
          execution_score: result.execution_score,
          pace_consistency: result.pace_consistency,
          cardiac_drift: result.cardiac_drift,
          real: result.real,
          ideal: result.ideal.overall
        });
      } catch(e) {
        console.warn(TAG, 'Benchmark error for', activity.date, e);
      }
    }
    
    return benchmarks.sort(function(a, b) { return a.date.localeCompare(b.date); });
  }
  
  // ============================================
  // ANALYZE TREND per category
  // ============================================
  function analyzeCategoryTrend(benchmarks, category) {
    var filtered = benchmarks.filter(function(b) { return b.category === category; });
    if (filtered.length === 0) return null;
    
    // Ostatnie 4-6 sesji tego typu
    var recent = filtered.slice(-6);
    
    // Trend execution score
    var scores = recent.map(function(b) { return b.execution_score; });
    var avgScore = Math.round(scores.reduce(function(a, b) { return a + b; }, 0) / scores.length);
    
    // Progression: linear regression
    var slope = 0;
    if (scores.length >= 3) {
      var n = scores.length;
      var sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
      for (var i = 0; i < n; i++) {
        sumX += i;
        sumY += scores[i];
        sumXY += i * scores[i];
        sumX2 += i * i;
      }
      slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    }
    
    // Pace consistency trend (dla tempo/intervals)
    var paceVariances = [];
    recent.forEach(function(b) {
      if (b.pace_consistency && b.pace_consistency.has_data) {
        paceVariances.push(b.pace_consistency.max_deviation_sec);
      }
    });
    var avgVariance = paceVariances.length > 0 ? 
      Math.round(paceVariances.reduce(function(a, b) { return a + b; }, 0) / paceVariances.length) : null;
    
    // Cardiac drift trend
    var drifts = [];
    recent.forEach(function(b) {
      if (b.cardiac_drift && b.cardiac_drift.has_data) {
        drifts.push(b.cardiac_drift.drift_bpm);
      }
    });
    var avgDrift = drifts.length > 0 ? 
      Math.round(drifts.reduce(function(a, b) { return a + b; }, 0) / drifts.length) : null;
    
    // Best & worst
    var best = recent.reduce(function(a, b) { return a.execution_score > b.execution_score ? a : b; });
    var worst = recent.reduce(function(a, b) { return a.execution_score < b.execution_score ? a : b; });
    
    // Trend label
    var trendLabel;
    if (slope > 1.5) trendLabel = 'improving_strongly';
    else if (slope > 0.3) trendLabel = 'improving';
    else if (slope > -0.3) trendLabel = 'stable';
    else if (slope > -1.5) trendLabel = 'declining';
    else trendLabel = 'declining_strongly';
    
    return {
      category: category,
      count: filtered.length,
      recent_count: recent.length,
      avg_score: avgScore,
      slope: +slope.toFixed(2),
      trend: trendLabel,
      avg_pace_variance: avgVariance,
      avg_cardiac_drift: avgDrift,
      best: { date: best.date, score: best.execution_score },
      worst: { date: worst.date, score: worst.execution_score },
      recent_scores: scores
    };
  }
  
  // ============================================
  // MAIN: Full progression analysis
  // ============================================
  async function analyze(daysBack) {
    var benchmarks = await getBenchmarksHistory(daysBack);
    if (benchmarks.length === 0) return null;
    
    var trends = {
      tempo: analyzeCategoryTrend(benchmarks, 'tempo'),
      intervals: analyzeCategoryTrend(benchmarks, 'intervals'),
      long: analyzeCategoryTrend(benchmarks, 'long'),
      easy: analyzeCategoryTrend(benchmarks, 'easy'),
      recovery: analyzeCategoryTrend(benchmarks, 'recovery')
    };
    
    // Overall stats
    var allScores = benchmarks.map(function(b) { return b.execution_score; });
    var overallAvg = Math.round(allScores.reduce(function(a, b) { return a + b; }, 0) / allScores.length);
    
    // Quality workouts (tempo + intervals)
    var quality = benchmarks.filter(function(b) { 
      return b.category === 'tempo' || b.category === 'intervals'; 
    });
    var qualityAvg = quality.length > 0 ?
      Math.round(quality.map(function(b) { return b.execution_score; })
        .reduce(function(a, b) { return a + b; }, 0) / quality.length) : null;
    
    return {
      total_workouts: benchmarks.length,
      days_analyzed: daysBack,
      overall_avg: overallAvg,
      quality_avg: qualityAvg,
      trends: trends,
      benchmarks: benchmarks,
      generated_at: new Date().toISOString()
    };
  }
  
  return {
    getBenchmarksHistory: getBenchmarksHistory,
    analyze: analyze,
    analyzeCategoryTrend: analyzeCategoryTrend
  };
})();

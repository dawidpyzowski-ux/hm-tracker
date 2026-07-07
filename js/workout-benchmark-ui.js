
/* workout-benchmark-ui.js v1 — Sprint 31: UI for ideal workout comparison */
var WorkoutBenchmarkUI = (function() {
  "use strict";
  
  function formatPace(sec) {
    if (!sec || sec <= 0) return '--:--';
    var m = Math.floor(sec / 60);
    var s = Math.round(sec % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }
  
  // ============================================
  // RENDER FULL BENCHMARK VIEW
  // ============================================
  function render(activity, plan) {
    if (!activity) return '<p style="color:#9ca3af;">Brak treningu</p>';
    if (typeof WorkoutBenchmarker === 'undefined') return '<p style="color:#fca5a5;">Benchmarker not loaded</p>';
    
    var result = WorkoutBenchmarker.benchmark(activity, plan);
    if (!result) return '<p style="color:#fca5a5;">Nie udało się porównać treningu</p>';
    
    if (result.error) {
      return '<div style="background:#451a03;border:1px solid #f59e0b;color:#fde68a;padding:14px;border-radius:8px;">⚠️ ' + result.error + '</div>';
    }
    
    var h = '';
    
    // === SUMMARY CARD ===
    h += renderSummaryCard(result);
    
    // === OVERALL METRICS ===
    h += renderOverallMetrics(result);
    
    // === PER-KM CHART (visual) ===
    h += renderKmChart(result);
    
    // === PER-KM DETAILS TABLE ===
    h += renderKmTable(result);
    
    // === CARDIAC DRIFT ===
    if (result.cardiac_drift.has_data) {
      h += renderCardiacDrift(result.cardiac_drift);
    }
    
    // === PACE CONSISTENCY ===
    if (result.pace_consistency.has_data) {
      h += renderPaceConsistency(result.pace_consistency);
    }
    
    // === INSIGHTS ===
    h += renderInsights(result.insights);
    
    return h;
  }
  
  // ============================================
  // SUMMARY CARD
  // ============================================
  function renderSummaryCard(result) {
    var score = result.execution_score;
    var color = score >= 90 ? '#22c55e' : 
                score >= 75 ? '#84cc16' :
                score >= 60 ? '#f59e0b' : '#ef4444';
    
    var label = score >= 95 ? '🏆 Perfect Execution' :
                score >= 85 ? '✅ Świetne wykonanie' :
                score >= 75 ? '👍 Dobre wykonanie' :
                score >= 60 ? '⚠️ Do poprawy' : '🔴 Poza zakresem';
    
    var h = '<div style="background:linear-gradient(135deg,#1e293b 0%,#0f172a 100%);border-radius:12px;padding:16px;margin-bottom:12px;border:2px solid ' + color + ';">';
    h += '<div style="display:flex;align-items:center;gap:16px;">';
    h += '<div style="width:80px;height:80px;border-radius:50%;background:' + color + '20;border:3px solid ' + color + ';display:flex;align-items:center;justify-content:center;flex-shrink:0;">';
    h += '<div style="text-align:center;"><div style="color:' + color + ';font-size:1.8em;font-weight:bold;line-height:1;">' + score + '</div><div style="color:' + color + ';font-size:0.6em;">/ 100</div></div>';
    h += '</div>';
    h += '<div style="flex:1;">';
    h += '<div style="color:#f9fafb;font-size:1.1em;font-weight:600;margin-bottom:4px;">🎯 Execution Score</div>';
    h += '<div style="color:' + color + ';font-size:0.9em;font-weight:600;">' + label + '</div>';
    h += '<div style="color:#9ca3af;font-size:0.85em;margin-top:4px;">' + result.summary + '</div>';
    h += '</div>';
    h += '</div>';
    h += '</div>';
    
    return h;
  }
  
  // ============================================
  // OVERALL METRICS
  // ============================================
  function renderOverallMetrics(result) {
    var real = result.real;
    var ideal = result.ideal.overall;
    
    var paceDiff = real.avg_pace - ideal.avg_pace;
    var timeDiff = real.total_time_sec - ideal.total_time_sec;
    
    var h = '<div style="background:#1f2937;border-radius:10px;padding:14px;margin-bottom:12px;">';
    h += '<h4 style="margin:0 0 12px;color:#f9fafb;font-size:0.95em;">📊 Overall Metrics — Real vs Ideal</h4>';
    
    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">';
    
    // Total time
    var timeStr = Math.floor(real.total_time_sec / 60) + ':' + Math.round(real.total_time_sec % 60).toString().padStart(2, '0');
    var idealTimeStr = Math.floor(ideal.total_time_sec / 60) + ':' + Math.round(ideal.total_time_sec % 60).toString().padStart(2, '0');
    
    h += renderMetricCard('⏱️ Total time', timeStr, idealTimeStr, timeDiff, 'sec', 30);
    h += renderMetricCard('🏃 Avg pace', real.avg_pace_str + '/km', formatPace(ideal.avg_pace) + '/km', paceDiff, 'sec/km', 5);
    h += renderMetricCard('❤️ Avg HR', real.avg_hr, ideal.avg_hr, real.avg_hr - ideal.avg_hr, 'bpm', 5);
    h += renderMetricCard('🔥 Max HR', real.max_hr, '~' + result.ideal.athlete_profile.max_hr, '', '', 0);
    
    h += '</div>';
    h += '</div>';
    
    return h;
  }
  
  function renderMetricCard(label, realVal, idealVal, diff, unit, threshold) {
    var diffStr = '';
    var diffColor = '#6b7280';
    
    if (diff !== '' && diff !== undefined) {
      var absDiff = Math.abs(diff);
      if (absDiff <= threshold) diffColor = '#22c55e';
      else if (absDiff <= threshold * 3) diffColor = '#f59e0b';
      else diffColor = '#ef4444';
      
      diffStr = (diff > 0 ? '+' : '') + Math.round(diff) + ' ' + unit;
    }
    
    var h = '<div style="background:#374151;padding:10px;border-radius:8px;">';
    h += '<div style="color:#9ca3af;font-size:0.7em;">' + label + '</div>';
    h += '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:4px;">';
    h += '<div style="color:#f9fafb;font-size:1.1em;font-weight:bold;">' + realVal + '</div>';
    h += '<div style="color:#6b7280;font-size:0.75em;">vs ' + idealVal + '</div>';
    h += '</div>';
    if (diffStr) {
      h += '<div style="color:' + diffColor + ';font-size:0.75em;margin-top:2px;font-weight:600;">' + diffStr + '</div>';
    }
    h += '</div>';
    return h;
  }
  
  // ============================================
  // PER-KM CHART (visual bars)
  // ============================================
  function renderKmChart(result) {
    var kms = result.km_comparisons;
    if (!kms.length) return '';
    
    var h = '<div style="background:#1f2937;border-radius:10px;padding:14px;margin-bottom:12px;">';
    h += '<h4 style="margin:0 0 12px;color:#f9fafb;font-size:0.95em;">📈 Per-KM Execution</h4>';
    
    // Find pace range for scaling
    var allPaces = [];
    kms.forEach(function(k) {
      allPaces.push(k.real.pace);
      allPaces.push(k.ideal.pace_target);
    });
    var minPace = Math.min.apply(null, allPaces);
    var maxPace = Math.max.apply(null, allPaces);
    var paceRange = maxPace - minPace;
    
    kms.forEach(function(km) {
      var scoreColor = km.total_score >= 90 ? '#22c55e' :
                       km.total_score >= 75 ? '#84cc16' :
                       km.total_score >= 60 ? '#f59e0b' : '#ef4444';
      
      var segEmoji = km.ideal.segment === 'warmup' ? '🟢' :
                     km.ideal.segment === 'tempo' ? '🔥' :
                     km.ideal.segment === 'interval_mix' ? '⚡' :
                     km.ideal.segment === 'marathon_pace' ? '🎯' :
                     km.ideal.segment === 'long_steady' ? '🏃' :
                     km.ideal.segment === 'cooldown' ? '🧊' : '📏';
      
      h += '<div style="margin-bottom:10px;padding:10px;background:#0f172a;border-radius:8px;border-left:4px solid ' + scoreColor + ';">';
      
      // Header
      h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">';
      h += '<div style="color:#f9fafb;font-weight:600;font-size:0.9em;">' + segEmoji + ' Km ' + km.km + ' <span style="color:#9ca3af;font-size:0.85em;font-weight:400;">(' + km.ideal.segment + ')</span></div>';
      h += '<div style="color:' + scoreColor + ';font-size:0.9em;font-weight:700;">' + km.total_score + '/100</div>';
      h += '</div>';
      
      // Pace comparison bar
      var realPaceOffset = paceRange > 0 ? (km.real.pace - minPace) / paceRange * 100 : 50;
      var idealPaceOffset = paceRange > 0 ? (km.ideal.pace_target - minPace) / paceRange * 100 : 50;
      
      var paceDiffColor = Math.abs(km.diff.pace) <= 5 ? '#22c55e' :
                         Math.abs(km.diff.pace) <= 15 ? '#f59e0b' : '#ef4444';
      
      h += '<div style="display:flex;gap:8px;align-items:center;margin-bottom:4px;">';
      h += '<div style="color:#9ca3af;font-size:0.7em;width:50px;">⏱️ Pace</div>';
      h += '<div style="flex:1;position:relative;background:#374151;height:20px;border-radius:4px;overflow:hidden;">';
      // Ideal marker
      h += '<div style="position:absolute;top:0;bottom:0;left:' + idealPaceOffset + '%;width:2px;background:#10b981;"></div>';
      // Real marker
      h += '<div style="position:absolute;top:0;bottom:0;left:' + realPaceOffset + '%;width:3px;background:' + paceDiffColor + ';box-shadow:0 0 4px ' + paceDiffColor + ';"></div>';
      h += '</div>';
      h += '<div style="color:#f9fafb;font-size:0.75em;min-width:80px;text-align:right;">' + 
        km.real.pace_str + ' <span style="color:#6b7280;">/ ' + km.ideal.pace_str + '</span></div>';
      h += '</div>';
      
      // HR comparison
      var hrDiffColor = Math.abs(km.diff.hr) <= 5 ? '#22c55e' :
                       Math.abs(km.diff.hr) <= 10 ? '#f59e0b' : '#ef4444';
      
      h += '<div style="display:flex;gap:8px;align-items:center;">';
      h += '<div style="color:#9ca3af;font-size:0.7em;width:50px;">❤️ HR</div>';
      h += '<div style="flex:1;position:relative;background:#374151;height:14px;border-radius:4px;overflow:hidden;">';
      var hrRealPct = km.real.hr / 200 * 100; // 200 as max HR reference
      var hrIdealPct = km.ideal.hr_target / 200 * 100;
      h += '<div style="position:absolute;top:0;bottom:0;left:' + hrIdealPct + '%;width:2px;background:#10b981;"></div>';
      h += '<div style="position:absolute;top:0;bottom:0;left:' + hrRealPct + '%;width:3px;background:' + hrDiffColor + ';box-shadow:0 0 4px ' + hrDiffColor + ';"></div>';
      h += '</div>';
      h += '<div style="color:#f9fafb;font-size:0.75em;min-width:80px;text-align:right;">' + 
        km.real.hr + ' <span style="color:#6b7280;">/ ' + km.ideal.hr_target + '</span></div>';
      h += '</div>';
      
      h += '</div>';
    });
    
    // Legend
    h += '<div style="display:flex;gap:12px;font-size:0.7em;color:#9ca3af;margin-top:8px;padding-top:8px;border-top:1px solid #374151;">';
    h += '<span><span style="display:inline-block;width:8px;height:8px;background:#10b981;border-radius:2px;"></span> Ideal</span>';
    h += '<span><span style="display:inline-block;width:8px;height:8px;background:#f59e0b;border-radius:2px;"></span> Twój wynik</span>';
    h += '</div>';
    
    h += '</div>';
    return h;
  }
  
  // ============================================
  // PER-KM TABLE (details)
  // ============================================
  function renderKmTable(result) {
    var h = '<details style="background:#1f2937;border-radius:10px;padding:14px;margin-bottom:12px;">';
    h += '<summary style="cursor:pointer;color:#f9fafb;font-weight:600;font-size:0.95em;">📋 Szczegóły per-km</summary>';
    
    h += '<div style="overflow-x:auto;margin-top:10px;">';
    h += '<table style="width:100%;color:#d1d5db;font-size:0.8em;border-collapse:collapse;">';
    h += '<thead><tr style="background:#0f172a;">';
    h += '<th style="padding:6px;text-align:left;">Km</th>';
    h += '<th style="padding:6px;text-align:left;">Segment</th>';
    h += '<th style="padding:6px;text-align:right;">Real</th>';
    h += '<th style="padding:6px;text-align:right;">Ideal</th>';
    h += '<th style="padding:6px;text-align:right;">Δ</th>';
    h += '<th style="padding:6px;text-align:right;">Score</th>';
    h += '</tr></thead>';
    h += '<tbody>';
    
    result.km_comparisons.forEach(function(km) {
      var scoreColor = km.total_score >= 90 ? '#22c55e' :
                       km.total_score >= 75 ? '#84cc16' :
                       km.total_score >= 60 ? '#f59e0b' : '#ef4444';
      
      var diffPace = km.diff.pace;
      var diffColor = Math.abs(diffPace) <= 5 ? '#22c55e' :
                      Math.abs(diffPace) <= 15 ? '#f59e0b' : '#ef4444';
      var diffStr = (diffPace > 0 ? '+' : '') + diffPace + 's';
      
      h += '<tr style="border-top:1px solid #374151;">';
      h += '<td style="padding:6px;">Km ' + km.km + '</td>';
      h += '<td style="padding:6px;color:#9ca3af;font-size:0.85em;">' + km.ideal.segment + '</td>';
      h += '<td style="padding:6px;text-align:right;">' + km.real.pace_str + '<br><span style="color:#6b7280;font-size:0.85em;">HR ' + km.real.hr + '</span></td>';
      h += '<td style="padding:6px;text-align:right;color:#6b7280;">' + km.ideal.pace_str + '<br><span style="font-size:0.85em;">HR ' + km.ideal.hr_target + '</span></td>';
      h += '<td style="padding:6px;text-align:right;color:' + diffColor + ';font-weight:600;">' + diffStr + '</td>';
      h += '<td style="padding:6px;text-align:right;color:' + scoreColor + ';font-weight:600;">' + km.total_score + '</td>';
      h += '</tr>';
    });
    
    h += '</tbody></table></div>';
    h += '</details>';
    
    return h;
  }
  
  // ============================================
  // CARDIAC DRIFT
  // ============================================
  function renderCardiacDrift(drift) {
    var color = drift.status === 'excellent' ? '#22c55e' :
                drift.status === 'good' ? '#84cc16' :
                drift.status === 'moderate' ? '#f59e0b' : '#ef4444';
    
    var h = '<div style="background:#1f2937;border-radius:10px;padding:14px;margin-bottom:12px;">';
    h += '<h4 style="margin:0 0 8px;color:#f9fafb;font-size:0.95em;">❤️ Cardiac Drift (work section)</h4>';
    
    h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">';
    h += '<div style="color:#d1d5db;font-size:0.85em;">HR: ' + drift.first_hr + ' → ' + drift.last_hr + ' bpm</div>';
    h += '<div style="color:' + color + ';font-size:1.2em;font-weight:bold;">+' + drift.drift_bpm + ' bpm</div>';
    h += '</div>';
    
    h += '<div style="color:' + color + ';font-size:0.85em;">' + drift.message + '</div>';
    h += '<div style="color:#6b7280;font-size:0.7em;margin-top:4px;">Target: <7 bpm drift w tempo/interval sections</div>';
    
    h += '</div>';
    return h;
  }
  
  // ============================================
  // PACE CONSISTENCY
  // ============================================
  function renderPaceConsistency(cons) {
    var color = cons.status === 'excellent' ? '#22c55e' :
                cons.status === 'good' ? '#84cc16' :
                cons.status === 'moderate' ? '#f59e0b' : '#ef4444';
    
    var h = '<div style="background:#1f2937;border-radius:10px;padding:14px;margin-bottom:12px;">';
    h += '<h4 style="margin:0 0 8px;color:#f9fafb;font-size:0.95em;">📊 Pace Consistency</h4>';
    
    h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">';
    h += '<div style="color:#d1d5db;font-size:0.85em;">Avg pace: ' + formatPace(cons.avg_pace) + '/km</div>';
    h += '<div style="color:' + color + ';font-size:1.2em;font-weight:bold;">±' + cons.max_deviation_sec + 's</div>';
    h += '</div>';
    
    h += '<div style="color:' + color + ';font-size:0.85em;">' + cons.message + '</div>';
    h += '<div style="color:#6b7280;font-size:0.7em;margin-top:4px;">Target: <5 sec variance w work section</div>';
    
    h += '</div>';
    return h;
  }
  
  // ============================================
  // INSIGHTS
  // ============================================
  function renderInsights(insights) {
    if (!insights || insights.length === 0) return '';
    
    var h = '<div style="background:#1f2937;border-radius:10px;padding:14px;margin-bottom:12px;">';
    h += '<h4 style="margin:0 0 12px;color:#f9fafb;font-size:0.95em;">💡 Insights & Recommendations</h4>';
    
    insights.forEach(function(ins) {
      var colors = {
        positive: { bg: '#052e16', border: '#22c55e', text: '#86efac' },
        info: { bg: '#0c1e3d', border: '#3b82f6', text: '#93c5fd' },
        warning: { bg: '#451a03', border: '#f59e0b', text: '#fde68a' },
        critical: { bg: '#450a0a', border: '#ef4444', text: '#fca5a5' }
      };
      var c = colors[ins.type] || colors.info;
      
      h += '<div style="background:' + c.bg + ';border-left:3px solid ' + c.border + ';padding:10px;border-radius:6px;margin-bottom:8px;">';
      h += '<div style="color:' + c.text + ';font-size:0.85em;margin-bottom:4px;">' + ins.text + '</div>';
      if (ins.fix) {
        h += '<div style="color:#d1d5db;font-size:0.8em;">→ ' + ins.fix + '</div>';
      }
      h += '</div>';
    });
    
    h += '</div>';
    return h;
  }
  
  // ============================================
  // COMPACT VERSION (for embed in TrainScore)
  // ============================================
  function renderCompact(activity, plan) {
    if (typeof WorkoutBenchmarker === 'undefined') return '';
    var result = WorkoutBenchmarker.benchmark(activity, plan);
    if (!result || result.error) return '';
    
    var score = result.execution_score;
    var color = score >= 90 ? '#22c55e' :
                score >= 75 ? '#84cc16' :
                score >= 60 ? '#f59e0b' : '#ef4444';
    
    var h = '<div style="background:#1f2937;border-radius:8px;padding:10px;margin-top:8px;border-left:3px solid ' + color + ';">';
    h += '<div style="display:flex;justify-content:space-between;align-items:center;">';
    h += '<div>';
    h += '<div style="color:#f9fafb;font-size:0.85em;font-weight:600;">🎯 Execution vs Ideal</div>';
    h += '<div style="color:#9ca3af;font-size:0.75em;margin-top:2px;">' + result.summary + '</div>';
    h += '</div>';
    h += '<div style="color:' + color + ';font-size:1.5em;font-weight:bold;">' + score + '<span style="font-size:0.5em;color:#6b7280;">/100</span></div>';
    h += '</div>';
    h += '</div>';
    
    return h;
  }
  
  return {
    render: render,
    renderCompact: renderCompact
  };
})();

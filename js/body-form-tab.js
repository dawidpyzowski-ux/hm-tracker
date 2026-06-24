
/* body-form-tab.js v2 — Sprint 24: Sub-tabs Recovery / Composition / Coach / Insights */
(function() {
  "use strict";
  var currentTab = 'recovery';

  function render() {
    var el = document.getElementById('s-bodyform') || document.getElementById('view-bodyform');
    if (!el) return;

    var html = '';
    html += '<div style="max-width:900px;margin:0 auto;padding:8px;">';
    html += '<h2 style="color:#f9fafb;margin:8px 4px;font-size:1.4em;">💪 Body & Health</h2>';

    // Sub-tabs nav
    html += '<div class="sub-tabs">';
    html += '<button class="sub-tab ' + (currentTab==='recovery'?'act':'') + '" onclick="BodyFormTab.setTab(\'recovery\')">🩺 Recovery</button>';
    html += '<button class="sub-tab ' + (currentTab==='composition'?'act':'') + '" onclick="BodyFormTab.setTab(\'composition\')">⚖️ Composition</button>';
    html += '<button class="sub-tab ' + (currentTab==='coach'?'act':'') + '" onclick="BodyFormTab.setTab(\'coach\')">🤖 Coach AI</button>';
    html += '<button class="sub-tab ' + (currentTab==='insights'?'act':'') + '" onclick="BodyFormTab.setTab(\'insights\')">🔗 Insights</button>';
    html += '</div>';

    // Content area
    html += '<div id="bf-content">';

    if (currentTab === 'recovery') {
      html += renderRecovery();
    } else if (currentTab === 'composition') {
      html += renderComposition();
    } else if (currentTab === 'coach') {
      html += renderCoach();
    } else if (currentTab === 'insights') {
      html += renderInsights();
    }

    html += '</div>';
    html += '</div>';

    el.innerHTML = html;

    // Render po wstrzyknięciu HTML
    setTimeout(function() {
      if (currentTab === 'recovery') renderRecoveryCharts();
      else if (currentTab === 'composition') renderCompositionCharts();
      else if (currentTab === 'coach') renderCoachContent();
      else if (currentTab === 'insights') renderInsightsContent();
    }, 50);
  }

  function setTab(tab) {
    currentTab = tab;
    render();
  }

  // === RECOVERY: Sleep, HRV, RHR, WristTemp, RespRate ===
  function renderRecovery() {
    var h = '';
    
    // Sleep
    h += '<div style="background:#1f2937;border-radius:10px;padding:12px;margin-bottom:12px;">';
    h += '<h3 style="margin:0 0 8px;color:#f9fafb;font-size:1em;">😴 Sen (Deep / REM / Core)</h3>';
    h += '<div style="position:relative;height:200px;"><canvas id="bf-sleep-stacked"></canvas></div>';
    h += '</div>';

    // HRV
    h += '<div style="background:#1f2937;border-radius:10px;padding:12px;margin-bottom:12px;">';
    h += '<h3 style="margin:0 0 8px;color:#f9fafb;font-size:1em;">💓 HRV</h3>';
    h += '<div style="position:relative;height:200px;"><canvas id="bf-hrv"></canvas></div>';
    h += '</div>';

    // RHR
    h += '<div style="background:#1f2937;border-radius:10px;padding:12px;margin-bottom:12px;">';
    h += '<h3 style="margin:0 0 8px;color:#f9fafb;font-size:1em;">❤️ RHR (Spoczynkowe tętno)</h3>';
    h += '<div style="position:relative;height:200px;"><canvas id="bf-rhr"></canvas></div>';
    h += '</div>';

    // Wrist Temp
    h += '<div style="background:#1f2937;border-radius:10px;padding:12px;margin-bottom:12px;">';
    h += '<h3 style="margin:0 0 8px;color:#f9fafb;font-size:1em;">🌡️ Wrist Temperature</h3>';
    h += '<div style="position:relative;height:200px;"><canvas id="bf-wrist-temp"></canvas></div>';
    h += '</div>';

    // Resp Rate
    h += '<div style="background:#1f2937;border-radius:10px;padding:12px;margin-bottom:12px;">';
    h += '<h3 style="margin:0 0 8px;color:#f9fafb;font-size:1em;">🫁 Respiratory Rate</h3>';
    h += '<div style="position:relative;height:200px;"><canvas id="bf-resp-rate"></canvas></div>';
    h += '</div>';


    // === SPRINT 25 NEW CHARTS ===
    // Cardio Recovery
    h += '<div style="background:#1f2937;border-radius:10px;padding:12px;margin-bottom:12px;">';
    h += '<h3 style="margin:0 0 8px;color:#f9fafb;font-size:1em;">⚡ Cardio Recovery</h3>';
    h += '<div style="position:relative;height:200px;"><canvas id="bf-cardio-recovery"></canvas></div>';
    h += '</div>';

    // VO2 Max
    h += '<div style="background:#1f2937;border-radius:10px;padding:12px;margin-bottom:12px;">';
    h += '<h3 style="margin:0 0 8px;color:#f9fafb;font-size:1em;">🏃 VO2 Max (Apple)</h3>';
    h += '<div style="position:relative;height:200px;"><canvas id="bf-vo2max"></canvas></div>';
    h += '</div>';

    // SpO2
    h += '<div style="background:#1f2937;border-radius:10px;padding:12px;margin-bottom:12px;">';
    h += '<h3 style="margin:0 0 8px;color:#f9fafb;font-size:1em;">🩺 Blood Oxygen (SpO2)</h3>';
    h += '<div style="position:relative;height:200px;"><canvas id="bf-spo2"></canvas></div>';
    h += '</div>';

    // Daily Steps
    h += '<div style="background:#1f2937;border-radius:10px;padding:12px;margin-bottom:12px;">';
    h += '<h3 style="margin:0 0 8px;color:#f9fafb;font-size:1em;">🚶 Daily Steps</h3>';
    h += '<div style="position:relative;height:200px;"><canvas id="bf-steps"></canvas></div>';
    h += '</div>';

    // Walking HR
    h += '<div style="background:#1f2937;border-radius:10px;padding:12px;margin-bottom:12px;">';
    h += '<h3 style="margin:0 0 8px;color:#f9fafb;font-size:1em;">❤️ Walking HR Avg</h3>';
    h += '<div style="position:relative;height:200px;"><canvas id="bf-walking-hr"></canvas></div>';
    h += '</div>';


    // Sleep Recovery Score card
    if (typeof SleepRecoveryScore !== 'undefined') {
      try {
        var srs = SleepRecoveryScore.compute();
        if (srs) {
          var color = srs.score >= 85 ? '#22c55e' : 
                      srs.score >= 70 ? '#84cc16' :
                      srs.score >= 55 ? '#f59e0b' : '#ef4444';
          
          h += '<div style="background:#1f2937;border-radius:10px;padding:14px;margin-bottom:12px;">';
          h += '<h3 style="margin:0 0 12px;color:#f9fafb;font-size:1em;">😴 Sleep Recovery Score</h3>';
          h += '<div style="text-align:center;margin-bottom:12px;">';
          h += '<div style="color:' + color + ';font-size:3em;font-weight:bold;line-height:1;">' + srs.score + '</div>';
          h += '<div style="color:#9ca3af;font-size:1em;margin-top:4px;">' + srs.label + '</div>';
          h += '</div>';
          
          h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:0.85em;">';
          h += '<div style="background:#374151;padding:8px;border-radius:6px;text-align:center;">';
          h += '<div style="color:#9ca3af;font-size:0.8em;">Total</div>';
          h += '<div style="color:#f9fafb;font-weight:600;">' + srs.components.total.value_h + 'h</div>';
          h += '<div style="color:' + color + ';font-size:0.7em;">score ' + srs.components.total.score + '</div>';
          h += '</div>';
          h += '<div style="background:#374151;padding:8px;border-radius:6px;text-align:center;">';
          h += '<div style="color:#9ca3af;font-size:0.8em;">Deep</div>';
          h += '<div style="color:#f9fafb;font-weight:600;">' + srs.components.deep.ratio_pct + '%</div>';
          h += '<div style="color:' + color + ';font-size:0.7em;">score ' + srs.components.deep.score + '</div>';
          h += '</div>';
          h += '<div style="background:#374151;padding:8px;border-radius:6px;text-align:center;">';
          h += '<div style="color:#9ca3af;font-size:0.8em;">REM</div>';
          h += '<div style="color:#f9fafb;font-weight:600;">' + srs.components.rem.ratio_pct + '%</div>';
          h += '<div style="color:' + color + ';font-size:0.7em;">score ' + srs.components.rem.score + '</div>';
          h += '</div>';
          h += '<div style="background:#374151;padding:8px;border-radius:6px;text-align:center;">';
          h += '<div style="color:#9ca3af;font-size:0.8em;">Consistency</div>';
          h += '<div style="color:#f9fafb;font-weight:600;">' + srs.components.consistency.score + '/100</div>';
          h += '</div>';
          h += '</div>';
          
          // Insights
          if (srs.insights && srs.insights.length) {
            h += '<div style="margin-top:12px;">';
            srs.insights.forEach(function(ins) {
              var bg = ins.type === 'positive' ? '#052e16' : 
                       ins.type === 'danger' ? '#450a0a' :
                       ins.type === 'warning' ? '#451a03' : '#1e3a8a';
              var fg = ins.type === 'positive' ? '#86efac' :
                       ins.type === 'danger' ? '#fca5a5' :
                       ins.type === 'warning' ? '#fde68a' : '#a5b4fc';
              h += '<div style="background:' + bg + ';color:' + fg + ';padding:8px 10px;border-radius:6px;margin-top:6px;font-size:0.85em;">' + ins.message + '</div>';
            });
            h += '</div>';
          }
          
          h += '</div>';
        }
      } catch(e) { console.warn('SleepRecoveryScore card failed:', e); }
    }

    
    return h;
}

    
    return h;
  }

  function renderRecoveryCharts() {
    if (typeof BodyFormCharts === 'undefined') return;

    function getData(field) {
      if (typeof HealthImport === "undefined") return [];
      return HealthImport.getAll()
        .filter(function(d) { return d[field] && d[field] > 0; })
        .map(function(d) { return { date: d.date, value: d[field] }; })
        .sort(function(a, b) { return a.date.localeCompare(b.date); });
    }

    function avg(arr) {
      if (!arr.length) return 0;
      return arr.reduce(function(s,d){return s+d.value;}, 0) / arr.length;
    }


    // === SPRINT 25 metrics ===
    // Cardio Recovery
    h += '<div style="background:#1f2937;border-radius:10px;padding:12px;margin-bottom:12px;">';
    h += '<h3 style="margin:0 0 8px;color:#f9fafb;font-size:1em;">⚡ Cardio Recovery</h3>';
    h += '<div style="position:relative;height:200px;"><canvas id="bf-cardio-recovery"></canvas></div>';
    h += '</div>';

    // VO2 Max
    h += '<div style="background:#1f2937;border-radius:10px;padding:12px;margin-bottom:12px;">';
    h += '<h3 style="margin:0 0 8px;color:#f9fafb;font-size:1em;">🏃 VO2 Max (Apple)</h3>';
    h += '<div style="position:relative;height:200px;"><canvas id="bf-vo2max"></canvas></div>';
    h += '</div>';

    // SpO2
    h += '<div style="background:#1f2937;border-radius:10px;padding:12px;margin-bottom:12px;">';
    h += '<h3 style="margin:0 0 8px;color:#f9fafb;font-size:1em;">🩺 Blood Oxygen (SpO2)</h3>';
    h += '<div style="position:relative;height:200px;"><canvas id="bf-spo2"></canvas></div>';
    h += '</div>';

    // Daily Steps
    h += '<div style="background:#1f2937;border-radius:10px;padding:12px;margin-bottom:12px;">';
    h += '<h3 style="margin:0 0 8px;color:#f9fafb;font-size:1em;">🚶 Daily Steps</h3>';
    h += '<div style="position:relative;height:200px;"><canvas id="bf-steps"></canvas></div>';
    h += '</div>';

    // Walking HR
    h += '<div style="background:#1f2937;border-radius:10px;padding:12px;margin-bottom:12px;">';
    h += '<h3 style="margin:0 0 8px;color:#f9fafb;font-size:1em;">❤️ Walking HR Avg</h3>';
    h += '<div style="position:relative;height:200px;"><canvas id="bf-walking-hr"></canvas></div>';
    h += '</div>';

    
    // Sleep stacked
    drawSleepStacked('bf-sleep-stacked');

    // HRV
    var hrv = getData('hrv');
    BodyFormCharts.drawTrendChart && BodyFormCharts.drawTrendChart('bf-hrv', hrv, {
      label: 'HRV', color: '#22c55e', unit: ' ms', yLabel: 'ms',
      baseline: hrv.length >= 3 ? +avg(hrv).toFixed(1) : 0
    });

    // RHR
    var rhr = getData('rhr');
    BodyFormCharts.drawTrendChart && BodyFormCharts.drawTrendChart('bf-rhr', rhr, {
      label: 'RHR', color: '#ef4444', unit: ' bpm', yLabel: 'bpm',
      baseline: rhr.length >= 3 ? Math.round(avg(rhr)) : 0
    });

    // Wrist Temp
    var wt = getData('wristTemp');
    BodyFormCharts.drawTrendChart && BodyFormCharts.drawTrendChart('bf-wrist-temp', wt, {
      label: 'Wrist Temp', color: '#f97316', unit: '°C', yLabel: '°C',
      baseline: wt.length >= 3 ? +avg(wt).toFixed(2) : 0
    });

    // Resp Rate
    var rr = getData('respRate');
    BodyFormCharts.drawTrendChart && BodyFormCharts.drawTrendChart('bf-resp-rate', rr, {
      label: 'Resp Rate', color: '#06b6d4', unit: '/min', yLabel: '/min',
      baseline: rr.length >= 3 ? +avg(rr).toFixed(1) : 0
    });



    // Sprint 25 charts
    var cr = getData('cardioRecovery');
    BodyFormCharts.drawTrendChart && BodyFormCharts.drawTrendChart('bf-cardio-recovery', cr, {
      label: 'Cardio Recovery', color: '#a855f7', unit: ' bpm', yLabel: 'bpm'
    });

    var vo2 = getData('vo2maxApple');
    BodyFormCharts.drawTrendChart && BodyFormCharts.drawTrendChart('bf-vo2max', vo2, {
      label: 'VO2 Max', color: '#10b981', unit: ' ml/kg/min', yLabel: 'ml/kg/min',
      target: 56  // cel 4:59
    });

    var spo2 = getData('spo2');
    BodyFormCharts.drawTrendChart && BodyFormCharts.drawTrendChart('bf-spo2', spo2, {
      label: 'SpO2', color: '#06b6d4', unit: '%', yLabel: '%',
      baseline: 95
    });

    var steps = getData('steps');
    BodyFormCharts.drawTrendChart && BodyFormCharts.drawTrendChart('bf-steps', steps, {
      label: 'Steps', color: '#f59e0b', unit: '', yLabel: 'kroki'
    });

    var wHR = getData('walkingHR');
    BodyFormCharts.drawTrendChart && BodyFormCharts.drawTrendChart('bf-walking-hr', wHR, {
      label: 'Walking HR', color: '#ef4444', unit: ' bpm', yLabel: 'bpm'
    });
  }
  
  function drawSleepStacked(canvasId) {
    var canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === 'undefined') return;
    
    if (typeof HealthImport === 'undefined') return;
    var data = HealthImport.getAll()
      .filter(function(d) { return d.sleepMin > 0; })
      .slice(-30);
    
    if (!data.length) {
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = '#9ca3af';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Brak danych snu', canvas.width/2, canvas.height/2);
      return;
    }

    var labels = data.map(function(d) { return d.date.slice(5); });
    var deep = data.map(function(d) { return Math.round((d.deepMin || 0) / 60 * 10) / 10; });
    var rem = data.map(function(d) { return Math.round((d.remMin || 0) / 60 * 10) / 10; });
    var core = data.map(function(d) { return Math.round((d.coreMin || 0) / 60 * 10) / 10; });

    new Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          { label: 'Deep', data: deep, backgroundColor: '#8b5cf6' },
          { label: 'REM', data: rem, backgroundColor: '#3b82f6' },
          { label: 'Core', data: core, backgroundColor: '#06b6d4' }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#d1d5db', font: { size: 11 } } }
        },
        scales: {
          x: { stacked: true, ticks: { color: '#9ca3af', font: { size: 9 } }, grid: { color: '#374151' } },
          y: { stacked: true, ticks: { color: '#9ca3af', font: { size: 10 } }, grid: { color: '#374151' }, title: { display: true, text: 'h', color: '#9ca3af' } }
        }
      }
    });
  }

  // === COMPOSITION: Weight + BF ===
  function renderComposition() {
    var h = '';
    
    // Body Composition dual axis
    h += '<div style="background:#1f2937;border-radius:10px;padding:12px;margin-bottom:12px;">';
    h += '<h3 style="margin:0 0 8px;color:#f9fafb;font-size:1em;">⚖️ Waga + Body Fat</h3>';
    h += '<div style="position:relative;height:280px;"><canvas id="bf-weight-bf"></canvas></div>';
    h += '</div>';

    // Progress vs Goal
    if (typeof BodyTracker !== 'undefined') {
      var progress = BodyTracker.getProgressVsGoal();
      if (progress) {
        var statusColor = progress.weight.status === 'on_track' ? '#22c55e' : 
                          progress.weight.status === 'ahead' ? '#84cc16' : '#f59e0b';
        var safetyEmoji = progress.weight.safety === 'healthy' ? '✅' : 
                          progress.weight.safety === 'slow' ? '🐢' :
                          progress.weight.safety === 'too_fast' ? '⚠️' : '⚪';
        
        h += '<div style="background:#1f2937;border-radius:10px;padding:14px;margin-bottom:12px;">';
        h += '<h3 style="margin:0 0 12px;color:#f9fafb;font-size:1em;">🎯 Progress do HM (' + progress.days_remaining + ' dni)</h3>';
        h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">';
        h += '<div style="background:#374151;padding:10px;border-radius:8px;text-align:center;">';
        h += '<div style="color:#9ca3af;font-size:0.8em;">Waga</div>';
        h += '<div style="color:' + statusColor + ';font-size:1.5em;font-weight:bold;">' + progress.weight.current + ' kg</div>';
        h += '<div style="color:#6b7280;font-size:0.75em;">cel ' + progress.weight.target + ' kg</div>';
        h += '</div>';
        h += '<div style="background:#374151;padding:10px;border-radius:8px;text-align:center;">';
        h += '<div style="color:#9ca3af;font-size:0.8em;">Body Fat</div>';
        h += '<div style="color:#f59e0b;font-size:1.5em;font-weight:bold;">' + progress.body_fat.current + '%</div>';
        h += '<div style="color:#6b7280;font-size:0.75em;">cel ' + progress.body_fat.target + '%</div>';
        h += '</div>';
        h += '</div>';
        h += '<div style="background:#374151;padding:10px;border-radius:8px;margin-bottom:8px;">';
        h += '<div style="display:flex;justify-content:space-between;color:#d1d5db;font-size:0.85em;margin-bottom:4px;">';
        h += '<span>Tygodniowa redukcja</span>';
        h += '<span style="color:' + statusColor + ';">' + progress.weight.weekly_loss_actual + ' kg/tydzień</span>';
        h += '</div>';
        h += '<div style="color:#6b7280;font-size:0.75em;">cel: ' + progress.weight.weekly_loss_target + ' kg/tydzień ' + safetyEmoji + '</div>';
        h += '</div>';
        h += '<div style="display:flex;align-items:center;justify-content:space-between;color:#9ca3af;font-size:0.85em;">';
        h += '<span>Status: <b style="color:' + statusColor + ';">' + progress.weight.status + '</b></span>';
        h += '<span>Safety: <b>' + progress.weight.safety + '</b></span>';
        h += '</div>';
        h += '</div>';
      }
    }

    return h;
  }

  function renderCompositionCharts() {
    if (typeof BodyFormCharts === 'undefined') return;
    
    function getData(field) {
      if (typeof HealthImport === "undefined") return [];
      return HealthImport.getAll()
        .filter(function(d) { return d[field] && d[field] > 0; })
        .map(function(d) { return { date: d.date, value: d[field] }; })
        .sort(function(a, b) { return a.date.localeCompare(b.date); });
    }

    var weight = getData('weight');
    var bf = getData('bodyFat');
    if (BodyFormCharts.drawDualAxisChart) {
      BodyFormCharts.drawDualAxisChart('bf-weight-bf', weight, bf);
    }
  }

  // === COACH AI ===
  function renderCoach() {
    return '<div id="bf-ai-coach-container"><p style="color:#9ca3af;text-align:center;padding:30px;">⏳ AI Coach analizuje dane...</p></div>';
  }

  async function renderCoachContent() {
    var container = document.getElementById('bf-ai-coach-container');
    if (!container) return;

    if (typeof AICoach === 'undefined') {
      container.innerHTML = '<p style="color:#fca5a5;text-align:center;padding:30px;">AICoach nie załadowany</p>';
      return;
    }

    // Użyj istniejącej AICoach.render() na nowym kontenerze
    AICoach.render('bf-ai-coach-container');
  }

  // === INSIGHTS (korelacje) ===
  function renderInsights() {
    var h = '';
    h += '<div style="background:#1f2937;border-radius:10px;padding:12px;margin-bottom:12px;">';
    h += '<h3 style="margin:0 0 4px;color:#f9fafb;font-size:1em;">🔗 Korelacje (Pearson)</h3>';
    h += '<p style="color:#9ca3af;margin:0 0 12px;font-size:0.75em;">r od -1 do +1. Bliżej ±1 = silniejsza zależność</p>';
    h += '<div id="bf-correlations"></div>';
    h += '</div>';

    // CP Trend (też ciekawy insight)
    h += '<div style="background:#1f2937;border-radius:10px;padding:12px;margin-bottom:12px;">';
    h += '<h3 style="margin:0 0 8px;color:#f9fafb;font-size:1em;">⚡ CP Trend (12 tygodni)</h3>';
    h += '<div style="position:relative;height:240px;"><canvas id="bf-cp-trend"></canvas></div>';
    h += '</div>';

    return h;
  }

  async function renderInsightsContent() {
    if (typeof BodyFormCharts === 'undefined') return;
    
    if (BodyFormCharts.computeCorrelations) {
      var corr = await BodyFormCharts.computeCorrelations();
      if (BodyFormCharts.renderCorrelations) {
        BodyFormCharts.renderCorrelations('bf-correlations', corr);
      }
    }
    
    if (BodyFormCharts.drawCPTrend) {
      await BodyFormCharts.drawCPTrend('bf-cp-trend');
    }
  }

  window.BodyFormTab = { 
    render: render,
    setTab: setTab
  };
})();

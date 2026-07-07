
/* stats-tabs.js v2 — Sprint 24: Sub-tabs Stats (Performance / Biomechanics / History) — bez duplikatów */
(function() {
  "use strict";
  var currentTab = 'performance';

  function render() {
    var el = document.getElementById('s-stat');
    if (!el) return;

    var html = '';
    html += '<div style="max-width:900px;margin:0 auto;padding:8px;">';
    html += '<h2 style="color:#f9fafb;margin:8px 4px 4px;font-size:1.4em;">📊 Statystyki</h2>';
    html += '<p style="color:#9ca3af;margin:0 4px 16px;font-size:0.85em;">Postępy treningowe</p>';

    html += '<div class="sub-tabs">';
    html += '<button class="sub-tab ' + (currentTab==='performance'?'act':'') + '" onclick="StatsTabs.setTab(\'performance\')">🏃 Performance</button>';
    html += '<button class="sub-tab ' + (currentTab==='biomechanics'?'act':'') + '" onclick="StatsTabs.setTab(\'biomechanics\')">📏 Biomechanics</button>';
    html += '<button class="sub-tab ' + (currentTab==='history'?'act':'') + '" onclick="StatsTabs.setTab(\'history\')">📚 History</button>';
    html += '</div>';

    html += '<div id="stats-content"><p style="color:#9ca3af;text-align:center;padding:20px;">⏳ Ładowanie...</p></div>';
    html += '</div>';

    el.innerHTML = html;

    setTimeout(function() {
      if (currentTab === 'performance') renderPerformance();
      else if (currentTab === 'biomechanics') renderBiomechanics();
      else if (currentTab === 'history') renderHistory();
    }, 50);
  }

  function setTab(tab) {
    currentTab = tab;
    render();
  }

  // === Filter Analytics HTML — zostaw tylko wybrane sekcje ===

function filterAnalyticsHtml(html, includeKeywords) {
  if (!html) return '';
  
  // Wstrzyknij całość Analytics, ale dodaj data-section atrybut
  // do ukrywania przez CSS
  var div = document.createElement('div');
  div.innerHTML = html;
  
  var sections = div.querySelectorAll('.chart-section');
  sections.forEach(function(sec) {
    var h3 = sec.querySelector('h3');
    if (!h3) return;
    var title = h3.textContent;
    var matches = includeKeywords.some(function(kw) {
      return title.indexOf(kw) >= 0;
    });
    if (!matches) {
      sec.style.display = 'none';
    }
  });
  
  // Table section (Podsumowanie tygodniowe)
  var tableSec = div.querySelector('.table-section');
  if (tableSec) {
    var tableMatches = includeKeywords.some(function(kw) {
      return tableSec.textContent.indexOf(kw) >= 0;
    });
    if (!tableMatches) {
      tableSec.style.display = 'none';
    }
  }
  
  return div.innerHTML;
}


  // === PERFORMANCE ===
  function renderPerformance() {
    var container = document.getElementById('stats-content');
    if (!container) return;

    var h = '';

    // Training Load + Prediction (z Charts)
    h += '<div class="chc"><div class="ch-t">❤️‍🔥 Training Load (CTL / ATL / TSB)</div><canvas id="ch-tl"></canvas></div>';
    h += '<div class="chc"><div class="ch-t">🎯 Prognoza półmaratonu - trend</div><canvas id="ch-pred"></canvas></div>';

    // Analytics — tylko Performance-related
    if (typeof Analytics !== 'undefined') {
      try {
        var analyticsHtml = Analytics.render();
        h += filterAnalyticsHtml(analyticsHtml, [
          'VO', 'Trend mocy', 'GAP', 'Najszybszy', 'Rownomiernosc', 'HR'
        ]);
      } catch(e) { console.warn('Analytics render failed:', e); }
    }

    // Charts dodatkowe
    h += '<div class="chc"><div class="ch-t">📊 Km tygodniowy (plan vs realizacja)</div><canvas id="ch1"></canvas></div>';
    h += '<div class="chc"><div class="ch-t">⏱️ Trend tempa</div><canvas id="ch2"></canvas></div>';
    h += '<div class="chc"><div class="ch-t">😊 Samopoczucie</div><canvas id="ch3"></canvas></div>';
    h += '<div class="chc"><div class="ch-t">📅 Objętość miesięczna</div><canvas id="ch4"></canvas></div>';

    container.innerHTML = h;

    setTimeout(function() {
      try {
        if (typeof Analytics !== 'undefined' && Analytics.drawCharts) Analytics.drawCharts();
      } catch(e) {}
      try {
        if (typeof Charts !== 'undefined') {
          if (Charts.weeklyKm) Charts.weeklyKm('ch1');
          if (Charts.paceTrend) Charts.paceTrend('ch2');
          if (Charts.feelingTrend) Charts.feelingTrend('ch3');
          if (Charts.monthlyVol) Charts.monthlyVol('ch4');
          if (Charts.trainingLoad) Charts.trainingLoad('ch-tl');
          if (Charts.predTrend) Charts.predTrend('ch-pred');
        }
      } catch(e) {}
    }, 100);
  }

  // === BIOMECHANICS ===
  function renderBiomechanics() {
    var container = document.getElementById('stats-content');
    if (!container) return;

    var h = '';

    h += '<div style="background:#1f2937;border-radius:10px;padding:12px;margin-bottom:12px;">';
    h += '<h3 style="margin:0 0 4px;color:#f9fafb;font-size:1em;">🏃 Running Biomechanics (Apple Watch)</h3>';
    h += '<p style="color:#9ca3af;margin:0;font-size:0.75em;">Pomiar z Apple Watch Ultra 2 — wymaga aktywnych biegów</p>';
    h += '</div>';

    h += '<div style="background:#1f2937;border-radius:10px;padding:12px;margin-bottom:12px;">';
    h += '<h3 style="margin:0 0 8px;color:#f9fafb;font-size:1em;">⚡ Critical Power (12 tygodni)</h3>';
    h += '<div style="position:relative;height:240px;"><canvas id="st-cp-trend"></canvas></div>';
    h += '</div>';

    h += '<div style="background:#1f2937;border-radius:10px;padding:12px;margin-bottom:12px;">';
    h += '<h3 style="margin:0 0 8px;color:#f9fafb;font-size:1em;">⚡ Running Power</h3>';
    h += '<div style="position:relative;height:200px;"><canvas id="st-running-power"></canvas></div>';
    h += '</div>';

    h += '<div style="background:#1f2937;border-radius:10px;padding:12px;margin-bottom:12px;">';
    h += '<h3 style="margin:0 0 8px;color:#f9fafb;font-size:1em;">👣 Ground Contact Time</h3>';
    h += '<div style="position:relative;height:200px;"><canvas id="st-gct"></canvas></div>';
    h += '</div>';

    h += '<div style="background:#1f2937;border-radius:10px;padding:12px;margin-bottom:12px;">';
    h += '<h3 style="margin:0 0 8px;color:#f9fafb;font-size:1em;">📏 Stride Length</h3>';
    h += '<div style="position:relative;height:200px;"><canvas id="st-stride"></canvas></div>';
    h += '</div>';

    h += '<div style="background:#1f2937;border-radius:10px;padding:12px;margin-bottom:12px;">';
    h += '<h3 style="margin:0 0 8px;color:#f9fafb;font-size:1em;">⬆️⬇️ Vertical Oscillation</h3>';
    h += '<div style="position:relative;height:200px;"><canvas id="st-vo"></canvas></div>';
    h += '</div>';

    // Form Score
    if (typeof BiomechanicsEngine !== 'undefined') {
      try {
        var biomech = BiomechanicsEngine.compute();
        if (biomech && biomech.form_score) {
          var color = biomech.form_score.form_score >= 70 ? '#22c55e' : 
                      biomech.form_score.form_score >= 55 ? '#f59e0b' : '#ef4444';
          h += '<div style="background:#1f2937;border-radius:10px;padding:14px;margin-bottom:12px;">';
          h += '<h3 style="margin:0 0 12px;color:#f9fafb;font-size:1em;">🏆 Form Score</h3>';
          h += '<div style="text-align:center;">';
          h += '<div style="color:' + color + ';font-size:3em;font-weight:bold;">' + biomech.form_score.form_score + '</div>';
          h += '<div style="color:#9ca3af;font-size:1em;">' + biomech.form_score.label + '</div>';
          h += '</div>';
          h += '</div>';
        }
      } catch(e) {}
    }

    container.innerHTML = h;

    setTimeout(function() {
      if (typeof BodyFormCharts === 'undefined') return;

      function getData(field) {
        if (typeof HealthImport === "undefined") return [];
        return HealthImport.getAll()
          .filter(function(d) { return d[field] && d[field] > 0; })
          .map(function(d) { return { date: d.date, value: d[field] }; })
          .sort(function(a, b) { return a.date.localeCompare(b.date); });
      }

      if (BodyFormCharts.drawCPTrend) BodyFormCharts.drawCPTrend('st-cp-trend');

      if (BodyFormCharts.drawTrendChart) {
        BodyFormCharts.drawTrendChart('st-running-power', getData('runningPower'), {
          label: 'Running Power', color: '#a855f7', unit: ' W', yLabel: 'Power (W)'
        });
        BodyFormCharts.drawTrendChart('st-gct', getData('gct'), {
          label: 'GCT', color: '#84cc16', unit: ' ms', yLabel: 'ms'
        });
        BodyFormCharts.drawTrendChart('st-stride', getData('stride'), {
          label: 'Stride', color: '#eab308', unit: ' m', yLabel: 'm'
        });
        BodyFormCharts.drawTrendChart('st-vo', getData('vo'), {
          label: 'VO', color: '#ec4899', unit: ' cm', yLabel: 'cm'
        });
      }
    }, 100);
  }

  // === HISTORY ===
  function renderHistory() {
    var container = document.getElementById('stats-content');
    if (!container) return;

    var h = '';

    // Heatmap
    h += renderHeatmap();

    // Analytics — tylko History-related sections
    if (typeof Analytics !== 'undefined') {
      try {
        var analyticsHtml = Analytics.render();
        h += filterAnalyticsHtml(analyticsHtml, [
          'Rekordy', 'Rozklad typow', 'Dystans narastajaco', 'Podsumowanie'
        ]);
      } catch(e) {}
    }

    // Historia treningów
    h += renderHistoryList();

    container.innerHTML = h;

    setTimeout(function() {
      try {
        if (typeof Analytics !== 'undefined' && Analytics.drawCharts) {
          Analytics.drawCharts();
        }
      } catch(e) {}
    }, 100);
  }

  function renderHeatmap() {
    if (typeof PLAN === 'undefined') return '';
    
    var t = todayStr();
    var dayH = ['Pn','Wt','Sr','Cz','Pt','Sb','Nd'];
    
    var h = '<div class="hmap"><div class="hmap-title">🟩 Mapa aktywności (13 tygodni)</div>';
    h += '<div class="hmap-days"><div></div>';
    dayH.forEach(function(d) { h += '<div class="hmap-dh">' + d + '</div>'; });
    h += '</div>';
    h += '<div class="hmap-grid">';
    
    PLAN.forEach(function(w) {
      var we = getDayDate(w.start, 6);
      h += '<div class="hmap-wk">T' + w.weekNum + '</div>';
      w.days.forEach(function(d) {
        var dt = getDayDate(w.start, d.dow);
        var log = S.getLog(dt);
        var past = dt < t;
        var isToday = dt === t;
        var hasShifted = false;
        if (!d.rest && d.km > 0 && !log.distance && !log.status) {
          if (typeof findShiftedLog === 'function') {
            var sh = findShiftedLog(w.start, we, dt, d.km);
            if (sh) hasShifted = true;
          }
        }
        var cls = 'hm-cell';
        if (d.rest) cls += ' rest';
        else if (!past && !isToday) cls += ' future';
        else if (log.status === 'done' || hasShifted) cls += ' done';
        else if (log.status === 'skipped') cls += ' skip';
        else if (past) cls += ' miss';
        else cls += ' future';
        if (isToday) cls += ' today-cell';
        h += '<div class="' + cls + '" title="' + d.name + ' ' + dt + '"></div>';
      });
    });
    
    h += '</div>';
    h += '<div class="hmap-leg">';
    h += '<div class="hmap-li"><div class="hmap-lc" style="background:var(--g)"></div>Wykonany</div>';
    h += '<div class="hmap-li"><div class="hmap-lc" style="background:var(--o)"></div>Brak logu</div>';
    h += '<div class="hmap-li"><div class="hmap-lc" style="background:var(--r)"></div>Pominięty</div>';
    h += '<div class="hmap-li"><div class="hmap-lc" style="background:var(--c3);opacity:.3"></div>Rest</div>';
    h += '<div class="hmap-li"><div class="hmap-lc" style="background:var(--c2);border:.5px solid var(--c3)"></div>Przyszłość</div>';
    h += '</div></div>';
    
    return h;
  }

  function renderHistoryList() {
    if (typeof S === 'undefined') return '';
    
    var DOW = ['Niedz','Pon','Wt','Sr','Czw','Pt','Sob'];
    var EMO_LOCAL = ['','😫','😣','😕','😐','🙂','😊','😄','😃','🤩','🔥'];
    
    var logs = S.getAllLogs();
    var sortedDates = Object.keys(logs).filter(function(d) { return logs[d].distance; }).sort(function(a, b) { return b.localeCompare(a); });
    
    var totalKm = 0;
    sortedDates.forEach(function(d) { if (logs[d].distance) totalKm += parseFloat(logs[d].distance); });
    
    var plannedDates = {};
    try {
      if (window.PLAN_FLAT) {
        window.PLAN_FLAT.forEach(function(pf) {
          if (!plannedDates[pf.date]) plannedDates[pf.date] = { type: pf.type, km: pf.km };
        });
      }
    } catch(e) {}
    
    var h = '<div class="stit">🏃 Historia treningów</div>';
    h += '<div class="hist-head">';
    h += '<span class="hist-count">' + sortedDates.length + ' treningów</span>';
    h += '<span class="hist-total">' + Math.round(totalKm * 10) / 10 + ' km łącznie</span>';
    h += '</div>';
    
    if (sortedDates.length === 0) {
      h += '<div class="empty">Brak zalogowanych treningów</div>';
      return h;
    }

    sortedDates.forEach(function(date) {
      var l = logs[date];
      var dd = new Date(date + 'T12:00:00');
      var dowName = DOW[dd.getDay()];
      var planned = plannedDates[date];
      var hasDet = !!l.strava_id;
      
      h += '<div class="wlog"' + (hasDet ? ' onclick="toggleDetail(this,' + l.strava_id + ')" style="cursor:pointer"' : '') + '>';
      h += '<div class="wlog-date"><div class="wlog-d">' + date.slice(5).replace('-','.') + '</div><div class="wlog-dow">' + dowName + '</div></div>';
      h += '<div class="wlog-info"><div class="wlog-top">';
      h += '<span class="wlog-km">' + l.distance + ' km</span>';
      if (l.pace) h += '<span class="wlog-pace">⏱ ' + l.pace + '/km</span>';
      if (l.hr) h += '<span class="wlog-hr">❤ ' + l.hr + ' bpm</span>';
      if (l.feeling) h += '<span class="wlog-feel">' + (EMO_LOCAL[+l.feeling] || '') + '</span>';
     
      // === Sprint 30: Smart Plan Matcher status ===
      var actForMatch = { date: date, km: l.distance, pace: l.pace, type: l.type, avg_hr: l.hr, strava_id: l.strava_id };
      var effective = null;
      if (typeof PlanMatcher !== 'undefined') {
        try { effective = PlanMatcher.getEffectivePlan(actForMatch); } catch(e) {}
      }
      
      if (effective && effective.plan) {
        var confLabel = effective.source === 'override_manual' ? '✍️ ' : 
                       (effective.confidence_level === 'high' ? '✅ ' :
                        effective.confidence_level === 'medium' ? '⚠️ ' : '❓ ');
        h += '<span class="wlog-match" style="cursor:pointer" onclick="event.stopPropagation();PlanOverrideUI.open(' + 
          JSON.stringify(actForMatch).replace(/"/g, '&quot;') + ')" title="Przypisano: ' + effective.plan.date + ' - ' + effective.plan.type + ' (' + effective.confidence + '%)">' + 
          confLabel + effective.plan.type + '</span>';
      } else if (effective && effective.source === 'override_skip') {
        h += '<span class="wlog-tag" style="cursor:pointer" onclick="event.stopPropagation();PlanOverrideUI.open(' + 
          JSON.stringify(actForMatch).replace(/"/g, '&quot;') + ')">✍️ Poza planem</span>';
      } else if (planned) {
        h += '<span class="wlog-match">✅ ' + planned.type + '</span>';
      } else {
        h += '<span class="wlog-tag" style="cursor:pointer" onclick="event.stopPropagation();PlanOverrideUI.open(' + 
          JSON.stringify(actForMatch).replace(/"/g, '&quot;') + ')">✨ Poza planem</span>';
      }
      
      if (hasDet) h += '<span class="wlog-expand-btn">▼ szczegóły</span>';

      h += '</div>';
      if (l.notes) h += '<div class="wlog-note">' + l.notes + '</div>';

      if (hasDet) h += '<div class="wlog-detail" id="det-' + l.strava_id + '"></div>';
      
      // === Sprint 31: Benchmark button ===
      var activityId = l.strava_id || l.id;
      if (activityId) {
        h += '<div style="margin-top:6px;">';
        h += '<button onclick="event.stopPropagation();WorkoutBenchmarkUI_showModal(\'' + date + '\',\'' + activityId + '\')" style="background:#7c3aed;color:white;border:none;padding:5px 12px;border-radius:6px;font-size:0.75em;font-weight:600;cursor:pointer;">🎯 Idealny Trening</button>';
        h += '</div>';
      }
      
      h += '</div></div>';

    });
    
    return h;
  }

  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  }

  window.StatsTabs = { render: render, setTab: setTab };

  
  // === Sprint 31: Modal for benchmark ===
  window.WorkoutBenchmarkUI_showModal = async function(date, activityId) {
    if (typeof WorkoutBenchmarkUI === 'undefined') {
      alert('Benchmark UI not loaded');
      return;
    }
    
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:9999;display:flex;align-items:flex-start;justify-content:center;padding:16px;overflow-y:auto;';
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
    
    overlay.innerHTML = '<div style="background:#111827;border-radius:12px;max-width:700px;width:100%;padding:16px;border:1px solid #374151;margin-top:20px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid #374151;">' +
      '<h3 style="margin:0;color:#f9fafb;">🎯 Idealny Trening — porównanie</h3>' +
      '<button onclick="this.closest(\'div[style*=\\\'fixed\\\']\').remove()" style="background:#374151;border:none;color:white;width:32px;height:32px;border-radius:50%;cursor:pointer;">✕</button>' +
      '</div>' +
      '<div id="bench-content"><p style="color:#9ca3af;text-align:center;padding:30px;">⏳ Ładuję...</p></div>' +
      '</div>';
    
    document.body.appendChild(overlay);
    
    // Load activity data
    try {
      var acts = await DB.getAll();
      var activity = acts.find(function(a) {
        return String(a.strava_id) === String(activityId) || String(a.id) === String(activityId);
      });
      
      if (!activity) {
        document.getElementById('bench-content').innerHTML = '<p style="color:#fca5a5;text-align:center;padding:20px;">Nie znaleziono treningu</p>';
        return;
      }
      
      // Add pace/hr from log if missing
      var log = S.getLog(date);
      if (log) {
        if (!activity.pace) activity.pace = log.pace;
        if (!activity.avg_hr) activity.avg_hr = log.hr;
      }
      
      // Get plan using PlanMatcher
      var plan = null;
      if (typeof PlanMatcher !== 'undefined') {
        var eff = PlanMatcher.getEffectivePlan(activity);
        if (eff && eff.plan) plan = eff.plan;
      }
      
      if (!plan && window.PLAN_FLAT) {
        plan = window.PLAN_FLAT.find(function(p) { return p.date === date; });
      }
      
      document.getElementById('bench-content').innerHTML = WorkoutBenchmarkUI.render(activity, plan);
    } catch(e) {
      console.error('Benchmark error:', e);
      document.getElementById('bench-content').innerHTML = '<p style="color:#fca5a5;text-align:center;padding:20px;">❌ ' + e.message + '</p>';
    }
  };

})();

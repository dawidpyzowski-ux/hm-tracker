
/* nutrition-tab.js v1 — Sprint 26: Full UI tab */
var NutritionTab = (function() {
  "use strict";

var currentTab = 'today';
var currentDate = null;

function localToday() {
  var d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString().slice(0, 10);
}


  function render() {
    var el = document.getElementById('s-nutr');
    if (!el) return;
    
    if (!currentDate) currentDate = localToday();
    
    var html = '';
    html += '<div style="max-width:900px;margin:0 auto;padding:8px;">';
    html += '<h2 style="color:#f9fafb;margin:8px 4px;font-size:1.4em;">🍽️ Dieta</h2>';
    
    // Sub-tabs
    html += '<div class="sub-tabs">';
    
html += '<button class="sub-tab ' + (currentTab==='today'?'act':'') + '" onclick="NutritionTab.setTab(\'today\')">📊 Dzisiaj</button>';
html += '<button class="sub-tab ' + (currentTab==='week'?'act':'') + '" onclick="NutritionTab.setTab(\'week\')">📅 Tydzień</button>';
html += '<button class="sub-tab ' + (currentTab==='analytics'?'act':'') + '" onclick="NutritionTab.setTab(\'analytics\')">📈 Analytics</button>';
html += '<button class="sub-tab ' + (currentTab==='ai'?'act':'') + '" onclick="NutritionTab.setTab(\'ai\')">🤖 AI</button>';
html += '<button class="sub-tab ' + (currentTab==='plan'?'act':'') + '" onclick="NutritionTab.setTab(\'plan\')">📋 Plan</button>';

    html += '</div>';
    
    html += '<div id="nutr-content">';

if (currentTab === 'today') html += renderToday();
else if (currentTab === 'week') html += renderWeek();
else if (currentTab === 'analytics') html += renderAnalyticsPlaceholder();
else if (currentTab === 'ai') html += renderAIPlaceholder();
else if (currentTab === 'plan') html += renderPlan();

    html += '</div>';
    
    html += '</div>';
    el.innerHTML = html;
    
  
if (currentTab === 'ai') setTimeout(renderAI, 100);
if (currentTab === 'analytics') setTimeout(renderAnalytics, 100);

  }

  function setTab(tab) {
    currentTab = tab;
    render();
  }

  // ============================================
  // TODAY — bilans + meals + add
  // ============================================

function renderToday() {
  if (typeof NutritionEngine === 'undefined') {
    return '<p style="color:#fca5a5;text-align:center;padding:30px;">NutritionEngine not loaded</p>';
  }
  
  var data = NutritionEngine.compute(currentDate);
  var h = '';
  
  // Date Navigator
  var today = localToday();
  var isToday = currentDate === today;
  var displayDate = currentDate;
  var d = new Date(currentDate);
  var dayName = ['Nd','Pn','Wt','Śr','Cz','Pt','Sb'][d.getDay()];
  
  h += '<div style="background:#1f2937;border-radius:10px;padding:10px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;">';
  h += '<button onclick="NutritionTab.navDate(-1)" style="background:#374151;border:none;color:#f9fafb;padding:8px 14px;border-radius:8px;cursor:pointer;font-size:1em;">← Wczoraj</button>';
  h += '<div style="text-align:center;">';
  h += '<div style="color:#f9fafb;font-weight:600;font-size:1em;">' + dayName + ', ' + displayDate.slice(8) + '.' + displayDate.slice(5,7) + (isToday ? ' (dziś)' : '') + '</div>';
  h += '<input type="date" id="date-picker" value="' + currentDate + '" onchange="NutritionTab.jumpToDate(this.value)" style="background:#1f2937;border:1px solid #374151;color:#9ca3af;padding:2px 6px;border-radius:4px;font-size:0.8em;margin-top:4px;">';
  h += '</div>';
  h += '<button onclick="NutritionTab.navDate(1)"' + (isToday ? ' disabled' : '') + ' style="background:' + (isToday ? '#1f2937' : '#374151') + ';border:none;color:#f9fafb;padding:8px 14px;border-radius:8px;cursor:' + (isToday ? 'not-allowed' : 'pointer') + ';font-size:1em;opacity:' + (isToday ? '0.4' : '1') + ';">Jutro →</button>';
  h += '</div>';

    
    // === Bilans card ===
    var calPct = data.percentages.calories;
    var calColor = calPct >= 95 && calPct <= 105 ? '#22c55e' :
                   calPct < 95 ? '#84cc16' :
                   calPct < 120 ? '#f59e0b' : '#ef4444';
    
    h += '<div style="background:#1f2937;border-radius:10px;padding:14px;margin-bottom:12px;">';
    h += '<h3 style="margin:0 0 12px;color:#f9fafb;font-size:1em;">📊 Bilans dzisiaj</h3>';
    
    // Calories big
    h += '<div style="text-align:center;margin-bottom:12px;">';
    h += '<div style="color:' + calColor + ';font-size:2.5em;font-weight:bold;line-height:1;">' + Math.round(data.totals.calories) + '</div>';
    h += '<div style="color:#9ca3af;font-size:0.9em;">z ' + data.budget.target_calories + ' kcal (' + calPct + '%)</div>';
    h += '</div>';
    
    // Bar
    h += '<div style="background:#374151;border-radius:10px;height:8px;overflow:hidden;margin-bottom:14px;">';
    h += '<div style="background:' + calColor + ';height:100%;width:' + Math.min(100, calPct) + '%;transition:width 0.3s;"></div>';
    h += '</div>';
    
    // Remaining
    var remaining = data.remaining.calories;
    if (remaining > 0) {
      h += '<div style="text-align:center;color:#9ca3af;font-size:0.9em;margin-bottom:12px;">→ Pozostało: <b style="color:#f9fafb;">' + Math.round(remaining) + ' kcal</b></div>';
    } else {
      h += '<div style="text-align:center;color:#f59e0b;font-size:0.9em;margin-bottom:12px;">→ Przekroczono o <b>' + Math.abs(Math.round(remaining)) + ' kcal</b></div>';
    }
    
    // Macros grid
    h += '<div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:8px;">';
    
    ['protein', 'carbs', 'fat'].forEach(function(macro) {
      var labels = { protein: 'Białko', carbs: 'Węgle', fat: 'Tłuszcz' };
      var emojis = { protein: '🥩', carbs: '🍞', fat: '🥑' };
      var colors = { protein: '#ef4444', carbs: '#f59e0b', fat: '#a855f7' };
      var current = Math.round(data.totals[macro]);
      var target = data.budget['target_' + macro + '_g'];
      var pct = data.percentages[macro];
      
      h += '<div style="background:#374151;padding:8px;border-radius:8px;text-align:center;">';
      h += '<div style="font-size:1.2em;">' + emojis[macro] + '</div>';
      h += '<div style="color:#9ca3af;font-size:0.7em;">' + labels[macro] + '</div>';
      h += '<div style="color:' + colors[macro] + ';font-size:1.1em;font-weight:bold;">' + current + 'g</div>';
      h += '<div style="color:#6b7280;font-size:0.65em;">/ ' + target + 'g (' + pct + '%)</div>';
      h += '<div style="background:#1f2937;border-radius:4px;height:3px;margin-top:4px;overflow:hidden;">';
      h += '<div style="background:' + colors[macro] + ';height:100%;width:' + Math.min(100, pct) + '%;"></div>';
      h += '</div>';
      h += '</div>';
    });
    h += '</div>';
    
    // Budget info
    h += '<div style="margin-top:12px;padding-top:10px;border-top:1px solid #374151;color:#6b7280;font-size:0.75em;text-align:center;">';
    h += 'TDEE: ' + data.budget.tdee + ' kcal | Deficyt: -' + data.budget.deficit + ' kcal';
    if (data.budget.auto_correction !== 0) {
      h += ' | Auto: ' + (data.budget.auto_correction > 0 ? '+' : '') + data.budget.auto_correction + ' kcal';
    }
    h += '</div>';
    
    h += '</div>';
    
    // === Add meal buttons ===
    h += '<div style="background:#1f2937;border-radius:10px;padding:14px;margin-bottom:12px;">';
    h += '<h3 style="margin:0 0 12px;color:#f9fafb;font-size:1em;">➕ Dodaj posiłek</h3>';
    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">';
    
    h += '<button onclick="NutritionTab.openScanner()" style="background:#3b82f6;color:white;border:none;border-radius:8px;padding:14px;font-size:0.9em;font-weight:600;cursor:pointer;">📷 Skanuj kod</button>';
    h += '<button onclick="NutritionTab.openSearch()" style="background:#22c55e;color:white;border:none;border-radius:8px;padding:14px;font-size:0.9em;font-weight:600;cursor:pointer;">🔍 Szukaj produkt</button>';
    h += '<button onclick="NutritionTab.openAIEstimate()" style="background:#a855f7;color:white;border:none;border-radius:8px;padding:14px;font-size:0.9em;font-weight:600;cursor:pointer;">✍️ AI Quick</button>';
    h += '<button onclick="NutritionTab.openManual()" style="background:#6b7280;color:white;border:none;border-radius:8px;padding:14px;font-size:0.9em;font-weight:600;cursor:pointer;">➕ Wpisz ręcznie</button>';
    h += '</div>';
    h += '</div>';
    
    // === Meals grouped ===
    h += '<div style="background:#1f2937;border-radius:10px;padding:14px;margin-bottom:12px;">';
    h += '<h3 style="margin:0 0 12px;color:#f9fafb;font-size:1em;">🍴 Posiłki dzisiaj</h3>';
    
    var groups = data.mealsByGroup;
    ['breakfast', 'lunch', 'dinner', 'snack'].forEach(function(type) {
      var group = groups[type];
      var groupCals = group.meals.reduce(function(s, m) { return s + (parseFloat(m.calories) || 0); }, 0);
      
      h += '<div style="margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid #374151;">';
      h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">';
      h += '<span style="color:#f9fafb;font-weight:600;">' + group.emoji + ' ' + group.label + '</span>';
      h += '<span style="color:#9ca3af;font-size:0.85em;">' + Math.round(groupCals) + ' kcal</span>';
      h += '</div>';
      
      if (group.meals.length === 0) {
        h += '<div style="color:#6b7280;font-size:0.85em;font-style:italic;text-align:center;padding:8px;">brak posiłków</div>';
      } else {
        group.meals.forEach(function(m) {
          h += '<div style="background:#374151;padding:10px;border-radius:8px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;">';
          h += '<div style="flex:1;min-width:0;">';
          h += '<div style="color:#f9fafb;font-size:0.9em;font-weight:600;">' + m.name + '</div>';
          h += '<div style="color:#9ca3af;font-size:0.75em;margin-top:2px;">';
          if (m.quantity_g) h += m.quantity_g + 'g · ';
          h += Math.round(m.calories) + ' kcal · B:' + Math.round(m.protein || 0) + 'g · W:' + Math.round(m.carbs || 0) + 'g · T:' + Math.round(m.fat || 0) + 'g';
          h += '</div>';
          h += '</div>';
          h += '<button onclick="NutritionTab.deleteMeal(\'' + currentDate + '\',' + m.id + ')" style="background:transparent;border:none;color:#ef4444;font-size:1.2em;cursor:pointer;padding:4px 8px;">🗑️</button>';
          h += '</div>';
        });
      }
      h += '</div>';
    });
    
    h += '</div>';
    
    return h;
  }

  // ============================================
  // WEEK summary
  // ============================================
  function renderWeek() {
    var h = '<div style="background:#1f2937;border-radius:10px;padding:14px;">';
    h += '<h3 style="margin:0 0 12px;color:#f9fafb;">📅 Tydzień</h3>';
    
    var dates = [];
    for (var i = 6; i >= 0; i--) {
      var d = new Date();
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().slice(0, 10));
    }
    
    var weekTotalCal = 0, weekTotalP = 0, weekTotalC = 0, weekTotalF = 0;
    var daysLogged = 0;
    
    dates.forEach(function(date) {
      var totals = NutritionEngine.getTotalsForDate(date);
      var budget = NutritionEngine.calculateBudget();
      var dd = new Date(date);
      var dayName = ['Nd','Pn','Wt','Śr','Cz','Pt','Sb'][dd.getDay()];
      var isToday = date === localToday();
      
      var pct = budget.target_calories > 0 ? Math.round(totals.calories / budget.target_calories * 100) : 0;
      var color = pct >= 95 && pct <= 105 ? '#22c55e' : pct < 95 ? '#84cc16' : '#f59e0b';
      
      h += '<div style="background:#374151;padding:10px;border-radius:8px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;' + (isToday ? 'border:1px solid #3b82f6;' : '') + '">';
      h += '<div>';
      h += '<div style="color:#f9fafb;font-weight:600;">' + dayName + ' ' + date.slice(5).replace('-','.') + (isToday ? ' (dziś)' : '') + '</div>';
      h += '<div style="color:#9ca3af;font-size:0.75em;">' + totals.meal_count + ' posiłki</div>';
      h += '</div>';
      h += '<div style="text-align:right;">';
      h += '<div style="color:' + color + ';font-weight:bold;">' + Math.round(totals.calories) + ' kcal</div>';
      h += '<div style="color:#9ca3af;font-size:0.75em;">' + pct + '% (cel ' + budget.target_calories + ')</div>';
      h += '</div>';
      h += '</div>';
      
      if (totals.calories > 0) {
        weekTotalCal += totals.calories;
        weekTotalP += totals.protein;
        weekTotalC += totals.carbs;
        weekTotalF += totals.fat;
        daysLogged++;
      }
    });
    
    if (daysLogged > 0) {
      h += '<div style="margin-top:12px;padding-top:12px;border-top:1px solid #374151;">';
      h += '<div style="color:#f9fafb;font-weight:600;margin-bottom:8px;">📊 Średnio (' + daysLogged + ' dni):</div>';
      h += '<div style="color:#9ca3af;font-size:0.85em;">';
      h += 'Kalorie: ' + Math.round(weekTotalCal / daysLogged) + ' kcal<br>';
      h += 'Białko: ' + Math.round(weekTotalP / daysLogged) + 'g<br>';
      h += 'Węgle: ' + Math.round(weekTotalC / daysLogged) + 'g<br>';
      h += 'Tłuszcz: ' + Math.round(weekTotalF / daysLogged) + 'g';
      h += '</div>';
      h += '</div>';
    }
    
    h += '</div>';
    return h;
  }

  // ============================================
  // AI placeholder + render
  // ============================================
  function renderAIPlaceholder() {
    return '<div id="nutr-ai-container"><p style="color:#9ca3af;text-align:center;padding:30px;">⏳ AI Coach analizuje dane...</p></div>';
  }


  async function renderAI() {
    var c = document.getElementById('nutr-ai-container');
    if (!c) return;
    
    c.innerHTML = '<div style="background:#1f2937;border-radius:10px;padding:14px;">' +
      '<h3 style="margin:0 0 8px;color:#f9fafb;">🤖 AI Nutrition Coach</h3>' +
      '<p style="color:#9ca3af;text-align:center;padding:30px;">⏳ AI analizuje Twoje dane...</p>' +
      '</div>';
    
    try {
      // Build rich payload
      var payload = buildNutritionPayload();
      
      var res = await fetch('https://hm-tracker-ai.dawid-pyzowski.workers.dev', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.assign({ mode: 'nutrition-coach' }, payload))
      });
      
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var data = await res.json();
      
      if (data.error) throw new Error(data.error);
      
      var analysis = (data.analysis || '')
        .replace(/\n\n/g, '<br><br>')
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      
      var html = '<div style="background:linear-gradient(135deg,#1e3a8a 0%,#1f2937 100%);border-radius:12px;padding:16px;border:2px solid #a855f7;">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid #374151;">';
      html += '<h3 style="margin:0;color:#f9fafb;font-size:1em;">🤖 AI Nutrition Coach</h3>';
      html += '<button onclick="NutritionTab.refreshAI()" style="background:#374151;border:none;color:#a855f7;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:0.8em;">🔄 Odśwież</button>';
      html += '</div>';
      html += '<div style="color:#e5e7eb;font-size:0.9em;line-height:1.55;">' + analysis + '</div>';
      html += '<div style="margin-top:8px;color:#6b7280;font-size:0.7em;text-align:right;">' + new Date(data.timestamp).toLocaleString() + ' | ' + (data.model || 'AI') + '</div>';
      html += '</div>';
      
      c.innerHTML = html;
      
    } catch(e) {
      c.innerHTML = '<div style="background:#1f2937;border-radius:10px;padding:14px;">' +
        '<h3 style="margin:0 0 8px;color:#f9fafb;">🤖 AI Nutrition Coach</h3>' +
        '<p style="color:#fca5a5;text-align:center;padding:20px;">❌ ' + e.message + '</p>' +
        '<button onclick="NutritionTab.refreshAI()" style="background:#374151;border:none;color:#a855f7;padding:8px 16px;border-radius:6px;cursor:pointer;width:100%;">🔄 Spróbuj ponownie</button>' +
        '</div>';
    }
  }

  function buildNutritionPayload() {
    var payload = {
      today: localToday(),
      profile: NutritionEngine.PROFILE,
      budget: NutritionEngine.calculateBudget(),
      today_data: NutritionEngine.compute(localToday())
    };
    
    // Analytics
    if (typeof NutritionAnalytics !== 'undefined') {
      payload.analytics = NutritionAnalytics.getSummary7d();
      payload.calorie_balance_30d = NutritionAnalytics.getCalorieBalance30d();
      payload.meal_timing = NutritionAnalytics.getMealTimingStats();
    }
    
    // Health context
    if (typeof HealthImport !== 'undefined') {
      var latest = HealthImport.getLatest();
      var baselines = HealthImport.getBaselines();
      payload.health = {
        latest: latest,
        baselines: baselines,
        history_7d: HealthImport.getHistory(7)
      };
    }
    
    // Body & weight trend
    if (typeof BodyTracker !== 'undefined') {
      payload.body = {
        progress: BodyTracker.getProgressVsGoal(),
        trend_7d: BodyTracker.getTrend(7)
      };
    }
    
    // Recent training context
    if (typeof DB !== 'undefined' && DB.getAll) {
      try {
        DB.getAll().then(function(acts) {
          // We can't async here in build, but we can pass it
        });
      } catch(e) {}
    }
    
    // Plan today (training)
    if (window.PLAN_FLAT) {
      payload.plan_today = window.PLAN_FLAT.find(function(p) { return p.date === localToday(); }) || null;
      
      // Plan jutro (dla pre-workout meal planning)
      var tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      var tomorrowStr = tomorrow.toISOString().slice(0, 10);
      payload.plan_tomorrow = window.PLAN_FLAT.find(function(p) { return p.date === tomorrowStr; }) || null;
    }
    
    return payload;
  }

  function refreshAI() {
    renderAI();
  }


  // ============================================
  // PLAN — static dietary info (z NUTR)
  // ============================================
  function renderPlan() {
    var h = '<div style="background:#1f2937;border-radius:10px;padding:14px;">';
    h += '<h3 style="margin:0 0 12px;color:#f9fafb;">📋 Plan dietetyczny</h3>';
    
    if (typeof NUTR !== 'undefined') {
      h += '<details><summary style="cursor:pointer;color:#f9fafb;font-weight:600;padding:8px 0;">🌅 Dzień treningowy</summary>';
      NUTR.training.forEach(function(m) {
        h += '<div style="background:#374151;padding:8px;border-radius:6px;margin:6px 0;">';
        h += '<div style="color:#f9fafb;font-weight:600;">' + m.time + ' ' + m.name + '</div>';
        h += '<div style="color:#9ca3af;font-size:0.8em;">' + m.desc + '</div>';
        h += '<div style="color:#6b7280;font-size:0.75em;margin-top:4px;">' + m.examples + '</div>';
        h += '</div>';
      });
      h += '</details>';
      
      h += '<details><summary style="cursor:pointer;color:#f9fafb;font-weight:600;padding:8px 0;">🛋️ Dzień wolny</summary>';
      NUTR.rest.forEach(function(m) {
        h += '<div style="background:#374151;padding:8px;border-radius:6px;margin:6px 0;">';
        h += '<div style="color:#f9fafb;font-weight:600;">' + m.time + ' ' + m.name + '</div>';
        h += '<div style="color:#9ca3af;font-size:0.8em;">' + m.desc + '</div>';
        h += '</div>';
      });
      h += '</details>';
      
      h += '<details><summary style="cursor:pointer;color:#f9fafb;font-weight:600;padding:8px 0;">🏁 Dzień wyścigu</summary>';
      NUTR.raceDay.forEach(function(x) {
        h += '<div style="background:#374151;padding:8px;border-radius:6px;margin:6px 0;">';
        h += '<div style="color:#f9fafb;font-weight:600;">' + x.time + ' ' + x.what + '</div>';
        h += '<div style="color:#9ca3af;font-size:0.8em;">' + x.details + '</div>';
        h += '</div>';
      });
      h += '</details>';
    }
    
    h += '</div>';
    return h;
  }

  // ============================================
  // MODALS — Scanner / Search / AI / Manual
  // ============================================
  function openScanner() {
    if (typeof NutritionScanner === 'undefined' || !NutritionScanner.isSupported()) {
      alert('Skaner niedostępny');
      return;
    }
    
    var modal = createModal('📷 Skanuj kod produktu');
    modal.body.innerHTML = '<video id="scan-video" style="width:100%;max-height:60vh;border-radius:8px;background:#000;"></video>' +
      '<p id="scan-status" style="color:#9ca3af;text-align:center;margin-top:10px;">Skieruj kamerę na kod kreskowy</p>';
    
    var video = document.getElementById('scan-video');
    var status = document.getElementById('scan-status');
    
    NutritionScanner.start(video, async function(barcode) {
      status.textContent = '✅ Znaleziono: ' + barcode + '\n⏳ Szukam produktu...';
      var product = await NutritionSearch.getByBarcode(barcode);
      closeModal(modal);
      
      if (product) {
        openAddMeal(product);
      } else {
        alert('Produkt nie znaleziony w bazie. Wpisz ręcznie.');
        openManual();
      }
    }, function(err) {
      status.textContent = '❌ Błąd: ' + err;
    });
    
    modal.onClose = function() { NutritionScanner.stop(); };
  }

  function openSearch() {
    var modal = createModal('🔍 Szukaj produkt');
    modal.body.innerHTML = '<input type="text" id="srch-input" placeholder="np. mleko, skyr, kurczak..." style="width:100%;padding:12px;border-radius:8px;border:1px solid #374151;background:#1f2937;color:white;font-size:1em;">' +
      '<div id="srch-results" style="margin-top:12px;max-height:60vh;overflow-y:auto;"></div>';
    
    var input = document.getElementById('srch-input');
    var results = document.getElementById('srch-results');
    var timer = null;
    
    input.focus();
    input.addEventListener('input', function() {
      clearTimeout(timer);
      var q = input.value.trim();
      if (q.length < 2) { results.innerHTML = ''; return; }
      results.innerHTML = '<p style="color:#9ca3af;text-align:center;padding:20px;">⏳ Szukam...</p>';
      timer = setTimeout(async function() {
        var products = await NutritionSearch.search(q, { limit: 20 });
        if (!products.length) {
          results.innerHTML = '<p style="color:#fbbf24;text-align:center;padding:20px;">Brak wyników. Spróbuj inaczej lub wpisz ręcznie.</p>';
          return;
        }
        var h = '';
        products.forEach(function(p) {
          h += '<div onclick="NutritionTab.selectProduct(' + JSON.stringify(p).replace(/"/g, '&quot;') + ')" style="background:#374151;padding:10px;border-radius:8px;margin-bottom:6px;cursor:pointer;">';
          h += '<div style="color:#f9fafb;font-weight:600;font-size:0.9em;">' + p.name + '</div>';
          if (p.brand) h += '<div style="color:#9ca3af;font-size:0.75em;">' + p.brand + '</div>';
          h += '<div style="color:#6b7280;font-size:0.75em;margin-top:4px;">' + Math.round(p.per_100g.calories) + ' kcal/100g · B:' + (p.per_100g.protein || 0) + 'g · W:' + (p.per_100g.carbs || 0) + 'g · T:' + (p.per_100g.fat || 0) + 'g</div>';
          h += '</div>';
        });
        results.innerHTML = h;
      }, 400);
    });
  }

  function selectProduct(product) {
    closeAllModals();
    openAddMeal(product);
  }

  function openAddMeal(product) {
    var modal = createModal('➕ ' + product.name);
    var defaultGrams = 100;
    modal.body.innerHTML = '<p style="color:#9ca3af;margin-bottom:8px;font-size:0.85em;">Ile gramów?</p>' +
      '<input type="number" id="meal-grams" value="' + defaultGrams + '" style="width:100%;padding:12px;border-radius:8px;border:1px solid #374151;background:#1f2937;color:white;font-size:1.2em;">' +
      '<div id="meal-preview" style="margin-top:12px;background:#374151;padding:10px;border-radius:8px;"></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px;">' +
      '<button onclick="NutritionTab.closeAllModals()" style="padding:12px;background:#6b7280;color:white;border:none;border-radius:8px;font-weight:600;">Anuluj</button>' +
      '<button id="meal-save" style="padding:12px;background:#22c55e;color:white;border:none;border-radius:8px;font-weight:600;">Zapisz</button>' +
      '</div>';
    
    function updatePreview() {
      var g = parseFloat(document.getElementById('meal-grams').value) || 100;
      var nutri = NutritionSearch.calculatePortion(product, g);
      document.getElementById('meal-preview').innerHTML = 
        '<div style="color:#f9fafb;font-size:1.1em;font-weight:bold;">' + nutri.calories + ' kcal</div>' +
        '<div style="color:#9ca3af;font-size:0.85em;">B: ' + nutri.protein + 'g · W: ' + nutri.carbs + 'g · T: ' + nutri.fat + 'g</div>';
    }
    
    document.getElementById('meal-grams').addEventListener('input', updatePreview);
    updatePreview();
    
    document.getElementById('meal-save').addEventListener('click', function() {
      var g = parseFloat(document.getElementById('meal-grams').value) || 100;
      var nutri = NutritionSearch.calculatePortion(product, g);
      NutritionEngine.addMeal(currentDate, {
        name: product.name,
        productId: product.barcode,
        quantity_g: g,
        calories: nutri.calories,
        protein: nutri.protein,
        carbs: nutri.carbs,
        fat: nutri.fat,
        source: product.source
      });
      NutritionEngine.addToFavorites(product);
      closeAllModals();
      render();
    });
  }

  function openManual() {
    var modal = createModal('➕ Wpisz posiłek');
    modal.body.innerHTML = 
      '<input type="text" id="m-name" placeholder="Nazwa (np. Jajecznica)" style="width:100%;padding:10px;border-radius:8px;border:1px solid #374151;background:#1f2937;color:white;margin-bottom:8px;">' +
      '<div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:6px;">' +
      '<input type="number" id="m-kcal" placeholder="kcal" style="padding:10px;border-radius:8px;border:1px solid #374151;background:#1f2937;color:white;">' +
      '<input type="number" id="m-p" placeholder="B (g)" style="padding:10px;border-radius:8px;border:1px solid #374151;background:#1f2937;color:white;">' +
      '<input type="number" id="m-c" placeholder="W (g)" style="padding:10px;border-radius:8px;border:1px solid #374151;background:#1f2937;color:white;">' +
      '<input type="number" id="m-f" placeholder="T (g)" style="padding:10px;border-radius:8px;border:1px solid #374151;background:#1f2937;color:white;">' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px;">' +
      '<button onclick="NutritionTab.closeAllModals()" style="padding:12px;background:#6b7280;color:white;border:none;border-radius:8px;">Anuluj</button>' +
      '<button id="m-save" style="padding:12px;background:#22c55e;color:white;border:none;border-radius:8px;font-weight:600;">Zapisz</button>' +
      '</div>';
    
    document.getElementById('m-name').focus();
    document.getElementById('m-save').addEventListener('click', function() {
      var name = document.getElementById('m-name').value.trim();
      if (!name) { alert('Wpisz nazwę'); return; }
      var kcal = parseFloat(document.getElementById('m-kcal').value) || 0;
      var p = parseFloat(document.getElementById('m-p').value) || 0;
      var c = parseFloat(document.getElementById('m-c').value) || 0;
      var f = parseFloat(document.getElementById('m-f').value) || 0;
      
      NutritionEngine.addMeal(currentDate, {
        name: name, calories: kcal, protein: p, carbs: c, fat: f,
        source: 'manual'
      });
      closeAllModals();
      render();
    });
  }

  function openAIEstimate() {
    var modal = createModal('✍️ AI Quick Estimate');
    modal.body.innerHTML = 
      '<p style="color:#9ca3af;font-size:0.85em;margin-bottom:8px;">Opisz posiłek po polsku:</p>' +
      '<textarea id="ai-desc" placeholder="np. 3 jajka + chleb pełnoziarnisty + masło + awokado" style="width:100%;padding:10px;border-radius:8px;border:1px solid #374151;background:#1f2937;color:white;min-height:80px;font-size:1em;"></textarea>' +
      '<button id="ai-go" style="width:100%;padding:12px;background:#a855f7;color:white;border:none;border-radius:8px;font-weight:600;margin-top:12px;">🤖 Oszacuj AI</button>' +
      '<div id="ai-result" style="margin-top:12px;"></div>';
    
    document.getElementById('ai-desc').focus();
    document.getElementById('ai-go').addEventListener('click', async function() {
      var desc = document.getElementById('ai-desc').value.trim();
      if (!desc) return;
      var resultEl = document.getElementById('ai-result');
      resultEl.innerHTML = '<p style="color:#9ca3af;text-align:center;padding:20px;">⏳ AI analizuje...</p>';
      
      try {
        var resp = await fetch('https://hm-tracker-ai.dawid-pyzowski.workers.dev', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'nutrition-estimate', description: desc })
        });
        var data = await resp.json();
        
        if (data.error) throw new Error(data.error);
        
        // Parsuj odpowiedź
        var match = data.analysis.match(/calories[:\s]*(\d+)[\s\S]*?protein[:\s]*(\d+\.?\d*)[\s\S]*?carbs[:\s]*(\d+\.?\d*)[\s\S]*?fat[:\s]*(\d+\.?\d*)/i);
        if (!match) {
          resultEl.innerHTML = '<div style="color:#f9fafb;background:#374151;padding:10px;border-radius:8px;white-space:pre-wrap;">' + data.analysis + '</div>';
          return;
        }
        
        var kcal = parseInt(match[1]);
        var p = parseFloat(match[2]);
        var c = parseFloat(match[3]);
        var f = parseFloat(match[4]);
        
        resultEl.innerHTML = '<div style="background:#374151;padding:12px;border-radius:8px;">' +
          '<div style="color:#f9fafb;font-size:1.3em;font-weight:bold;">' + kcal + ' kcal</div>' +
          '<div style="color:#9ca3af;margin-bottom:10px;">B: ' + p + 'g · W: ' + c + 'g · T: ' + f + 'g</div>' +
          '<button onclick="NutritionTab.saveAIMeal(\'' + desc.replace(/'/g, "\\'") + '\',' + kcal + ',' + p + ',' + c + ',' + f + ')" style="width:100%;padding:10px;background:#22c55e;color:white;border:none;border-radius:6px;font-weight:600;">✅ Zapisz</button>' +
          '</div>';
      } catch(e) {
        resultEl.innerHTML = '<p style="color:#fca5a5;text-align:center;padding:10px;">❌ ' + e.message + '</p>';
      }
    });
  }

  function saveAIMeal(desc, kcal, p, c, f) {
    NutritionEngine.addMeal(currentDate, {
      name: desc, calories: kcal, protein: p, carbs: c, fat: f, source: 'ai_estimate'
    });
    closeAllModals();
    render();
  }

  function deleteMeal(date, id) {
    if (!confirm('Usunąć posiłek?')) return;
    NutritionEngine.deleteMeal(date, id);
    render();
  }

  // ============================================
  // MODAL helpers
  // ============================================
  function createModal(title) {
    var overlay = document.createElement('div');
    overlay.className = 'nutr-modal-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
    
    var modal = document.createElement('div');
    modal.style.cssText = 'background:#111827;border-radius:12px;max-width:500px;width:100%;max-height:90vh;overflow-y:auto;border:1px solid #374151;';
    
    var header = '<div style="display:flex;justify-content:space-between;align-items:center;padding:14px;border-bottom:1px solid #374151;">';
    header += '<h3 style="margin:0;color:#f9fafb;font-size:1em;">' + title + '</h3>';
    header += '<button onclick="NutritionTab.closeAllModals()" style="background:#374151;border:none;color:white;width:32px;height:32px;border-radius:50%;font-size:1em;cursor:pointer;">✕</button>';
    header += '</div>';
    
    modal.innerHTML = header;
    var body = document.createElement('div');
    body.style.cssText = 'padding:14px;';
    modal.appendChild(body);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    var result = { overlay: overlay, body: body };
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) closeModal(result);
    });
    return result;
  }

  function closeModal(modal) {
    if (modal.onClose) modal.onClose();
    if (modal.overlay && modal.overlay.parentNode) {
      modal.overlay.parentNode.removeChild(modal.overlay);
    }
  }

  function closeAllModals() {
    document.querySelectorAll('.nutr-modal-overlay').forEach(function(el) {
      if (el.parentNode) el.parentNode.removeChild(el);
    });
    if (typeof NutritionScanner !== 'undefined') NutritionScanner.stop();
  }


  // ============================================
  // DATE NAVIGATION
  // ============================================
  function navDate(deltaDays) {
    var d = new Date(currentDate);
    d.setDate(d.getDate() + deltaDays);
    currentDate = d.toISOString().slice(0, 10);
    render();
  }

  function jumpToDate(dateStr) {
    if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      currentDate = dateStr;
      render();
    }
  }

  // ============================================
  // ANALYTICS sub-tab
  // ============================================
  function renderAnalyticsPlaceholder() {
    return '<div id="nutr-analytics-container"><p style="color:#9ca3af;text-align:center;padding:30px;">⏳ Ładowanie analytics...</p></div>';
  }

  function renderAnalytics() {
    var container = document.getElementById('nutr-analytics-container');
    if (!container || typeof NutritionAnalytics === 'undefined') return;
    
    var summary = NutritionAnalytics.getSummary7d();
    var balance30 = NutritionAnalytics.getCalorieBalance30d();
    var correlations = NutritionAnalytics.computeCorrelations();
    var streak = NutritionAnalytics.getProteinStreak();
    var timing = NutritionAnalytics.getMealTimingStats();
    
    var h = '';
    
    // Days logged status
    var daysLogged = balance30.length;
    h += '<div style="background:' + (daysLogged < 7 ? '#451a03' : '#052e16') + ';border:1px solid ' + (daysLogged < 7 ? '#f59e0b' : '#22c55e') + ';color:' + (daysLogged < 7 ? '#fde68a' : '#86efac') + ';padding:10px 14px;border-radius:8px;margin-bottom:12px;text-align:center;font-size:0.85em;">';
    if (daysLogged < 7) {
      h += '⏳ Zbieram dane: <b>' + daysLogged + '/7 dni</b>. Wykresy będą pełniejsze gdy zalogujesz więcej.';
    } else {
      h += '✅ Dane gotowe! ' + daysLogged + ' dni zalogowane. Analytics w pełni operacyjna.';
    }
    h += '</div>';
    
    // CALORIE BALANCE
    h += '<div style="background:#1f2937;border-radius:10px;padding:14px;margin-bottom:12px;">';
    h += '<h3 style="margin:0 0 8px;color:#f9fafb;font-size:1em;">📊 Bilans kaloryczny (' + daysLogged + ' dni)</h3>';
    if (daysLogged >= 1) {
      h += '<div style="position:relative;height:240px;"><canvas id="na-balance"></canvas></div>';
    } else {
      h += '<p style="color:#9ca3af;text-align:center;padding:30px;">Brak danych — dodaj pierwszy posiłek</p>';
    }
    h += '</div>';
    
    // PROTEIN STREAK
    h += '<div style="background:#1f2937;border-radius:10px;padding:14px;margin-bottom:12px;">';
    h += '<h3 style="margin:0 0 8px;color:#f9fafb;font-size:1em;">🥩 Protein Streak</h3>';
    if (streak.total >= 1) {
      h += '<div style="text-align:center;margin-bottom:10px;">';
      h += '<div style="color:#22c55e;font-size:2em;font-weight:bold;">' + streak.streak + '</div>';
      h += '<div style="color:#9ca3af;font-size:0.85em;">dni z rzędu ≥' + Math.round(NutritionEngine.PROFILE.protein_per_kg * 75) + 'g białka</div>';
      h += '</div>';
      h += '<div style="color:#9ca3af;font-size:0.85em;text-align:center;">Łącznie hit: ' + streak.hits + '/' + streak.total + ' dni</div>';
      
      // Calendar visual
      h += '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:12px;justify-content:center;">';
      streak.days.slice(-30).forEach(function(d) {
        var color = d.hit ? '#22c55e' : '#ef4444';
        var dd = d.date.slice(8);
        h += '<div style="width:32px;height:32px;background:' + color + ';border-radius:6px;display:flex;align-items:center;justify-content:center;color:white;font-size:0.7em;font-weight:600;" title="' + d.date + ': ' + d.protein + 'g">' + dd + '</div>';
      });
      h += '</div>';
    } else {
      h += '<p style="color:#9ca3af;text-align:center;padding:20px;">Loguj posiłki, żeby zacząć streak</p>';
    }
    h += '</div>';
    
    // MEAL TIMING
    if (timing && Object.values(timing.calories).some(function(v) { return v > 0; })) {
      h += '<div style="background:#1f2937;border-radius:10px;padding:14px;margin-bottom:12px;">';
      h += '<h3 style="margin:0 0 12px;color:#f9fafb;font-size:1em;">🍽️ Meal Timing</h3>';
      var slots = ['5-9', '9-12', '12-15', '15-18', '18-21', '21-24'];
      var labels = ['Rano', 'Przedpoł.', 'Lunch', 'Popoł.', 'Wieczór', 'Późno'];
      var maxKcal = Math.max.apply(null, slots.map(function(s) { return timing.calories[s]; }));
      
      slots.forEach(function(s, i) {
        var kcal = Math.round(timing.calories[s]);
        var pct = maxKcal > 0 ? (kcal / maxKcal * 100) : 0;
        var color = i === 4 || i === 5 ? '#f59e0b' : '#3b82f6';
        
        h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">';
        h += '<div style="width:80px;color:#9ca3af;font-size:0.8em;">' + labels[i] + ' (' + s + ')</div>';
        h += '<div style="flex:1;background:#374151;border-radius:4px;height:20px;overflow:hidden;">';
        h += '<div style="background:' + color + ';height:100%;width:' + pct + '%;display:flex;align-items:center;justify-content:flex-end;padding-right:6px;color:white;font-size:0.7em;font-weight:600;">';
        if (kcal > 100) h += kcal + ' kcal';
        h += '</div>';
        h += '</div>';
        h += '</div>';
      });
      h += '<p style="color:#9ca3af;font-size:0.75em;margin-top:8px;">⚠️ Posiłki po 21:00 mogą gorzej wpływać na sen</p>';
      h += '</div>';
    }
    
    // CORRELATIONS
    if (correlations) {
      var anyCorr = Object.values(correlations).some(function(c) { return c.r !== null; });
      h += '<div style="background:#1f2937;border-radius:10px;padding:14px;margin-bottom:12px;">';
      h += '<h3 style="margin:0 0 4px;color:#f9fafb;font-size:1em;">🔗 Korelacje (Pearson)</h3>';
      h += '<p style="color:#9ca3af;margin:0 0 12px;font-size:0.75em;">r od -1 do +1. Bliżej ±1 = silniejsza zależność</p>';
      
      if (!anyCorr) {
        h += '<p style="color:#fbbf24;text-align:center;padding:20px;font-size:0.85em;">⏳ Za mało danych. Korelacje pojawią się po 3+ dniach.</p>';
      } else {
        h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">';
        Object.keys(correlations).forEach(function(key) {
          var c = correlations[key];
          var rStr = c.r !== null ? c.r.toFixed(2) : 'n/a';
          var color = c.r === null ? '#6b7280' :
                      Math.abs(c.r) >= 0.5 ? (c.r > 0 ? '#22c55e' : '#ef4444') :
                      Math.abs(c.r) >= 0.3 ? '#f59e0b' : '#9ca3af';
          
          h += '<div style="background:#374151;padding:10px;border-radius:8px;border-left:3px solid ' + color + ';">';
          h += '<div style="color:#9ca3af;font-size:0.7em;">' + c.title + '</div>';
          h += '<div style="color:' + color + ';font-size:1.2em;font-weight:bold;">r = ' + rStr + '</div>';
          h += '<div style="color:#6b7280;font-size:0.7em;">n=' + c.n + ' par</div>';
          h += '</div>';
        });
        h += '</div>';
      }
      h += '</div>';
    }
    
    container.innerHTML = h;
    
    // Render canvas chart
    if (daysLogged >= 1 && typeof Chart !== 'undefined') {
      setTimeout(function() {
        drawBalanceChart(balance30);
      }, 50);
    }
  }

  function drawBalanceChart(data) {
    var canvas = document.getElementById('na-balance');
    if (!canvas) return;
    
    var labels = data.map(function(d) { return d.date.slice(5); });
    var tdee = data.map(function(d) { return d.tdee; });
    var intake = data.map(function(d) { return d.intake; });
    var target = data.map(function(d) { return d.target_calories; });
    
    new Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Spalono (TDEE)',
            data: tdee,
            backgroundColor: 'rgba(239, 68, 68, 0.7)',
            borderColor: '#ef4444',
            borderWidth: 1
          },
          {
            label: 'Spożyto',
            data: intake,
            backgroundColor: 'rgba(34, 197, 94, 0.7)',
            borderColor: '#22c55e',
            borderWidth: 1
          },
          {
            label: 'Cel intake',
            data: target,
            type: 'line',
            borderColor: '#f59e0b',
            borderWidth: 2,
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#d1d5db', font: { size: 11 } } }
        },
        scales: {
          x: { ticks: { color: '#9ca3af', font: { size: 10 } }, grid: { color: '#374151' } },
          y: { ticks: { color: '#9ca3af', font: { size: 10 } }, grid: { color: '#374151' }, title: { display: true, text: 'kcal', color: '#9ca3af' } }
        }
      }
    });
  }

  
  window.NutritionTab = {
    render: render,
    setTab: setTab,
    openScanner: openScanner,
    openSearch: openSearch,
    openManual: openManual,
    openAIEstimate: openAIEstimate,
    selectProduct: selectProduct,
    saveAIMeal: saveAIMeal,
    deleteMeal: deleteMeal,
    closeAllModals: closeAllModals,
    refreshAI: refreshAI,
    
  navDate: navDate,
  jumpToDate: jumpToDate

  };

  return window.NutritionTab;
})();

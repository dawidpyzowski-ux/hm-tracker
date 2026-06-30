
/* caffeine-tab.js v1 — Sprint 28: UI for caffeine tracking */
var CaffeineTab = (function() {
  "use strict";
  var currentDate = null;
  
  function localToday() {
    var d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString().slice(0, 10);
  }
  
  function render(containerId) {
    var el = document.getElementById(containerId);
    if (!el) return;
    if (!currentDate) currentDate = localToday();
    
    if (typeof CaffeineTracker === 'undefined') {
      el.innerHTML = '<p style="color:#fca5a5;text-align:center;padding:30px;">CaffeineTracker not loaded</p>';
      return;
    }
    
    var data = CaffeineTracker.compute(currentDate);
    var h = '';
    
    // === Status card ===
    var pct = Math.round(data.totals.total_mg / data.settings.daily_target_mg * 100);
    var color = pct >= 100 ? '#ef4444' : pct >= 80 ? '#f59e0b' : '#22c55e';
    
    h += '<div style="background:#1f2937;border-radius:10px;padding:14px;margin-bottom:12px;">';
    h += '<h3 style="margin:0 0 12px;color:#f9fafb;font-size:1em;">☕ Kofeina dziś</h3>';
    
    h += '<div style="text-align:center;margin-bottom:12px;">';
    h += '<div style="color:' + color + ';font-size:2.5em;font-weight:bold;line-height:1;">' + Math.round(data.totals.total_mg) + '</div>';
    h += '<div style="color:#9ca3af;font-size:0.9em;">mg / ' + data.settings.daily_target_mg + ' mg cel (' + pct + '%)</div>';
    h += '</div>';
    
    h += '<div style="background:#374151;border-radius:8px;height:8px;overflow:hidden;margin-bottom:14px;">';
    h += '<div style="background:' + color + ';height:100%;width:' + Math.min(100, pct) + '%;"></div>';
    h += '</div>';
    
    // In body now + projection
    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">';
    h += '<div style="background:#374151;padding:10px;border-radius:8px;text-align:center;">';
    h += '<div style="color:#9ca3af;font-size:0.75em;">Teraz w organizmie</div>';
    h += '<div style="color:#f9fafb;font-size:1.3em;font-weight:bold;">' + data.in_body_now + ' mg</div>';
    h += '</div>';
    
    var bedColor = data.bedtime_projection_mg >= 100 ? '#ef4444' : 
                   data.bedtime_projection_mg >= 50 ? '#f59e0b' : '#22c55e';
    h += '<div style="background:#374151;padding:10px;border-radius:8px;text-align:center;">';
    h += '<div style="color:#9ca3af;font-size:0.75em;">O 22:00 (bedtime)</div>';
    h += '<div style="color:' + bedColor + ';font-size:1.3em;font-weight:bold;">' + data.bedtime_projection_mg + ' mg</div>';
    h += '</div>';
    h += '</div>';
    
    // Cutoff recommendation
    if (data.cutoff_recommendation) {
      var r = data.cutoff_recommendation;
      h += '<div style="margin-top:12px;padding:10px;background:#0f172a;border-left:3px solid #3b82f6;border-radius:6px;">';
      h += '<div style="color:#60a5fa;font-size:0.85em;font-weight:600;">⏰ Cutoff: ' + r.cutoff_hour + ':00 (confidence: ' + r.confidence + ')</div>';
      h += '<div style="color:#9ca3af;font-size:0.75em;margin-top:4px;">' + r.reason + '</div>';
      h += '</div>';
    }
    
    h += '</div>';
    
    // === Quick add buttons ===
    h += '<div style="background:#1f2937;border-radius:10px;padding:14px;margin-bottom:12px;">';
    h += '<h3 style="margin:0 0 12px;color:#f9fafb;font-size:1em;">➕ Dodaj kawę</h3>';
    
    var groups = {
      work: { label: '🏢 W pracy', items: [] },
      home: { label: '🏠 W domu', items: [] },
      cafe: { label: '☕ Kawiarnia', items: [] },
      other: { label: '⚡ Inne', items: [] }
    };
    
    CaffeineTracker.PRESETS.forEach(function(p) {
      if (groups[p.group]) groups[p.group].items.push(p);
    });
    
    Object.keys(groups).forEach(function(gkey) {
      var g = groups[gkey];
      if (!g.items.length) return;
      
      h += '<div style="margin-bottom:12px;">';
      h += '<div style="color:#9ca3af;font-size:0.8em;font-weight:600;margin-bottom:6px;">' + g.label + '</div>';
      h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">';
      g.items.forEach(function(p) {
        h += '<button onclick="CaffeineTab.quickAdd(\'' + p.id + '\')" style="background:#374151;color:white;border:none;border-radius:6px;padding:10px 8px;font-size:0.8em;font-weight:500;cursor:pointer;text-align:left;display:flex;justify-content:space-between;align-items:center;">';
        h += '<span>' + p.emoji + ' ' + p.name + '</span>';
        h += '<span style="color:#a855f7;font-weight:600;">' + p.mg + 'mg</span>';
        h += '</button>';
      });
      h += '</div>';
      h += '</div>';
    });
    
    // Custom calculator
    h += '<button onclick="CaffeineTab.openCustom()" style="width:100%;padding:10px;background:#6b7280;color:white;border:none;border-radius:8px;font-weight:600;margin-top:6px;">🧪 Custom calculator</button>';
    
    h += '</div>';
    
    // === Today's entries ===
    h += '<div style="background:#1f2937;border-radius:10px;padding:14px;margin-bottom:12px;">';
    h += '<h3 style="margin:0 0 12px;color:#f9fafb;font-size:1em;">📋 Dzisiejsze wpisy</h3>';
    
    if (data.log.entries.length === 0) {
      h += '<p style="color:#6b7280;text-align:center;padding:20px;font-size:0.85em;">Brak wpisów. Tap przycisk wyżej żeby dodać.</p>';
    } else {
      data.log.entries.forEach(function(e) {
        h += '<div style="background:#374151;padding:10px;border-radius:8px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;">';
        h += '<div>';
        h += '<div style="color:#f9fafb;font-size:0.9em;font-weight:600;">' + (e.emoji || '☕') + ' ' + e.name + '</div>';
        h += '<div style="color:#9ca3af;font-size:0.75em;">' + e.time + ' · ' + e.mg + ' mg' + (e.notes ? ' · ' + e.notes : '') + '</div>';
        h += '</div>';
        h += '<button onclick="CaffeineTab.deleteEntry(\'' + currentDate + '\',' + e.id + ')" style="background:transparent;border:none;color:#ef4444;font-size:1.2em;cursor:pointer;padding:4px 8px;">🗑️</button>';
        h += '</div>';
      });
    }
    
    h += '</div>';
    
    // === Correlations ===
    if (data.correlations && data.correlations.sample_size >= 5) {
      h += '<div style="background:#1f2937;border-radius:10px;padding:14px;margin-bottom:12px;">';
      h += '<h3 style="margin:0 0 4px;color:#f9fafb;font-size:1em;">🔗 Korelacje (' + data.correlations.sample_size + ' dni)</h3>';
      h += '<p style="color:#9ca3af;margin:0 0 12px;font-size:0.75em;">Kofeina vs sen vs HRV</p>';
      
      h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">';
      ['caffeine_deep', 'caffeine_hrv', 'cutoff_deep', 'cutoff_hrv'].forEach(function(key) {
        var c = data.correlations[key];
        if (!c) return;
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
      h += '</div>';
    } else {
      h += '<div style="background:#1f2937;border-radius:10px;padding:14px;text-align:center;">';
      h += '<p style="color:#9ca3af;font-size:0.85em;margin:0;">⏳ Korelacje pojawią się po 5+ dniach logowania</p>';
      h += '</div>';
    }
    
    el.innerHTML = h;
  }
  
  function quickAdd(presetId) {
    var preset = CaffeineTracker.PRESETS.find(function(p) { return p.id === presetId; });
    if (!preset) return;
    
    CaffeineTracker.addEntry(currentDate || localToday(), {
      name: preset.name,
      emoji: preset.emoji,
      mg: preset.mg,
      method: preset.method || null,
      dose_g: preset.dose_g || null,
      notes: preset.notes || null
    });
    
    // Re-render
    var container = document.getElementById('caffeine-content');
    if (container) render('caffeine-content');
  }
  
  function deleteEntry(date, id) {
    if (!confirm('Usunąć wpis?')) return;
    CaffeineTracker.deleteEntry(date, id);
    var container = document.getElementById('caffeine-content');
    if (container) render('caffeine-content');
  }
  
  function openCustom() {
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
    
    overlay.innerHTML = 
      '<div style="background:#111827;border-radius:12px;max-width:500px;width:100%;padding:16px;border:1px solid #374151;">' +
        '<h3 style="margin:0 0 16px;color:#f9fafb;">🧪 Custom Calculator</h3>' +
        
        '<label style="color:#9ca3af;font-size:0.85em;display:block;margin-bottom:4px;">Nazwa:</label>' +
        '<input type="text" id="cc-name" placeholder="np. Drip Ethiopia 22g" style="width:100%;padding:10px;border-radius:8px;border:1px solid #374151;background:#1f2937;color:white;margin-bottom:12px;">' +
        
        '<label style="color:#9ca3af;font-size:0.85em;display:block;margin-bottom:4px;">Metoda:</label>' +
        '<select id="cc-method" style="width:100%;padding:10px;border-radius:8px;border:1px solid #374151;background:#1f2937;color:white;margin-bottom:12px;">' +
          '<option value="espresso">Espresso (ekspres)</option>' +
          '<option value="nespresso">Nespresso (kapsułka)</option>' +
          '<option value="drip_v60" selected>V60 / drip</option>' +
          '<option value="aeropress">AeroPress</option>' +
          '<option value="french_press">French Press</option>' +
          '<option value="chemex">Chemex</option>' +
          '<option value="moka">Moka pot</option>' +
          '<option value="cold_brew">Cold brew</option>' +
        '</select>' +
        
        '<label style="color:#9ca3af;font-size:0.85em;display:block;margin-bottom:4px;">Gramatura (g):</label>' +
        '<input type="number" id="cc-dose" value="18" step="0.5" style="width:100%;padding:10px;border-radius:8px;border:1px solid #374151;background:#1f2937;color:white;margin-bottom:12px;">' +
        
        '<label style="color:#9ca3af;font-size:0.85em;display:block;margin-bottom:4px;">Ziarna:</label>' +
        '<select id="cc-beans" style="width:100%;padding:10px;border-radius:8px;border:1px solid #374151;background:#1f2937;color:white;margin-bottom:12px;">' +
          '<option value="arabica" selected>Arabica (specialty)</option>' +
          '<option value="robusta">Robusta (mocniejsza)</option>' +
        '</select>' +
        
        '<label style="color:#9ca3af;font-size:0.85em;display:block;margin-bottom:4px;">Roast:</label>' +
        '<select id="cc-roast" style="width:100%;padding:10px;border-radius:8px;border:1px solid #374151;background:#1f2937;color:white;margin-bottom:12px;">' +
          '<option value="light">Light (jasny)</option>' +
          '<option value="medium" selected>Medium (średni)</option>' +
          '<option value="dark">Dark (ciemny)</option>' +
        '</select>' +
        
        '<div id="cc-result" style="background:#374151;padding:12px;border-radius:8px;margin-bottom:12px;text-align:center;">' +
          '<div style="color:#a855f7;font-size:1.5em;font-weight:bold;" id="cc-mg">~115 mg</div>' +
          '<div style="color:#9ca3af;font-size:0.8em;">Estymacja kofeiny</div>' +
        '</div>' +
        
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">' +
          '<button onclick="this.closest(\'div[style*=\\\'fixed\\\']\').remove()" style="padding:10px;background:#6b7280;color:white;border:none;border-radius:8px;font-weight:600;">Anuluj</button>' +
          '<button id="cc-save" style="padding:10px;background:#22c55e;color:white;border:none;border-radius:8px;font-weight:600;">Zapisz</button>' +
        '</div>' +
      '</div>';
    
    document.body.appendChild(overlay);
    
    function updateMg() {
      var method = document.getElementById('cc-method').value;
      var dose = parseFloat(document.getElementById('cc-dose').value) || 18;
      var beans = document.getElementById('cc-beans').value;
      var roast = document.getElementById('cc-roast').value;
      var mg = CaffeineTracker.calculate(method, dose, beans, roast);
      document.getElementById('cc-mg').textContent = '~' + mg + ' mg';
      return mg;
    }
    
    ['cc-method', 'cc-dose', 'cc-beans', 'cc-roast'].forEach(function(id) {
      document.getElementById(id).addEventListener('change', updateMg);
      document.getElementById(id).addEventListener('input', updateMg);
    });
    
    updateMg();
    
    document.getElementById('cc-save').onclick = function() {
      var name = document.getElementById('cc-name').value.trim();
      if (!name) { alert('Wpisz nazwę'); return; }
      var method = document.getElementById('cc-method').value;
      var dose = parseFloat(document.getElementById('cc-dose').value) || 18;
      var beans = document.getElementById('cc-beans').value;
      var roast = document.getElementById('cc-roast').value;
      var mg = updateMg();
      
      CaffeineTracker.addEntry(currentDate || localToday(), {
        name: name,
        emoji: '☕',
        mg: mg,
        method: method,
        dose_g: dose,
        beans: beans,
        roast: roast
      });
      
      overlay.remove();
      var container = document.getElementById('caffeine-content');
      if (container) render('caffeine-content');
    };
  }
  
  function setDate(date) {
    currentDate = date;
  }
  
  window.CaffeineTab = {
    render: render,
    quickAdd: quickAdd,
    deleteEntry: deleteEntry,
    openCustom: openCustom,
    setDate: setDate
  };
  
  return window.CaffeineTab;
})();

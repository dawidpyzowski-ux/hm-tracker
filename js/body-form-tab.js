
/* body-form-tab.js v1 — Sprint 23: Tab UI + nawigacja */
(function() {
  "use strict";

  function render() {
    var el = document.getElementById('s-bodyform') || document.getElementById('view-bodyform');
    if (!el) return;

    var html = '';
    html += '<div style="max-width:900px;margin:0 auto;padding:12px;">';
    html += '<h2 style="color:#f9fafb;margin:0 0 4px;">📊 Body & Form</h2>';
    html += '<p style="color:#9ca3af;margin:0 0 20px;font-size:0.9em;">Trendy wagi, biomechaniki i korelacje</p>';

    // Sekcja: Body Composition (Weight + BF)
    html += '<div style="background:#1f2937;border-radius:10px;padding:14px;margin-bottom:16px;">';
    html += '<h3 style="margin:0 0 10px;color:#f9fafb;">⚖️ Body Composition</h3>';
    html += '<div style="position:relative;height:280px;"><canvas id="bf-weight-bf"></canvas></div>';
    html += '</div>';

    // Sekcja: CP Trend
    html += '<div style="background:#1f2937;border-radius:10px;padding:14px;margin-bottom:16px;">';
    html += '<h3 style="margin:0 0 10px;color:#f9fafb;">⚡ Critical Power (CP) — 12 tygodni</h3>';
    html += '<div style="position:relative;height:280px;"><canvas id="bf-cp-trend"></canvas></div>';
    html += '</div>';

    // Sekcja: Health Metrics
    html += '<h3 style="color:#f9fafb;margin:20px 0 10px;">🩺 Health (Apple Watch)</h3>';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">';
    
    html += '<div style="background:#1f2937;border-radius:10px;padding:14px;">';
    html += '<h4 style="margin:0 0 8px;color:#f9fafb;font-size:0.95em;">🌡️ Wrist Temperature</h4>';
    html += '<div style="position:relative;height:200px;"><canvas id="bf-wrist-temp"></canvas></div>';
    html += '</div>';

    html += '<div style="background:#1f2937;border-radius:10px;padding:14px;">';
    html += '<h4 style="margin:0 0 8px;color:#f9fafb;font-size:0.95em;">🫁 Respiratory Rate</h4>';
    html += '<div style="position:relative;height:200px;"><canvas id="bf-resp-rate"></canvas></div>';
    html += '</div>';

    html += '</div>';

    // Sekcja: Running Biomechanics
    html += '<h3 style="color:#f9fafb;margin:20px 0 10px;">🏃 Running Biomechanics</h3>';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">';

    html += '<div style="background:#1f2937;border-radius:10px;padding:14px;">';
    html += '<h4 style="margin:0 0 8px;color:#f9fafb;font-size:0.95em;">⚡ Running Power</h4>';
    html += '<div style="position:relative;height:200px;"><canvas id="bf-running-power"></canvas></div>';
    html += '</div>';

    html += '<div style="background:#1f2937;border-radius:10px;padding:14px;">';
    html += '<h4 style="margin:0 0 8px;color:#f9fafb;font-size:0.95em;">👣 Ground Contact Time</h4>';
    html += '<div style="position:relative;height:200px;"><canvas id="bf-gct"></canvas></div>';
    html += '</div>';

    html += '<div style="background:#1f2937;border-radius:10px;padding:14px;">';
    html += '<h4 style="margin:0 0 8px;color:#f9fafb;font-size:0.95em;">📏 Stride Length</h4>';
    html += '<div style="position:relative;height:200px;"><canvas id="bf-stride"></canvas></div>';
    html += '</div>';

    html += '<div style="background:#1f2937;border-radius:10px;padding:14px;">';
    html += '<h4 style="margin:0 0 8px;color:#f9fafb;font-size:0.95em;">⬆️⬇️ Vertical Oscillation</h4>';
    html += '<div style="position:relative;height:200px;"><canvas id="bf-vo"></canvas></div>';
    html += '</div>';

    html += '</div>';

    // Sekcja: Korelacje
    html += '<div style="background:#1f2937;border-radius:10px;padding:14px;margin-bottom:16px;">';
    html += '<h3 style="margin:0 0 4px;color:#f9fafb;">🔗 Korelacje (Pearson)</h3>';
    html += '<p style="color:#9ca3af;margin:0 0 12px;font-size:0.8em;">Współczynnik r od -1 do +1. Im bliżej ±1, tym silniejsza zależność.</p>';
    html += '<div id="bf-correlations"></div>';
    html += '</div>';

    html += '</div>';

    el.innerHTML = html;

    // Render wszystkich wykresów
    setTimeout(function() {
      if (typeof BodyFormCharts !== "undefined") {
        BodyFormCharts.renderAll().catch(function(e) {
          console.warn('[BodyFormTab] Render error:', e);
        });
      }
    }, 100);
  }

  // Export
  window.BodyFormTab = { render: render };
})();

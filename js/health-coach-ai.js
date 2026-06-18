/* health-coach-ai.js — Sprint 15: AI Performance Coach */
var HealthCoachAI = (function() {
  "use strict";

  function paceToSec(p) {
    if (!p) return 0;
    var parts = p.split(":");
    return parseInt(parts[0])*60 + parseInt(parts[1]);
  }

  function secToPace(s) {
    var m = Math.floor(s/60);
    var sec = Math.round(s%60);
    return m + ":" + (sec < 10 ? "0" : "") + sec;
  }

  function getBasePace() {
    if (typeof S === "undefined" || !S.getAllLogs) return null;
    var logs = S.getAllLogs().slice(-5);

    var paces = logs
      .map(l => paceToSec(l.pace))
      .filter(p => p > 0);

    if (!paces.length) return null;

    var avg = Math.round(paces.reduce((a,b)=>a+b,0)/paces.length);
    return avg;
  }

  function getTodayImpact() {
    var h = HealthImport.getToday();
    if (!h) return { penalty: 0, reasons: [] };

    var base = HealthImport.getBaselines();
    var penalty = 0;
    var reasons = [];

    // HRV impact
    if (h.hrv && base.hrv) {
      var ratio = h.hrv / base.hrv;
      if (ratio < 0.8) { penalty += 12; reasons.push("HRV ↓"); }
      else if (ratio < 0.95) { penalty += 6; reasons.push("HRV lekko ↓"); }
      else if (ratio > 1.1) { penalty -= 5; reasons.push("HRV ↑"); }
    }

    // RHR impact
    if (h.rhr && base.rhr) {
      var diff = h.rhr - base.rhr;
      if (diff >= 5) { penalty += 10; reasons.push("RHR ↑"); }
      else if (diff >= 3) { penalty += 5; reasons.push("RHR lekko ↑"); }
      else if (diff < 0) { penalty -= 4; reasons.push("RHR ↓"); }
    }

    // Sleep
    if (h.sleepMin) {
      if (h.sleepMin < 360) { penalty += 12; reasons.push("sen <6h"); }
      else if (h.sleepMin < 420) { penalty += 5; reasons.push("sen ~6-7h"); }
      else if (h.sleepMin > 450) { penalty -= 4; reasons.push("dobry sen"); }
    }

    return { penalty, reasons };
  }

  function predict() {
    var base = getBasePace();
    if (!base) return null;

    var impact = getTodayImpact();
    var predicted = base + impact.penalty;

    return {
      base: secToPace(base),
      predicted: secToPace(predicted),
      delta: impact.penalty,
      reasons: impact.reasons
    };
  }

  function render(containerId) {
    var el = document.getElementById(containerId);
    if (!el) return;

    var pred = predict();
    if (!pred) {
      el.innerHTML = "<p style='color:#9ca3af'>Brak danych treningowych</p>";
      return;
    }

    var color = pred.delta <= 0 ? "#22c55e" : pred.delta < 10 ? "#f59e0b" : "#ef4444";

    el.innerHTML = `
      <div style="background:#111827;border-radius:10px;padding:12px;">
        <h4 style="margin:0 0 8px;color:#f9fafb;">🤖 AI Coach</h4>

        <div style="display:flex;justify-content:space-around;margin-bottom:8px;">
          <div style="text-align:center;">
            <div style="color:#9ca3af;font-size:0.7em;">Base</div>
            <div style="color:#d1d5db;font-size:1.2em;">${pred.base}</div>
          </div>
          <div style="text-align:center;">
            <div style="color:#9ca3af;font-size:0.7em;">Today</div>
            <div style="color:${color};font-size:1.4em;font-weight:700;">
              ${pred.predicted}
            </div>
          </div>
        </div>

        <div style="color:#9ca3af;font-size:0.75em;text-align:center;">
          Δ ${pred.delta > 0 ? "+" : ""}${pred.delta}s/km (${pred.reasons.join(", ")})
        </div>
      </div>
    `;
  }

  return { predict, render };
})();

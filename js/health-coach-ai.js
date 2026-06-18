
/* health-coach-ai.js v2 — Sprint 15: AI Performance Coach */
var HealthCoachAI = (function() {
  "use strict";

  function paceToSec(p) {
    if (!p) return 0;
    var parts = String(p).split(":");
    if (parts.length !== 2) return 0;
    return parseInt(parts[0])*60 + parseInt(parts[1]);
  }

  function secToPace(s) {
    var m = Math.floor(s/60);
    var sec = Math.round(s%60);
    return m + ":" + (sec < 10 ? "0" : "") + sec;
  }

  function getBasePace() {
    if (typeof S === "undefined" || !S.getAllLogs) return null;
    var rawLogs = S.getAllLogs();
    if (!rawLogs) return null;

    // Konwertuj obiekt { "YYYY-MM-DD": {...} } -> tablica
    var logsArray = [];
    if (Array.isArray(rawLogs)) {
      logsArray = rawLogs;
    } else if (typeof rawLogs === "object") {
      var dates = Object.keys(rawLogs).sort();
      for (var i = 0; i < dates.length; i++) {
        var e = rawLogs[dates[i]];
        if (e && (e.distance || e.km)) {
          e.date = e.date || dates[i];
          logsArray.push(e);
        }
      }
    }

    if (!logsArray.length) return null;

    // Wez ostatnie 5 treningow z paceem
    var recent = logsArray.slice(-5);
    var paces = recent
      .map(function(l) { return paceToSec(l.pace); })
      .filter(function(p) { return p > 0; });

    if (!paces.length) return null;
    return Math.round(paces.reduce(function(a, b) { return a + b; }, 0) / paces.length);
  }

  function getTodayImpact() {
    var h = HealthImport.getToday();
    if (!h) {
      // Fallback: weź najnowszy wpis (np. wczoraj)
      h = HealthImport.getLatest();
    }
    if (!h) return { penalty: 0, reasons: [] };

    var base = HealthImport.getBaselines();
    var penalty = 0;
    var reasons = [];

    // HRV impact
    if (h.hrv && base.hrv) {
      var ratio = h.hrv / base.hrv;
      if (ratio < 0.8) { penalty += 12; reasons.push("HRV \u2193"); }
      else if (ratio < 0.95) { penalty += 6; reasons.push("HRV lekko \u2193"); }
      else if (ratio > 1.1) { penalty -= 5; reasons.push("HRV \u2191"); }
    }

    // RHR impact
    if (h.rhr && base.rhr) {
      var diff = h.rhr - base.rhr;
      if (diff >= 5) { penalty += 10; reasons.push("RHR \u2191"); }
      else if (diff >= 3) { penalty += 5; reasons.push("RHR lekko \u2191"); }
      else if (diff < 0) { penalty -= 4; reasons.push("RHR \u2193"); }
    }

    // Sleep
    if (h.sleepMin) {
      if (h.sleepMin < 360) { penalty += 12; reasons.push("sen <6h"); }
      else if (h.sleepMin < 420) { penalty += 5; reasons.push("sen ~6-7h"); }
      else if (h.sleepMin > 450) { penalty -= 4; reasons.push("dobry sen"); }
    }

    return { penalty: penalty, reasons: reasons };
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
      el.innerHTML = "<div style='background:#111827;border-radius:10px;padding:12px;margin-top:10px;'><h4 style='margin:0 0 6px;color:#f9fafb;'>\u{1F916} AI Coach</h4><p style='color:#9ca3af;font-size:0.85em;margin:0;'>Brak danych treningowych do predykcji</p></div>";
      return;
    }

    var color = pred.delta <= 0 ? "#22c55e" : pred.delta < 10 ? "#f59e0b" : "#ef4444";
    var reasonsText = pred.reasons.length ? pred.reasons.join(", ") : "brak istotnych czynnikow";

    el.innerHTML =
      "<div style='background:#111827;border-radius:10px;padding:12px;margin-top:10px;'>" +
        "<h4 style='margin:0 0 8px;color:#f9fafb;'>\u{1F916} AI Coach - predykcja tempa</h4>" +
        "<div style='display:flex;justify-content:space-around;margin-bottom:8px;'>" +
          "<div style='text-align:center;'>" +
            "<div style='color:#9ca3af;font-size:0.7em;'>Baseline</div>" +
            "<div style='color:#d1d5db;font-size:1.2em;font-weight:600;'>" + pred.base + "/km</div>" +
          "</div>" +
          "<div style='text-align:center;'>" +
            "<div style='color:#9ca3af;font-size:0.7em;'>Dzis</div>" +
            "<div style='color:" + color + ";font-size:1.4em;font-weight:700;'>" + pred.predicted + "/km</div>" +
          "</div>" +
        "</div>" +
        "<div style='color:#9ca3af;font-size:0.75em;text-align:center;border-top:1px solid #374151;padding-top:6px;'>" +
          "\u0394 " + (pred.delta > 0 ? "+" : "") + pred.delta + "s/km (" + reasonsText + ")" +
        "</div>" +
      "</div>";
  }

  return { predict: predict, render: render };
})();

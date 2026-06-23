
/* ai-coach.js v3 — MAX Daily Coach with rich preprocessing */
var AICoach = (function() {
  "use strict";

  var WORKER_URL = "https://hm-tracker-ai.dawid-pyzowski.workers.dev";
  var CACHE_KEY = "ai_analysis_cache";
  var CACHE_TTL_HOURS = 3;

  async function analyze(force) {
    if (!force) {
      var cached = getCache();
      if (cached) return cached;
    }

    if (typeof DailyCoachEngine === "undefined") {
      return { error: "DailyCoachEngine not loaded" };
    }


    var engineData = await DailyCoachEngine.compute();
    if (engineData.error) return { error: engineData.error };


    var payload = Object.assign({ mode: "daily-v2" }, engineData);

    try {
      console.log("[AICoach] Wysylam rich payload do Workera...");
      var res = await fetch(WORKER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        var errText = await res.text();
        throw new Error("HTTP " + res.status + ": " + errText);
      }

      var data = await res.json();
      var result = {
        analysis: data.analysis,
        timestamp: data.timestamp || new Date().toISOString(),
        model: data.model || "AI",
        debug: engineData
      };
      setCache(result);
      return result;
    } catch (e) {
      console.error("[AICoach] Blad:", e);
      return { error: e.message };
    }
  }

  function getCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var c = JSON.parse(raw);
      var age = (Date.now() - new Date(c.timestamp).getTime()) / 1000 / 3600;
      if (age > CACHE_TTL_HOURS) return null;
      return c;
    } catch (e) { return null; }
  }

  function setCache(data) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch(e) {}
  }

  function clearCache() { localStorage.removeItem(CACHE_KEY); }

  async function render(containerId) {
    var c = document.getElementById(containerId);
    if (!c) return;

    c.innerHTML = "<div style='background:#1f2937;border-radius:10px;padding:14px;margin-top:10px;'>" +
      "<h4 style='margin:0 0 10px;color:#f9fafb;'>\u{1F916} AI Coach Analysis</h4>" +
      "<p style='color:#9ca3af;text-align:center;'>\u23F3 AI analizuje Twoje dane...</p>" +
      "</div>";

    var result = await analyze();

    if (result.error) {
      c.innerHTML = "<div style='background:#1f2937;border-radius:10px;padding:14px;margin-top:10px;'>" +
        "<h4 style='margin:0 0 10px;color:#f9fafb;'>\u{1F916} AI Coach</h4>" +
        "<p style='color:#fca5a5;font-size:0.85em;'>\u274C " + result.error + "</p>" +
        "<button onclick='AICoach.refresh(\"" + containerId + "\")' style='margin-top:8px;padding:6px 12px;background:#374151;border:none;color:white;border-radius:6px;cursor:pointer;'>\u{1F504} Ponow</button>" +
        "</div>";
      return;
    }

    var ts = new Date(result.timestamp).toLocaleString();
    var modelLabel = result.model || "AI";
    var readinessColor = result.debug && result.debug.readiness ? result.debug.readiness.color : "blue";
    var readinessScore = result.debug && result.debug.readiness ? result.debug.readiness.score : "?";
    var readinessLabel = result.debug && result.debug.readiness ? result.debug.readiness.label : "";

    var colorMap = { green: "#22c55e", lightgreen: "#84cc16", yellow: "#f59e0b", orange: "#f97316", red: "#ef4444" };
    var borderColor = colorMap[readinessColor] || "#3b82f6";

    var html = "<div style='background:linear-gradient(135deg,#1e3a8a 0%,#1f2937 100%);border-radius:12px;padding:16px;margin-top:10px;border:2px solid " + borderColor + ";'>";

    // Header z readiness score
    html += "<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid #374151;'>";
    html += "<div>";
    html += "<h4 style='margin:0;color:#f9fafb;'>\u{1F916} AI Daily Coach</h4>";
    html += "<div style='color:" + borderColor + ";font-size:0.85em;font-weight:600;margin-top:2px;'>" + readinessLabel + " (" + readinessScore + "/100)</div>";
    html += "</div>";
    html += "<button onclick='AICoach.refresh(\"" + containerId + "\")' style='background:#374151;border:none;color:#60a5fa;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:0.8em;'>\u{1F504} Odswiez</button>";
    html += "</div>";

    var formatted = (result.analysis || "")
      .replace(/\n\n/g, "<br><br>")
      .replace(/\n/g, "<br>")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

    html += "<div style='color:#e5e7eb;font-size:0.92em;line-height:1.55;'>" + formatted + "</div>";

    // Collapsible debug
    html += "<details style='margin-top:12px;'>";
    html += "<summary style='cursor:pointer;color:#6b7280;font-size:0.7em;'>Dane Engine (debug)</summary>";
    html += "<pre style='background:#000;padding:10px;border-radius:6px;font-size:0.65em;overflow-x:auto;color:#86efac;max-height:300px;overflow-y:auto;'>" + JSON.stringify(result.debug, null, 2) + "</pre>";
    html += "</details>";

    html += "<div style='margin-top:8px;color:#6b7280;font-size:0.7em;text-align:right;'>" + ts + " | " + modelLabel + "</div>";
    html += "</div>";

    c.innerHTML = html;
  }

  function refresh(containerId) {
    clearCache();
    render(containerId);
  }

  return { analyze: analyze, render: render, refresh: refresh, clearCache: clearCache };
})();

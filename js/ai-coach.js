/* ai-coach.js — Cloudflare Workers AI Coach */
var AICoach = (function() {
  "use strict";

  // ⚠️ PODMIEŃ NA SWÓJ URL WORKERA
  var WORKER_URL = "https://hm-tracker-ai.dawid-pyzowski.workers.dev";

  var CACHE_KEY = "ai_analysis_cache";
  var CACHE_TTL_HOURS = 6; // przez 6h ten sam wynik

  async function analyze(force) {
    // Cache check
    if (!force) {
      var cached = getCache();
      if (cached) return cached;
    }

    if (typeof HealthImport === "undefined" || typeof S === "undefined") {
      return { error: "Brakuje modułów health/training" };
    }

    var health = HealthImport.getAll();
    if (health.length < 3) {
      return { error: "Za mało danych health (min 3 dni)" };
    }

    // Konwertuj treningi
    var rawLogs = S.getAllLogs();
    var training = [];
    Object.keys(rawLogs).sort().forEach(function(d) {
      var l = rawLogs[d];
      if (!l || (!l.distance && !l.km)) return;
      training.push({
        date: d,
        km: parseFloat(l.km || l.distance),
        pace: l.pace || "",
        type: l.type || l.workout_type || "",
        hr: l.hr || l.avg_hr || 0
      });
    });

    if (training.length < 3) {
      return { error: "Za mało treningów (min 3)" };
    }

    // Przygotuj payload
    var payload = {
      healthData: health.slice(-14).map(function(h) {
        return {
          date: h.date,
          sleep_h: (h.sleepMin / 60).toFixed(1),
          deep_min: h.deepMin,
          rem_min: h.remMin,
          rhr: h.rhr,
          hrv: h.hrv
        };
      }),
      trainingData: training,
      raceTarget: {
        name: "Wizz Air Prague Night HM",
        date: "2026-09-06",
        pace: "4:59"
      }
    };

    try {
      console.log("[AICoach] Wysylam zapytanie...");
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
      console.log("[AICoach] Otrzymano:", data);

      var result = {
        analysis: data.analysis,
        timestamp: data.timestamp || new Date().toISOString()
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
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); }
    catch (e) {}
  }

  function clearCache() {
    localStorage.removeItem(CACHE_KEY);
  }

  async function render(containerId) {
    var c = document.getElementById(containerId);
    if (!c) return;

    c.innerHTML = "<div style='background:#1f2937;border-radius:10px;padding:14px;margin-top:10px;'>" +
      "<h4 style='margin:0 0 10px;color:#f9fafb;'>\u{1F916} AI Coach (Cloudflare)</h4>" +
      "<p style='color:#9ca3af;text-align:center;'>\u23F3 Analizuje dane...</p>" +
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

    // Render analysis
    var ts = new Date(result.timestamp).toLocaleString();
    var html = "<div style='background:linear-gradient(135deg,#1e3a8a 0%,#1f2937 100%);border-radius:12px;padding:16px;margin-top:10px;border:1px solid #3b82f6;'>";
    html += "<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;'>";
    html += "<h4 style='margin:0;color:#f9fafb;'>\u{1F916} AI Coach Analysis</h4>";
    html += "<button onclick='AICoach.refresh(\"" + containerId + "\")' style='background:#374151;border:none;color:#60a5fa;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:0.75em;'>\u{1F504} Odswiez</button>";
    html += "</div>";

    // Format analysis text (replace \n with <br>)
    var formatted = (result.analysis || "")
      .replace(/\n\n/g, "<br><br>")
      .replace(/\n/g, "<br>")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

    html += "<div style='color:#e5e7eb;font-size:0.92em;line-height:1.5;'>" + formatted + "</div>";
    html += "<div style='margin-top:10px;padding-top:8px;border-top:1px solid #374151;color:#6b7280;font-size:0.7em;text-align:right;'>" + ts + "</div>";
    html += "</div>";

    c.innerHTML = html;
  }

  function refresh(containerId) {
    clearCache();
    render(containerId);
  }

  return {
    analyze: analyze,
    render: render,
    refresh: refresh,
    clearCache: clearCache
  };
})();

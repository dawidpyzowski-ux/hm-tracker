/* workout-analyzer.js v1 — Sprint 17: AI Workout Analysis */
var WorkoutAnalyzer = (function() {
  "use strict";
  var TAG = "[WorkoutAnalyzer]";

  // Same URL co AICoach
  var WORKER_URL = (typeof AICoach !== "undefined" && AICoach.WORKER_URL)
    ? AICoach.WORKER_URL
    : "https://hm-tracker-ai.dawid-pyzowski.workers.dev";

  function paceToSec(p) {
    if (!p) return 0;
    var parts = p.toString().split(":");
    if (parts.length !== 2) return 0;
    return parseInt(parts[0]) * 60 + parseInt(parts[1]);
  }

  function speedToPaceStr(speed) {
    if (!speed || speed <= 0) return "-";
    var s = Math.round(1000 / speed);
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  }

  function prepareSplits(detail) {
    if (!detail || !detail.splits) return [];
    return detail.splits.map(function(s, i) {
      return {
        km: i + 1,
        pace: speedToPaceStr(s.average_speed),
        hr: Math.round(s.average_heartrate || 0),
        elev: Math.round(s.elevation_difference || 0)
      };
    });
  }

  function prepareLaps(detail, classified) {
    if (classified && classified.length) {
      return classified.map(function(l, i) {
        return {
          lap: i + 1,
          role: l.role || "unknown",
          dist_km: +(l.distKm || 0).toFixed(2),
          pace: speedToPaceStr(l.distKm * 1000 / (l.duration || 1)),
          hr: Math.round(l.avgHR || 0)
        };
      });
    }
    if (!detail || !detail.laps) return [];
    return detail.laps.slice(0, 10).map(function(l, i) {
      return {
        lap: i + 1,
        dist_km: +(l.distance / 1000).toFixed(2),
        pace: speedToPaceStr(l.average_speed),
        hr: Math.round(l.average_heartrate || 0)
      };
    });
  }

  function findSimilarWorkout(workout) {
    if (typeof DB === "undefined" || !DB.getAll) return null;
    return DB.getAll().then(function(acts) {
      var type = (workout.type || "").toLowerCase();
      var sameType = acts.filter(function(a) {
        if (a.date === workout.date) return false;
        var t = (a.type || "").toLowerCase();
        return t.indexOf(type.split("_")[0]) >= 0 || t === type;
      });
      sameType.sort(function(a, b) { return b.date.localeCompare(a.date); });
      return sameType[0] || null;
    });
  }

  async function analyze(activity, options) {
    options = options || {};
    if (!activity) return { error: "Brak aktywności" };

    // Pobierz detail z Strava
    var detail = null;
    if (activity.strava_id && typeof DB !== "undefined" && DB.getDetail) {
      try { detail = DB.getDetail(activity.strava_id); } catch (e) {}
    }

    if (!detail || !detail.splits) {
      return { error: "Brak szczegółowych danych (splits) dla tego treningu" };
    }

    // Splits per km
    var splits = prepareSplits(detail);

    // Laps z TrainScore (jeśli interval)
    var trainScore = null;
    var laps = null;
    var planType = (activity.type || "").toLowerCase();
    if (planType.indexOf("interv") >= 0 && typeof TrainScore !== "undefined") {
      try {
        var ts = TrainScore.evaluate(activity.date);
        if (ts) {
          trainScore = {
            total: ts.total,
            volume: ts.volume,
            intensity: ts.intensity,
            hr: ts.hr,
            coach: ts.coachMsg
          };
          if (ts.classified) {
            laps = prepareLaps(detail, ts.classified);
          }
        }
      } catch (e) { console.warn(TAG, "TrainScore failed:", e); }
    }
    if (!laps) laps = prepareLaps(detail);

    // Porównanie z poprzednim
    var comparison = null;
    try {
      var similar = await findSimilarWorkout(activity);
      if (similar) {
        comparison = {
          date: similar.date,
          km: similar.km,
          pace: similar.pace,
          avg_hr: similar.avg_hr
        };
      }
    } catch (e) {}

    // Health day before
    var health = null;
    if (typeof HealthImport !== "undefined") {
      var pd = new Date(activity.date);
      pd.setDate(pd.getDate() - 1);
      var prevStr = pd.toISOString().slice(0, 10);
      var h = HealthImport.getByDate(prevStr);
      if (h) {
        health = {
          date: prevStr,
          sleep_h: (h.sleepMin / 60).toFixed(1),
          deep_min: h.deepMin,
          rem_min: h.remMin,
          rhr: h.rhr,
          hrv: h.hrv
        };
      }
    }

    var payload = {
      mode: "workout",
      workout: {
        date: activity.date,
        type: activity.type || "",
        km: activity.km,
        pace: activity.pace || activity.avg_pace,
        avg_hr: activity.avg_hr || activity.average_heartrate,
        notes: activity.notes
      },
      splits: splits,
      laps: laps,
      trainScore: trainScore,
      comparison: comparison,
      health: health
    };

    try {
      console.log(TAG, "Wysylam:", payload);
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
      return { analysis: data.analysis, timestamp: data.timestamp };
    } catch (e) {
      console.error(TAG, "Bład:", e);
      return { error: e.message };
    }
  }

  async function renderAsModal(activity) {
    // Stwórz modal
    var modal = document.createElement("div");
    modal.id = "wa-modal";
    modal.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto;";

    modal.innerHTML = "<div style='background:#111827;border-radius:14px;padding:18px;max-width:600px;width:100%;max-height:90vh;overflow-y:auto;border:1px solid #3b82f6;'>" +
      "<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;'>" +
      "<h3 style='margin:0;color:#f9fafb;'>\u{1F916} AI Analiza: " + activity.date + " (" + activity.km + "km)</h3>" +
      "<button onclick='document.getElementById(\"wa-modal\").remove()' style='background:#ef4444;border:none;color:white;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:1em;'>\u00D7</button>" +
      "</div>" +
      "<div id='wa-content' style='color:#e5e7eb;line-height:1.6;'>" +
      "<p style='color:#9ca3af;text-align:center;padding:30px;'>\u23F3 AI analizuje Twój trening...</p>" +
      "</div>" +
      "</div>";

    document.body.appendChild(modal);

    var result = await analyze(activity);
    var contentEl = document.getElementById("wa-content");
    if (!contentEl) return; // user closed

    if (result.error) {
      contentEl.innerHTML = "<p style='color:#fca5a5;text-align:center;'>\u274C " + result.error + "</p>";
      return;
    }

    var formatted = (result.analysis || "")
      .replace(/\n\n/g, "<br><br>")
      .replace(/\n/g, "<br>")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/^([\u{1F300}-\u{1F9FF}].+?:)/gmu, "<strong style='color:#60a5fa;'>$1</strong>");

    contentEl.innerHTML = "<div style='font-size:0.92em;'>" + formatted + "</div>" +
      "<div style='margin-top:12px;padding-top:8px;border-top:1px solid #374151;color:#6b7280;font-size:0.7em;text-align:right;'>" +
      new Date(result.timestamp).toLocaleString() + "</div>";
  }

  return {
    analyze: analyze,
    renderAsModal: renderAsModal,
    WORKER_URL: WORKER_URL
  };
})();

/* health-cross.js v3 — Sprint 13.3: Smart Cross-Analysis with quartile thresholds */
var HealthCross = (function() {
  "use strict";
  var TAG = "[HealthCross]";

  function getTrainingData() {
    if (typeof S === "undefined" || !S.getAllLogs) return [];
    var rawLogs = S.getAllLogs();
    if (!rawLogs) return [];

    var logsArray = [];
    if (Array.isArray(rawLogs)) {
      logsArray = rawLogs;
    } else if (typeof rawLogs === "object") {
      var dates = Object.keys(rawLogs);
      for (var i = 0; i < dates.length; i++) {
        var entry = rawLogs[dates[i]];
        if (entry) {
          entry.date = entry.date || dates[i];
          logsArray.push(entry);
        }
      }
    }

    return logsArray.map(function(l) {
      return {
        date: l.date || "",
        km: parseFloat(l.km || l.distance || 0),
        pace: l.pace || "",
        type: l.type || l.workout_type || "",
        duration: l.duration || "",
        hr: l.hr || l.avg_hr || 0
      };
    }).filter(function(l) { return l.date && l.km > 0; });
  }

  function paceToSec(pace) {
    if (!pace) return 0;
    var parts = pace.toString().replace(",", ":").split(":");
    if (parts.length === 2) return parseInt(parts[0]) * 60 + parseInt(parts[1]);
    return parseInt(pace) || 0;
  }

  function secToPace(sec) {
    if (!sec || sec <= 0) return "-";
    var m = Math.floor(sec / 60);
    var s = Math.round(sec % 60);
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  function median(arr) {
    var s = arr.slice().sort(function(a, b) { return a - b; });
    var mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  }

  function analyze() {
    if (typeof HealthImport === "undefined") return null;
    var health = HealthImport.getAll();
    var training = getTrainingData();
    if (health.length < 2 || training.length < 3) {
      return { insights: [{ type: "info", title: "Za malo danych", msg: "Potrzeba min. 2 dni health i 3 treningow. Masz: " + health.length + " dni health, " + training.length + " treningow." }], correlations: {} };
    }

    var healthMap = {};
    health.forEach(function(h) { healthMap[h.date] = h; });

    var insights = [];
    var correlations = {};

    // Zbierz pary (health day-1 + training) z paceem
    var pairs = [];
    training.forEach(function(t) {
      var prevDate = new Date(t.date);
      prevDate.setDate(prevDate.getDate() - 1);
      var prevStr = prevDate.toISOString().slice(0, 10);
      var h = healthMap[prevStr];
      if (!h) return;
      var paceSec = paceToSec(t.pace);
      if (paceSec <= 0) return;
      pairs.push({ training: t, health: h, paceSec: paceSec });
    });

    if (pairs.length < 3) {
      return { insights: [{ type: "info", title: "Za malo dopasowanych dni", msg: "Tylko " + pairs.length + " treningow ma dane health z dnia poprzedniego. Potrzeba min. 3." }], correlations: {} };
    }

    // === MEDIAN-BASED COMPARISON (zamiast sztywnych progow) ===

    // 1. Sleep vs pace (median split)
    var sleepSorted = pairs.slice().sort(function(a, b) { return a.health.sleepMin - b.health.sleepMin; });
    var midSleep = Math.floor(sleepSorted.length / 2);
    var betterSleep = sleepSorted.slice(midSleep); // top half (more sleep)
    var worseSleep = sleepSorted.slice(0, midSleep); // bottom half

    if (betterSleep.length >= 2 && worseSleep.length >= 2) {
      var avgPaceBetterSleep = Math.round(betterSleep.reduce(function(s, p) { return s + p.paceSec; }, 0) / betterSleep.length);
      var avgPaceWorseSleep = Math.round(worseSleep.reduce(function(s, p) { return s + p.paceSec; }, 0) / worseSleep.length);
      var diff = avgPaceWorseSleep - avgPaceBetterSleep;
      var avgBetterH = (betterSleep.reduce(function(s, p) { return s + p.health.sleepMin; }, 0) / betterSleep.length / 60).toFixed(1);
      var avgWorseH = (worseSleep.reduce(function(s, p) { return s + p.health.sleepMin; }, 0) / worseSleep.length / 60).toFixed(1);

      correlations.sleepVsPace = { betterSleep: secToPace(avgPaceBetterSleep), worseSleep: secToPace(avgPaceWorseSleep), diffSec: diff };

      if (Math.abs(diff) >= 3) {
        insights.push({
          type: diff > 0 ? (diff > 10 ? "warning" : "info") : "positive",
          title: "Sen a tempo",
          msg: diff > 0
            ? "Po krotszym snie (" + avgWorseH + "h) tempo jest wolniejsze o " + secToPace(Math.abs(diff)) + "/km vs po dluzszym (" + avgBetterH + "h)."
            : "Po krotszym snie tempo jest szybsze (mozliwe ze biegales latwiejsze trasy).",
          detail: "Lepszy sen: " + secToPace(avgPaceBetterSleep) + "/km (" + avgBetterH + "h) | Krotszy: " + secToPace(avgPaceWorseSleep) + "/km (" + avgWorseH + "h)"
        });
      }
    }

    // 2. HRV vs pace (median split)
    var hrvSorted = pairs.filter(function(p) { return p.health.hrv > 0; }).sort(function(a, b) { return a.health.hrv - b.health.hrv; });
    var midHrv = Math.floor(hrvSorted.length / 2);
    var highHrv = hrvSorted.slice(midHrv);
    var lowHrv = hrvSorted.slice(0, midHrv);

    if (highHrv.length >= 2 && lowHrv.length >= 2) {
      var avgPaceHighHrv = Math.round(highHrv.reduce(function(s, p) { return s + p.paceSec; }, 0) / highHrv.length);
      var avgPaceLowHrv = Math.round(lowHrv.reduce(function(s, p) { return s + p.paceSec; }, 0) / lowHrv.length);
      var hrvDiff = avgPaceLowHrv - avgPaceHighHrv;
      var avgHighHrvVal = Math.round(highHrv.reduce(function(s, p) { return s + p.health.hrv; }, 0) / highHrv.length);
      var avgLowHrvVal = Math.round(lowHrv.reduce(function(s, p) { return s + p.health.hrv; }, 0) / lowHrv.length);

      correlations.hrvVsPace = { highHrv: secToPace(avgPaceHighHrv), lowHrv: secToPace(avgPaceLowHrv), diffSec: hrvDiff };

      if (Math.abs(hrvDiff) >= 3) {
        insights.push({
          type: hrvDiff > 0 ? (hrvDiff > 10 ? "warning" : "info") : "positive",
          title: "HRV a tempo",
          msg: hrvDiff > 0
            ? "Przy niskim HRV (" + avgLowHrvVal + "ms) tempo spada o " + secToPace(hrvDiff) + "/km vs dni z wysokim HRV (" + avgHighHrvVal + "ms)."
            : "Interesujace: przy niskim HRV tempo jest szybsze.",
          detail: "Wysokie HRV: " + secToPace(avgPaceHighHrv) + "/km | Niskie HRV: " + secToPace(avgPaceLowHrv) + "/km"
        });
      }
    }

    // 3. RHR vs pace (median split)
    var rhrSorted = pairs.filter(function(p) { return p.health.rhr > 0; }).sort(function(a, b) { return a.health.rhr - b.health.rhr; });
    var midRhr = Math.floor(rhrSorted.length / 2);
    var lowRhr = rhrSorted.slice(0, midRhr); // niskie RHR = lepsza regeneracja
    var highRhr = rhrSorted.slice(midRhr);

    if (lowRhr.length >= 2 && highRhr.length >= 2) {
      var avgPaceLowRhr = Math.round(lowRhr.reduce(function(s, p) { return s + p.paceSec; }, 0) / lowRhr.length);
      var avgPaceHighRhr = Math.round(highRhr.reduce(function(s, p) { return s + p.paceSec; }, 0) / highRhr.length);
      var rhrDiff = avgPaceHighRhr - avgPaceLowRhr;
      var avgLowRhrVal = Math.round(lowRhr.reduce(function(s, p) { return s + p.health.rhr; }, 0) / lowRhr.length);
      var avgHighRhrVal = Math.round(highRhr.reduce(function(s, p) { return s + p.health.rhr; }, 0) / highRhr.length);

      correlations.rhrVsPace = { lowRhr: secToPace(avgPaceLowRhr), highRhr: secToPace(avgPaceHighRhr), diffSec: rhrDiff };

      if (Math.abs(rhrDiff) >= 3) {
        insights.push({
          type: rhrDiff > 0 ? "warning" : "info",
          title: "RHR a tempo",
          msg: rhrDiff > 0
            ? "Przy wyzszym RHR (" + avgHighRhrVal + " bpm) tempo spada o " + secToPace(rhrDiff) + "/km. Cialo sygnalizuje zmeczenie."
            : "Brak wyraznego zwiazku RHR z tempem.",
          detail: "Niskie RHR: " + secToPace(avgPaceLowRhr) + "/km (" + avgLowRhrVal + " bpm) | Wysokie: " + secToPace(avgPaceHighRhr) + "/km (" + avgHighRhrVal + " bpm)"
        });
      }
    }

    // 4. Best/worst day insights
    if (pairs.length >= 5) {
      var bestPair = pairs.reduce(function(best, p) { return p.paceSec < best.paceSec ? p : best; }, pairs[0]);
      var worstPair = pairs.reduce(function(worst, p) { return p.paceSec > worst.paceSec ? p : worst; }, pairs[0]);

      insights.push({
        type: "info",
        title: "Twoj najlepszy trening",
        msg: bestPair.training.date.slice(5) + ": " + bestPair.training.km + "km @ " + secToPace(bestPair.paceSec) + "/km",
        detail: "Dzien wczesniej: sen " + (bestPair.health.sleepMin/60).toFixed(1) + "h | HRV " + bestPair.health.hrv + " | RHR " + bestPair.health.rhr
      });
    }

    // 5. Risk detection
    var baselines = HealthImport.getBaselines();
    var riskDays = [];
    pairs.forEach(function(p) {
      var risk = 0;
      var reasons = [];
      if (p.health.sleepMin && p.health.sleepMin < 360) { risk += 2; reasons.push("sen <6h"); }
      if (p.health.hrv && p.health.hrv < baselines.hrv * 0.75) { risk += 2; reasons.push("HRV bardzo niskie"); }
      if (p.health.rhr && p.health.rhr > baselines.rhr + 5) { risk += 1; reasons.push("RHR podwyzszone"); }
      if (risk >= 2 && p.training.km >= 8) {
        riskDays.push({ date: p.training.date, km: p.training.km, reasons: reasons });
      }
    });

    if (riskDays.length > 0) {
      insights.push({
        type: "danger",
        title: "Ryzyko przetrenowania",
        msg: riskDays.length + " trening(ow) przy slabej regeneracji. Cialo sygnalizowalo zmeczenie.",
        detail: riskDays.map(function(r) { return r.date.slice(5) + ": " + r.km + "km (" + r.reasons.join(", ") + ")"; }).join(" | ")
      });
    }

    console.log(TAG, "Analysis complete.", insights.length, "insights | pairs:", pairs.length, "/ training:", training.length, "/ health:", health.length);
    return { insights: insights, correlations: correlations, pairs: pairs.length };
  }

  function render(containerId) {
    var c = document.getElementById(containerId);
    if (!c) return;

    var result = analyze();
    if (!result || !result.insights || result.insights.length === 0) {
      c.innerHTML = "<p style='color:#9ca3af;text-align:center;padding:20px;'>Brak danych do cross-analizy</p>";
      return;
    }

    var html = "<h3 style='color:#f9fafb;margin:0 0 12px;'>\u{1F9E0} Health x Training</h3>";

    result.insights.forEach(function(ins) {
      var bg, fg, icon;
      switch (ins.type) {
        case "danger":  bg = "#450a0a"; fg = "#fca5a5"; icon = "\u26A0\uFE0F"; break;
        case "warning": bg = "#451a03"; fg = "#fde68a"; icon = "\uD83D\uDFE1"; break;
        case "positive": bg = "#052e16"; fg = "#86efac"; icon = "\u2705"; break;
        default:        bg = "#1e1b4b"; fg = "#a5b4fc"; icon = "\uD83D\uDCCA"; break;
      }

      html += "<div style='background:" + bg + ";border-radius:10px;padding:12px;margin:6px 0;'>";
      html += "<div style='font-weight:600;color:" + fg + ";margin-bottom:4px;'>" + icon + " " + ins.title + "</div>";
      html += "<div style='color:" + fg + ";font-size:0.88em;opacity:0.95;'>" + ins.msg + "</div>";
      if (ins.detail) {
        html += "<div style='color:" + fg + ";font-size:0.78em;opacity:0.7;margin-top:4px;border-top:1px solid rgba(255,255,255,0.1);padding-top:4px;'>" + ins.detail + "</div>";
      }
      html += "</div>";
    });

    c.innerHTML = html;
  }

  return { analyze: analyze, render: render };
})();

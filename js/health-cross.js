/* health-cross.js — Sprint 13.3: Health x Training Cross-Analysis */
var HealthCross = (function() {
  "use strict";
  var TAG = "[HealthCross]";

  function getTrainingData() {
    if (typeof S === "undefined" || !S.getAllLogs) return [];
    var logs = S.getAllLogs();
    if (!logs || !logs.length) return [];
    return logs.map(function(l) {
      return {
        date: l.date || "",
        km: parseFloat(l.km) || 0,
        pace: l.pace || "",
        type: l.type || "",
        duration: l.duration || "",
        hr: l.hr || 0
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

  function analyze() {
    if (typeof HealthImport === "undefined") return null;
    var health = HealthImport.getAll();
    var training = getTrainingData();
    if (health.length < 2 || training.length < 3) {
      return { insights: [{ type: "info", title: "Za malo danych", msg: "Potrzeba min. 2 dni danych zdrowotnych i 3 treningow do analizy." }], correlations: {} };
    }

    var healthMap = {};
    health.forEach(function(h) { healthMap[h.date] = h; });

    var insights = [];
    var correlations = {};
    var baselines = HealthImport.getBaselines();

    // 1. Sleep vs next-day pace
    var goodSleepPaces = [];
    var badSleepPaces = [];
    training.forEach(function(t) {
      var prevDate = new Date(t.date);
      prevDate.setDate(prevDate.getDate() - 1);
      var prevDateStr = prevDate.toISOString().slice(0, 10);
      var h = healthMap[prevDateStr];
      if (!h || !h.sleepMin) return;
      var paceSec = paceToSec(t.pace);
      if (paceSec <= 0) return;

      if (h.sleepMin >= 420) {
        goodSleepPaces.push(paceSec);
      } else if (h.sleepMin < 360) {
        badSleepPaces.push(paceSec);
      }
    });

    if (goodSleepPaces.length > 0 && badSleepPaces.length > 0) {
      var avgGood = Math.round(goodSleepPaces.reduce(function(a, b) { return a + b; }, 0) / goodSleepPaces.length);
      var avgBad = Math.round(badSleepPaces.reduce(function(a, b) { return a + b; }, 0) / badSleepPaces.length);
      var diff = avgBad - avgGood;
      correlations.sleepVsPace = { goodSleep: secToPace(avgGood), badSleep: secToPace(avgBad), diffSec: diff };

      if (diff > 0) {
        insights.push({
          type: diff > 15 ? "warning" : "info",
          title: "Sen a tempo",
          msg: "Po slabym snie (<6h) Twoje tempo jest wolniejsze o " + secToPace(diff) + "/km vs po dobrym snie (7h+).",
          detail: "Dobry sen: " + secToPace(avgGood) + "/km | Slaby sen: " + secToPace(avgBad) + "/km"
        });
      }
    }

    // 2. HRV level vs pace
    var highHrvPaces = [];
    var lowHrvPaces = [];
    training.forEach(function(t) {
      var prevDate = new Date(t.date);
      prevDate.setDate(prevDate.getDate() - 1);
      var prevDateStr = prevDate.toISOString().slice(0, 10);
      var h = healthMap[prevDateStr];
      if (!h || !h.hrv) return;
      var paceSec = paceToSec(t.pace);
      if (paceSec <= 0) return;

      if (h.hrv >= baselines.hrv * 1.1) {
        highHrvPaces.push(paceSec);
      } else if (h.hrv < baselines.hrv * 0.8) {
        lowHrvPaces.push(paceSec);
      }
    });

    if (highHrvPaces.length > 0 && lowHrvPaces.length > 0) {
      var avgHighHrv = Math.round(highHrvPaces.reduce(function(a, b) { return a + b; }, 0) / highHrvPaces.length);
      var avgLowHrv = Math.round(lowHrvPaces.reduce(function(a, b) { return a + b; }, 0) / lowHrvPaces.length);
      var hrvDiff = avgLowHrv - avgHighHrv;
      correlations.hrvVsPace = { highHrv: secToPace(avgHighHrv), lowHrv: secToPace(avgLowHrv), diffSec: hrvDiff };

      if (hrvDiff > 0) {
        insights.push({
          type: hrvDiff > 20 ? "warning" : "info",
          title: "HRV a tempo",
          msg: "Przy niskim HRV tempo spada o " + secToPace(hrvDiff) + "/km vs dni z wysokim HRV.",
          detail: "Wysokie HRV: " + secToPace(avgHighHrv) + "/km | Niskie HRV: " + secToPace(avgLowHrv) + "/km"
        });
      }
    }

    // 3. RHR elevation vs performance
    var normalRhrPaces = [];
    var elevatedRhrPaces = [];
    training.forEach(function(t) {
      var prevDate = new Date(t.date);
      prevDate.setDate(prevDate.getDate() - 1);
      var prevDateStr = prevDate.toISOString().slice(0, 10);
      var h = healthMap[prevDateStr];
      if (!h || !h.rhr) return;
      var paceSec = paceToSec(t.pace);
      if (paceSec <= 0) return;

      if (h.rhr <= baselines.rhr + 2) {
        normalRhrPaces.push(paceSec);
      } else if (h.rhr >= baselines.rhr + 5) {
        elevatedRhrPaces.push(paceSec);
      }
    });

    if (normalRhrPaces.length > 0 && elevatedRhrPaces.length > 0) {
      var avgNormRhr = Math.round(normalRhrPaces.reduce(function(a, b) { return a + b; }, 0) / normalRhrPaces.length);
      var avgElevRhr = Math.round(elevatedRhrPaces.reduce(function(a, b) { return a + b; }, 0) / elevatedRhrPaces.length);
      var rhrPaceDiff = avgElevRhr - avgNormRhr;
      correlations.rhrVsPace = { normal: secToPace(avgNormRhr), elevated: secToPace(avgElevRhr), diffSec: rhrPaceDiff };

      if (rhrPaceDiff > 0) {
        insights.push({
          type: "warning",
          title: "RHR a tempo",
          msg: "Podwyzszone RHR (+5 bpm) koreluje ze spadkiem tempa o " + secToPace(rhrPaceDiff) + "/km.",
          detail: "Normalne RHR: " + secToPace(avgNormRhr) + "/km | Podwyzszone: " + secToPace(avgElevRhr) + "/km"
        });
      }
    }

    // 4. Risk detection: low sleep + hard training
    var riskDays = [];
    training.forEach(function(t) {
      var prevDate = new Date(t.date);
      prevDate.setDate(prevDate.getDate() - 1);
      var prevDateStr = prevDate.toISOString().slice(0, 10);
      var h = healthMap[prevDateStr];
      if (!h) return;

      var risk = 0;
      var reasons = [];
      if (h.sleepMin && h.sleepMin < 360) { risk += 2; reasons.push("sen < 6h"); }
      if (h.hrv && baselines.hrv && h.hrv < baselines.hrv * 0.7) { risk += 2; reasons.push("HRV bardzo niskie"); }
      if (h.rhr && baselines.rhr && h.rhr > baselines.rhr + 5) { risk += 1; reasons.push("RHR podwyzszone"); }

      if (risk >= 2 && t.km >= 8) {
        riskDays.push({ date: t.date, km: t.km, reasons: reasons, risk: risk });
      }
    });

    if (riskDays.length > 0) {
      insights.push({
        type: "danger",
        title: "Ryzyko przetrenowania",
        msg: riskDays.length + " trening(ow) przy slabej regeneracji! Ciezki trening po zlym snie/niskim HRV zwieksza ryzyko kontuzji.",
        detail: riskDays.map(function(r) { return r.date.slice(5) + ": " + r.km + "km (" + r.reasons.join(", ") + ")"; }).join(" | ")
      });
    }

    // 5. Positive correlation
    var recoveredGoodRuns = 0;
    var totalRecoveredRuns = 0;
    training.forEach(function(t) {
      var prevDate = new Date(t.date);
      prevDate.setDate(prevDate.getDate() - 1);
      var prevDateStr = prevDate.toISOString().slice(0, 10);
      var h = healthMap[prevDateStr];
      if (!h || !h.sleepMin || !h.hrv) return;

      if (h.sleepMin >= 420 && h.hrv >= baselines.hrv * 0.95) {
        totalRecoveredRuns++;
        var paceSec = paceToSec(t.pace);
        var targetPace = paceToSec("5:30");
        if (paceSec > 0 && paceSec <= targetPace) {
          recoveredGoodRuns++;
        }
      }
    });

    if (totalRecoveredRuns >= 2) {
      var pct = Math.round(recoveredGoodRuns / totalRecoveredRuns * 100);
      if (pct >= 60) {
        insights.push({
          type: "positive",
          title: "Regeneracja = wyniki",
          msg: pct + "% treningow po dobrej regeneracji to dobre wyniki (<5:30/km).",
          detail: recoveredGoodRuns + " z " + totalRecoveredRuns + " treningow"
        });
      }
    }

    console.log(TAG, "Analysis complete.", insights.length, "insights");
    return { insights: insights, correlations: correlations };
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

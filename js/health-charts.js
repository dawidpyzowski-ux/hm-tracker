/* health-charts.js — Sprint 13.3: Chart.js Health Visualizations */
var HealthCharts = (function() {
  "use strict";
  var TAG = "[HealthCharts]";

  var darkTheme = {
    bg: "#111827",
    cardBg: "#1f2937",
    gridColor: "rgba(75, 85, 99, 0.3)",
    textColor: "#d1d5db",
    textMuted: "#9ca3af"
  };

  var colors = {
    hrv: { line: "#22c55e", fill: "rgba(34,197,94,0.15)", rolling: "#86efac" },
    rhr: { line: "#ef4444", fill: "rgba(239,68,68,0.15)", baseline: "#fca5a5" },
    deep: "#8b5cf6",
    rem: "#f472b6",
    core: "#60a5fa",
    excellent: "#22c55e",
    good: "#84cc16",
    moderate: "#f59e0b",
    low: "#ef4444"
  };

  function rollingAvg(arr, window) {
    var result = [];
    for (var i = 0; i < arr.length; i++) {
      var start = Math.max(0, i - window + 1);
      var slice = arr.slice(start, i + 1);
      var sum = slice.reduce(function(a, b) { return a + b; }, 0);
      result.push(Math.round(sum / slice.length * 10) / 10);
    }
    return result;
  }

  function getScoreColor(score) {
    if (score >= 85) return colors.excellent;
    if (score >= 70) return colors.good;
    if (score >= 50) return colors.moderate;
    return colors.low;
  }

  function chartDefaults() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: darkTheme.textColor, font: { size: 11 } } },
        tooltip: { mode: "index", intersect: false }
      },
      scales: {
        x: {
          ticks: { color: darkTheme.textMuted, font: { size: 10 }, maxRotation: 45 },
          grid: { color: darkTheme.gridColor }
        },
        y: {
          ticks: { color: darkTheme.textMuted, font: { size: 10 } },
          grid: { color: darkTheme.gridColor }
        }
      }
    };
  }

  function makeCanvas(parent, id, height) {
    var wrap = document.createElement("div");
    wrap.style.cssText = "background:" + darkTheme.cardBg + ";border-radius:12px;padding:12px;margin:8px 0;";
    var canvasWrap = document.createElement("div");
    canvasWrap.style.cssText = "position:relative;height:" + (height || 220) + "px;";
    var canvas = document.createElement("canvas");
    canvas.id = id;
    canvasWrap.appendChild(canvas);
    wrap.appendChild(canvasWrap);
    parent.appendChild(wrap);
    return canvas;
  }

  function renderHRVChart(parent, hist) {
    var hrvData = [], labels = [];
    hist.forEach(function(h) {
      if (h.hrv && h.hrv > 0) {
        hrvData.push(h.hrv);
        labels.push(h.date ? h.date.slice(5) : "");
      }
    });
    if (hrvData.length < 2) return;

    var rolling7 = rollingAvg(hrvData, 7);
    var canvas = makeCanvas(parent, "hc-hrv", 220);

    var opts = chartDefaults();
    opts.plugins.title = { display: true, text: "HRV (ms) + 7-day rolling avg", color: darkTheme.textColor, font: { size: 13 } };

    new Chart(canvas, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "HRV",
            data: hrvData,
            borderColor: colors.hrv.line,
            backgroundColor: colors.hrv.fill,
            fill: true,
            tension: 0.3,
            pointRadius: 3,
            pointBackgroundColor: colors.hrv.line,
            borderWidth: 2
          },
          {
            label: "7d avg",
            data: rolling7,
            borderColor: colors.hrv.rolling,
            borderDash: [5, 3],
            pointRadius: 0,
            borderWidth: 2,
            fill: false
          }
        ]
      },
      options: opts
    });
  }

  function renderRHRChart(parent, hist, baselines) {
    var rhrData = [], labels = [];
    hist.forEach(function(h) {
      if (h.rhr && h.rhr > 0) {
        rhrData.push(h.rhr);
        labels.push(h.date ? h.date.slice(5) : "");
      }
    });
    if (rhrData.length < 2) return;

    var baselineArr = rhrData.map(function() { return baselines.rhr || 55; });
    var canvas = makeCanvas(parent, "hc-rhr", 220);

    var opts = chartDefaults();
    opts.plugins.title = { display: true, text: "RHR (bpm) vs baseline", color: darkTheme.textColor, font: { size: 13 } };

    new Chart(canvas, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "RHR",
            data: rhrData,
            borderColor: colors.rhr.line,
            backgroundColor: colors.rhr.fill,
            fill: true,
            tension: 0.3,
            pointRadius: 3,
            pointBackgroundColor: colors.rhr.line,
            borderWidth: 2
          },
          {
            label: "Baseline",
            data: baselineArr,
            borderColor: colors.rhr.baseline,
            borderDash: [8, 4],
            pointRadius: 0,
            borderWidth: 1.5,
            fill: false
          }
        ]
      },
      options: opts
    });
  }

  function renderSleepChart(parent, hist) {
    var deepArr = [], remArr = [], coreArr = [], labels = [];
    hist.forEach(function(h) {
      if (h.sleepMin && h.sleepMin > 0) {
        deepArr.push(h.deepMin || 0);
        remArr.push(h.remMin || 0);
        coreArr.push(h.coreMin || 0);
        labels.push(h.date ? h.date.slice(5) : "");
      }
    });
    if (deepArr.length < 2) return;

    var canvas = makeCanvas(parent, "hc-sleep", 220);

    var opts = chartDefaults();
    opts.plugins.title = { display: true, text: "Sen (min) \u2014 Deep / REM / Core", color: darkTheme.textColor, font: { size: 13 } };
    opts.scales.x.stacked = true;
    opts.scales.y.stacked = true;

    new Chart(canvas, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          { label: "Deep", data: deepArr, backgroundColor: colors.deep, borderRadius: 2 },
          { label: "REM", data: remArr, backgroundColor: colors.rem, borderRadius: 2 },
          { label: "Core", data: coreArr, backgroundColor: colors.core, borderRadius: 2 }
        ]
      },
      options: opts
    });
  }

  function renderReadinessChart(parent, hist) {
    if (typeof HealthScore === "undefined") return;
    var scores = [], bgColors = [], labels = [];
    hist.forEach(function(h) {
      var ss = HealthScore.sleepScore(h);
      if (ss) {
        scores.push(ss.score);
        bgColors.push(getScoreColor(ss.score));
        labels.push(h.date ? h.date.slice(5) : "");
      }
    });
    if (scores.length < 2) return;

    var canvas = makeCanvas(parent, "hc-readiness", 200);

    var opts = chartDefaults();
    opts.plugins.title = { display: true, text: "Sleep Score (trend)", color: darkTheme.textColor, font: { size: 13 } };
    opts.scales.y.min = 0;
    opts.scales.y.max = 100;

    new Chart(canvas, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [{
          label: "Sleep Score",
          data: scores,
          backgroundColor: bgColors,
          borderRadius: 4,
          barPercentage: 0.7
        }]
      },
      options: opts
    });
  }

  function render(containerId) {
    var c = document.getElementById(containerId);
    if (!c) return;
    if (typeof HealthImport === "undefined") {
      c.innerHTML = "<p style='color:#9ca3af;text-align:center;'>HealthImport not loaded</p>";
      return;
    }

    var hist = HealthImport.getHistory(30);
    if (hist.length < 2) {
      c.innerHTML = "<p style='color:#9ca3af;text-align:center;padding:20px;'>Za malo danych do wykresow (min. 2 dni)</p>";
      return;
    }

    var baselines = HealthImport.getBaselines();

    c.innerHTML = "";
    var title = document.createElement("h3");
    title.style.cssText = "color:#f9fafb;margin:0 0 8px;padding:0 4px;";
    title.textContent = "Health Charts (ostatnie 30 dni)";
    c.appendChild(title);

    renderHRVChart(c, hist);
    renderRHRChart(c, hist, baselines);
    renderSleepChart(c, hist);
    renderReadinessChart(c, hist);

    console.log(TAG, "Rendered", hist.length, "days of charts");
  }

  return { render: render };
})();

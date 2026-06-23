/* biomechanics-engine.js v1 — Sprint 22: GCT, Stride, VO tracking */
var BiomechanicsEngine = (function() {
  "use strict";

  function getAll() {
    if (typeof HealthImport === "undefined") return [];
    return HealthImport.getAll()
      .filter(function(e) { return e.gct > 0 || e.stride > 0 || e.vo > 0; })
      .map(function(e) {
        return {
          date: e.date,
          gct: e.gct || null,
          stride: e.stride || null,
          vo: e.vo || null,
          runningPower: e.runningPower || null
        };
      })
      .sort(function(a, b) { return a.date.localeCompare(b.date); });
  }

  function getTrend(days) {
    days = days || 30;
    var all = getAll();
    var todayD = new Date();
    var cutoff = new Date(todayD.getTime() - days * 86400000);
    var recent = all.filter(function(e) { return new Date(e.date) >= cutoff; });
    if (recent.length < 2) return null;

    function avg(arr) {
      var f = arr.filter(function(v) { return v > 0; });
      return f.length ? f.reduce(function(a,b){return a+b;}, 0) / f.length : 0;
    }

    var gcts = recent.map(function(e) { return e.gct; });
    var strides = recent.map(function(e) { return e.stride; });
    var vos = recent.map(function(e) { return e.vo; });

    return {
      gct: { avg: +avg(gcts).toFixed(0), n: gcts.filter(function(v){return v>0;}).length },
      stride: { avg: +avg(strides).toFixed(2), n: strides.filter(function(v){return v>0;}).length },
      vo: { avg: +avg(vos).toFixed(1), n: vos.filter(function(v){return v>0;}).length }
    };
  }

  function getFormScore() {
    var trend = getTrend(7);
    if (!trend) return null;

    // GCT score (lower = better)
    var gctScore = 0;
    if (trend.gct.avg > 0) {
      if (trend.gct.avg < 220) gctScore = 100;
      else if (trend.gct.avg < 240) gctScore = 85;
      else if (trend.gct.avg < 260) gctScore = 70;
      else if (trend.gct.avg < 280) gctScore = 55;
      else gctScore = 40;
    }

    // Stride score (longer = better for height ~1.75m)
    var strideScore = 0;
    if (trend.stride.avg > 0) {
      if (trend.stride.avg >= 1.4) strideScore = 100;
      else if (trend.stride.avg >= 1.3) strideScore = 85;
      else if (trend.stride.avg >= 1.2) strideScore = 70;
      else if (trend.stride.avg >= 1.1) strideScore = 55;
      else strideScore = 40;
    }

    // VO score (lower = better)
    var voScore = 0;
    if (trend.vo.avg > 0) {
      if (trend.vo.avg < 8) voScore = 100;
      else if (trend.vo.avg < 9.5) voScore = 85;
      else if (trend.vo.avg < 11) voScore = 70;
      else if (trend.vo.avg < 13) voScore = 55;
      else voScore = 40;
    }

    var totalScore = 0, count = 0;
    if (gctScore) { totalScore += gctScore; count++; }
    if (strideScore) { totalScore += strideScore; count++; }
    if (voScore) { totalScore += voScore; count++; }

    var formScore = count > 0 ? Math.round(totalScore / count) : 0;
    var label;
    if (formScore >= 85) label = "Excellent";
    else if (formScore >= 70) label = "Good";
    else if (formScore >= 55) label = "Average";
    else label = "Developing";

    return {
      form_score: formScore,
      label: label,
      components: {
        gct: { value: trend.gct.avg, score: gctScore },
        stride: { value: trend.stride.avg, score: strideScore },
        vo: { value: trend.vo.avg, score: voScore }
      }
    };
  }

  function compute() {
    return {
      current: getAll().slice(-1)[0] || null,
      trend_30d: getTrend(30),
      trend_7d: getTrend(7),
      form_score: getFormScore()
    };
  }

  return { compute: compute, getAll: getAll, getTrend: getTrend, getFormScore: getFormScore };
})();

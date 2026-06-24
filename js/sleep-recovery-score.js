
/* sleep-recovery-score.js v1 — Sprint 25: Sleep Recovery Score */
var SleepRecoveryScore = (function() {
  "use strict";

  function compute() {
    if (typeof HealthImport === "undefined") return null;
    var data = HealthImport.getAll().filter(function(d) { return d.sleepMin > 0; });
    if (!data.length) return null;

    var today = HealthImport.getLatest();
    if (!today || !today.sleepMin) return null;

    var totalMin = today.sleepMin;
    var deepMin = today.deepMin || 0;
    var remMin = today.remMin || 0;
    var coreMin = today.coreMin || 0;

    // 1. Total Sleep (30% wagi)
    var totalH = totalMin / 60;
    var totalScore;
    if (totalH >= 7.5) totalScore = 100;
    else if (totalH >= 7) totalScore = 85;
    else if (totalH >= 6.5) totalScore = 70;
    else if (totalH >= 6) totalScore = 50;
    else if (totalH >= 5) totalScore = 30;
    else totalScore = 15;

    // 2. Deep Sleep Ratio (25% wagi) — norm 15-25%
    var deepPct = (deepMin / totalMin) * 100;
    var deepScore;
    if (deepPct >= 18 && deepPct <= 25) deepScore = 100;
    else if (deepPct >= 15) deepScore = 80;
    else if (deepPct >= 12) deepScore = 60;
    else if (deepPct >= 10) deepScore = 40;
    else deepScore = 20;

    // 3. REM Ratio (25% wagi) — norm 20-25%
    var remPct = (remMin / totalMin) * 100;
    var remScore;
    if (remPct >= 20 && remPct <= 25) remScore = 100;
    else if (remPct >= 18 && remPct <= 28) remScore = 85;
    else if (remPct >= 15) remScore = 65;
    else if (remPct >= 12) remScore = 45;
    else remScore = 25;

    // 4. Consistency (20% wagi) — czy spał o podobnej porze
    var last7 = data.slice(-7).filter(function(d) { return d.sleepMin > 0; });
    var consistencyScore = 50; // default
    if (last7.length >= 4) {
      var avgSleep = last7.reduce(function(s, d) { return s + d.sleepMin; }, 0) / last7.length;
      var variance = last7.reduce(function(s, d) {
        return s + Math.pow(d.sleepMin - avgSleep, 2);
      }, 0) / last7.length;
      var stddev = Math.sqrt(variance) / 60; // do godzin
      
      if (stddev < 0.5) consistencyScore = 100;
      else if (stddev < 1) consistencyScore = 85;
      else if (stddev < 1.5) consistencyScore = 65;
      else if (stddev < 2) consistencyScore = 45;
      else consistencyScore = 25;
    }

    // Final score
    var finalScore = Math.round(
      totalScore * 0.30 +
      deepScore * 0.25 +
      remScore * 0.25 +
      consistencyScore * 0.20
    );

    var label;
    if (finalScore >= 85) label = "Excellent";
    else if (finalScore >= 70) label = "Good";
    else if (finalScore >= 55) label = "Moderate";
    else if (finalScore >= 40) label = "Poor";
    else label = "Critical";

    // Trend (7d avg)
    var recent7 = data.slice(-7).filter(function(d) { return d.sleepMin > 0; });
    var avgScore7d = null;
    if (recent7.length >= 3) {
      var scores = recent7.map(function(d) {
        var tH = d.sleepMin / 60;
        var s = tH >= 7.5 ? 100 : tH >= 7 ? 85 : tH >= 6 ? 70 : 50;
        return s;
      });
      avgScore7d = Math.round(scores.reduce(function(a,b){return a+b;}, 0) / scores.length);
    }

    return {
      score: finalScore,
      label: label,
      components: {
        total: { value_h: +totalH.toFixed(1), score: totalScore },
        deep: { value_min: deepMin, ratio_pct: +deepPct.toFixed(1), score: deepScore },
        rem: { value_min: remMin, ratio_pct: +remPct.toFixed(1), score: remScore },
        consistency: { score: consistencyScore }
      },
      avg_7d: avgScore7d,
      insights: generateInsights(deepPct, remPct, totalH, consistencyScore)
    };
  }

  function generateInsights(deepPct, remPct, totalH, consistencyScore) {
    var insights = [];
    if (deepPct < 15) {
      insights.push({ type: "warning", message: "Deep sleep " + deepPct.toFixed(0) + "% poniżej normy 15-25% — możliwa niska regeneracja fizyczna" });
    }
    if (remPct < 18) {
      insights.push({ type: "warning", message: "REM " + remPct.toFixed(0) + "% poniżej normy — może wpłynąć na regenerację mentalną" });
    }
    if (totalH < 6.5) {
      insights.push({ type: "danger", message: "Sen " + totalH.toFixed(1) + "h — krytycznie krótki" });
    }
    if (consistencyScore < 50) {
      insights.push({ type: "info", message: "Niespójność rytmu snu — postaraj się chodzić spać o podobnej porze" });
    }
    if (deepPct >= 18 && remPct >= 20 && totalH >= 7) {
      insights.push({ type: "positive", message: "Świetna jakość snu — pełna regeneracja" });
    }
    return insights;
  }

  return { compute: compute };
})();


/* health-score.js v3 — MERGED: readiness + sleepScore */
const HealthScore = (() => {

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  /* ═══════════════════════════════════════
     READINESS SCORING (new API)
     ═══════════════════════════════════════ */
  function scoreSleep(e, b) {
    if (!e.sleepMin || !b.sleepMin) return 0;
    return clamp(Math.round(e.sleepMin / b.sleepMin * 100), 0, 120);
  }

  function scoreHRV(e, b) {
    if (!e.hrv || !b.hrv) return 0;
    return clamp(Math.round(e.hrv / b.hrv * 100), 0, 120);
  }

  function scoreRHR(e, b) {
    if (!e.rhr || !b.rhr) return 0;
    const d = e.rhr - b.rhr;
    if (d <= 0) return 100;
    if (d >= 10) return 20;
    return clamp(100 - d * 8, 20, 100);
  }

  function calculate() {
    if (typeof HealthImport === 'undefined') return { score: 0, level: 'unknown' };
    const entry = HealthImport.getToday();
    if (!entry) return { score: 0, level: 'no-data' };
    const base = HealthImport.getBaselines();
    const ss = scoreSleep(entry, base);
    const sh = scoreHRV(entry, base);
    const sr = scoreRHR(entry, base);
    const score = Math.round(ss * 0.4 + sh * 0.4 + sr * 0.2);
    let level = 'low';
    if (score >= 85) level = 'excellent';
    else if (score >= 70) level = 'good';
    else if (score >= 50) level = 'moderate';
    return { score, level, details: { sSleep: ss, sHRV: sh, sRHR: sr } };
  }

  function calcReadiness() {
    return calculate();
  }

  function getReadiness() {
    return calculate();
  }

  /* ═══════════════════════════════════════
     SLEEP SCORE (legacy API for health-history.js)
     ═══════════════════════════════════════ */
  function sleepScore(entry) {
    if (!entry) return null;
    var factors = [];
    var missing = [];
    var total = 0, maxTotal = 0;

    // Duration (max 30)
    if (entry.sleepMin && entry.sleepMin > 0) {
      var durPts = clamp(Math.round(entry.sleepMin / 480 * 30), 0, 30);
      factors.push({ name: 'Duration', val: (entry.sleepMin / 60).toFixed(1) + 'h', pts: durPts, max: 30 });
      total += durPts; maxTotal += 30;
    } else { missing.push('Sleep duration'); maxTotal += 30; }

    // Deep (max 25)
    if (entry.deepMin && entry.deepMin > 0) {
      var deepPts = clamp(Math.round(entry.deepMin / 90 * 25), 0, 25);
      factors.push({ name: 'Deep sleep', val: entry.deepMin + 'm', pts: deepPts, max: 25 });
      total += deepPts; maxTotal += 25;
    } else { missing.push('Deep sleep'); maxTotal += 25; }

    // REM (max 25)
    if (entry.remMin && entry.remMin > 0) {
      var remPts = clamp(Math.round(entry.remMin / 120 * 25), 0, 25);
      factors.push({ name: 'REM sleep', val: entry.remMin + 'm', pts: remPts, max: 25 });
      total += remPts; maxTotal += 25;
    } else { missing.push('REM sleep'); maxTotal += 25; }

    // RHR (max 10)
    if (entry.rhr && entry.rhr > 0) {
      var rhrPts = entry.rhr <= 50 ? 10 : entry.rhr <= 55 ? 8 : entry.rhr <= 60 ? 6 : entry.rhr <= 65 ? 4 : 2;
      factors.push({ name: 'RHR', val: entry.rhr + ' bpm', pts: rhrPts, max: 10 });
      total += rhrPts; maxTotal += 10;
    } else { missing.push('Resting HR'); maxTotal += 10; }

    // HRV (max 10)
    if (entry.hrv && entry.hrv > 0) {
      var hrvPts = entry.hrv >= 60 ? 10 : entry.hrv >= 45 ? 8 : entry.hrv >= 30 ? 6 : entry.hrv >= 20 ? 4 : 2;
      factors.push({ name: 'HRV', val: entry.hrv + ' ms', pts: hrvPts, max: 10 });
      total += hrvPts; maxTotal += 10;
    } else { missing.push('HRV'); maxTotal += 10; }

    var score = maxTotal > 0 ? Math.round(total / maxTotal * 100) : 0;
    var label = score >= 85 ? 'Swietny sen' : score >= 70 ? 'Dobry sen' : score >= 50 ? 'Przecietny sen' : 'Slaby sen';

    return { score: score, label: label, factors: factors, missing: missing };
  }

  function getTodaySleepScore() {
    if (typeof HealthImport === 'undefined') return null;
    var entry = HealthImport.getToday();
    return entry ? sleepScore(entry) : null;
  }

  /* ═══════════════════════════════════════
     PUBLIC API — all functions exposed
     ═══════════════════════════════════════ */
  return {
    calculate: calculate,
    calcReadiness: calcReadiness,
    getReadiness: getReadiness,
    sleepScore: sleepScore,
    getTodaySleepScore: getTodaySleepScore
  };

})();

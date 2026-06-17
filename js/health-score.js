/* health-score.js v2 — readiness scoring */
const HealthScore = (() => {
  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

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

  function getReadiness() {
    return calculate();
  }

  return { calculate, getReadiness };
})();

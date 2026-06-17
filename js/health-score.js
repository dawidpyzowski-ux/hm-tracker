
/* health-score.js v2 — readiness scoring */

const HealthScore = (() => {

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function scoreSleep(entry, base) {
    if (!entry.sleepMin || !base.sleepMin) return 0;

    const ratio = entry.sleepMin / base.sleepMin;
    return clamp(Math.round(ratio * 100), 0, 120);
  }

  function scoreHRV(entry, base) {
    if (!entry.hrv || !base.hrv) return 0;

    const ratio = entry.hrv / base.hrv;
    return clamp(Math.round(ratio * 100), 0, 120);
  }

  function scoreRHR(entry, base) {
    if (!entry.rhr || !base.rhr) return 0;

    const diff = entry.rhr - base.rhr;

    if (diff <= 0) return 100;
    if (diff >= 10) return 20;

    return clamp(100 - diff * 8, 20, 100);
  }

  function calculate() {
    if (typeof HealthImport === 'undefined') return { score: 0, level: 'unknown' };

    const entry = HealthImport.getToday();
    if (!entry) return { score: 0, level: 'no-data' };

    const base = HealthImport.getBaselines();

    const sSleep = scoreSleep(entry, base);
    const sHRV   = scoreHRV(entry, base);
    const sRHR   = scoreRHR(entry, base);

    const score = Math.round(
      sSleep * 0.4 +
      sHRV   * 0.4 +
      sRHR   * 0.2
    );

    let level = 'low';
    if (score >= 85) level = 'excellent';
    else if (score >= 70) level = 'good';
    else if (score >= 50) level = 'moderate';

    return {
      score,
      level,
      details: { sSleep, sHRV, sRHR }
    };
  }

  function getReadiness() {
    return calculate();
  }

  return { calculate, getReadiness };

})();

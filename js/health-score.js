
/* health-score.js v4 — FINAL MERGED: readiness + sleepScore + full format for coach-patch */
const HealthScore = (() => {

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  /* ═══════════════════════════════════════
     READINESS SCORING
     ═══════════════════════════════════════ */
  function calculate() {
    if (typeof HealthImport === 'undefined') return null;
    const entry = HealthImport.getToday();
    if (!entry) return null;
    const base = HealthImport.getBaselines();

    var factors = [];
    var warnings = [];
    var total = 0, maxTotal = 0;

    // Sleep (weight 25)
    if (entry.sleepMin && base.sleepMin) {
      var ratio = entry.sleepMin / base.sleepMin;
      var pts = clamp(Math.round(ratio * 25), 0, 30);
      factors.push({ name: 'Sen', val: (entry.sleepMin / 60).toFixed(1) + 'h', pts: pts, max: 25 });
      total += pts; maxTotal += 25;
      if (ratio < 0.75) warnings.push('Sen znacznie ponizej normy (' + (entry.sleepMin / 60).toFixed(1) + 'h vs ' + (base.sleepMin / 60).toFixed(1) + 'h)');
    } else { maxTotal += 25; }

    // Deep (weight 15)
    if (entry.deepMin && base.deepMin) {
      var dr = entry.deepMin / base.deepMin;
      var dp = clamp(Math.round(dr * 15), 0, 20);
      factors.push({ name: 'Deep sleep', val: entry.deepMin + 'm', pts: dp, max: 15 });
      total += dp; maxTotal += 15;
      if (dr < 0.6) warnings.push('Bardzo malo snu glębokiego (' + entry.deepMin + 'm)');
    } else { maxTotal += 15; }

    // REM (weight 10)
    if (entry.remMin && base.remMin) {
      var rr = entry.remMin / base.remMin;
      var rp = clamp(Math.round(rr * 10), 0, 15);
      factors.push({ name: 'REM', val: entry.remMin + 'm', pts: rp, max: 10 });
      total += rp; maxTotal += 10;
    } else { maxTotal += 10; }

    // HRV (weight 30)
    if (entry.hrv && base.hrv) {
      var hr = entry.hrv / base.hrv;
      var hp = clamp(Math.round(hr * 30), 0, 35);
      factors.push({ name: 'HRV', val: entry.hrv + ' ms', pts: hp, max: 30 });
      total += hp; maxTotal += 30;
      if (hr < 0.7) warnings.push('HRV znacznie ponizej baseline (' + entry.hrv + ' vs ' + base.hrv + ' ms)');
    } else { maxTotal += 30; }

    // RHR (weight 20)
    if (entry.rhr && base.rhr) {
      var diff = entry.rhr - base.rhr;
      var rhrPts;
      if (diff <= 0) rhrPts = 20;
      else if (diff >= 10) rhrPts = 4;
      else rhrPts = clamp(20 - Math.round(diff * 1.6), 4, 20);
      factors.push({ name: 'RHR', val: entry.rhr + ' bpm', pts: rhrPts, max: 20 });
      total += rhrPts; maxTotal += 20;
      if (diff >= 5) warnings.push('RHR podwyzszone (' + entry.rhr + ' vs baseline ' + base.rhr + ' bpm)');
    } else { maxTotal += 20; }

    var score = maxTotal > 0 ? Math.round(total / maxTotal * 100) : 0;

    var level, recommendation;
    if (score >= 85) {
      level = 'excellent';
      recommendation = 'Pelna gotowosc — mozesz trenowac intensywnie!';
    } else if (score >= 70) {
      level = 'good';
      recommendation = 'Dobra forma — trening umiarkowany do intensywnego.';
    } else if (score >= 50) {
      level = 'moderate';
      recommendation = 'Przecietna gotowosc — rozważ lżejszy trening.';
    } else if (score >= 30) {
      level = 'low';
      recommendation = 'Niska gotowosc — priorytet regeneracja, lekki trening.';
    } else {
      level = 'critical';
      recommendation = 'Bardzo niska gotowosc — odpoczynek lub dzien wolny.';
    }

    return {
      score: score,
      level: level,
      recommendation: recommendation,
      factors: factors,
      warnings: warnings,
      details: {
        sSleep: factors.find(f => f.name === 'Sen'),
        sHRV: factors.find(f => f.name === 'HRV'),
        sRHR: factors.find(f => f.name === 'RHR')
      }
    };
  }

  function calcReadiness() { return calculate(); }
  function getReadiness() { return calculate(); }

  /* ═══════════════════════════════════════
     SLEEP SCORE (for health-history.js)
     ═══════════════════════════════════════ */
  function sleepScore(entry) {
    if (!entry) return null;
    var factors = [];
    var missing = [];
    var total = 0, maxTotal = 0;

    if (entry.sleepMin && entry.sleepMin > 0) {
      var durPts = clamp(Math.round(entry.sleepMin / 480 * 30), 0, 30);
      factors.push({ name: 'Duration', val: (entry.sleepMin / 60).toFixed(1) + 'h', pts: durPts, max: 30 });
      total += durPts; maxTotal += 30;
    } else { missing.push('Sleep duration'); maxTotal += 30; }

    if (entry.deepMin && entry.deepMin > 0) {
      var deepPts = clamp(Math.round(entry.deepMin / 90 * 25), 0, 25);
      factors.push({ name: 'Deep sleep', val: entry.deepMin + 'm', pts: deepPts, max: 25 });
      total += deepPts; maxTotal += 25;
    } else { missing.push('Deep sleep'); maxTotal += 25; }

    if (entry.remMin && entry.remMin > 0) {
      var remPts = clamp(Math.round(entry.remMin / 120 * 25), 0, 25);
      factors.push({ name: 'REM sleep', val: entry.remMin + 'm', pts: remPts, max: 25 });
      total += remPts; maxTotal += 25;
    } else { missing.push('REM sleep'); maxTotal += 25; }

    if (entry.rhr && entry.rhr > 0) {
      var rhrPts = entry.rhr <= 50 ? 10 : entry.rhr <= 55 ? 8 : entry.rhr <= 60 ? 6 : entry.rhr <= 65 ? 4 : 2;
      factors.push({ name: 'RHR', val: entry.rhr + ' bpm', pts: rhrPts, max: 10 });
      total += rhrPts; maxTotal += 10;
    } else { missing.push('Resting HR'); maxTotal += 10; }

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
     PUBLIC API
     ═══════════════════════════════════════ */
  return {
    calculate: calculate,
    calcReadiness: calcReadiness,
    getReadiness: getReadiness,
    sleepScore: sleepScore,
    getTodaySleepScore: getTodaySleepScore
  };

})();

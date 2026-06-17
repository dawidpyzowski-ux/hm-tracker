/* health-import.js v3 — HM Tracker Sprint 13+
   Matched to iOS Shortcut "HM Health" URL params:
   ?health=1&date=YYYY-MM-DD&sleep=MIN&deep=MIN&rem=MIN&core=MIN&rhr=BPM&hrv=raw,list
*/
const HealthImport = (() => {
  const STORE_KEY = 'health_data';

  function parseNum(v) {
    const n = parseFloat(v);
    return isNaN(n) ? 0 : n;
  }

  function parseList(v) {
    if (!v) return [];
    return v.split(',').map(Number).filter(n => !isNaN(n) && n > 0);
  }

  function avg(arr) {
    if (!arr.length) return 0;
    return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
  }

  function init() {
    const p = new URLSearchParams(window.location.search);
    if (p.get('health') !== '1') return null;
    const date = p.get('date');
    if (!date) return null;

    const deepMin  = Math.round(parseNum(p.get('deep')));
    const remMin   = Math.round(parseNum(p.get('rem')));
    const coreMin  = Math.round(parseNum(p.get('core')));
    const sleepMin = p.has('sleep')
      ? Math.round(parseNum(p.get('sleep')))
      : (deepMin + remMin + coreMin);

    const hrvRaw = parseList(p.get('hrv'));
    const hrv    = avg(hrvRaw);

    const rhr = Math.round(parseNum(p.get('rhr')));

    const energy   = parseInt(p.get('energy'))   || 0;
    const soreness = parseInt(p.get('soreness')) || 0;

    const entry = {
      date, sleepMin, deepMin, remMin, coreMin,
      rhr, hrv, hrvRaw,
      energy, soreness,
      ts: Date.now()
    };

    save(entry);
    console.log('[Health] Saved', date, entry);
    return entry;
  }

  function save(entry) {
    const all = getAll();
    const idx = all.findIndex(e => e.date === entry.date);
    if (idx >= 0) all[idx] = entry; else all.push(entry);
    all.sort((a, b) => a.date.localeCompare(b.date));
    localStorage.setItem(STORE_KEY, JSON.stringify(all));
  }

  function getAll() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; }
    catch { return []; }
  }

  function getByDate(d) {
    return getAll().find(e => e.date === d) || null;
  }

  function getToday() {
    return getByDate(new Date().toISOString().slice(0, 10));
  }

  function getLatest() {
    const all = getAll();
    return all.length ? all[all.length - 1] : null;
  }

  return { init, getAll, getByDate, getToday, getLatest };
})();

HealthImport.init();

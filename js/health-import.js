
/* health-import.js v5 — HM Tracker Sprint 14: auto-sync */
const HealthImport = (() => {
  const STORE_KEY = 'health_data';


function parseNum(v) {
  if (v === null || v === undefined || v === '') return 0;
  // Konwersja PL locale (74,2 → 74.2)
  const normalized = String(v).replace(',', '.');
  const n = parseFloat(normalized);
  return isNaN(n) ? 0 : n;
}



function parseList(v) {
  if (!v) return [];
  // HRV format: "72.54,30.15,55.72" (kropki dziesiętne, przecinki separator)
  return v.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n) && n > 0);
}


  function avg(arr) {
    if (!arr.length) return 0;
    return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
  }

  function localDateStr() {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString().slice(0, 10);
  }


function init() {
    const p = new URLSearchParams(window.location.search);
    if (p.get('health') !== '1') return null;
    const date = p.get('date');
    
    // Strict validation: only YYYY-MM-DD format
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      console.warn('[HealthImport] Invalid date, ignoring:', date);
      return null;
    }


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

  

// === SPRINT 22: nowe metryki (z obsługą PL locale "74,2" → 74.2) ===
function parseOptional(rawValue) {
  if (rawValue === null || rawValue === undefined || rawValue === '') return null;
  const normalized = String(rawValue).replace(',', '.');
  const n = parseFloat(normalized);
  return isNaN(n) || n === 0 ? null : n;
}

const wristTemp = parseOptional(p.get('wristTemp'));
const respRate = parseOptional(p.get('respRate'));
const weight = parseOptional(p.get('weight'));
const bodyFat = parseOptional(p.get('bodyFat'));
const runningPower = parseOptional(p.get('runningPower'));
const gct = parseOptional(p.get('gct'));
const stride = parseOptional(p.get('stride'));
const vo = parseOptional(p.get('vo'));


    // === SPRINT 25: nowe metryki Apple Health ===
    function parseOptional2(rawValue) {
      if (rawValue === null || rawValue === undefined || rawValue === '') return null;
      var normalized = String(rawValue).replace(',', '.');
      var n = parseFloat(normalized);
      return isNaN(n) || n === 0 ? null : n;
    }
    
    const cardioRecovery = parseOptional2(p.get('cardioRecovery'));
    const vo2maxApple = parseOptional2(p.get('vo2maxApple'));
    const steps = parseOptional2(p.get('steps'));
    const walkingHR = parseOptional2(p.get('walkingHR'));
    const spo2 = parseOptional2(p.get('spo2'));


const entry = {
  date, sleepMin, deepMin, remMin, coreMin,
  rhr, hrv, hrvRaw, energy, soreness,
  wristTemp, respRate, weight, bodyFat,
  runningPower, gct, stride, vo,
  // Sprint 25 additions
  cardioRecovery, vo2maxApple, steps, walkingHR, spo2,
  ts: Date.now()
};



    save(entry);
    console.log('[Health] Saved', date, entry);

    // 🔥 AUTO-PUSH do chmury
    if (typeof HealthSync !== 'undefined') {
      HealthSync.push().then(ok => {
        console.log('[Health] Auto-push:', ok ? '✅' : '❌');
      });
    }

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
    return getByDate(localDateStr());
  }

  function getLatest() {
    const all = getAll();
    return all.length ? all[all.length - 1] : null;
  }

  function getHistory(days) {
    const all = getAll();
    if (!days) return all;
    const now = new Date();
    const cutoff = new Date(now.getTime() - days * 86400000)
      .toISOString().slice(0, 10);
    return all.filter(e => e.date >= cutoff);
  }

  function getBaselines() {
    const all = getAll();
    if (!all.length) {
      return { sleepMin: 420, deepMin: 60, remMin: 90, coreMin: 270, rhr: 55, hrv: 40 };
    }
    const a = (key) => {
      const vals = all.map(e => e[key] || 0).filter(v => v > 0);
      return vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : 0;
    };
    return {
      sleepMin: a('sleepMin'), deepMin: a('deepMin'),
      remMin: a('remMin'), coreMin: a('coreMin'),
      rhr: a('rhr'), hrv: a('hrv')
    };
  }

  function renderForm(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = `
      <div class="health-checkin" style="padding:12px;border-radius:12px;background:var(--card-bg,#1e1e1e);margin-bottom:12px;">
        <h3 style="margin:0 0 8px">\u{1FA7A} Health Check-in</h3>
        <p style="font-size:0.85em;opacity:0.7;margin:0 0 10px">No data from Apple Health today. Enter manually:</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <label style="font-size:0.85em">Sleep (min)<input type="number" id="hf-sleep" style="width:100%;padding:6px;border-radius:8px;border:1px solid #444;background:#111;color:#fff"></label>
          <label style="font-size:0.85em">Deep (min)<input type="number" id="hf-deep" style="width:100%;padding:6px;border-radius:8px;border:1px solid #444;background:#111;color:#fff"></label>
          <label style="font-size:0.85em">REM (min)<input type="number" id="hf-rem" style="width:100%;padding:6px;border-radius:8px;border:1px solid #444;background:#111;color:#fff"></label>
          <label style="font-size:0.85em">Core (min)<input type="number" id="hf-core" style="width:100%;padding:6px;border-radius:8px;border:1px solid #444;background:#111;color:#fff"></label>
          <label style="font-size:0.85em">RHR (bpm)<input type="number" id="hf-rhr" style="width:100%;padding:6px;border-radius:8px;border:1px solid #444;background:#111;color:#fff"></label>
          <label style="font-size:0.85em">HRV (ms)<input type="number" id="hf-hrv" style="width:100%;padding:6px;border-radius:8px;border:1px solid #444;background:#111;color:#fff"></label>
          <label style="font-size:0.85em">Energy (1-5)<input type="number" id="hf-energy" min="1" max="5" style="width:100%;padding:6px;border-radius:8px;border:1px solid #444;background:#111;color:#fff"></label>
          <label style="font-size:0.85em">Soreness (1-5)<input type="number" id="hf-sore" min="1" max="5" style="width:100%;padding:6px;border-radius:8px;border:1px solid #444;background:#111;color:#fff"></label>
        </div>
        <button onclick="HealthImport.saveForm()" style="margin-top:10px;width:100%;padding:10px;border:none;border-radius:8px;background:#4CAF50;color:#fff;font-weight:bold;cursor:pointer">Save Check-in</button>
      </div>`;
  }

  function saveForm() {
    const g = id => parseInt(document.getElementById(id)?.value) || 0;
    const entry = {
      date: localDateStr(),
      sleepMin: g('hf-sleep'), deepMin: g('hf-deep'),
      remMin: g('hf-rem'), coreMin: g('hf-core'),
      rhr: g('hf-rhr'), hrv: g('hf-hrv'), hrvRaw: [],
      energy: g('hf-energy'), soreness: g('hf-sore'),
      ts: Date.now()
    };
    save(entry);
    console.log('[Health] Manual save', entry);

    // 🔥 AUTO-PUSH po manual save
    if (typeof HealthSync !== 'undefined') {
      HealthSync.push();
    }

    location.reload();
  }

  return { init, getAll, getByDate, getToday, getLatest, getHistory, getBaselines, renderForm, saveForm };
})();

HealthImport.init();

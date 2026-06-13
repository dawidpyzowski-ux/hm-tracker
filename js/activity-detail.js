/**
 * HM Tracker PWA – activity-detail.js  (Sprint 7)
 * -----------------------------------------------
 * Features:
 *   1. HR chart with zone coloring
 *   2. Km splits table
 *   3. HR zones distribution
 *   4. NEW – Running Power estimation
 *   5. NEW – GAP (Grade Adjusted Pace)
 *   6. NEW – Laps / segment table with full metrics
 *
 * Dependencies: Chart.js (loaded in index.html)
 */

// --------------- Chart Registry (prevent canvas-reuse errors) ---------------
const DetailChartRegistry = {};

function destroyDetailChart(key) {
  if (DetailChartRegistry[key]) {
    DetailChartRegistry[key].destroy();
    delete DetailChartRegistry[key];
  }
}

function destroyAllDetailCharts() {
  Object.keys(DetailChartRegistry).forEach(destroyDetailChart);
}

// --------------- Constants / Config ---------------
const GRAVITY   = 9.81;
const AIR_RHO   = 1.225;   // kg/m³
const CD        = 0.9;     // drag coefficient
const FRONTAL_A = 0.5;     // m²  frontal area
const CR        = 0.01;    // rolling resistance coefficient

function getUserWeight() {
  const w = parseFloat(localStorage.getItem('hm_user_weight'));
  return (w && w > 0) ? w : 75;  // default 75 kg
}

// --------------- HR Zones (uses max HR from settings or 190) ---------------
function getMaxHR() {
  const m = parseInt(localStorage.getItem('hm_user_max_hr'), 10);
  return (m && m > 100) ? m : 190;
}

function getHRZones() {
  const max = getMaxHR();
  return [
    { name: 'Z1 Recovery',  min: 0,             max: 0.60 * max, color: 'rgba(150,150,150,0.35)' },
    { name: 'Z2 Easy',      min: 0.60 * max,    max: 0.70 * max, color: 'rgba(86,180,233,0.35)' },
    { name: 'Z3 Aerobic',   min: 0.70 * max,    max: 0.80 * max, color: 'rgba(0,158,115,0.35)' },
    { name: 'Z4 Threshold', min: 0.80 * max,    max: 0.90 * max, color: 'rgba(240,228,66,0.35)' },
    { name: 'Z5 Max',       min: 0.90 * max,    max: 1.00 * max, color: 'rgba(213,94,0,0.35)' },
  ];
}

// --------------- Utility helpers ---------------
function formatPace(speedMs) {
  // speed in m/s → min:sec per km
  if (!speedMs || speedMs <= 0) return '--:--';
  const secPerKm = 1000 / speedMs;
  const mins = Math.floor(secPerKm / 60);
  const secs = Math.round(secPerKm % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatTime(seconds) {
  if (!seconds || seconds <= 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// --------------- Running Power Model ---------------
/**
 * P = m*g*v*(sin θ + Cr*cos θ) + 0.5*ρ*Cd*A*v³ + m*a*v
 *
 * @param {number} v      – speed (m/s)
 * @param {number} grade  – gradient (fraction, e.g. 0.05 = 5 %)
 * @param {number} accel  – instantaneous acceleration (m/s²)
 * @param {number} mass   – runner mass (kg)
 * @returns {number}        power in watts (≥0)
 */
function calcRunningPower(v, grade, accel, mass) {
  const theta = Math.atan(grade);
  const gravityComponent = mass * GRAVITY * v * (Math.sin(theta) + CR * Math.cos(theta));
  const airResistance    = 0.5 * AIR_RHO * CD * FRONTAL_A * Math.pow(v, 3);
  const kineticCost      = mass * accel * v;
  return Math.max(0, gravityComponent + airResistance + kineticCost);
}

/**
 * Compute power stream from activity streams.
 * Returns array of power values aligned with the time stream.
 */
function computePowerStream(activity) {
  const streams = activity.streams || {};
  const vel  = streams.velocity_smooth?.data;
  const alt  = streams.altitude?.data;
  const time = streams.time?.data;
  const dist = streams.distance?.data;
  if (!vel || !alt || !time || vel.length < 3) return null;

  const mass = getUserWeight();
  const n = vel.length;
  const power = new Array(n).fill(0);

  for (let i = 1; i < n - 1; i++) {
    // gradient from altitude & distance
    const dd = (dist ? dist[i + 1] - dist[i - 1] : vel[i] * (time[i + 1] - time[i - 1])) || 1;
    const grade = (alt[i + 1] - alt[i - 1]) / Math.max(dd, 0.1);

    // acceleration
    const dt = (time[i + 1] - time[i - 1]) || 1;
    const accel = (vel[i + 1] - vel[i - 1]) / dt;

    power[i] = calcRunningPower(vel[i], grade, accel, mass);
  }
  // edge values
  power[0]     = power[1];
  power[n - 1] = power[n - 2];
  return power;
}

/**
 * Normalized Power (rolling 30-s average raised to 4th power, then root).
 */
function calcNormalizedPower(powerStream, timeStream) {
  if (!powerStream || powerStream.length < 30) return null;
  // build 30-s rolling average
  const rolling = [];
  let windowStart = 0;
  let windowSum   = 0;
  let windowCount = 0;
  for (let i = 0; i < powerStream.length; i++) {
    windowSum += powerStream[i];
    windowCount++;
    while (timeStream && timeStream[i] - timeStream[windowStart] > 30) {
      windowSum -= powerStream[windowStart];
      windowCount--;
      windowStart++;
    }
    if (windowCount > 0) rolling.push(windowSum / windowCount);
  }
  if (rolling.length === 0) return null;
  const avg4 = rolling.reduce((s, p) => s + Math.pow(p, 4), 0) / rolling.length;
  return Math.pow(avg4, 0.25);
}

// --------------- GAP (Grade Adjusted Pace) ---------------
/**
 * Minetti cost of transport as a function of gradient (fraction).
 * C(i) = 155.4i⁵ − 30.4i⁴ − 43.3i³ + 46.3i² + 19.5i + 3.6
 */
function minettiCost(grade) {
  const i = grade;
  return 155.4*Math.pow(i,5) - 30.4*Math.pow(i,4) - 43.3*Math.pow(i,3)
       + 46.3*Math.pow(i,2) + 19.5*i + 3.6;
}

/**
 * GAP speed = speed × (costAtGrade / costAtFlat)
 * Returns the equivalent flat speed for a given actual speed & grade.
 */
function gapSpeed(actualSpeed, grade) {
  const costFlat  = minettiCost(0);      // ~ 3.6 J/kg/m
  const costGrade = minettiCost(grade);
  if (costFlat <= 0 || costGrade <= 0) return actualSpeed;
  return actualSpeed * (costGrade / costFlat);
}

/**
 * Compute per-point GAP speed stream.
 */
function computeGAPStream(activity) {
  const streams = activity.streams || {};
  const vel  = streams.velocity_smooth?.data;
  const alt  = streams.altitude?.data;
  const dist = streams.distance?.data;
  const time = streams.time?.data;
  if (!vel || !alt || vel.length < 3) return null;

  const n = vel.length;
  const gapArr = new Array(n).fill(0);
  for (let i = 1; i < n - 1; i++) {
    const dd = (dist ? dist[i+1] - dist[i-1] : vel[i] * (time[i+1] - time[i-1])) || 1;
    const grade = (alt[i+1] - alt[i-1]) / Math.max(dd, 0.1);
    gapArr[i] = gapSpeed(vel[i], grade);
  }
  gapArr[0]     = gapArr[1];
  gapArr[n - 1] = gapArr[n - 2];
  return gapArr;
}

// --------------- Laps / Splits builder ---------------
/**
 * Build lap objects from splits_metric (Strava), or fallback to per-km from streams.
 * Each lap: { index, distance, time, pace, gap, avgHR, avgPower, elevGain, elevLoss }
 */
function buildLaps(activity, powerStream, gapStream) {
  const laps = [];
  const splits = activity.splits_metric;
  const streams = activity.streams || {};

  if (splits && splits.length > 0) {
    // Use Strava splits_metric
    const hrData   = streams.heartrate?.data;
    const altData  = streams.altitude?.data;
    const distData = streams.distance?.data;
    const timeData = streams.time?.data;

    splits.forEach((sp, idx) => {
      const avgSpeed = sp.average_speed || (sp.distance / sp.moving_time);
      const gapSpd   = sp.average_grade_adjusted_speed || avgSpeed;

      // compute elevation gain/loss, avgHR, avgPower from streams if available
      let elevGain = 0, elevLoss = 0, hrSum = 0, hrCount = 0, pwrSum = 0, pwrCount = 0;
      if (distData && timeData) {
        const lapStart = (idx === 0) ? 0 : splits.slice(0, idx).reduce((s, l) => s + l.distance, 0);
        const lapEnd   = lapStart + sp.distance;
        for (let j = 0; j < distData.length; j++) {
          if (distData[j] >= lapStart && distData[j] <= lapEnd) {
            if (hrData && hrData[j]) { hrSum += hrData[j]; hrCount++; }
            if (powerStream && powerStream[j]) { pwrSum += powerStream[j]; pwrCount++; }
            if (altData && j > 0 && distData[j-1] >= lapStart) {
              const dAlt = altData[j] - altData[j-1];
              if (dAlt > 0) elevGain += dAlt; else elevLoss += Math.abs(dAlt);
            }
          }
        }
      }

      laps.push({
        index:    idx + 1,
        distance: sp.distance,
        time:     sp.moving_time,
        pace:     formatPace(avgSpeed),
        gap:      formatPace(gapSpd),
        avgHR:    hrCount > 0 ? Math.round(hrSum / hrCount) : (sp.average_heartrate || '--'),
        avgPower: pwrCount > 0 ? Math.round(pwrSum / pwrCount) : '--',
        elevGain: Math.round(elevGain),
        elevLoss: Math.round(elevLoss),
        paceSecKm: avgSpeed > 0 ? 1000 / avgSpeed : 9999,
        gapSecKm:  gapSpd > 0 ? 1000 / gapSpd : 9999,
      });
    });
  } else {
    // Fallback: generate per-km laps from distance stream
    const distData = streams.distance?.data;
    const timeData = streams.time?.data;
    const velData  = streams.velocity_smooth?.data;
    const hrData   = streams.heartrate?.data;
    const altData  = streams.altitude?.data;
    if (!distData || !timeData) return laps;

    let lapIdx = 1;
    let lapStartI = 0;
    const totalDist = distData[distData.length - 1];
    while (lapIdx * 1000 <= totalDist + 500) {
      const lapStartDist = (lapIdx - 1) * 1000;
      const lapEndDist   = Math.min(lapIdx * 1000, totalDist);
      let endI = distData.findIndex(d => d >= lapEndDist);
      if (endI < 0) endI = distData.length - 1;

      let hrSum = 0, hrC = 0, pwrSum = 0, pwrC = 0, gapSum = 0, gapC = 0;
      let elevG = 0, elevL = 0;
      for (let j = lapStartI; j <= endI; j++) {
        if (hrData && hrData[j])          { hrSum  += hrData[j]; hrC++; }
        if (powerStream && powerStream[j]){ pwrSum += powerStream[j]; pwrC++; }
        if (gapStream && gapStream[j])    { gapSum += gapStream[j]; gapC++; }
        if (altData && j > lapStartI) {
          const dA = altData[j] - altData[j-1];
          if (dA > 0) elevG += dA; else elevL += Math.abs(dA);
        }
      }

      const dist = distData[endI] - distData[lapStartI];
      const time = timeData[endI] - timeData[lapStartI];
      const avgSpd = dist / (time || 1);
      const avgGap = gapC > 0 ? gapSum / gapC : avgSpd;

      laps.push({
        index: lapIdx,
        distance: Math.round(dist),
        time: time,
        pace: formatPace(avgSpd),
        gap:  formatPace(avgGap),
        avgHR:    hrC  > 0 ? Math.round(hrSum  / hrC)  : '--',
        avgPower: pwrC > 0 ? Math.round(pwrSum / pwrC) : '--',
        elevGain: Math.round(elevG),
        elevLoss: Math.round(elevL),
        paceSecKm: avgSpd > 0 ? 1000 / avgSpd : 9999,
        gapSecKm:  avgGap > 0 ? 1000 / avgGap : 9999,
      });

      lapStartI = endI;
      lapIdx++;
    }
  }
  return laps;
}

// --------------- Color helpers ---------------
/**
 * Map pace (sec/km) to a CSS color – green (fast) → yellow → red (slow).
 */
function paceColor(secPerKm, minPace, maxPace) {
  const range = maxPace - minPace || 1;
  const ratio = Math.max(0, Math.min(1, (secPerKm - minPace) / range));
  // 0 = fastest (green), 1 = slowest (red)
  const r = Math.round(255 * ratio);
  const g = Math.round(255 * (1 - ratio));
  return `rgb(${r},${g},60)`;
}

// ============================================================
//   PUBLIC – render the full activity detail page
// ============================================================
/**
 * renderActivityDetail(activity, containerEl)
 *
 * @param {Object} activity  – full activity object (with streams)
 * @param {HTMLElement} containerEl – DOM element to inject content into
 */
function renderActivityDetail(activity, containerEl) {
  destroyAllDetailCharts();
  containerEl.innerHTML = ''; // clear

  const streams = activity.streams || {};
  const hrData  = streams.heartrate?.data;
  const velData = streams.velocity_smooth?.data;
  const altData = streams.altitude?.data;
  const timeData = streams.time?.data;
  const distData = streams.distance?.data;

  // --- Compute derived streams ---
  const powerStream = computePowerStream(activity);
  const gapStream   = computeGAPStream(activity);
  const laps        = buildLaps(activity, powerStream, gapStream);

  // ---- Summary stats ----
  const summaryDiv = document.createElement('div');
  summaryDiv.className = 'detail-summary';
  const distKm  = (activity.distance / 1000).toFixed(2);
  const dur     = formatTime(activity.moving_time);
  const avgPace = formatPace(activity.average_speed);
  const avgHR   = activity.average_heartrate ? Math.round(activity.average_heartrate) : '--';
  const elev    = activity.total_elevation_gain ? Math.round(activity.total_elevation_gain) : 0;

  // Power stats
  let avgPwr = '--', maxPwr = '--', normPwr = '--';
  if (powerStream) {
    avgPwr = Math.round(powerStream.reduce((a,b) => a + b, 0) / powerStream.length);
    maxPwr = Math.round(Math.max(...powerStream));
    const np = calcNormalizedPower(powerStream, timeData);
    normPwr = np ? Math.round(np) : '--';
  }

  // Overall GAP
  let overallGAP = '--';
  if (gapStream) {
    const avgGapSpd = gapStream.reduce((a,b) => a + b, 0) / gapStream.length;
    overallGAP = formatPace(avgGapSpd);
  }

  summaryDiv.innerHTML = `
    <h2>${activity.name || 'Activity'}</h2>
    <div class="stat-grid">
      <div class="stat"><span class="stat-label">Distance</span><span class="stat-value">${distKm} km</span></div>
      <div class="stat"><span class="stat-label">Time</span><span class="stat-value">${dur}</span></div>
      <div class="stat"><span class="stat-label">Pace</span><span class="stat-value">${avgPace} /km</span></div>
      <div class="stat"><span class="stat-label">GAP</span><span class="stat-value">${overallGAP} /km</span></div>
      <div class="stat"><span class="stat-label">Avg HR</span><span class="stat-value">${avgHR} bpm</span></div>
      <div class="stat"><span class="stat-label">Elevation</span><span class="stat-value">${elev} m</span></div>
      <div class="stat"><span class="stat-label">Avg Power</span><span class="stat-value">${avgPwr} W</span></div>
      <div class="stat"><span class="stat-label">Norm Power</span><span class="stat-value">${normPwr} W</span></div>
      <div class="stat"><span class="stat-label">Max Power</span><span class="stat-value">${maxPwr} W</span></div>
    </div>`;
  containerEl.appendChild(summaryDiv);

  // ---- HR Chart with zone coloring ----
  if (hrData && hrData.length > 0 && distData) {
    const hrSection = document.createElement('div');
    hrSection.className = 'chart-section';
    hrSection.innerHTML = '<h3>Heart Rate</h3><canvas id="hrChart"></canvas>';
    containerEl.appendChild(hrSection);

    const labels = distData.map(d => (d / 1000).toFixed(2));
    const zones = getHRZones();

    const hrZonePlugin = {
      id: 'hrZoneBackground',
      beforeDraw(chart) {
        const { ctx, chartArea: { left, right, top, bottom }, scales: { y } } = chart;
        zones.forEach(z => {
          const yTop = y.getPixelForValue(Math.min(z.max, y.max));
          const yBot = y.getPixelForValue(Math.max(z.min, y.min));
          ctx.fillStyle = z.color;
          ctx.fillRect(left, yTop, right - left, yBot - yTop);
        });
      }
    };

    const ctx = document.getElementById('hrChart').getContext('2d');
    DetailChartRegistry['hrChart'] = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Heart Rate (bpm)',
          data: hrData,
          borderColor: 'rgba(213,94,0,0.9)',
          backgroundColor: 'rgba(213,94,0,0.1)',
          fill: true,
          pointRadius: 0,
          borderWidth: 1.5,
          tension: 0.3,
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { title: { display: true, text: 'Distance (km)' },
               ticks: { maxTicksLimit: 15 } },
          y: { title: { display: true, text: 'bpm' },
               min: Math.min(...hrData) - 10,
               max: Math.max(...hrData) + 10 }
        }
      },
      plugins: [hrZonePlugin]
    });
  }

  // ---- Power Chart ----
  if (powerStream && distData) {
    const pwrSection = document.createElement('div');
    pwrSection.className = 'chart-section';
    pwrSection.innerHTML = '<h3>Running Power</h3><canvas id="powerChart"></canvas>';
    containerEl.appendChild(pwrSection);

    // smooth power for display (rolling 10-point avg)
    const smoothPwr = powerStream.map((_, i, arr) => {
      const start = Math.max(0, i - 5);
      const end   = Math.min(arr.length, i + 5);
      let s = 0; for (let j = start; j < end; j++) s += arr[j];
      return Math.round(s / (end - start));
    });

    const labels = distData.map(d => (d / 1000).toFixed(2));
    const ctx = document.getElementById('powerChart').getContext('2d');
    DetailChartRegistry['powerChart'] = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Power (W)',
          data: smoothPwr,
          borderColor: 'rgba(120,60,200,0.9)',
          backgroundColor: 'rgba(120,60,200,0.1)',
          fill: true,
          pointRadius: 0,
          borderWidth: 1.5,
          tension: 0.3,
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { title: { display: true, text: 'Distance (km)' }, ticks: { maxTicksLimit: 15 } },
          y: { title: { display: true, text: 'Watts' }, beginAtZero: true }
        }
      }
    });
  }

  // ---- GAP vs Pace Chart (per-lap bar chart) ----
  if (laps.length > 0) {
    const gapSection = document.createElement('div');
    gapSection.className = 'chart-section';
    gapSection.innerHTML = '<h3>Pace vs GAP per Split</h3><canvas id="gapChart"></canvas>';
    containerEl.appendChild(gapSection);

    const lbls       = laps.map(l => `Km ${l.index}`);
    const paceVals   = laps.map(l => l.paceSecKm);
    const gapVals    = laps.map(l => l.gapSecKm);

    const ctx = document.getElementById('gapChart').getContext('2d');
    DetailChartRegistry['gapChart'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: lbls,
        datasets: [
          { label: 'Actual Pace (s/km)', data: paceVals, backgroundColor: 'rgba(86,180,233,0.7)' },
          { label: 'GAP (s/km)',         data: gapVals,  backgroundColor: 'rgba(230,159,0,0.7)' },
        ]
      },
      options: {
        responsive: true,
        plugins: {
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const val = ctx.raw;
                const m = Math.floor(val / 60);
                const s = Math.round(val % 60);
                return `${ctx.dataset.label}: ${m}:${s.toString().padStart(2,'0')} /km`;
              }
            }
          }
        },
        scales: {
          x: { title: { display: true, text: 'Split' } },
          y: { title: { display: true, text: 'sec / km' }, reverse: true }
        }
      }
    });
  }

  // ---- Laps Table ----
  if (laps.length > 0) {
    const lapSection = document.createElement('div');
    lapSection.className = 'table-section';
    const minPace = Math.min(...laps.map(l => l.gapSecKm));
    const maxPace = Math.max(...laps.map(l => l.gapSecKm));

    let html = '<h3>Laps / Splits</h3>';
    html += `<table class="laps-table"><thead><tr>
      <th>#</th><th>Dist</th><th>Time</th><th>Pace</th><th>GAP</th>
      <th>HR</th><th>Power</th><th>Elev ↑</th><th>Elev ↓</th>
    </tr></thead><tbody>`;

    laps.forEach(l => {
      const bg = paceColor(l.gapSecKm, minPace, maxPace);
      html += `<tr style="background:${bg}22">
        <td>${l.index}</td>
        <td>${(l.distance / 1000).toFixed(2)} km</td>
        <td>${formatTime(l.time)}</td>
        <td>${l.pace}</td>
        <td><strong>${l.gap}</strong></td>
        <td>${l.avgHR}</td>
        <td>${l.avgPower !== '--' ? l.avgPower + ' W' : '--'}</td>
        <td>+${l.elevGain} m</td>
        <td>-${l.elevLoss} m</td>
      </tr>`;
    });
    html += '</tbody></table>';
    lapSection.innerHTML = html;
    containerEl.appendChild(lapSection);
  }

  // ---- HR Zone Distribution (donut) ----
  if (hrData && hrData.length > 0) {
    const zoneSection = document.createElement('div');
    zoneSection.className = 'chart-section';
    zoneSection.innerHTML = '<h3>HR Zone Distribution</h3><canvas id="hrZoneDonut"></canvas>';
    containerEl.appendChild(zoneSection);

    const zones = getHRZones();
    const counts = zones.map(() => 0);
    hrData.forEach(hr => {
      for (let z = zones.length - 1; z >= 0; z--) {
        if (hr >= zones[z].min) { counts[z]++; break; }
      }
    });
    const total = counts.reduce((a, b) => a + b, 0) || 1;
    const pcts  = counts.map(c => ((c / total) * 100).toFixed(1));

    const ctx = document.getElementById('hrZoneDonut').getContext('2d');
    DetailChartRegistry['hrZoneDonut'] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: zones.map((z, i) => `${z.name} (${pcts[i]}%)`),
        datasets: [{
          data: counts,
          backgroundColor: zones.map(z => z.color.replace('0.35', '0.75')),
        }]
      },
      options: { responsive: true, plugins: { legend: { position: 'right' } } }
    });
  }
}

// Expose to global scope
window.renderActivityDetail = renderActivityDetail;
window.computePowerStream   = computePowerStream;
window.computeGAPStream     = computeGAPStream;
window.buildLaps            = buildLaps;
window.calcNormalizedPower   = calcNormalizedPower;

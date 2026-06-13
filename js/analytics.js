/**
 * HM Tracker PWA – analytics.js  (Sprint 7)
 * ------------------------------------------
 * Features:
 *   1. VO2max trend (per-activity estimation)
 *   2. Training distribution (interval detection via pace variance)
 *   3. Cumulative distance
 *   4. Time below HR 150
 *   5. NEW – Power analytics (avg power trend, P:W ratio, power zones)
 *   6. NEW – GAP analytics (GAP trend, GAP vs actual pace)
 *   7. NEW – Split analytics (best km trend, split consistency, neg/pos split ratio)
 *
 * Dependencies: Chart.js, activity-detail.js (for computePowerStream, computeGAPStream, etc.)
 */

// --------------- Chart Registry ---------------
const AnalyticsChartRegistry = {};

function destroyAnalyticsChart(key) {
  if (AnalyticsChartRegistry[key]) {
    AnalyticsChartRegistry[key].destroy();
    delete AnalyticsChartRegistry[key];
  }
}

function destroyAllAnalyticsCharts() {
  Object.keys(AnalyticsChartRegistry).forEach(destroyAnalyticsChart);
}

// --------------- Helpers ---------------
function getUserWeightAnalytics() {
  const w = parseFloat(localStorage.getItem('hm_user_weight'));
  return (w && w > 0) ? w : 75;
}

function getMaxHRAnalytics() {
  const m = parseInt(localStorage.getItem('hm_user_max_hr'), 10);
  return (m && m > 100) ? m : 190;
}

function getRestHR() {
  const r = parseInt(localStorage.getItem('hm_user_rest_hr'), 10);
  return (r && r > 30) ? r : 50;
}

function weekKey(dateStr) {
  const d = new Date(dateStr);
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${weekNum.toString().padStart(2, '0')}`;
}

function formatPaceAnalytics(speedMs) {
  if (!speedMs || speedMs <= 0) return '--:--';
  const s = 1000 / speedMs;
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

// --------------- VO2max Estimation (per activity) ---------------
/**
 * Uses a Firstbeat-inspired approach:
 *   - %HRR (heart rate reserve) as fraction of effort
 *   - speed as proxy for oxygen cost
 *   VO2max ≈ (speed_ml_O2) / (fractional_utilization)
 *
 * Running economy: VO2 (ml/kg/min) ≈ speed(m/min) × 0.2 + 3.5  (ACSM flat running)
 * Fractional utilization from %HRR: frac ≈ 0.8 × %HRR + 0.15 (simplified Swain)
 *
 * We use the activity's average speed and average HR.
 */
function estimateVO2max(activity) {
  const avgSpeed = activity.average_speed; // m/s
  const avgHR    = activity.average_heartrate;
  if (!avgSpeed || avgSpeed <= 0 || !avgHR || avgHR <= 0) return null;

  const maxHR  = activity.max_heartrate || getMaxHRAnalytics();
  const restHR = getRestHR();

  // %HRR – fraction of heart-rate reserve used
  const hrReserve = maxHR - restHR;
  if (hrReserve <= 0) return null;
  const pctHRR = (avgHR - restHR) / hrReserve;

  // fractional VO2max utilisation from %HRR (Swain et al.)
  const fracUtil = Math.max(0.3, Math.min(1.0, 0.8 * pctHRR + 0.15));

  // Oxygen cost of running (ml/kg/min) – ACSM running equation
  const speedMperMin = avgSpeed * 60;
  // Add grade component if we have elevation data
  let gradeComponent = 0;
  if (activity.total_elevation_gain && activity.distance > 0) {
    const avgGrade = activity.total_elevation_gain / activity.distance;
    gradeComponent = speedMperMin * 0.9 * avgGrade;
  }
  const vo2atPace = speedMperMin * 0.2 + gradeComponent + 3.5;

  // VO2max = actual_VO2 / fractional_utilisation
  const vo2max = vo2atPace / fracUtil;

  // Clamp to reasonable range
  return (vo2max > 20 && vo2max < 90) ? Math.round(vo2max * 10) / 10 : null;
}

// --------------- Training Type Detection ---------------
/**
 * Classify activity into Easy / Tempo / Interval / Long Run.
 *
 * Uses pace variance within the run (from velocity_smooth) to detect intervals.
 *   – High CV (coeff. of variation) of pace in middle portion → Intervals
 *   – Steady moderate pace → Tempo
 *   – Lower pace, longer duration → Easy / Long Run
 *
 * Also trims warmup (~2 km) and cooldown (~1.5 km) for analysis.
 */
function classifyTraining(activity) {
  const distKm = activity.distance / 1000;
  const avgSpeed = activity.average_speed; // m/s
  const avgPace  = avgSpeed > 0 ? (1000 / avgSpeed) : 999; // sec/km

  const streams = activity.streams || {};
  const velData  = streams.velocity_smooth?.data;
  const distData = streams.distance?.data;

  let cv = 0; // coefficient of variation of pace in the "work" portion

  if (velData && distData && velData.length > 20) {
    // Trim warmup (first 2 km) and cooldown (last 1.5 km)
    const totalDist = distData[distData.length - 1];
    const warmupEnd   = 2000;
    const cooldownStart = Math.max(totalDist - 1500, warmupEnd + 500);

    const workSpeeds = [];
    for (let i = 0; i < velData.length; i++) {
      if (distData[i] >= warmupEnd && distData[i] <= cooldownStart && velData[i] > 0.5) {
        workSpeeds.push(velData[i]);
      }
    }

    if (workSpeeds.length > 10) {
      const mean = workSpeeds.reduce((a, b) => a + b, 0) / workSpeeds.length;
      const variance = workSpeeds.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / workSpeeds.length;
      const stddev = Math.sqrt(variance);
      cv = stddev / mean;
    }
  }

  // Classification logic
  if (cv > 0.25) {
    return 'Interval';
  } else if (distKm >= 18) {
    return 'Long Run';
  } else if (avgPace < 300) {
    // faster than 5:00/km → Tempo
    return 'Tempo';
  } else if (distKm >= 12 && avgPace < 360) {
    return 'Tempo';
  } else {
    return 'Easy';
  }
}

// --------------- Power Zones ---------------
const POWER_ZONES = [
  { name: 'Z1 Recovery',    max: 0.55, color: 'rgba(150,150,150,0.7)' },
  { name: 'Z2 Endurance',   max: 0.75, color: 'rgba(86,180,233,0.7)' },
  { name: 'Z3 Tempo',       max: 0.90, color: 'rgba(0,158,115,0.7)' },
  { name: 'Z4 Threshold',   max: 1.05, color: 'rgba(240,228,66,0.7)' },
  { name: 'Z5 VO2max',      max: 1.20, color: 'rgba(230,159,0,0.7)' },
  { name: 'Z6 Anaerobic',   max: Infinity, color: 'rgba(213,94,0,0.7)' },
];

// ============================================================
//   PUBLIC – render all analytics charts
// ============================================================
/**
 * renderAnalytics(activities, containerEl)
 *
 * @param {Array}       activities   – array of activity objects (with streams)
 * @param {HTMLElement}  containerEl  – DOM element to inject content into
 */
function renderAnalytics(activities, containerEl) {
  destroyAllAnalyticsCharts();
  containerEl.innerHTML = '';

  if (!activities || activities.length === 0) {
    containerEl.innerHTML = '<p>No activities found. Import or sync data first.</p>';
    return;
  }

  // Sort chronologically
  const sorted = [...activities].sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

  // ---- Pre-compute per-activity data ----
  const perActivity = sorted.map(act => {
    const powerStream = (typeof computePowerStream === 'function') ? computePowerStream(act) : null;
    const gapStream   = (typeof computeGAPStream === 'function')   ? computeGAPStream(act)   : null;

    const avgPower = powerStream
      ? Math.round(powerStream.reduce((a,b) => a+b, 0) / powerStream.length)
      : null;

    const avgGapSpeed = gapStream
      ? gapStream.reduce((a,b) => a+b, 0) / gapStream.length
      : null;

    // Best km (fastest split)
    const splits = act.splits_metric;
    let bestKmPace = null;
    if (splits && splits.length > 0) {
      const fullKms = splits.filter(s => s.distance >= 900); // nearly 1 km
      if (fullKms.length > 0) {
        const fastest = fullKms.reduce((best, s) => s.average_speed > best.average_speed ? s : best);
        bestKmPace = 1000 / fastest.average_speed; // sec/km
      }
    }

    // Negative/positive split analysis
    let splitRatio = null;
    if (splits && splits.length >= 2) {
      const half = Math.floor(splits.length / 2);
      const firstHalfAvg = splits.slice(0, half).reduce((s, sp) => s + sp.average_speed, 0) / half;
      const secondHalfAvg = splits.slice(half).reduce((s, sp) => s + sp.average_speed, 0) / (splits.length - half);
      splitRatio = secondHalfAvg / firstHalfAvg; // >1 = negative split (faster second half)
    }

    // Consistency score: 1 - CV of pace across splits (1 = perfectly even)
    let consistency = null;
    if (splits && splits.length >= 3) {
      const fullKms = splits.filter(s => s.distance >= 900);
      if (fullKms.length >= 3) {
        const speeds = fullKms.map(s => s.average_speed);
        const mean = speeds.reduce((a,b) => a+b, 0) / speeds.length;
        const std  = Math.sqrt(speeds.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / speeds.length);
        consistency = Math.max(0, Math.round((1 - std / mean) * 100));
      }
    }

    return {
      date:        act.start_date,
      week:        weekKey(act.start_date),
      name:        act.name,
      distKm:      act.distance / 1000,
      movingTime:  act.moving_time,
      avgSpeed:    act.average_speed,
      avgHR:       act.average_heartrate,
      vo2max:      estimateVO2max(act),
      type:        classifyTraining(act),
      avgPower:    avgPower,
      pwRatio:     avgPower ? (avgPower / getUserWeightAnalytics()).toFixed(2) : null,
      avgGapSpeed: avgGapSpeed,
      bestKmPace:  bestKmPace,
      splitRatio:  splitRatio,
      consistency: consistency,
      powerStream: powerStream,
      hrData:      act.streams?.heartrate?.data,
      timeData:    act.streams?.time?.data,
    };
  });

  // ======================== 1. VO2max Trend ========================
  {
    const section = document.createElement('div');
    section.className = 'chart-section';
    section.innerHTML = '<h3>VO₂max Trend</h3><canvas id="vo2maxChart"></canvas>';
    containerEl.appendChild(section);

    const withVO2 = perActivity.filter(a => a.vo2max !== null);
    const labels = withVO2.map(a => new Date(a.date).toLocaleDateString());
    const data   = withVO2.map(a => a.vo2max);

    const ctx = document.getElementById('vo2maxChart').getContext('2d');
    AnalyticsChartRegistry['vo2maxChart'] = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'VO₂max (ml/kg/min)',
          data,
          borderColor: 'rgba(0,158,115,0.9)',
          backgroundColor: 'rgba(0,158,115,0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 3,
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: { title: { display: true, text: 'ml/kg/min' } }
        }
      }
    });
  }

  // ======================== 2. Training Distribution ========================
  {
    const section = document.createElement('div');
    section.className = 'chart-section';
    section.innerHTML = '<h3>Training Type Distribution</h3><canvas id="trainingDistChart"></canvas>';
    containerEl.appendChild(section);

    const typeCounts = { Easy: 0, Tempo: 0, Interval: 0, 'Long Run': 0 };
    perActivity.forEach(a => { if (typeCounts.hasOwnProperty(a.type)) typeCounts[a.type]++; });

    const typeColors = {
      Easy:       'rgba(86,180,233,0.7)',
      Tempo:      'rgba(230,159,0,0.7)',
      Interval:   'rgba(213,94,0,0.7)',
      'Long Run': 'rgba(0,158,115,0.7)',
    };

    const ctx = document.getElementById('trainingDistChart').getContext('2d');
    AnalyticsChartRegistry['trainingDistChart'] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: Object.keys(typeCounts),
        datasets: [{
          data: Object.values(typeCounts),
          backgroundColor: Object.keys(typeCounts).map(k => typeColors[k]),
        }]
      },
      options: { responsive: true, plugins: { legend: { position: 'right' } } }
    });
  }

  // ======================== 3. Cumulative Distance ========================
  {
    const section = document.createElement('div');
    section.className = 'chart-section';
    section.innerHTML = '<h3>Cumulative Distance</h3><canvas id="cumDistChart"></canvas>';
    containerEl.appendChild(section);

    let cum = 0;
    const labels = perActivity.map(a => new Date(a.date).toLocaleDateString());
    const data   = perActivity.map(a => { cum += a.distKm; return Math.round(cum * 10) / 10; });

    const ctx = document.getElementById('cumDistChart').getContext('2d');
    AnalyticsChartRegistry['cumDistChart'] = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Cumulative Distance (km)',
          data,
          borderColor: 'rgba(86,180,233,0.9)',
          backgroundColor: 'rgba(86,180,233,0.1)',
          fill: true,
          tension: 0.3,
        }]
      },
      options: { responsive: true, scales: { y: { title: { display: true, text: 'km' } } } }
    });
  }

  // ======================== 4. Time below HR 150 ========================
  {
    const section = document.createElement('div');
    section.className = 'chart-section';
    section.innerHTML = '<h3>Time with HR < 150 bpm (per activity)</h3><canvas id="hrBelow150Chart"></canvas>';
    containerEl.appendChild(section);

    const items = perActivity.map(a => {
      if (!a.hrData || !a.timeData || a.hrData.length < 2) return { label: '', mins: 0 };
      let totalBelow = 0;
      for (let i = 1; i < a.hrData.length; i++) {
        if (a.hrData[i] < 150) {
          totalBelow += (a.timeData[i] - a.timeData[i-1]);
        }
      }
      return {
        label: new Date(a.date).toLocaleDateString(),
        mins: Math.round(totalBelow / 60 * 10) / 10
      };
    }).filter(x => x.label);

    const ctx = document.getElementById('hrBelow150Chart').getContext('2d');
    AnalyticsChartRegistry['hrBelow150Chart'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: items.map(i => i.label),
        datasets: [{
          label: 'Minutes below 150 bpm',
          data: items.map(i => i.mins),
          backgroundColor: 'rgba(0,158,115,0.6)',
        }]
      },
      options: { responsive: true, scales: { y: { title: { display: true, text: 'min' }, beginAtZero: true } } }
    });
  }

  // ======================== 5. Power Trend ========================
  {
    const section = document.createElement('div');
    section.className = 'chart-section';
    section.innerHTML = '<h3>Average Power Trend</h3><canvas id="powerTrendChart"></canvas>';
    containerEl.appendChild(section);

    const withPwr = perActivity.filter(a => a.avgPower !== null);
    const labels = withPwr.map(a => new Date(a.date).toLocaleDateString());

    const ctx = document.getElementById('powerTrendChart').getContext('2d');
    AnalyticsChartRegistry['powerTrendChart'] = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Avg Power (W)',
            data: withPwr.map(a => a.avgPower),
            borderColor: 'rgba(120,60,200,0.9)',
            backgroundColor: 'rgba(120,60,200,0.1)',
            fill: true, tension: 0.3, pointRadius: 3,
          },
          {
            label: 'P:W Ratio (W/kg)',
            data: withPwr.map(a => parseFloat(a.pwRatio)),
            borderColor: 'rgba(200,60,120,0.9)',
            backgroundColor: 'rgba(200,60,120,0.1)',
            fill: false, tension: 0.3, pointRadius: 3,
            yAxisID: 'y1',
          }
        ]
      },
      options: {
        responsive: true,
        scales: {
          y:  { title: { display: true, text: 'Watts' }, position: 'left' },
          y1: { title: { display: true, text: 'W/kg' }, position: 'right', grid: { drawOnChartArea: false } },
        }
      }
    });
  }

  // ======================== 6. Power Zone Distribution (all activities) ========================
  {
    const section = document.createElement('div');
    section.className = 'chart-section';
    section.innerHTML = '<h3>Power Zone Distribution (all activities)</h3><canvas id="powerZonesChart"></canvas>';
    containerEl.appendChild(section);

    // Estimate FTP as 95% of best 20-min normalized power (simplified: use highest avgPower * 0.95)
    const allPowers = perActivity.filter(a => a.avgPower).map(a => a.avgPower);
    const estFTP = allPowers.length > 0 ? Math.max(...allPowers) * 0.95 : 250;

    const zoneCounts = POWER_ZONES.map(() => 0);
    perActivity.forEach(a => {
      if (!a.powerStream) return;
      a.powerStream.forEach(p => {
        const ratio = p / estFTP;
        for (let z = 0; z < POWER_ZONES.length; z++) {
          if (ratio <= POWER_ZONES[z].max) { zoneCounts[z]++; break; }
        }
      });
    });

    const total = zoneCounts.reduce((a,b) => a+b, 0) || 1;

    const ctx = document.getElementById('powerZonesChart').getContext('2d');
    AnalyticsChartRegistry['powerZonesChart'] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: POWER_ZONES.map((z, i) => `${z.name} (${((zoneCounts[i]/total)*100).toFixed(1)}%)`),
        datasets: [{
          data: zoneCounts,
          backgroundColor: POWER_ZONES.map(z => z.color),
        }]
      },
      options: { responsive: true, plugins: { legend: { position: 'right' } } }
    });
  }

  // ======================== 7. GAP Trend ========================
  {
    const section = document.createElement('div');
    section.className = 'chart-section';
    section.innerHTML = '<h3>GAP vs Actual Pace Trend</h3><canvas id="gapTrendChart"></canvas>';
    containerEl.appendChild(section);

    const withGap = perActivity.filter(a => a.avgGapSpeed && a.avgSpeed);
    const labels = withGap.map(a => new Date(a.date).toLocaleDateString());

    const ctx = document.getElementById('gapTrendChart').getContext('2d');
    AnalyticsChartRegistry['gapTrendChart'] = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Actual Pace (sec/km)',
            data: withGap.map(a => Math.round(1000 / a.avgSpeed)),
            borderColor: 'rgba(86,180,233,0.9)',
            tension: 0.3, pointRadius: 3,
          },
          {
            label: 'GAP (sec/km)',
            data: withGap.map(a => Math.round(1000 / a.avgGapSpeed)),
            borderColor: 'rgba(230,159,0,0.9)',
            tension: 0.3, pointRadius: 3,
          }
        ]
      },
      options: {
        responsive: true,
        scales: {
          y: {
            title: { display: true, text: 'sec / km' },
            reverse: true,
            ticks: {
              callback: (v) => {
                const m = Math.floor(v / 60);
                const s = Math.round(v % 60);
                return `${m}:${s.toString().padStart(2,'0')}`;
              }
            }
          }
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const v = ctx.raw;
                const m = Math.floor(v / 60);
                const s = Math.round(v % 60);
                return `${ctx.dataset.label}: ${m}:${s.toString().padStart(2,'0')} /km`;
              }
            }
          }
        }
      }
    });
  }

  // ======================== 8. Best Km Pace Trend ========================
  {
    const section = document.createElement('div');
    section.className = 'chart-section';
    section.innerHTML = '<h3>Best Km Pace Trend</h3><canvas id="bestKmChart"></canvas>';
    containerEl.appendChild(section);

    const withBest = perActivity.filter(a => a.bestKmPace !== null);
    const labels = withBest.map(a => new Date(a.date).toLocaleDateString());

    const ctx = document.getElementById('bestKmChart').getContext('2d');
    AnalyticsChartRegistry['bestKmChart'] = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Best Km (sec/km)',
          data: withBest.map(a => Math.round(a.bestKmPace)),
          borderColor: 'rgba(213,94,0,0.9)',
          backgroundColor: 'rgba(213,94,0,0.1)',
          fill: true, tension: 0.3, pointRadius: 3,
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: {
            title: { display: true, text: 'sec / km' },
            reverse: true,
            ticks: {
              callback: (v) => {
                const m = Math.floor(v / 60);
                const s = Math.round(v % 60);
                return `${m}:${s.toString().padStart(2,'0')}`;
              }
            }
          }
        }
      }
    });
  }

  // ======================== 9. Split Consistency & Negative Split Ratio ========================
  {
    const section = document.createElement('div');
    section.className = 'chart-section';
    section.innerHTML = '<h3>Pacing Consistency & Split Ratio</h3><canvas id="consistencyChart"></canvas>';
    containerEl.appendChild(section);

    const withData = perActivity.filter(a => a.consistency !== null && a.splitRatio !== null);
    const labels = withData.map(a => new Date(a.date).toLocaleDateString());

    const ctx = document.getElementById('consistencyChart').getContext('2d');
    AnalyticsChartRegistry['consistencyChart'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Consistency Score (%)',
            data: withData.map(a => a.consistency),
            backgroundColor: 'rgba(0,158,115,0.6)',
            yAxisID: 'y',
          },
          {
            label: 'Split Ratio (>1 = negative split)',
            data: withData.map(a => Math.round(a.splitRatio * 100) / 100),
            type: 'line',
            borderColor: 'rgba(230,159,0,0.9)',
            pointRadius: 4,
            tension: 0.3,
            yAxisID: 'y1',
          }
        ]
      },
      options: {
        responsive: true,
        scales: {
          y:  { title: { display: true, text: 'Consistency %' }, position: 'left', min: 0, max: 100 },
          y1: { title: { display: true, text: 'Split Ratio' }, position: 'right',
                grid: { drawOnChartArea: false } },
        }
      }
    });
  }

  // ======================== 10. Weekly Summary Table ========================
  {
    const section = document.createElement('div');
    section.className = 'table-section';

    // Group by week
    const weekMap = {};
    perActivity.forEach(a => {
      if (!weekMap[a.week]) weekMap[a.week] = { dist: 0, runs: 0, vo2: [], power: [] };
      weekMap[a.week].dist += a.distKm;
      weekMap[a.week].runs++;
      if (a.vo2max) weekMap[a.week].vo2.push(a.vo2max);
      if (a.avgPower) weekMap[a.week].power.push(a.avgPower);
    });

    let html = '<h3>Weekly Summary</h3><table class="analytics-table"><thead><tr>' +
      '<th>Week</th><th>Runs</th><th>Distance</th><th>Avg VO₂max</th><th>Avg Power</th>' +
      '</tr></thead><tbody>';

    Object.keys(weekMap).sort().forEach(w => {
      const d = weekMap[w];
      const avgVO2 = d.vo2.length > 0 ? (d.vo2.reduce((a,b)=>a+b,0)/d.vo2.length).toFixed(1) : '--';
      const avgPwr = d.power.length > 0 ? Math.round(d.power.reduce((a,b)=>a+b,0)/d.power.length) : '--';
      html += `<tr>
        <td>${w}</td>
        <td>${d.runs}</td>
        <td>${d.dist.toFixed(1)} km</td>
        <td>${avgVO2}</td>
        <td>${avgPwr !== '--' ? avgPwr + ' W' : '--'}</td>
      </tr>`;
    });
    html += '</tbody></table>';
    section.innerHTML = html;
    containerEl.appendChild(section);
  }
}

// Expose to global scope
window.renderAnalytics  = renderAnalytics;
window.estimateVO2max   = estimateVO2max;
window.classifyTraining = classifyTraining;

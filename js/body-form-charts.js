
/* body-form-charts.js v1 — Sprint 23: Body & Form visualizations + correlations */
var BodyFormCharts = (function() {
  "use strict";
  var TAG = "[BodyFormCharts]";
  var _charts = {};

  function destroy(id) {
    if (_charts[id]) { _charts[id].destroy(); delete _charts[id]; }
  }

  function paceToSec(p) {
    if (!p) return 0;
    var parts = String(p).split(":");
    if (parts.length !== 2) return 0;
    return parseInt(parts[0]) * 60 + parseInt(parts[1]);
  }

  function getHealthData(field) {
    if (typeof HealthImport === "undefined") return [];
    return HealthImport.getAll()
      .filter(function(d) { return d[field] && d[field] > 0; })
      .map(function(d) { return { date: d.date, value: d[field], full: d }; })
      .sort(function(a, b) { return a.date.localeCompare(b.date); });
  }

  // ========================================
  // SIMPLE TREND CHART
  // ========================================
  function drawTrendChart(canvasId, data, options) {
    options = options || {};
    var canvas = document.getElementById(canvasId);
    if (!canvas) return;
    destroy(canvasId);

    if (!data || data.length === 0) {
      var ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#9ca3af';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Brak danych — zbieram pomiary', canvas.width/2, canvas.height/2);
      return;
    }

    var labels = data.map(function(d) { return d.date.slice(5); });
    var values = data.map(function(d) { return d.value; });

    var datasets = [{
      label: options.label || 'Value',
      data: values,
      borderColor: options.color || '#3b82f6',
      backgroundColor: (options.color || '#3b82f6') + '20',
      tension: 0.3,
      pointRadius: data.length > 30 ? 2 : 4,
      pointHoverRadius: 6,
      borderWidth: 2,
      fill: options.fill !== false
    }];

    // Baseline jeśli podany
    if (options.baseline !== undefined && options.baseline > 0) {
      datasets.push({
        label: 'Baseline',
        data: new Array(values.length).fill(options.baseline),
        borderColor: '#ef4444',
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false,
        borderWidth: 1
      });
    }

    // Target line jeśli podany
    if (options.target !== undefined && options.target > 0) {
      datasets.push({
        label: 'Cel',
        data: new Array(values.length).fill(options.target),
        borderColor: '#10b981',
        borderDash: [10, 5],
        pointRadius: 0,
        fill: false,
        borderWidth: 2
      });
    }

    _charts[canvasId] = new Chart(canvas, {
      type: 'line',
      data: { labels: labels, datasets: datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: datasets.length > 1, labels: { color: '#d1d5db', font: { size: 11 } } },
          tooltip: { 
            mode: 'index', 
            intersect: false,
            callbacks: {
              label: function(ctx) {
                return ctx.dataset.label + ': ' + ctx.parsed.y + (options.unit || '');
              }
            }
          }
        },
        scales: {
          x: { ticks: { color: '#9ca3af', font: { size: 10 } }, grid: { color: '#374151' } },
          y: { 
            ticks: { color: '#9ca3af', font: { size: 10 } }, 
            grid: { color: '#374151' },
            title: options.yLabel ? { display: true, text: options.yLabel, color: '#9ca3af' } : undefined
          }
        }
      }
    });
  }

  // ========================================
  // DUAL AXIS CHART (Weight + Body Fat)
  // ========================================
  function drawDualAxisChart(canvasId, weightData, bfData) {
    var canvas = document.getElementById(canvasId);
    if (!canvas) return;
    destroy(canvasId);

    if (!weightData.length && !bfData.length) {
      var ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#9ca3af';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Brak danych wagowych', canvas.width/2, canvas.height/2);
      return;
    }

    // Połącz daty z obu serii
    var allDates = {};
    weightData.forEach(function(d) { allDates[d.date] = true; });
    bfData.forEach(function(d) { allDates[d.date] = true; });
    var labels = Object.keys(allDates).sort();

    var weightMap = {}; weightData.forEach(function(d) { weightMap[d.date] = d.value; });
    var bfMap = {}; bfData.forEach(function(d) { bfMap[d.date] = d.value; });

    var weightSeries = labels.map(function(d) { return weightMap[d] || null; });
    var bfSeries = labels.map(function(d) { return bfMap[d] || null; });

    var targetWeight = (typeof BodyTracker !== "undefined") ? BodyTracker.GOALS.target.weight_kg : 71;
    var targetBF = (typeof BodyTracker !== "undefined") ? BodyTracker.GOALS.target.body_fat_pct : 16;

    _charts[canvasId] = new Chart(canvas, {
      type: 'line',
      data: {
        labels: labels.map(function(d) { return d.slice(5); }),
        datasets: [
          {
            label: 'Waga (kg)',
            data: weightSeries,
            borderColor: '#3b82f6',
            backgroundColor: '#3b82f620',
            yAxisID: 'y-weight',
            tension: 0.3,
            pointRadius: 4,
            spanGaps: true
          },
          {
            label: 'Body Fat (%)',
            data: bfSeries,
            borderColor: '#f59e0b',
            backgroundColor: '#f59e0b20',
            yAxisID: 'y-bf',
            tension: 0.3,
            pointRadius: 4,
            spanGaps: true
          },
          {
            label: 'Cel wagi',
            data: new Array(labels.length).fill(targetWeight),
            borderColor: '#10b981',
            borderDash: [10, 5],
            pointRadius: 0,
            fill: false,
            yAxisID: 'y-weight'
          },
          {
            label: 'Cel BF',
            data: new Array(labels.length).fill(targetBF),
            borderColor: '#10b981',
            borderDash: [10, 5],
            pointRadius: 0,
            fill: false,
            yAxisID: 'y-bf'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#d1d5db', font: { size: 11 } } },
          tooltip: { mode: 'index', intersect: false }
        },
        scales: {
          x: { ticks: { color: '#9ca3af', font: { size: 10 } }, grid: { color: '#374151' } },
          'y-weight': {
            type: 'linear',
            position: 'left',
            ticks: { color: '#3b82f6', font: { size: 10 } },
            grid: { color: '#374151' },
            title: { display: true, text: 'Waga (kg)', color: '#3b82f6' }
          },
          'y-bf': {
            type: 'linear',
            position: 'right',
            ticks: { color: '#f59e0b', font: { size: 10 } },
            grid: { drawOnChartArea: false },
            title: { display: true, text: 'Body Fat (%)', color: '#f59e0b' }
          }
        }
      }
    });
  }

  // ========================================
  // CP TREND CHART
  // ========================================
  async function drawCPTrend(canvasId) {
    var canvas = document.getElementById(canvasId);
    if (!canvas) return;
    destroy(canvasId);

    if (typeof PowerEngine === "undefined") return;
    if (typeof DB === "undefined" || !DB.getAll) return;

    try {
      var acts = await DB.getAll();
      var trend = await PowerEngine.getCPTrend(acts, 12);
      var valid = trend.filter(function(t) { return t.cp; });

      if (valid.length === 0) {
        var ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#9ca3af';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Brak danych CP — potrzeba więcej tempo/threshold runs', canvas.width/2, canvas.height/2);
        return;
      }

      var labels = valid.map(function(t) { return t.week_ending.slice(5); });
      var values = valid.map(function(t) { return t.cp; });

      // Target CP for 4:59
      var pred = PowerEngine.predictHMfromPower(values[values.length - 1], "4:59");
      var targetCP = pred ? pred.target_cp_needed : null;

      var datasets = [{
        label: 'CP (W)',
        data: values,
        borderColor: '#a855f7',
        backgroundColor: '#a855f720',
        tension: 0.3,
        pointRadius: 5,
        borderWidth: 3,
        fill: true
      }];

      if (targetCP) {
        datasets.push({
          label: 'Cel 4:59 (' + targetCP + 'W)',
          data: new Array(values.length).fill(targetCP),
          borderColor: '#10b981',
          borderDash: [10, 5],
          pointRadius: 0,
          fill: false
        });
      }

      _charts[canvasId] = new Chart(canvas, {
        type: 'line',
        data: { labels: labels, datasets: datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { labels: { color: '#d1d5db', font: { size: 11 } } },
            tooltip: { mode: 'index', intersect: false }
          },
          scales: {
            x: { ticks: { color: '#9ca3af', font: { size: 10 } }, grid: { color: '#374151' } },
            y: {
              ticks: { color: '#9ca3af', font: { size: 10 } },
              grid: { color: '#374151' },
              title: { display: true, text: 'Critical Power (W)', color: '#9ca3af' }
            }
          }
        }
      });
    } catch (e) { console.warn(TAG, "CP trend error", e); }
  }

  // ========================================
  // CORRELATIONS — Pearson coefficient
  // ========================================
  function pearson(x, y) {
    var n = x.length;
    if (n < 3) return null;
    var sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
    for (var i = 0; i < n; i++) {
      sumX += x[i]; sumY += y[i];
      sumXY += x[i] * y[i];
      sumX2 += x[i] * x[i]; sumY2 += y[i] * y[i];
    }
    var num = n * sumXY - sumX * sumY;
    var den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    if (den === 0) return null;
    return num / den;
  }

  function correlationStrength(r) {
    if (r === null) return "n/a";
    var abs = Math.abs(r);
    if (abs >= 0.7) return "silna";
    if (abs >= 0.4) return "umiarkowana";
    if (abs >= 0.2) return "słaba";
    return "brak";
  }

  function correlationColor(r) {
    if (r === null) return "#9ca3af";
    var abs = Math.abs(r);
    if (abs >= 0.7) return r > 0 ? "#22c55e" : "#ef4444";
    if (abs >= 0.4) return r > 0 ? "#84cc16" : "#f97316";
    return "#9ca3af";
  }

  async function computeCorrelations() {
    if (typeof HealthImport === "undefined") return null;
    if (typeof DB === "undefined" || !DB.getAll) return null;

    var health = HealthImport.getAll();
    var acts = await DB.getAll();

    // Mapa: data → activity (najnowsza jeśli kilka)
    var actMap = {};
    acts.forEach(function(a) {
      if (a.km > 0 && a.pace) {
        var paceSec = paceToSec(a.pace);
        if (paceSec > 0) actMap[a.date] = { pace: paceSec, km: a.km, hr: a.avg_hr || a.average_heartrate };
      }
    });

    var pairs = [];
    health.forEach(function(h) {
      var act = actMap[h.date];
      pairs.push({
        date: h.date,
        weight: h.weight,
        bf: h.bodyFat,
        rp: h.runningPower,
        gct: h.gct,
        stride: h.stride,
        vo: h.vo,
        wt: h.wristTemp,
        rr: h.respRate,
        hrv: h.hrv,
        rhr: h.rhr,
        pace: act ? act.pace : null,
        hr: act ? act.hr : null
      });
    });

    function extract(field1, field2) {
      var x = [], y = [];
      pairs.forEach(function(p) {
        if (p[field1] && p[field2] && p[field1] > 0 && p[field2] > 0) {
          x.push(p[field1]);
          y.push(p[field2]);
        }
      });
      return { x: x, y: y, n: x.length, r: pearson(x, y) };
    }

    // CP per workout (z PowerEngine)
    var workoutCP = [];
    if (typeof PowerEngine !== "undefined") {
      for (var i = 0; i < acts.length; i++) {
        var a = acts[i];
        var streams = a.strava_id ? DB.getStreams(a.strava_id) : null;
        if (!streams) continue;
        var pwr = PowerEngine.calculatePowerFromStreams(streams);
        if (pwr && pwr.np) {
          workoutCP.push({ date: a.date, np: pwr.np });
        }
      }
    }
    var cpMap = {};
    workoutCP.forEach(function(c) { cpMap[c.date] = c.np; });

    // Body Fat ↔ Power CP (match po dacie)
    var bfCpX = [], bfCpY = [];
    pairs.forEach(function(p) {
      if (p.bf && cpMap[p.date]) {
        bfCpX.push(p.bf); bfCpY.push(cpMap[p.date]);
      }
    });

    // 6 korelacji
    return {
      weight_pace: Object.assign({ title: "Waga ↔ Tempo", desc: "Czy redukcja wagi = szybsze tempo?" }, extract('weight', 'pace')),
      bf_cp: { title: "Body Fat ↔ CP", desc: "Czy mniej BF = wyższa moc?", x: bfCpX, y: bfCpY, n: bfCpX.length, r: pearson(bfCpX, bfCpY) },
      gct_pace: Object.assign({ title: "GCT ↔ Tempo", desc: "Czy krótszy GCT = szybsze tempo?" }, extract('gct', 'pace')),
      vo_pace: Object.assign({ title: "VO ↔ Tempo", desc: "Czy niższe VO = lepsza ekonomia?" }, extract('vo', 'pace')),
      wristtemp_hrv: Object.assign({ title: "Wrist Temp ↔ HRV", desc: "Czy temperatura wpływa na HRV?" }, extract('wt', 'hrv')),
      stride_pace: Object.assign({ title: "Stride ↔ Tempo", desc: "Czy dłuższy krok = szybsze tempo?" }, extract('stride', 'pace'))
    };
  }

  function renderCorrelations(containerId, correlations) {
    var el = document.getElementById(containerId);
    if (!el) return;

    if (!correlations) {
      el.innerHTML = '<p style="color:#9ca3af;text-align:center;padding:20px;">Korelacje niedostępne</p>';
      return;
    }

    var html = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px;">';
    
    Object.keys(correlations).forEach(function(key) {
      var c = correlations[key];
      var color = correlationColor(c.r);
      var strength = correlationStrength(c.r);
      var rStr = c.r !== null ? c.r.toFixed(3) : 'n/a';
      var direction = c.r > 0 ? '↗ pozytywna' : c.r < 0 ? '↘ negatywna' : '—';

      html += '<div style="background:#1f2937;border-left:4px solid ' + color + ';padding:14px;border-radius:8px;">';
      html += '<h4 style="margin:0 0 4px;color:#f9fafb;font-size:0.95em;">' + c.title + '</h4>';
      html += '<p style="margin:0 0 8px;color:#9ca3af;font-size:0.8em;">' + c.desc + '</p>';
      
      if (c.n < 3) {
        html += '<p style="margin:0;color:#fbbf24;font-size:0.85em;">⏳ Za mało danych (' + c.n + '/3)</p>';
      } else {
        html += '<div style="display:flex;gap:12px;align-items:center;margin-top:8px;">';
        html += '<div style="font-size:1.4em;font-weight:bold;color:' + color + ';">r = ' + rStr + '</div>';
        html += '<div style="font-size:0.85em;color:#d1d5db;">';
        html += '<div>' + direction + '</div>';
        html += '<div>siła: <b>' + strength + '</b></div>';
        html += '<div style="opacity:0.7;">n = ' + c.n + ' par</div>';
        html += '</div>';
        html += '</div>';
      }
      html += '</div>';
    });
    html += '</div>';

    el.innerHTML = html;
  }

  // ========================================
  // MAIN: RENDER ALL CHARTS
  // ========================================
  async function renderAll() {
    // Weight + Body Fat (dual axis)
    var weight = getHealthData('weight');
    var bf = getHealthData('bodyFat');
    drawDualAxisChart('bf-weight-bf', weight, bf);

    // Wrist Temp
    var wt = getHealthData('wristTemp');
    var wtBaseline = wt.length >= 3 ? wt.reduce(function(s,d){return s+d.value;}, 0) / wt.length : 0;
    drawTrendChart('bf-wrist-temp', wt, {
      label: 'Wrist Temperature',
      color: '#f97316',
      baseline: wtBaseline ? +wtBaseline.toFixed(2) : 0,
      unit: '°C',
      yLabel: '°C'
    });

    // Respiratory Rate
    var rr = getHealthData('respRate');
    var rrBaseline = rr.length >= 3 ? rr.reduce(function(s,d){return s+d.value;}, 0) / rr.length : 0;
    drawTrendChart('bf-resp-rate', rr, {
      label: 'Respiratory Rate',
      color: '#06b6d4',
      baseline: rrBaseline ? +rrBaseline.toFixed(1) : 0,
      unit: '/min',
      yLabel: '/min'
    });

    // Running Power
    var rp = getHealthData('runningPower');
    drawTrendChart('bf-running-power', rp, {
      label: 'Running Power',
      color: '#a855f7',
      unit: ' W',
      yLabel: 'Power (W)'
    });

    // GCT
    var gct = getHealthData('gct');
    drawTrendChart('bf-gct', gct, {
      label: 'Ground Contact Time',
      color: '#84cc16',
      unit: ' ms',
      yLabel: 'GCT (ms)'
    });

    // Stride
    var stride = getHealthData('stride');
    drawTrendChart('bf-stride', stride, {
      label: 'Stride Length',
      color: '#eab308',
      unit: ' m',
      yLabel: 'Stride (m)'
    });

    // VO
    var vo = getHealthData('vo');
    drawTrendChart('bf-vo', vo, {
      label: 'Vertical Oscillation',
      color: '#ec4899',
      unit: ' cm',
      yLabel: 'VO (cm)'
    });

    // CP Trend (12 weeks)
    await drawCPTrend('bf-cp-trend');

    // Korelacje
    var correlations = await computeCorrelations();
    renderCorrelations('bf-correlations', correlations);
  }

  return {
    renderAll: renderAll,
    computeCorrelations: computeCorrelations,
    pearson: pearson
  };
})();

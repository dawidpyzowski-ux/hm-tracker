/**
 * HM Tracker PWA - analytics.js (Sprint 7: Power / GAP / Split analytics)
 * Global: Analytics.render(), Analytics.drawCharts()
 */
var Analytics = (function() {
  var _charts = {};
  function _destroy(k) { if (_charts[k]) { _charts[k].destroy(); delete _charts[k]; } }

  function _weight() {
    var w = parseFloat(localStorage.getItem('hm_user_weight'));
    if (w && w > 0) return w;
    try { var s = S.getSettings(); if (s && s.weight) return s.weight; } catch(e) {}
    return 75;
  }
  function _maxHR() {
    var m = parseInt(localStorage.getItem('hm_user_max_hr'), 10);
    return (m && m > 100) ? m : 190;
  }
  function _restHR() {
    var r = parseInt(localStorage.getItem('hm_user_rest_hr'), 10);
    if (r && r > 30) return r;
    try { var s = S.getSettings(); if (s && s.rhr) return s.rhr; } catch(e) {}
    return 50;
  }

  function _sa(streams, key) {
    if (!streams || !streams[key]) return null;
    if (Array.isArray(streams[key])) return streams[key];
    if (streams[key].data && Array.isArray(streams[key].data)) return streams[key].data;
    return null;
  }

  function _getStrava(sid) {
    var det = null, str = null;
    var sidStr = String(sid);
    var dP = ['strava_detail_','hm_strava_detail_','hm_detail_','detail_'];
    var sP = ['strava_streams_','hm_strava_streams_','hm_streams_','streams_'];
    var i, raw;
    for (i = 0; i < dP.length; i++) { raw = localStorage.getItem(dP[i]+sidStr); if (raw) { try{det=JSON.parse(raw);}catch(e){} break; } }
    for (i = 0; i < sP.length; i++) { raw = localStorage.getItem(sP[i]+sidStr); if (raw) { try{str=JSON.parse(raw);}catch(e){} break; } }
    return { det: det, str: str };
  }

  function _paceToSec(p) {
    if (!p) return 360;
    var parts = p.split(':');
    return (+parts[0]) * 60 + (+parts[1] || 0);
  }

  function _weekKey(dateStr) {
    var d = new Date(dateStr);
    var j1 = new Date(d.getFullYear(), 0, 1);
    var wn = Math.ceil(((d - j1) / 86400000 + j1.getDay() + 1) / 7);
    return d.getFullYear() + '-W' + (wn < 10 ? '0' : '') + wn;
  }

  function _minettiCost(grade) {
    var i = grade;
    return 155.4*Math.pow(i,5) - 30.4*Math.pow(i,4) - 43.3*Math.pow(i,3)
         + 46.3*Math.pow(i,2) + 19.5*i + 3.6;
  }

  function _powerStream(str) {
    var vel = _sa(str, 'velocity_smooth');
    var alt = _sa(str, 'altitude');
    var tm = _sa(str, 'time');
    var dst = _sa(str, 'distance');
    if (!vel || !alt || !tm || vel.length < 3) return null;
    var mass = _weight(), n = vel.length, pw = [], i;
    for (i = 0; i < n; i++) pw.push(0);
    for (i = 1; i < n - 1; i++) {
      var dd = (dst ? dst[i+1]-dst[i-1] : vel[i]*(tm[i+1]-tm[i-1])) || 1;
      var gr = (alt[i+1]-alt[i-1]) / Math.max(dd, 0.1);
      gr = Math.max(-0.5, Math.min(0.5, gr));
      var c = _minettiCost(gr);
      var metab = c * mass * vel[i];
      var mech = metab * 0.25;
      var air = 0.5 * 1.225 * 0.9 * 0.5 * Math.pow(vel[i], 3);
      pw[i] = Math.max(0, mech + air);
    }
    pw[0] = pw[1]; pw[n-1] = pw[n-2];
    return pw;
  }

  function _gapStream(str) {
    var vel = _sa(str, 'velocity_smooth');
    var alt = _sa(str, 'altitude');
    var dst = _sa(str, 'distance');
    var tm = _sa(str, 'time');
    if (!vel || !alt || vel.length < 3) return null;
    var cf = _minettiCost(0), n = vel.length, g = [], i;
    for (i = 0; i < n; i++) g.push(0);
    for (i = 1; i < n - 1; i++) {
      var dd = (dst ? dst[i+1]-dst[i-1] : vel[i]*(tm[i+1]-tm[i-1])) || 1;
      var gr = (alt[i+1]-alt[i-1]) / Math.max(dd, 0.1);
      gr = Math.max(-0.5, Math.min(0.5, gr));
      var cg = _minettiCost(gr);
      g[i] = (cf > 0 && cg > 0) ? vel[i]*(cg/cf) : vel[i];
    }
    g[0] = g[1]; g[n-1] = g[n-2];
    return g;
  }

  function _vo2max(spd, hr, mxHR, elevGain, dist) {
    if (!spd || spd <= 0 || !hr || hr <= 0) return null;
    var maxH = mxHR || _maxHR();
    var rHR = _restHR();
    var hrRes = maxH - rHR;
    if (hrRes <= 0) return null;
    var pctHRR = (hr - rHR) / hrRes;
    var frac = Math.max(0.3, Math.min(1.0, 0.8 * pctHRR + 0.15));
    var spm = spd * 60;
    var gc = 0;
    if (elevGain && dist && dist > 0) gc = spm * 0.9 * (elevGain / dist);
    var vo2 = (spm * 0.2 + gc + 3.5) / frac;
    return (vo2 > 20 && vo2 < 90) ? Math.round(vo2 * 10) / 10 : null;
  }

  function _classify(spd, distKm, str) {
    var avgPace = spd > 0 ? (1000 / spd) : 999;
    var cv = 0;
    if (str) {
      var vel = _sa(str, 'velocity_smooth');
      var dst = _sa(str, 'distance');
      if (vel && dst && vel.length > 20) {
        var td = dst[dst.length - 1];
        var wu = 2000, cd = Math.max(td - 1500, wu + 500);
        var ws = [];
        for (var i = 0; i < vel.length; i++) {
          if (dst[i] >= wu && dst[i] <= cd && vel[i] > 0.5) ws.push(vel[i]);
        }
        if (ws.length > 10) {
          var mn = 0;
          for (i = 0; i < ws.length; i++) mn += ws[i];
          mn /= ws.length;
          var vr = 0;
          for (i = 0; i < ws.length; i++) vr += Math.pow(ws[i] - mn, 2);
          vr /= ws.length;
          cv = Math.sqrt(vr) / mn;
        }
      }
    }
    if (cv > 0.25) return 'Interwal';
    if (distKm >= 18) return 'Dlugi';
    if (avgPace < 300) return 'Tempo';
    if (distKm >= 12 && avgPace < 360) return 'Tempo';
    return 'Easy';
  }

  function _collectAll() {
    var logs, items = [];
    try { logs = S.getAllLogs(); } catch(e) { return items; }
    var dates = Object.keys(logs);
    for (var di = 0; di < dates.length; di++) {
      var date = dates[di];
      var l = logs[date];
      if (!l.distance) continue;
      var sid = l.strava_id;
      var det = null, str = null;
      if (sid) { var sd = _getStrava(sid); det = sd.det; str = sd.str; }

      var distKm = parseFloat(l.distance);
      var distM = distKm * 1000;
      var spd = l.pace ? (1000 / _paceToSec(l.pace)) : null;
      var hr = l.hr ? +l.hr : null;
      var mxHR = det ? det.max_hr : null;
      var elev = det ? det.total_elevation_gain : null;

      var pw = str ? _powerStream(str) : null;
      var gs = str ? _gapStream(str) : null;
      var avgPwr = null;
      if (pw) { var pSum = 0; for (var pi = 0; pi < pw.length; pi++) pSum += pw[pi]; avgPwr = Math.round(pSum / pw.length); }
      var avgGapSpd = null;
      if (gs) { var gSum = 0; for (var gi = 0; gi < gs.length; gi++) gSum += gs[gi]; avgGapSpd = gSum / gs.length; }

      var splits = det ? det.splits : null;
      var bestKm = null, splitRatio = null, consistency = null;
      if (splits && splits.length > 0) {
        var full = [];
        for (var fi = 0; fi < splits.length; fi++) { if (splits[fi].distance >= 900) full.push(splits[fi]); }
        if (full.length) {
          var fastest = full[0];
          for (fi = 1; fi < full.length; fi++) { if (full[fi].average_speed > fastest.average_speed) fastest = full[fi]; }
          bestKm = 1000 / fastest.average_speed;
        }
        if (splits.length >= 2) {
          var half = Math.floor(splits.length / 2);
          var f1s = 0, f2s = 0;
          for (fi = 0; fi < half; fi++) f1s += splits[fi].average_speed;
          for (fi = half; fi < splits.length; fi++) f2s += splits[fi].average_speed;
          f1s /= half; f2s /= (splits.length - half);
          if (f1s > 0) splitRatio = f2s / f1s;
        }
        if (full.length >= 3) {
          var sp2 = [];
          for (fi = 0; fi < full.length; fi++) sp2.push(full[fi].average_speed);
          var mn2 = 0;
          for (fi = 0; fi < sp2.length; fi++) mn2 += sp2[fi];
          mn2 /= sp2.length;
          var std2 = 0;
          for (fi = 0; fi < sp2.length; fi++) std2 += Math.pow(sp2[fi] - mn2, 2);
          std2 = Math.sqrt(std2 / sp2.length);
          consistency = Math.max(0, Math.round((1 - std2/mn2) * 100));
        }
      }

      items.push({
        date: date, week: _weekKey(date + 'T12:00:00'),
        distKm: distKm, spd: spd, hr: hr, mxHR: mxHR,
        vo2: _vo2max(spd, hr, mxHR, elev, distM),
        type: _classify(spd, distKm, str),
        avgPwr: avgPwr,
        pwRatio: avgPwr ? (avgPwr / _weight()).toFixed(2) : null,
        avgGapSpd: avgGapSpd, bestKm: bestKm,
        splitRatio: splitRatio, consistency: consistency
      });
    }
    items.sort(function(a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    return items;
  }

  function _findPRs(items) {
    var prs = [], i;
    var bk = null;
    for (i = 0; i < items.length; i++) { if (items[i].bestKm && (!bk || items[i].bestKm < bk)) bk = items[i].bestKm; }
    if (bk) { var m = Math.floor(bk/60), s = Math.round(bk%60); prs.push({ label: 'Najszybszy km', value: m + ':' + (s<10?'0':'') + s + '/km' }); }
    var lr = 0;
    for (i = 0; i < items.length; i++) { if (items[i].distKm > lr) lr = items[i].distKm; }
    if (lr > 0) prs.push({ label: 'Najdluzszy bieg', value: lr.toFixed(1) + ' km' });
    var hv = null;
    for (i = 0; i < items.length; i++) { if (items[i].vo2 && (!hv || items[i].vo2 > hv)) hv = items[i].vo2; }
    if (hv) prs.push({ label: 'Najwyzszy VO2max', value: hv + ' ml/kg/min' });
    var hp = null;
    for (i = 0; i < items.length; i++) { if (items[i].avgPwr && (!hp || items[i].avgPwr > hp)) hp = items[i].avgPwr; }
    if (hp) prs.push({ label: 'Najwyzsza moc', value: hp + ' W' });
    var bc = null;
    for (i = 0; i < items.length; i++) { if (items[i].consistency !== null && (bc === null || items[i].consistency > bc)) bc = items[i].consistency; }
    if (bc !== null) prs.push({ label: 'Najlepsza rownomiernosc', value: bc + '%' });
    return prs;
  }

  function _pTick(v) {
    var m = Math.floor(v/60), s = Math.round(v%60);
    return m + ':' + (s<10?'0':'') + s;
  }

  // ======== render() ========
  function render() {
    var items = _collectAll();
    if (items.length < 2) return '';

    var h = '<div class="stit">\uD83D\uDCC8 Zaawansowana analityka</div>';

    var prs = _findPRs(items);
    if (prs.length) {
      h += '<div class="chart-section"><h3>\uD83C\uDFC6 Rekordy osobiste</h3><div class="stat-grid">';
      for (var pi = 0; pi < prs.length; pi++) {
        h += '<div class="stat"><span class="stat-label">' + prs[pi].label + '</span><span class="stat-value">' + prs[pi].value + '</span></div>';
      }
      h += '</div></div>';
    }

    h += '<div class="chart-section"><h3>\uD83E\uDEC1 Trend VO\u2082max</h3><canvas id="an-vo2"></canvas></div>';
    h += '<div class="chart-section"><h3>\uD83C\uDFCB Rozklad typow treningu</h3><canvas id="an-tdist"></canvas></div>';

    var hasPwr = false, hasGap = false, hasBest = false, hasCon = false;
    for (var i = 0; i < items.length; i++) {
      if (items[i].avgPwr) hasPwr = true;
      if (items[i].avgGapSpd) hasGap = true;
      if (items[i].bestKm) hasBest = true;
      if (items[i].consistency !== null) hasCon = true;
    }
    if (hasPwr) h += '<div class="chart-section"><h3>\u26A1 Trend mocy</h3><canvas id="an-pwr"></canvas></div>';
    if (hasGap) h += '<div class="chart-section"><h3>\uD83C\uDFD4 GAP vs Tempo</h3><canvas id="an-gap"></canvas></div>';
    if (hasBest) h += '<div class="chart-section"><h3>\uD83D\uDE80 Najszybszy km</h3><canvas id="an-bestkm"></canvas></div>';
    if (hasCon) h += '<div class="chart-section"><h3>\uD83D\uDCCA Rownomiernosc / Split ratio</h3><canvas id="an-consist"></canvas></div>';

    var wm = {};
    for (i = 0; i < items.length; i++) {
      var a = items[i];
      if (!wm[a.week]) wm[a.week] = { d:0, r:0, vo2:[], pwr:[] };
      wm[a.week].d += a.distKm; wm[a.week].r++;
      if (a.vo2) wm[a.week].vo2.push(a.vo2);
      if (a.avgPwr) wm[a.week].pwr.push(a.avgPwr);
    }
    var weeks = Object.keys(wm).sort();
    h += '<div class="table-section"><h3>\uD83D\uDCCB Podsumowanie tygodniowe</h3>';
    h += '<table class="analytics-table"><thead><tr><th>Tydzien</th><th>Biegi</th><th>Dystans</th><th>VO\u2082max</th><th>Moc</th></tr></thead><tbody>';
    for (i = 0; i < weeks.length; i++) {
      var wd = wm[weeks[i]];
      var av = '--', ap = '--';
      if (wd.vo2.length) { var vs = 0; for (var vi = 0; vi < wd.vo2.length; vi++) vs += wd.vo2[vi]; av = (vs/wd.vo2.length).toFixed(1); }
      if (wd.pwr.length) { var ps = 0; for (var ppi = 0; ppi < wd.pwr.length; ppi++) ps += wd.pwr[ppi]; ap = Math.round(ps/wd.pwr.length) + 'W'; }
      h += '<tr><td>' + weeks[i] + '</td><td>' + wd.r + '</td><td>' + wd.d.toFixed(1) + ' km</td><td>' + av + '</td><td>' + ap + '</td></tr>';
    }
    h += '</tbody></table></div>';
    return h;
  }

  // ======== drawCharts() ========
  function drawCharts() {
    var items = _collectAll();
    if (items.length < 2) return;
    var i, key, cv, labels, wArr;

    // 1. VO2max
    wArr = [];
    for (i = 0; i < items.length; i++) { if (items[i].vo2) wArr.push(items[i]); }
    if (wArr.length) {
      _destroy('an-vo2');
      cv = document.getElementById('an-vo2');
      if (cv) {
        labels = []; var vData = [];
        for (i = 0; i < wArr.length; i++) { labels.push(wArr[i].date.slice(5)); vData.push(wArr[i].vo2); }
        _charts['an-vo2'] = new Chart(cv.getContext('2d'), {
          type: 'line',
          data: { labels: labels, datasets: [{ label: 'VO2max', data: vData,
            borderColor: 'rgba(0,158,115,0.9)', backgroundColor: 'rgba(0,158,115,0.1)',
            fill: true, tension: 0.3, pointRadius: 3 }] },
          options: { responsive: true, scales: { y: { title: { display: true, text: 'ml/kg/min' } } } }
        });
      }
    }

    // 2. Training type donut
    _destroy('an-tdist');
    cv = document.getElementById('an-tdist');
    if (cv) {
      var tc = { Easy:0, Tempo:0, Interwal:0, Dlugi:0 };
      for (i = 0; i < items.length; i++) { if (tc.hasOwnProperty(items[i].type)) tc[items[i].type]++; }
      var tKeys = ['Easy','Tempo','Interwal','Dlugi'];
      var tCols = ['rgba(86,180,233,0.7)','rgba(230,159,0,0.7)','rgba(213,94,0,0.7)','rgba(0,158,115,0.7)'];
      var tVals = [];
      for (i = 0; i < tKeys.length; i++) tVals.push(tc[tKeys[i]]);
      _charts['an-tdist'] = new Chart(cv.getContext('2d'), {
        type: 'doughnut',
        data: { labels: tKeys, datasets: [{ data: tVals, backgroundColor: tCols }] },
        options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
      });
    }

    // 3. Power trend
    wArr = [];
    for (i = 0; i < items.length; i++) { if (items[i].avgPwr) wArr.push(items[i]); }
    if (wArr.length) {
      _destroy('an-pwr');
      cv = document.getElementById('an-pwr');
      if (cv) {
        labels = []; var pwD = [], prD = [];
        for (i = 0; i < wArr.length; i++) { labels.push(wArr[i].date.slice(5)); pwD.push(wArr[i].avgPwr); prD.push(parseFloat(wArr[i].pwRatio)); }
        _charts['an-pwr'] = new Chart(cv.getContext('2d'), {
          type: 'line',
          data: { labels: labels, datasets: [
            { label: 'Avg Power (W)', data: pwD, borderColor: 'rgba(120,60,200,0.9)', backgroundColor: 'rgba(120,60,200,0.1)', fill: true, tension: 0.3, pointRadius: 3 },
            { label: 'P:W (W/kg)', data: prD, borderColor: 'rgba(200,60,120,0.9)', fill: false, tension: 0.3, pointRadius: 3, yAxisID: 'y1' }
          ]},
          options: { responsive: true, scales: {
            y: { title: { display: true, text: 'W' }, position: 'left' },
            y1: { title: { display: true, text: 'W/kg' }, position: 'right', grid: { drawOnChartArea: false } }
          }}
        });
      }
    }

    // 4. GAP vs Pace
    wArr = [];
    for (i = 0; i < items.length; i++) { if (items[i].avgGapSpd && items[i].spd) wArr.push(items[i]); }
    if (wArr.length) {
      _destroy('an-gap');
      cv = document.getElementById('an-gap');
      if (cv) {
        labels = []; var apD = [], agD = [];
        for (i = 0; i < wArr.length; i++) { labels.push(wArr[i].date.slice(5)); apD.push(Math.round(1000/wArr[i].spd)); agD.push(Math.round(1000/wArr[i].avgGapSpd)); }
        _charts['an-gap'] = new Chart(cv.getContext('2d'), {
          type: 'line',
          data: { labels: labels, datasets: [
            { label: 'Tempo (s/km)', data: apD, borderColor: 'rgba(86,180,233,0.9)', tension: 0.3, pointRadius: 3 },
            { label: 'GAP (s/km)', data: agD, borderColor: 'rgba(230,159,0,0.9)', tension: 0.3, pointRadius: 3 }
          ]},
          options: { responsive: true,
            scales: { y: { reverse: true, title: { display: true, text: 's/km' }, ticks: { callback: _pTick } } },
            plugins: { tooltip: { callbacks: { label: function(ctx) { return ctx.dataset.label + ': ' + _pTick(ctx.raw) + '/km'; } } } }
          }
        });
      }
    }

    // 5. Best km
    wArr = [];
    for (i = 0; i < items.length; i++) { if (items[i].bestKm) wArr.push(items[i]); }
    if (wArr.length) {
      _destroy('an-bestkm');
      cv = document.getElementById('an-bestkm');
      if (cv) {
        labels = []; var bkD = [];
        for (i = 0; i < wArr.length; i++) { labels.push(wArr[i].date.slice(5)); bkD.push(Math.round(wArr[i].bestKm)); }
        _charts['an-bestkm'] = new Chart(cv.getContext('2d'), {
          type: 'line',
          data: { labels: labels, datasets: [{ label: 'Najszybszy km (s/km)', data: bkD,
            borderColor: 'rgba(213,94,0,0.9)', backgroundColor: 'rgba(213,94,0,0.1)',
            fill: true, tension: 0.3, pointRadius: 3 }] },
          options: { responsive: true, scales: { y: { reverse: true, title: { display: true, text: 's/km' }, ticks: { callback: _pTick } } } }
        });
      }
    }

    // 6. Consistency
    wArr = [];
    for (i = 0; i < items.length; i++) { if (items[i].consistency !== null && items[i].splitRatio !== null) wArr.push(items[i]); }
    if (wArr.length) {
      _destroy('an-consist');
      cv = document.getElementById('an-consist');
      if (cv) {
        labels = []; var cD = [], sD = [];
        for (i = 0; i < wArr.length; i++) { labels.push(wArr[i].date.slice(5)); cD.push(wArr[i].consistency); sD.push(Math.round(wArr[i].splitRatio*100)/100); }
        _charts['an-consist'] = new Chart(cv.getContext('2d'), {
          type: 'bar',
          data: { labels: labels, datasets: [
            { label: 'Rownomiernosc (%)', data: cD, backgroundColor: 'rgba(0,158,115,0.6)', yAxisID: 'y' },
            { label: 'Split ratio (>1=neg.split)', data: sD, type: 'line', borderColor: 'rgba(230,159,0,0.9)', pointRadius: 4, tension: 0.3, yAxisID: 'y1' }
          ]},
          options: { responsive: true, scales: {
            y: { title: { display: true, text: '%' }, position: 'left', min: 0, max: 100 },
            y1: { title: { display: true, text: 'Ratio' }, position: 'right', grid: { drawOnChartArea: false } }
          }}
        });
      }
    }
  }

  return { render: render, drawCharts: drawCharts };
})();

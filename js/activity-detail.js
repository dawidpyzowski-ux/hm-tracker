/**
 * HM Tracker PWA - activity-detail.js (Sprint 7)
 * ActDetail.render(sid), ActDetail.drawCharts(sid)
 */
var ActDetail = (function() {
  var _charts = {};
  function _destroy(key) { if (_charts[key]) { _charts[key].destroy(); delete _charts[key]; } }

  var G = 9.81, RHO = 1.225, CD = 0.9, FA = 0.5, CR = 0.01;

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

  function _sa(streams, key) {
    if (!streams || !streams[key]) return null;
    if (Array.isArray(streams[key])) return streams[key];
    if (streams[key].data && Array.isArray(streams[key].data)) return streams[key].data;
    return null;
  }

  function _findLog(sid) {
    var sidStr = String(sid);
    try {
      var logs = S.getAllLogs();
      var dates = Object.keys(logs);
      for (var i = 0; i < dates.length; i++) {
        var l = logs[dates[i]];
        if (l.strava_id && String(l.strava_id) == sidStr) return { log: l, date: dates[i] };
      }
    } catch(e) {}
    return null;
  }

  function _getData(sid) {
    var detail = null, streams = null;
    var sidStr = String(sid);
    var dPre = ['strava_detail_','hm_strava_detail_','hm_detail_','detail_'];
    var sPre = ['strava_streams_','hm_strava_streams_','hm_streams_','streams_'];
    var i, raw;
    for (i = 0; i < dPre.length; i++) {
      raw = localStorage.getItem(dPre[i] + sidStr);
      if (raw) { try { detail = JSON.parse(raw); } catch(e) {} break; }
    }
    for (i = 0; i < sPre.length; i++) {
      raw = localStorage.getItem(sPre[i] + sidStr);
      if (raw) { try { streams = JSON.parse(raw); } catch(e) {} break; }
    }
    var found = _findLog(sid);
    return { detail: detail, streams: streams, log: found ? found.log : null, date: found ? found.date : null };
  }

  function _fmtPace(ms) {
    if (!ms || ms <= 0) return '--:--';
    var s = 1000 / ms, m = Math.floor(s / 60), sc = Math.round(s % 60);
    return m + ':' + (sc < 10 ? '0' : '') + sc;
  }
  function _fmtTime(sec) {
    if (!sec || sec <= 0) return '0:00';
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    var s = Math.round(sec % 60);
    if (h > 0) return h + ':' + (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }
  function _paceToSec(p) {
    if (!p) return 0;
    var parts = p.split(':');
    return (+parts[0]) * 60 + (+parts[1] || 0);
  }

  function _minettiCost(grade) {
    var i = grade;
    return 155.4*Math.pow(i,5) - 30.4*Math.pow(i,4) - 43.3*Math.pow(i,3)
         + 46.3*Math.pow(i,2) + 19.5*i + 3.6;
  }

  function _calcPower(v, grade, mass) {
    var c = _minettiCost(grade);
    var metab = c * mass * v;
    var mech = metab * 0.25;
    var air = 0.5 * RHO * CD * FA * Math.pow(v, 3);
    return Math.max(0, mech + air);
  }

  function _powerStream(streams) {
    var vel = _sa(streams, 'velocity_smooth');
    var alt = _sa(streams, 'altitude');
    var tm = _sa(streams, 'time');
    var dst = _sa(streams, 'distance');
    if (!vel || !alt || !tm || vel.length < 3) return null;
    var mass = _weight(), n = vel.length, pw = [], i;
    for (i = 0; i < n; i++) pw.push(0);
    for (i = 1; i < n - 1; i++) {
      var dd = (dst ? dst[i+1] - dst[i-1] : vel[i] * (tm[i+1] - tm[i-1])) || 1;
      var gr = (alt[i+1] - alt[i-1]) / Math.max(dd, 0.1);
      gr = Math.max(-0.5, Math.min(0.5, gr));
      pw[i] = _calcPower(vel[i], gr, mass);
    }
    pw[0] = pw[1]; pw[n-1] = pw[n-2];
    return pw;
  }

  function _normalizedPower(pw, tm) {
    if (!pw || pw.length < 30 || !tm) return null;
    var rolling = [], ws = 0, wSum = 0, wC = 0, i;
    for (i = 0; i < pw.length; i++) {
      wSum += pw[i]; wC++;
      while (tm[i] - tm[ws] > 30) { wSum -= pw[ws]; wC--; ws++; }
      if (wC > 0) rolling.push(wSum / wC);
    }
    if (!rolling.length) return null;
    var a4 = 0;
    for (i = 0; i < rolling.length; i++) a4 += Math.pow(rolling[i], 4);
    a4 /= rolling.length;
    return Math.pow(a4, 0.25);
  }

  function _gapSpeed(v, grade) {
    var cf = _minettiCost(0), cg = _minettiCost(grade);
    return (cf > 0 && cg > 0) ? v * (cg / cf) : v;
  }

  function _gapStream(streams) {
    var vel = _sa(streams, 'velocity_smooth');
    var alt = _sa(streams, 'altitude');
    var dst = _sa(streams, 'distance');
    var tm = _sa(streams, 'time');
    if (!vel || !alt || vel.length < 3) return null;
    var n = vel.length, g = [], i;
    for (i = 0; i < n; i++) g.push(0);
    for (i = 1; i < n - 1; i++) {
      var dd = (dst ? dst[i+1]-dst[i-1] : vel[i]*(tm[i+1]-tm[i-1])) || 1;
      var gr = (alt[i+1]-alt[i-1]) / Math.max(dd, 0.1);
      gr = Math.max(-0.5, Math.min(0.5, gr));
      g[i] = _gapSpeed(vel[i], gr);
    }
    g[0] = g[1]; g[n-1] = g[n-2];
    return g;
  }

  // Laps = workout segments (intervals, warmup, cooldown etc.)
  function _buildLaps(detail) {
    var laps = [];
    if (!detail || !detail.laps || detail.laps.length === 0) return laps;
    for (var idx = 0; idx < detail.laps.length; idx++) {
      var lp = detail.laps[idx];
      laps.push({
        i: idx + 1,
        name: lp.name || ('Lap ' + (idx+1)),
        dist: lp.distance || 0,
        time: lp.moving_time || lp.elapsed_time || 0,
        pace: _fmtPace(lp.average_speed),
        hr: lp.average_heartrate ? Math.round(lp.average_heartrate) : '--',
        pwr: lp.average_watts ? Math.round(lp.average_watts) : '--',
        elev: lp.total_elevation_gain ? Math.round(lp.total_elevation_gain) : 0,
        pSec: lp.average_speed > 0 ? 1000/lp.average_speed : 9999
      });
    }
    return laps;
  }

  // Splits = per-km with GAP
  function _buildSplits(detail, streams, pwStream) {
    var splits = [];
    if (!detail || !detail.splits || detail.splits.length === 0) return splits;
    var hrD = _sa(streams, 'heartrate');
    var altD = _sa(streams, 'altitude');
    var dstD = _sa(streams, 'distance');

    for (var idx = 0; idx < detail.splits.length; idx++) {
      var sp = detail.splits[idx];
      var avgSpd = sp.average_speed || (sp.distance / sp.moving_time);
      var gapSpd = sp.average_grade_adjusted_speed || avgSpd;
      var eg = 0, el2 = 0, pS = 0, pC = 0;

      if (dstD && pwStream) {
        var ls = 0;
        for (var k = 0; k < idx; k++) ls += detail.splits[k].distance;
        var le = ls + sp.distance;
        for (var j = 0; j < dstD.length; j++) {
          if (dstD[j] >= ls && dstD[j] <= le) {
            if (pwStream[j]) { pS += pwStream[j]; pC++; }
            if (altD && j > 0 && dstD[j-1] >= ls) {
              var da = altD[j] - altD[j-1];
              if (da > 0) eg += da; else el2 += Math.abs(da);
            }
          }
        }
      }

      splits.push({
        i: idx + 1,
        dist: sp.distance,
        time: sp.moving_time,
        pace: _fmtPace(avgSpd),
        gap: _fmtPace(gapSpd),
        hr: sp.average_heartrate ? Math.round(sp.average_heartrate) : '--',
        pwr: pC > 0 ? Math.round(pS/pC) : '--',
        eg: Math.round(eg),
        el: Math.round(el2),
        pSec: avgSpd > 0 ? 1000/avgSpd : 9999,
        gSec: gapSpd > 0 ? 1000/gapSpd : 9999
      });
    }
    return splits;
  }

  function _paceColor(sec, mn, mx) {
    var range = mx - mn || 1;
    var ratio = Math.max(0, Math.min(1, (sec - mn) / range));
    return 'rgb(' + Math.round(255*ratio) + ',' + Math.round(255*(1-ratio)) + ',60)';
  }

  function _hrZones() {
    var mx = _maxHR();
    return [
      { n:'Z1 Recovery', mn:0, mx:mx*0.60, c:'rgba(150,150,150,0.35)' },
      { n:'Z2 Easy', mn:mx*0.60, mx:mx*0.70, c:'rgba(86,180,233,0.35)' },
      { n:'Z3 Aerobic', mn:mx*0.70, mx:mx*0.80, c:'rgba(0,158,115,0.35)' },
      { n:'Z4 Threshold', mn:mx*0.80, mx:mx*0.90, c:'rgba(240,228,66,0.35)' },
      { n:'Z5 Max', mn:mx*0.90, mx:mx*1.00, c:'rgba(213,94,0,0.35)' }
    ];
  }

  // ======== render(sid) ========
  function render(sid) {
    var data = _getData(sid);
    var det = data.detail;
    var str = data.streams;
    var log = data.log;
    if (!det && !log) return '<div class="empty">Brak danych szczegolowych. Zsynchronizuj Strave.</div>';

    var pwStr = str ? _powerStream(str) : null;
    var gapStr = str ? _gapStream(str) : null;
    var laps = _buildLaps(det);
    var splits = _buildSplits(det, str, pwStr);

    // Summary stats from LOG + DETAIL
    var distKm = log && log.distance ? parseFloat(log.distance) : 0;
    var paceStr = log && log.pace ? log.pace : '--:--';
    var avgHR = log && log.hr ? log.hr : '--';
    var elev = det && det.total_elevation_gain ? Math.round(det.total_elevation_gain) : 0;

    var movTime = 0;
    if (det && det.splits) {
      for (var si = 0; si < det.splits.length; si++) movTime += (det.splits[si].moving_time || 0);
    }
    var durStr = _fmtTime(movTime);

    var avgPwr = '--', maxPwr = '--', normPwr = '--';
    if (pwStr) {
      var pSum = 0, pMax = 0;
      for (var pi = 0; pi < pwStr.length; pi++) { pSum += pwStr[pi]; if (pwStr[pi] > pMax) pMax = pwStr[pi]; }
      avgPwr = Math.round(pSum / pwStr.length);
      maxPwr = Math.round(pMax);
      var tmD = _sa(str, 'time');
      var np = _normalizedPower(pwStr, tmD);
      normPwr = np ? Math.round(np) : '--';
    }

    var overallGAP = '--';
    if (gapStr) {
      var gSum = 0;
      for (var gi = 0; gi < gapStr.length; gi++) gSum += gapStr[gi];
      overallGAP = _fmtPace(gSum / gapStr.length);
    }

    var h = '<div class="detail-summary"><div class="stat-grid">';
    h += '<div class="stat"><span class="stat-label">Dystans</span><span class="stat-value">' + distKm.toFixed(1) + ' km</span></div>';
    h += '<div class="stat"><span class="stat-label">Czas</span><span class="stat-value">' + durStr + '</span></div>';
    h += '<div class="stat"><span class="stat-label">Tempo</span><span class="stat-value">' + paceStr + ' /km</span></div>';
    h += '<div class="stat"><span class="stat-label">GAP</span><span class="stat-value">' + overallGAP + ' /km</span></div>';
    h += '<div class="stat"><span class="stat-label">Avg HR</span><span class="stat-value">' + avgHR + ' bpm</span></div>';
    h += '<div class="stat"><span class="stat-label">Przewyzszenie</span><span class="stat-value">' + elev + ' m</span></div>';
    h += '<div class="stat"><span class="stat-label">Avg Power</span><span class="stat-value">' + avgPwr + ' W</span></div>';
    h += '<div class="stat"><span class="stat-label">Norm Power</span><span class="stat-value">' + normPwr + ' W</span></div>';
    h += '<div class="stat"><span class="stat-label">Max Power</span><span class="stat-value">' + maxPwr + ' W</span></div>';
    h += '</div></div>';

    // --- LAPS TABLE (workout segments) ---
    if (laps.length > 0) {
      var lpArr = [];
      for (var li0 = 0; li0 < laps.length; li0++) lpArr.push(laps[li0].pSec);
      var lmn = Math.min.apply(null, lpArr), lmx = Math.max.apply(null, lpArr);

      h += '<div class="table-section"><h3>Okrazenia (segmenty treningu)</h3>';
      h += '<table class="laps-table"><thead><tr>';
      h += '<th>#</th><th>Nazwa</th><th>Dyst</th><th>Czas</th><th>Tempo</th>';
      h += '<th>HR</th><th>Moc</th><th>Przewyzszenie</th></tr></thead><tbody>';
      for (var ti0 = 0; ti0 < laps.length; ti0++) {
        var lp = laps[ti0];
        var bg0 = _paceColor(lp.pSec, lmn, lmx);
        h += '<tr style="background:' + bg0 + '22">';
        h += '<td>' + lp.i + '</td>';
        h += '<td>' + lp.name + '</td>';
        h += '<td>' + (lp.dist/1000).toFixed(2) + '</td>';
        h += '<td>' + _fmtTime(lp.time) + '</td>';
        h += '<td><strong>' + lp.pace + '</strong></td>';
        h += '<td>' + lp.hr + '</td>';
        h += '<td>' + (lp.pwr !== '--' ? lp.pwr + 'W' : '--') + '</td>';
        h += '<td>+' + lp.elev + 'm</td></tr>';
      }
      h += '</tbody></table></div>';
    }

    // --- SPLITS TABLE (per-km) ---
    if (splits.length > 0) {
      var spArr = [];
      for (var li2 = 0; li2 < splits.length; li2++) spArr.push(splits[li2].gSec);
      var smn = Math.min.apply(null, spArr), smx = Math.max.apply(null, spArr);

      h += '<div class="table-section"><h3>Splity (per km)</h3>';
      h += '<table class="laps-table"><thead><tr>';
      h += '<th>Km</th><th>Dyst</th><th>Czas</th><th>Tempo</th><th>GAP</th>';
      h += '<th>HR</th><th>Moc</th><th>&#8593;</th><th>&#8595;</th></tr></thead><tbody>';
      for (var ti = 0; ti < splits.length; ti++) {
        var sp = splits[ti];
        var bg = _paceColor(sp.gSec, smn, smx);
        h += '<tr style="background:' + bg + '22">';
        h += '<td>' + sp.i + '</td>';
        h += '<td>' + (sp.dist/1000).toFixed(2) + '</td>';
        h += '<td>' + _fmtTime(sp.time) + '</td>';
        h += '<td>' + sp.pace + '</td>';
        h += '<td><strong>' + sp.gap + '</strong></td>';
        h += '<td>' + sp.hr + '</td>';
        h += '<td>' + (sp.pwr !== '--' ? sp.pwr + 'W' : '--') + '</td>';
        h += '<td>+' + sp.eg + 'm</td>';
        h += '<td>-' + sp.el + 'm</td></tr>';
      }
      h += '</tbody></table></div>';
    }

    // Chart containers
    var hrArr = _sa(str, 'heartrate');
    var dstArr = _sa(str, 'distance');
    var hasHR = hrArr && hrArr.length > 0;
    var hasDst = dstArr && dstArr.length > 0;

    if (hasHR && hasDst)
      h += '<div class="chart-section"><h3>Tetno</h3><canvas id="ad-hr-' + sid + '"></canvas></div>';
    if (pwStr && hasDst)
      h += '<div class="chart-section"><h3>Moc biegowa</h3><canvas id="ad-pwr-' + sid + '"></canvas></div>';
    if (splits.length > 0)
      h += '<div class="chart-section"><h3>Tempo vs GAP</h3><canvas id="ad-gap-' + sid + '"></canvas></div>';
    if (hasHR)
      h += '<div class="chart-section"><h3>Strefy HR</h3><canvas id="ad-zone-' + sid + '"></canvas></div>';

    return h;
  }

  // ======== drawCharts(sid) ========
  function drawCharts(sid) {
    var data = _getData(sid);
    var str = data.streams;
    var det = data.detail;
    if (!str) return;

    var hrD = _sa(str, 'heartrate');
    var dstD = _sa(str, 'distance');
    var tmD = _sa(str, 'time');
    var pwStr = _powerStream(str);
    var splits = _buildSplits(det, str, pwStr);
    var i, key, cv, labels;

    // 1. HR chart
    if (hrD && hrD.length && dstD) {
      key = 'ad-hr-' + sid;
      _destroy(key);
      cv = document.getElementById(key);
      if (cv) {
        labels = [];
        for (i = 0; i < dstD.length; i++) labels.push((dstD[i]/1000).toFixed(1));
        var zones = _hrZones();
        var hrMin = hrD[0], hrMax = hrD[0];
        for (i = 1; i < hrD.length; i++) { if (hrD[i] < hrMin) hrMin = hrD[i]; if (hrD[i] > hrMax) hrMax = hrD[i]; }
        var zonePlugin = {
          id: 'hrZoneBg' + sid,
          beforeDraw: function(chart) {
            var ctx2 = chart.ctx, ca = chart.chartArea, yScale = chart.scales.y;
            for (var zi = 0; zi < zones.length; zi++) {
              var yt = yScale.getPixelForValue(Math.min(zones[zi].mx, yScale.max));
              var yb = yScale.getPixelForValue(Math.max(zones[zi].mn, yScale.min));
              ctx2.fillStyle = zones[zi].c;
              ctx2.fillRect(ca.left, yt, ca.right - ca.left, yb - yt);
            }
          }
        };
        _charts[key] = new Chart(cv.getContext('2d'), {
          type: 'line',
          data: { labels: labels, datasets: [{
            label: 'HR (bpm)', data: hrD,
            borderColor: 'rgba(213,94,0,0.9)', backgroundColor: 'rgba(213,94,0,0.1)',
            fill: true, pointRadius: 0, borderWidth: 1.5, tension: 0.3
          }]},
          options: { responsive: true, plugins: { legend: { display: false } },
            scales: {
              x: { title: { display: true, text: 'km' }, ticks: { maxTicksLimit: 12 } },
              y: { title: { display: true, text: 'bpm' }, min: hrMin - 10, max: hrMax + 10 }
            }
          },
          plugins: [zonePlugin]
        });
      }
    }

    // 2. Power chart
    if (pwStr && dstD) {
      key = 'ad-pwr-' + sid;
      _destroy(key);
      cv = document.getElementById(key);
      if (cv) {
        var smooth = [];
        for (i = 0; i < pwStr.length; i++) {
          var s1 = Math.max(0, i-5), e1 = Math.min(pwStr.length, i+5), sm = 0;
          for (var j = s1; j < e1; j++) sm += pwStr[j];
          smooth.push(Math.round(sm / (e1 - s1)));
        }
        labels = [];
        for (i = 0; i < dstD.length; i++) labels.push((dstD[i]/1000).toFixed(1));
        _charts[key] = new Chart(cv.getContext('2d'), {
          type: 'line',
          data: { labels: labels, datasets: [{
            label: 'Moc (W)', data: smooth,
            borderColor: 'rgba(120,60,200,0.9)', backgroundColor: 'rgba(120,60,200,0.1)',
            fill: true, pointRadius: 0, borderWidth: 1.5, tension: 0.3
          }]},
          options: { responsive: true, plugins: { legend: { display: false } },
            scales: {
              x: { title: { display: true, text: 'km' }, ticks: { maxTicksLimit: 12 } },
              y: { title: { display: true, text: 'W' }, beginAtZero: true }
            }
          }
        });
      }
    }

    // 3. Pace vs GAP bar (from splits)
    if (splits.length > 0) {
      key = 'ad-gap-' + sid;
      _destroy(key);
      cv = document.getElementById(key);
      if (cv) {
        var gLabels = [], gPace = [], gGap = [];
        for (i = 0; i < splits.length; i++) {
          gLabels.push('Km ' + splits[i].i);
          gPace.push(splits[i].pSec);
          gGap.push(splits[i].gSec);
        }
        _charts[key] = new Chart(cv.getContext('2d'), {
          type: 'bar',
          data: { labels: gLabels, datasets: [
            { label: 'Tempo (s/km)', data: gPace, backgroundColor: 'rgba(86,180,233,0.7)' },
            { label: 'GAP (s/km)', data: gGap, backgroundColor: 'rgba(230,159,0,0.7)' }
          ]},
          options: {
            responsive: true,
            plugins: { tooltip: { callbacks: { label: function(ctx) {
              var v = ctx.raw, m = Math.floor(v/60), s = Math.round(v%60);
              return ctx.dataset.label + ': ' + m + ':' + (s<10?'0':'') + s + '/km';
            }}}},
            scales: {
              x: { title: { display: true, text: 'Split' } },
              y: { title: { display: true, text: 's/km' }, reverse: true,
                ticks: { callback: function(v) {
                  var m = Math.floor(v/60), s = Math.round(v%60);
                  return m + ':' + (s<10?'0':'') + s;
                }}
              }
            }
          }
        });
      }
    }

    // 4. HR Zone donut
    if (hrD && hrD.length) {
      key = 'ad-zone-' + sid;
      _destroy(key);
      cv = document.getElementById(key);
      if (cv) {
        var zones2 = _hrZones();
        var counts = [0,0,0,0,0];
        for (i = 0; i < hrD.length; i++) {
          for (var z = zones2.length - 1; z >= 0; z--) {
            if (hrD[i] >= zones2[z].mn) { counts[z]++; break; }
          }
        }
        var total = 0;
        for (i = 0; i < counts.length; i++) total += counts[i];
        if (total === 0) total = 1;
        var zLabels = [], zColors = [];
        for (i = 0; i < zones2.length; i++) {
          zLabels.push(zones2[i].n + ' (' + ((counts[i]/total)*100).toFixed(1) + '%)');
          zColors.push(zones2[i].c.replace('0.35', '0.75'));
        }
        _charts[key] = new Chart(cv.getContext('2d'), {
          type: 'doughnut',
          data: { labels: zLabels, datasets: [{ data: counts, backgroundColor: zColors }] },
          options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
        });
      }
    }
  }

  return { render: render, drawCharts: drawCharts };
})();

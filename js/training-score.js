
// HM Tracker - TrainScore v1 (Sprint 10: Training Evaluation)
var TrainScore = (function() {

  // === HELPERS ===
  function _p(str) {
    // Parse pace "5:00" → 300 seconds
    if (!str) return 0;
    var s = String(str).replace(/[^\d:]/g, '');
    var pp = s.split(':');
    if (pp.length === 2) return (+pp[0]) * 60 + (+pp[1]);
    return 0;
  }

  function _pStr(sec) {
    if (!sec || sec <= 0) return '--:--';
    var m = Math.floor(sec / 60), s = Math.round(sec % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function _lapPace(lap) {
    return lap.average_speed > 0 ? 1000 / lap.average_speed : 9999;
  }

  function _clamp(v, mn, mx) { return Math.max(mn, Math.min(mx, v)); }

  // === PLAN PARSER ===
  
  function _parseDesc(desc, type, km) {
    var result = { category: 'steady', warmup: 0, cooldown: 0, reps: 0, repDist: 0,
      repPace: 0, repPaceMax: 0, restTime: 0, steadyPace: 0, steadyPaceMax: 0,
      segments: [], totalKm: km, rawDesc: desc, hasStrides: false, steadyKm: 0 };
    var d = desc.toLowerCase();

    // Detect strides/rytmy
    var strideMatch = d.match(/(\d+)\s*x\s*(\d+)\s*m\s*(rytm|stride)/);
    if (strideMatch) result.hasStrides = true;

    // Extract WU
    var wuMatch = d.match(/(\d+\.?\d*)\s*km\s*wu/);
    if (wuMatch) result.warmup = parseFloat(wuMatch[1]);

    // Extract CD
    var cdMatch = d.match(/(\d+\.?\d*)\s*km\s*cd/);
    if (cdMatch) result.cooldown = parseFloat(cdMatch[1]);

    // INTERVALS: "3x2 km @ 5:00 (trucht 3:00)"
    var intMatch = d.match(/(\d+)\s*x\s*(\d+\.?\d*)\s*km\s*@\s*(\d+:\d+)(?:\s*-\s*(\d+:\d+))?/);
    if (intMatch) {
      result.category = 'intervals';
      result.reps = parseInt(intMatch[1]);
      result.repDist = parseFloat(intMatch[2]);
      result.repPace = _p(intMatch[3]);
      result.repPaceMax = intMatch[4] ? _p(intMatch[4]) : result.repPace;
      var restMatch = d.match(/trucht\s*(\d+:\d+)/);
      if (restMatch) result.restTime = _p(restMatch[1]);
      return result;
    }

    // INTERVALS short: "8x600m @ 4:25-4:30"
    var intShort = d.match(/(\d+)\s*x\s*(\d+)\s*m\s*@\s*(\d+:\d+)(?:\s*-\s*(\d+:\d+))?/);
    if (intShort && parseInt(intShort[2]) >= 400) {
      result.category = 'intervals';
      result.reps = parseInt(intShort[1]);
      result.repDist = parseInt(intShort[2]) / 1000;
      result.repPace = _p(intShort[3]);
      result.repPaceMax = intShort[4] ? _p(intShort[4]) : result.repPace;
      var restM2 = d.match(/trucht\s*(\d+:\d+)/);
      if (restM2) result.restTime = _p(restM2[1]);
      return result;
    }

    // FARTLEK: "6x(3min @ 4:50 / 2min trucht)"
    var fartMatch = d.match(/(\d+)\s*x\s*\(\s*(\d+)\s*min\s*@\s*(\d+:\d+)/);
    if (fartMatch) {
      result.category = 'fartlek';
      result.reps = parseInt(fartMatch[1]);
      result.repPace = _p(fartMatch[3]);
      var restFart = d.match(/(\d+)\s*min\s*trucht/);
      if (restFart) result.restTime = parseInt(restFart[1]) * 60;
      return result;
    }

    // MIXED INTERVALS: "3x(1km@4:40+1km@5:00)"
    var mixMatch = d.match(/(\d+)\s*x\s*\(\s*(\d+\.?\d*)\s*km\s*@\s*(\d+:\d+)\s*\+\s*(\d+\.?\d*)\s*km\s*@\s*(\d+:\d+)/);
    if (mixMatch) {
      result.category = 'intervals';
      result.reps = parseInt(mixMatch[1]) * 2;
      result.repDist = parseFloat(mixMatch[2]);
      result.repPace = _p(mixMatch[3]);
      result.repPaceMax = _p(mixMatch[5]);
      var restMix = d.match(/trucht\s*(\d+:\d+)/);
      if (restMix) result.restTime = _p(restMix[1]);
      return result;
    }

    // TEMPO: "20 min @ 5:05-5:10"
    var tempoMatch = d.match(/(\d+)\s*min\s*@\s*(\d+:\d+)(?:\s*-\s*(\d+:\d+))?/);
    if (tempoMatch && d.indexOf('x') === -1) {
      result.category = 'tempo';
      result.repPace = _p(tempoMatch[2]);
      result.repPaceMax = tempoMatch[3] ? _p(tempoMatch[3]) : result.repPace;
      return result;
    }

    // PROGRESSIVE: "15 km @ 6:15 -> 4 km @ 5:40-5:50"
    var progMatch = d.match(/(\d+\.?\d*)\s*km.*?@\s*(\d+:\d+).*?->\s*(\d+\.?\d*)\s*km.*?@\s*(\d+:\d+)(?:\s*-\s*(\d+:\d+))?/);
    if (progMatch) {
      result.category = 'progressive';
      result.segments.push({ km: parseFloat(progMatch[1]), pace: _p(progMatch[2]) });
      result.segments.push({ km: parseFloat(progMatch[3]), pace: _p(progMatch[4]), paceMax: progMatch[5] ? _p(progMatch[5]) : 0 });
      var thirdSeg = d.match(/->\s*(\d+\.?\d*)\s*km\s*easy/);
      if (thirdSeg) result.segments.push({ km: parseFloat(thirdSeg[1]), pace: 0 });
      return result;
    }

    // STEADY: "8 km @ 6:30-6:40 + 6x100m rytmy + 1.5 km CD"
    // Extract the main steady portion distance separately
    var steadyMatch = d.match(/(\d+\.?\d*)\s*km\s*@\s*(\d+:\d+)(?:\s*-\s*(\d+:\d+))?/);
    if (steadyMatch) {
      result.category = 'steady';
      result.steadyKm = parseFloat(steadyMatch[1]);
      result.steadyPace = _p(steadyMatch[2]);
      result.steadyPaceMax = steadyMatch[3] ? _p(steadyMatch[3]) : result.steadyPace;
      return result;
    }

    return result;
  }


  // === LAP CLASSIFIER ===
  
  function _classifyLaps(laps, plan) {
    if (!laps || laps.length === 0) return [];
    var classified = [];
    var i;

    // For interval/fartlek/tempo: use plan structure to identify roles
    if (plan.category === 'intervals' || plan.category === 'fartlek' || plan.category === 'tempo') {
      for (i = 0; i < laps.length; i++) {
        var lap = laps[i];
        var pace = _lapPace(lap);
        var distKm = lap.distance / 1000;
        var role = 'work';

        // First lap: warmup if plan has WU and lap matches ~WU distance and is slow
        if (i === 0 && plan.warmup > 0 && distKm >= plan.warmup * 0.6 && distKm <= plan.warmup * 1.5) {
          role = 'warmup';
        }
        // Very short laps (< 0.8km) = rest/trucht between intervals
        else if (distKm < 0.8) {
          role = 'rest';
        }
        // Last 1-2 laps: cooldown if plan has CD and pace is slow
        else if (plan.cooldown > 0 && i >= laps.length - 2) {
          // Check if this lap is significantly slower than the work pace target
          var targetPace = plan.repPace || 300;
          if (pace > targetPace + 60) {
            role = 'cooldown';
          }
        }

        classified.push({
          index: i, role: role, distKm: distKm, pace: pace,
          hr: lap.average_heartrate || 0, maxHR: lap.max_heartrate || 0,
          name: lap.name || '', time: lap.moving_time || lap.elapsed_time || 0
        });
      }
      return classified;
    }

    // For steady runs: all splits are "work" (handled elsewhere)
    for (i = 0; i < laps.length; i++) {
      classified.push({
        index: i, role: 'work', distKm: laps[i].distance / 1000,
        pace: _lapPace(laps[i]), hr: laps[i].average_heartrate || 0,
        maxHR: laps[i].max_heartrate || 0, name: laps[i].name || '',
        time: laps[i].moving_time || laps[i].elapsed_time || 0
      });
    }
    return classified;
  }


  // === SCORING FUNCTIONS ===

  function _scoreVolume(actualKm, planKm) {
    if (planKm <= 0) return { score: 100, msg: 'Brak planu km' };
    var ratio = actualKm / planKm;
    var score;
    if (ratio >= 0.9 && ratio <= 1.1) score = 100;
    else if (ratio >= 0.8 && ratio < 0.9) score = 80 + (ratio - 0.8) * 200;
    else if (ratio > 1.1 && ratio <= 1.2) score = 80 + (1.2 - ratio) * 200;
    else if (ratio >= 0.7 && ratio < 0.8) score = 60 + (ratio - 0.7) * 200;
    else if (ratio > 1.2 && ratio <= 1.3) score = 60 + (1.3 - ratio) * 200;
    else score = Math.max(20, 60 - Math.abs(1 - ratio) * 200);
    score = _clamp(Math.round(score), 0, 100);
    var msg = Math.round(ratio * 100) + '% planu (' + actualKm + '/' + planKm + ' km)';
    if (ratio > 1.15) msg += ' - za duzo!';
    else if (ratio < 0.85) msg += ' - za malo!';
    return { score: score, msg: msg };
  }

  function _scoreIntensity(classified, plan, type) {
    var workLaps = classified.filter(function(l) { return l.role === 'work'; });
    var restLaps = classified.filter(function(l) { return l.role === 'rest'; });

    // STEADY (easy, recovery, long)
   
    if (plan.category === 'steady' && plan.steadyPace > 0) {
      var targetMin = plan.steadyPace;
      var targetMax = plan.steadyPaceMax || plan.steadyPace;
      
      // If has strides or CD: only evaluate the main steady portion (steadyKm)
      var evalLaps = workLaps;
      if (plan.hasStrides || plan.cooldown > 0) {
        var mainKm = plan.steadyKm || plan.totalKm;
        evalLaps = [];
        var cumDist = 0;
        for (var ei = 0; ei < workLaps.length; ei++) {
          cumDist += workLaps[ei].distKm;
          if (cumDist <= mainKm + 0.5) {
            evalLaps.push(workLaps[ei]);
          }
        }
        if (evalLaps.length === 0) evalLaps = workLaps;
      }
      
      var avgPace = 0;
      if (evalLaps.length > 0) {
        var sum = 0;
        for (var i = 0; i < evalLaps.length; i++) sum += evalLaps[i].pace;
        avgPace = sum / evalLaps.length;
      }
      
      var isEasy = type.toLowerCase().indexOf('easy') !== -1 || type.toLowerCase().indexOf('recovery') !== -1 || type.toLowerCase().indexOf('regen') !== -1;
      var diff = 0;
      var msgs = [];
      
      if (avgPace >= targetMin - 15 && avgPace <= targetMax + 15) {
        diff = 100;
        msgs.push('Tempo w zakresie: ' + _pStr(avgPace) + ' (plan: ' + _pStr(targetMin) + '-' + _pStr(targetMax) + ')');
      } else if (avgPace < targetMin - 15) {
        var overSec = targetMin - avgPace;
        diff = isEasy ? Math.max(30, 100 - overSec * 3) : Math.max(50, 100 - overSec * 2);
        msgs.push('Za szybko! ' + _pStr(avgPace) + ' vs plan ' + _pStr(targetMin) + (isEasy ? ' - easy run = pilnuj tempa!' : ''));
      } else {
        var underSec = avgPace - targetMax;
        diff = Math.max(50, 100 - underSec * 2);
        msgs.push('Za wolno: ' + _pStr(avgPace) + ' vs plan ' + _pStr(targetMax));
      }
      
      if (plan.hasStrides) {
        msgs.push('Rytmy wykryte - ocena tempa tylko z glownej czesci (' + (plan.steadyKm || '?') + ' km)');
      }
      
      return { score: _clamp(Math.round(diff), 0, 100), msgs: msgs };
    }


    // INTERVALS
    if (plan.category === 'intervals' && workLaps.length > 0) {
      var targetP = plan.repPace;
      var targetPMax = plan.repPaceMax || targetP;
      var repScores = [];
      var msgs2 = [];
      for (var r = 0; r < workLaps.length; r++) {
        var wl = workLaps[r];
        var rpDiff;
        if (wl.pace >= targetP - 10 && wl.pace <= targetPMax + 10) {
          rpDiff = 100;
        } else if (wl.pace < targetP - 10) {
          rpDiff = Math.max(60, 100 - (targetP - wl.pace) * 2);
        } else {
          rpDiff = Math.max(40, 100 - (wl.pace - targetPMax) * 3);
        }
        repScores.push(rpDiff);
        msgs2.push('Rep' + (r + 1) + ': ' + _pStr(wl.pace) + ' (plan: ' + _pStr(targetP) + (targetPMax !== targetP ? '-' + _pStr(targetPMax) : '') + ') → ' + Math.round(rpDiff) + ' pkt');
      }
      var avgRepScore = 0;
      for (r = 0; r < repScores.length; r++) avgRepScore += repScores[r];
      avgRepScore = avgRepScore / repScores.length;

      // Rest check
      if (restLaps.length > 0 && plan.restTime > 0) {
        var avgRest = 0;
        for (r = 0; r < restLaps.length; r++) avgRest += restLaps[r].time;
        avgRest = avgRest / restLaps.length;
        if (avgRest > plan.restTime * 1.3) msgs2.push('Przerwy za dlugie: ' + Math.round(avgRest) + 's vs plan ' + plan.restTime + 's');
        else if (avgRest < plan.restTime * 0.7) msgs2.push('Przerwy za krotkie: ' + Math.round(avgRest) + 's vs plan ' + plan.restTime + 's');
      }

      // Reps count check
      if (plan.reps > 0 && workLaps.length !== plan.reps) {
        msgs2.push('Liczba serii: ' + workLaps.length + '/' + plan.reps);
        avgRepScore = avgRepScore * (Math.min(workLaps.length, plan.reps) / Math.max(workLaps.length, plan.reps));
      }

      return { score: _clamp(Math.round(avgRepScore), 0, 100), msgs: msgs2 };
    }

    // PROGRESSIVE
    if (plan.category === 'progressive' && plan.segments.length >= 2) {
      // Use splits to check if pace decreased across segments
      var msgs3 = ['Trening progresywny - analiza z splitow'];
      return { score: 80, msgs: msgs3 };
    }

    // TEMPO / FARTLEK - simplified
    if (plan.category === 'tempo' || plan.category === 'fartlek') {
      if (workLaps.length > 0 && plan.repPace > 0) {
        var avgW = 0;
        for (var w = 0; w < workLaps.length; w++) avgW += workLaps[w].pace;
        avgW = avgW / workLaps.length;
        var diff2 = Math.abs(avgW - plan.repPace);
        var sc = diff2 < 10 ? 100 : Math.max(50, 100 - diff2 * 2);
        return { score: _clamp(Math.round(sc), 0, 100), msgs: ['Tempo sekcji roboczej: ' + _pStr(avgW) + ' vs plan ' + _pStr(plan.repPace)] };
      }
    }

    return { score: 75, msgs: ['Brak danych do oceny intensywnosci'] };
  }

  function _scoreHR(classified, plan, type, streams) {
    var isEasy = type.toLowerCase().indexOf('easy') !== -1 || type.toLowerCase().indexOf('recovery') !== -1 || type.toLowerCase().indexOf('regen') !== -1;
    var isLong = type.toLowerCase().indexOf('long') !== -1;
    var isInterval = plan.category === 'intervals' || plan.category === 'fartlek';
    var workLaps = classified.filter(function(l) { return l.role === 'work'; });
    var restLaps = classified.filter(function(l) { return l.role === 'rest'; });
    var msgs = [];
    var score = 80;

    if (isEasy) {
      var avgHR = 0, cnt = 0;
      for (var i = 0; i < classified.length; i++) {
        if (classified[i].hr > 0) { avgHR += classified[i].hr; cnt++; }
      }
      if (cnt > 0) {
        avgHR = avgHR / cnt;
        if (avgHR < 150) { score = 100; msgs.push('HR ' + Math.round(avgHR) + ' bpm - swietnie w Z2'); }
        else if (avgHR < 155) { score = 85; msgs.push('HR ' + Math.round(avgHR) + ' bpm - ok, gorny zakres Z2'); }
        else if (avgHR < 165) { score = 65; msgs.push('HR ' + Math.round(avgHR) + ' bpm - za wysokie na easy!'); }
        else { score = 40; msgs.push('HR ' + Math.round(avgHR) + ' bpm - zdecydowanie za wysokie!'); }
      }
    } else if (isInterval && workLaps.length > 0) {
      // Work laps should have high HR
      var avgWorkHR = 0;
      for (var w = 0; w < workLaps.length; w++) avgWorkHR += workLaps[w].hr;
      avgWorkHR = avgWorkHR / workLaps.length;
      if (avgWorkHR > 165) { score = 95; msgs.push('HR odcinkow: ' + Math.round(avgWorkHR) + ' bpm - dobra intensywnosc'); }
      else if (avgWorkHR > 155) { score = 80; msgs.push('HR odcinkow: ' + Math.round(avgWorkHR) + ' bpm - moglo byc wyzej'); }
      else { score = 60; msgs.push('HR odcinkow: ' + Math.round(avgWorkHR) + ' bpm - niska intensywnosc'); }

      // Rest recovery
      if (restLaps.length > 0 && workLaps.length > 0) {
        var drops = [];
        for (var r = 0; r < restLaps.length; r++) {
          var prevWork = null;
          for (var pw = classified.indexOf(restLaps[r]) - 1; pw >= 0; pw--) {
            if (classified[pw].role === 'work') { prevWork = classified[pw]; break; }
          }
          if (prevWork && prevWork.hr > 0 && restLaps[r].hr > 0) {
            drops.push(prevWork.hr - restLaps[r].hr);
          }
        }
        if (drops.length > 0) {
          var avgDrop = 0;
          for (var dr = 0; dr < drops.length; dr++) avgDrop += drops[dr];
          avgDrop = avgDrop / drops.length;
          if (avgDrop > 20) msgs.push('Regeneracja HR: -' + Math.round(avgDrop) + ' bpm miedzy seriami (swietna!)');
          else if (avgDrop > 10) msgs.push('Regeneracja HR: -' + Math.round(avgDrop) + ' bpm (ok)');
          else msgs.push('Regeneracja HR: -' + Math.round(avgDrop) + ' bpm (slaba - za krotkie przerwy?)');
        }
      }
    } else if (isLong) {
      // Cardiac drift from streams or splits
      var hrStream = streams ? (Array.isArray(streams.heartrate) ? streams.heartrate : null) : null;
      if (hrStream && hrStream.length > 100) {
        var quarter = Math.floor(hrStream.length / 4);
        var firstQ = 0, lastQ = 0;
        for (var f = 0; f < quarter; f++) firstQ += hrStream[f];
        firstQ = firstQ / quarter;
        for (var l = hrStream.length - quarter; l < hrStream.length; l++) lastQ += hrStream[l];
        lastQ = lastQ / quarter;
        var drift = ((lastQ - firstQ) / firstQ) * 100;
        if (drift < 8) { score = 100; msgs.push('Cardiac drift: ' + drift.toFixed(1) + '% - swietna wytrzymalosc!'); }
        else if (drift < 12) { score = 85; msgs.push('Cardiac drift: ' + drift.toFixed(1) + '% - ok'); }
        else if (drift < 18) { score = 70; msgs.push('Cardiac drift: ' + drift.toFixed(1) + '% - podwyzszony'); }
        else { score = 50; msgs.push('Cardiac drift: ' + drift.toFixed(1) + '% - wysoki, pracuj nad wytrzymaloscia'); }
      }
    }

    return { score: _clamp(score, 0, 100), msgs: msgs };
  }

  function _scoreTiming(date, planDate) {
    if (!date || !planDate) return { score: 100, msg: '' };
    if (date === planDate) return { score: 100, msg: 'W terminie' };
    var d1 = new Date(date + 'T12:00:00'), d2 = new Date(planDate + 'T12:00:00');
    var diff = Math.abs(Math.round((d1 - d2) / 86400000));
    if (diff === 1) return { score: 80, msg: 'Przesuniety o 1 dzien' };
    if (diff === 2) return { score: 60, msg: 'Przesuniety o 2 dni' };
    return { score: 40, msg: 'Przesuniety o ' + diff + ' dni' };
  }

  // === WEIGHTS ===
  function _weights(type) {
    var t = type.toLowerCase();
    if (t.indexOf('interwal') !== -1 || t.indexOf('fartlek') !== -1 || t.indexOf('cruise') !== -1)
      return { vol: 0.15, int: 0.45, hr: 0.30, time: 0.10 };
    if (t.indexOf('tempo') !== -1 || t.indexOf('symulacja') !== -1 || t.indexOf('race pace') !== -1)
      return { vol: 0.20, int: 0.40, hr: 0.30, time: 0.10 };
    if (t.indexOf('long') !== -1)
      return { vol: 0.30, int: 0.25, hr: 0.35, time: 0.10 };
    // Easy, Recovery, Regeneracja
    return { vol: 0.25, int: 0.35, hr: 0.30, time: 0.10 };
  }

  // === COACH MESSAGE ===
  function _coachMsg(total, volS, intS, hrS, type) {
    var msgs = [];
    if (total >= 90) msgs.push('Swietny trening! Tak trzymaj!');
    else if (total >= 75) msgs.push('Dobry trening z drobnymi odchyleniami.');
    else if (total >= 60) msgs.push('Przecietny trening - jest nad czym pracowac.');
    else msgs.push('Slaby trening - przeanalizuj co poszlo nie tak.');

    var isEasy = type.toLowerCase().indexOf('easy') !== -1 || type.toLowerCase().indexOf('recovery') !== -1;
    if (isEasy && intS.score < 70) msgs.push('Pilnuj tempa na easy runs - za szybko = ryzyko kontuzji i brak regeneracji!');
    if (hrS.score < 60) msgs.push('Tetno poza zakresem - sprawdz czy dobrze sie czujesz.');
    if (volS.score < 70) msgs.push('Dystans odbiega od planu - dostosuj nastepne treningi.');
    return msgs.join(' ');
  }

  // === MAIN EVALUATE ===
  function evaluate(date) {
    if (typeof PLAN === 'undefined' || typeof S === 'undefined' || typeof DB === 'undefined') return null;
    var log = S.getLog(date);
    if (!log || !log.distance) return null;

    // Find plan for this date
    var planDay = null, planDate = date;
    for (var wi = 0; wi < PLAN.length; wi++) {
      var w = PLAN[wi];
      for (var di = 0; di < w.days.length; di++) {
        var d = w.days[di];
        var dt = getDayDate(w.start, d.dow);
        if (dt === date && !d.rest) { planDay = d; break; }
      }
      if (planDay) break;
    }

    // Check shift matching
    if (!planDay) {
      for (wi = 0; wi < PLAN.length; wi++) {
        w = PLAN[wi];
        var we = getDayDate(w.start, 6);
        for (di = 0; di < w.days.length; di++) {
          d = w.days[di];
          if (d.rest || d.km <= 0) continue;
          dt = getDayDate(w.start, d.dow);
          var dLog = S.getLog(dt);
          if (!dLog || !dLog.distance) {
            var dd = new Date(date + 'T12:00:00'), dp = new Date(dt + 'T12:00:00');
            if (Math.abs(dd - dp) <= 2 * 86400000) {
              var ratio = parseFloat(log.distance) / d.km;
              if (ratio > 0.6 && ratio < 1.4) { planDay = d; planDate = dt; break; }
            }
          }
        }
        if (planDay) break;
      }
    }

    if (!planDay) return { total: 0, volume: { score: 0 }, intensity: { score: 0 }, hr: { score: 0 }, timing: { score: 0 }, coachMsg: 'Trening poza planem', planDay: null, classified: [] };

    var plan = _parseDesc(planDay.desc, planDay.type, planDay.km);
    var det = log.strava_id ? DB.getDetail(log.strava_id) : null;
    var str = log.strava_id ? DB.getStreams(log.strava_id) : null;
    var laps = det ? det.laps || [] : [];
    var classified = _classifyLaps(laps, plan);

    // If only 1 lap (steady run), use splits as "work"
    if (classified.length <= 1 && det && det.splits && det.splits.length > 0) {
      classified = [];
      for (var si = 0; si < det.splits.length; si++) {
        var sp = det.splits[si];
        classified.push({
          index: si, role: 'work', distKm: sp.distance / 1000,
          pace: sp.average_speed > 0 ? 1000 / sp.average_speed : 9999,
          hr: sp.average_heartrate || 0, maxHR: 0, name: 'Km ' + (si + 1),
          time: sp.moving_time || 0
        });
      }
    }

    var volS = _scoreVolume(parseFloat(log.distance), planDay.km);
    var intS = _scoreIntensity(classified, plan, planDay.type);
    var hrS = _scoreHR(classified, plan, planDay.type, str);
    var timS = _scoreTiming(date, planDate);
    var wt = _weights(planDay.type);

    var total = Math.round(wt.vol * volS.score + wt.int * intS.score + wt.hr * hrS.score + wt.time * timS.score);
    var coach = _coachMsg(total, volS, intS, hrS, planDay.type);

    return {
      total: total,
      volume: volS,
      intensity: intS,
      hr: hrS,
      timing: timS,
      coachMsg: coach,
      planDay: planDay,
      plan: plan,
      classified: classified
    };
  }

  // === RENDER ===
  function render(date) {
    var ev = evaluate(date);
    if (!ev) return '';
    var col = ev.total >= 85 ? '#30D158' : ev.total >= 65 ? '#FF9F0A' : '#FF453A';

    var h = '<div class="ts-card">';
    h += '<div class="ts-header"><div class="ts-score-circle" style="border-color:' + col + '"><span style="color:' + col + '">' + ev.total + '</span></div>';
    h += '<div class="ts-info"><div class="ts-title">Ocena treningu</div>';
    if (ev.planDay) h += '<div class="ts-plan">' + ev.planDay.type + ' | ' + ev.planDay.km + ' km</div>';
    h += '</div></div>';

    // Bars
    var dims = [
      { label: 'Objetosc', score: ev.volume.score, icon: '\uD83D\uDCCF' },
      { label: 'Intensywnosc', score: ev.intensity.score, icon: '\u23F1' },
      { label: 'Tetno', score: ev.hr.score, icon: '\u2764' },
      { label: 'Terminowosc', score: ev.timing.score, icon: '\uD83D\uDCC5' }
    ];
    for (var i = 0; i < dims.length; i++) {
      var dm = dims[i];
      var dc = dm.score >= 85 ? '#30D158' : dm.score >= 65 ? '#FF9F0A' : '#FF453A';
      h += '<div class="ts-dim"><div class="ts-dim-head"><span>' + dm.icon + ' ' + dm.label + '</span><span style="color:' + dc + '">' + dm.score + '/100</span></div>';
      h += '<div class="ts-bar"><div class="ts-fill" style="width:' + dm.score + '%;background:' + dc + '"></div></div></div>';
    }

    // Details
    if (ev.volume.msg) h += '<div class="ts-detail">\uD83D\uDCCF ' + ev.volume.msg + '</div>';
    if (ev.intensity.msgs) {
      for (var m = 0; m < ev.intensity.msgs.length; m++) {
        h += '<div class="ts-detail">\u23F1 ' + ev.intensity.msgs[m] + '</div>';
      }
    }
    if (ev.hr.msgs) {
      for (m = 0; m < ev.hr.msgs.length; m++) {
        h += '<div class="ts-detail">\u2764 ' + ev.hr.msgs[m] + '</div>';
      }
    }
    if (ev.timing.msg) h += '<div class="ts-detail">\uD83D\uDCC5 ' + ev.timing.msg + '</div>';

    // Coach
    h += '<div class="ts-coach">\uD83E\uDDD1\u200D\uD83C\uDFEB ' + ev.coachMsg + '</div>';
    h += '</div>';
    return h;
  }

  // === WEEK SCORE ===
  function weekScore(weekIndex) {
    if (typeof PLAN === 'undefined') return null;
    var w = PLAN[weekIndex];
    if (!w) return null;
    var results = [];
    var totalScore = 0, count = 0;
    for (var di = 0; di < w.days.length; di++) {
      var d = w.days[di];
      if (d.rest) continue;
      var dt = getDayDate(w.start, d.dow);
      var ev = evaluate(dt);
      if (ev && ev.total > 0) {
        results.push({ date: dt, name: d.name, type: d.type, score: ev.total, ev: ev });
        totalScore += ev.total;
        count++;
      } else {
        // Check if skipped
        var log = S.getLog(dt);
        if (!log || !log.distance) {
          results.push({ date: dt, name: d.name, type: d.type, score: 0, ev: null });
        }
      }
    }
    var avg = count > 0 ? Math.round(totalScore / count) : 0;
    return { weekNum: w.weekNum, avg: avg, count: count, total: w.days.filter(function(d) { return !d.rest; }).length, results: results };
  }

  return {
    evaluate: evaluate,
    render: render,
    weekScore: weekScore,
    _parseDesc: _parseDesc,
    _classifyLaps: _classifyLaps
  };
})();


/* weekly-report.js v2 — Weekly Report Card (fixed rendering + PLAN_FLAT) */
const WeeklyReport = (() => {
  "use strict";
  var TAG = "[WeeklyReport]";

  function parsePace(p){
    if(!p) return null;
    var parts = String(p).split(":");
    if(parts.length !== 2) return null;
    return parseInt(parts[0],10)*60 + parseInt(parts[1],10);
  }

  function formatPace(s){
    if(!s || !isFinite(s)) return "--:--";
    var m = Math.floor(s/60);
    var sec = Math.round(s%60);
    return m+":"+String(sec).padStart(2,"0");
  }

  function fmtDate(d){
    return String(d.getDate()).padStart(2,"0")+"."+String(d.getMonth()+1).padStart(2,"0");
  }

  function getWeekRange(offset){
    var now = new Date();
    now.setHours(12,0,0,0);
    var day = now.getDay();
    var diff = day === 0 ? -6 : 1 - day;
    var mon = new Date(now);
    mon.setDate(mon.getDate() + diff + (offset * 7));
    mon.setHours(0,0,0,0);
    var sun = new Date(mon);
    sun.setDate(sun.getDate() + 6);
    sun.setHours(23,59,59,999);
    return {start: mon, end: sun, label: fmtDate(mon)+" – "+fmtDate(sun)};
  }

  function getWeekActivities(acts, offset){
    var range = getWeekRange(offset);
    return acts.filter(function(a){
      var d = new Date(a.date+"T12:00:00");
      return d >= range.start && d <= range.end;
    });
  }

  function getWeekPlan(offset){
    if(!window.PLAN_FLAT) return [];
    var range = getWeekRange(offset);
    return window.PLAN_FLAT.filter(function(p){
      var d = new Date(p.date+"T12:00:00");
      return d >= range.start && d <= range.end;
    });
  }

  function calcStats(acts){
    var totalKm=0, totalMin=0, hrs=[], paces=[], totalElev=0, totalCal=0;
    for(var i=0; i<acts.length; i++){
      var a = acts[i];
      totalKm += parseFloat(a.km || a.distance_km || 0);
      totalMin += parseFloat(a.duration_min || 0);
      if(a.avg_hr) hrs.push(parseFloat(a.avg_hr));
      var ps = parsePace(a.pace || a.avg_pace);
      if(ps) paces.push(ps);
      if(a.total_elevation_gain) totalElev += parseFloat(a.total_elevation_gain);
      if(a.calories) totalCal += parseFloat(a.calories);
    }
    var avgHR = hrs.length ? Math.round(hrs.reduce(function(a,b){return a+b},0)/hrs.length) : null;
    var avgPace = paces.length ? Math.round(paces.reduce(function(a,b){return a+b},0)/paces.length) : null;
    return {
      totalKm: +totalKm.toFixed(1),
      sessions: acts.length,
      totalMin: Math.round(totalMin),
      avgPace: avgPace,
      avgHR: avgHR,
      totalElev: Math.round(totalElev),
      totalCal: Math.round(totalCal)
    };
  }

  function calcAdherence(acts, plan){
    if(!plan || plan.length === 0) return {volume:0, completion:0, typeMatch:0};
    var plannedKm = 0;
    for(var i=0; i<plan.length; i++) plannedKm += parseFloat(plan[i].km || 0);
    var actualKm = 0;
    for(var j=0; j<acts.length; j++) actualKm += parseFloat(acts[j].km || 0);
    var volume = plannedKm > 0 ? Math.min(120, Math.round(actualKm / plannedKm * 100)) : 0;
    var completion = Math.round(acts.length / plan.length * 100);

    var typeMatched = 0;
    for(var p=0; p<plan.length; p++){
      var pType = String(plan[p].type || "").toLowerCase();
      for(var a=0; a<acts.length; a++){
        var aType = String(acts[a].type || "").toLowerCase();
        var aDate = acts[a].date;
        if(aDate === plan[p].date || pType.indexOf(aType)>=0 || aType.indexOf(pType)>=0 ||
           (pType.indexOf("easy")>=0 && aType.indexOf("easy")>=0) ||
           (pType.indexOf("interw")>=0 && aType.indexOf("interw")>=0) ||
           (pType.indexOf("long")>=0 && aType.indexOf("long")>=0) ||
           (pType.indexOf("tempo")>=0 && aType.indexOf("tempo")>=0) ||
           (pType.indexOf("recovery")>=0 && aType.indexOf("recovery")>=0)){
          typeMatched++; break;
        }
      }
    }
    var typeMatch = Math.round(typeMatched / plan.length * 100);
    return {volume: volume, completion: Math.min(100,completion), typeMatch: Math.min(100,typeMatch)};
  }

  function calcGrade(adh, stats){
    var quality = 75;
    try {
      if(typeof TrainScore !== "undefined" && TrainScore.evaluate){
        quality = 80;
      }
    } catch(e){}
    var consistency = 100;
    if(stats.sessions <= 1) consistency = 30;
    else if(stats.sessions === 2) consistency = 60;
    else if(stats.sessions === 3) consistency = 80;

    var score = Math.round(
      0.4 * Math.min(adh.volume, 100) +
      0.3 * adh.completion +
      0.2 * quality +
      0.1 * consistency
    );
    var letter, color;
    if(score >= 90){ letter="A"; color="#30D158"; }
    else if(score >= 80){ letter="B"; color="#0A84FF"; }
    else if(score >= 70){ letter="C"; color="#FF9F0A"; }
    else if(score >= 60){ letter="D"; color="#FF6B35"; }
    else { letter="F"; color="#FF453A"; }
    return {score:score, letter:letter, color:color};
  }

  var _currentOffset = 0;

  function render(containerId, offset){
    if(typeof offset === "number") _currentOffset = offset;
    var container = document.getElementById(containerId);
    if(!container){ console.error(TAG, "Brak kontenera", containerId); return; }
    container.innerHTML = '<p style="padding:20px;text-align:center;color:var(--fg2)">Ładowanie raportu...</p>';

    DB.getAll().then(function(allActs){
      var range = getWeekRange(_currentOffset);
      var acts = getWeekActivities(allActs, _currentOffset);
      var plan = getWeekPlan(_currentOffset);
      var stats = calcStats(acts);
      var adh = calcAdherence(acts, plan);
      var grade = calcGrade(adh, stats);

      // Prev week stats for comparison
      var prevActs = getWeekActivities(allActs, _currentOffset - 1);
      var prevStats = calcStats(prevActs);

      var h = '';

      // Header + navigation
      h += '<div class="weekly-header">';
      h += '<button class="weekly-nav-btn" id="wr-prev">&larr; Poprz.</button>';
      h += '<span class="weekly-title">📋 Raport Tygodniowy — '+range.label+'</span>';
      h += '<button class="weekly-nav-btn" id="wr-next">Nast. &rarr;</button>';
      h += '</div>';

      if(acts.length === 0){
        h += '<div class="weekly-empty">🚌 Brak treningów w tym tygodniu</div>';
        container.innerHTML = h;
        attachNav(containerId);
        return;
      }

      // Stats grid
      h += '<div class="weekly-stats-grid">';
      h += statCard("🏃", "Dystans", stats.totalKm+" km");
      h += statCard("📅", "Sesje", stats.sessions+"");
      h += statCard("⏱", "Czas", stats.totalMin+" min");
      h += statCard("🏎", "Avg Pace", formatPace(stats.avgPace)+"/km");
      h += statCard("❤️", "Avg HR", stats.avgHR ? stats.avgHR+" bpm" : "--");
      h += statCard("⛰", "Przewyż.", stats.totalElev+" m");
      h += '</div>';

      // Plan adherence
      if(plan.length > 0){
        h += '<div class="weekly-card">';
        h += '<h3 class="weekly-card-title">📊 Zgodność z Planem</h3>';
        h += adhBar("Volume", adh.volume);
        h += adhBar("Ukończenie", adh.completion);
        h += adhBar("Typ treningu", adh.typeMatch);
        h += '</div>';
      }

      // Grade
      h += '<div class="weekly-card" style="text-align:center">';
      h += '<h3 class="weekly-card-title">🏆 Ocena Tygodnia</h3>';
      h += '<svg width="120" height="120" viewBox="0 0 120 120">';
      h += '<circle cx="60" cy="60" r="52" fill="none" stroke="#333" stroke-width="8"/>';
      h += '<circle cx="60" cy="60" r="52" fill="none" stroke="'+grade.color+'" stroke-width="8" stroke-dasharray="'+Math.round(326.7*grade.score/100)+' 326.7" transform="rotate(-90 60 60)"/>';
      h += '<text x="60" y="55" text-anchor="middle" fill="'+grade.color+'" font-size="36" font-weight="bold">'+grade.letter+'</text>';
      h += '<text x="60" y="75" text-anchor="middle" fill="var(--fg2)" font-size="14">'+grade.score+'</text>';
      h += '</svg>';
      h += '<div style="margin-top:12px;font-size:13px;color:var(--fg2)">';
      h += 'Adherence: '+adh.volume+'% <span style="opacity:.5">×0.4</span><br>';
      h += 'Ukończenie: '+adh.completion+'% <span style="opacity:.5">×0.3</span><br>';
      h += 'Jakość: '+Math.round(0.2*75/0.2)+' <span style="opacity:.5">×0.2</span><br>';
      h += 'Regularność: '+(stats.sessions<=1?30:stats.sessions===2?60:stats.sessions===3?80:100)+' <span style="opacity:.5">×0.1</span>';
      h += '</div></div>';

      // Week over week
      if(prevStats.sessions > 0){
        h += '<div class="weekly-card">';
        h += '<h3 class="weekly-card-title">📝 vs Poprzedni Tydzień</h3>';
        h += wowRow("Dystans", stats.totalKm, prevStats.totalKm, "km", false);
        h += wowRow("Sesje", stats.sessions, prevStats.sessions, "", false);
        h += wowRow("Czas", stats.totalMin, prevStats.totalMin, "min", false);
        h += wowRow("Avg Pace", stats.avgPace, prevStats.avgPace, "s", true);
        h += wowRow("Avg HR", stats.avgHR, prevStats.avgHR, "bpm", true);
        h += '</div>';
      }

      container.innerHTML = h;
      attachNav(containerId);
      console.log(TAG, "Raport gotowy:", range.label, stats.sessions, "treningow,", stats.totalKm, "km");
    }).catch(function(e){
      console.error(TAG, e);
      container.innerHTML = '<p style="padding:20px;color:red">Błąd: '+e.message+'</p>';
    });
  }

  function statCard(icon, label, value){
    return '<div class="weekly-stat-card"><span class="weekly-stat-icon">'+icon+'</span><span class="weekly-stat-label">'+label+'</span><span class="weekly-stat-value">'+value+'</span></div>';
  }

  function adhBar(label, pct){
    var col = pct >= 90 ? '#0A84FF' : pct >= 70 ? '#BF5AF2' : pct >= 50 ? '#FF9F0A' : '#FF453A';
    return '<div class="weekly-adh-row"><span class="weekly-adh-label">'+label+'</span><div class="weekly-adh-track"><div class="weekly-adh-fill" style="width:'+Math.min(100,pct)+'%;background:'+col+'"></div></div><span class="weekly-adh-pct">'+pct+'%</span></div>';
  }

  function wowRow(label, cur, prev, unit, lowerBetter){
    if(cur === null || prev === null) return '';
    var delta = +(cur - prev).toFixed(1);
    var pct = prev !== 0 ? +((delta / Math.abs(prev)) * 100).toFixed(1) : 0;
    var improved = lowerBetter ? delta < 0 : delta > 0;
    var icon = improved ? '✅' : (Math.abs(delta) < 0.1 ? '➖' : '🔻');
    var sign = delta > 0 ? '+' : '';
    if(label === "Avg Pace"){
      return '<div class="weekly-wow-row"><span>'+icon+'</span><span class="weekly-wow-label">'+label+'</span><span class="weekly-wow-delta" style="color:'+(improved?'#30D158':'#FF453A')+'">'+sign+delta+'s</span><span class="weekly-wow-pct">'+sign+pct+'%</span></div>';
    }
    return '<div class="weekly-wow-row"><span>'+icon+'</span><span class="weekly-wow-label">'+label+'</span><span class="weekly-wow-delta" style="color:'+(improved?'#30D158':'#FF453A')+'">'+sign+delta+' '+unit+'</span><span class="weekly-wow-pct">'+sign+pct+'%</span></div>';
  }

  function attachNav(containerId){
    var prev = document.getElementById("wr-prev");
    var next = document.getElementById("wr-next");
    if(prev) prev.addEventListener("click", function(){ render(containerId, _currentOffset - 1); });
    if(next) next.addEventListener("click", function(){ render(containerId, _currentOffset + 1); });
  }

  return { render: render, calcGrade: calcGrade };
})();

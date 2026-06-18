/* briefing.js v3 — Pre-Run Briefing + Injury Risk — CLEAN */
const Briefing = (() => {
  "use strict";
  const TAG = "[Briefing]";

  const dayStart = (d) => { const r = new Date(d); r.setHours(0,0,0,0); return r; };
  const todayISO = () => { const d = new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); };
  const parsePace = (p) => { if(!p) return null; const pp=String(p).split(":"); if(pp.length!==2) return null; return parseInt(pp[0],10)*60+parseInt(pp[1],10); };
  const formatPace = (s) => { if(!s||!isFinite(s)) return "--:--"; const m=Math.floor(s/60),sc=Math.round(s%60); return m+":"+String(sc).padStart(2,"0"); };
  const clamp = (v,lo,hi) => Math.max(lo,Math.min(hi,v));
  const diffDays = (a,b) => Math.round(Math.abs(dayStart(a)-dayStart(b))/86400000);

  function activityLoad(act) {
    const km = parseFloat(act.distance_km||act.km||0);
    const dur = parseFloat(act.duration_min||act.moving_time_min||0)||(act.moving_time?act.moving_time/60:0);
    const hr = parseFloat(act.avg_hr||act.average_heartrate||0);
    if (hr>0 && dur>0) return +(dur*clamp((hr-55)/(190-55),0.5,1.0)).toFixed(1);
    return +(km*10).toFixed(1);
  }

  function calcACWR(activities) {
    const now=dayStart(new Date()); let acute=0, chronic=0;
    (activities||[]).forEach(act => {
      const age=diffDays(now, dayStart(new Date(act.date||act.start_date)));
      const load=activityLoad(act);
      if(age<7) acute+=load;
      if(age<28) chronic+=load;
    });
    const cw=chronic/4, ratio=cw>0?+(acute/cw).toFixed(2):0;
    let zone,color;
    if(ratio<0.8){zone="undertrained";color="#3b82f6";}
    else if(ratio<=1.3){zone="optimal";color="#22c55e";}
    else if(ratio<=1.5){zone="caution";color="#f59e0b";}
    else{zone="danger";color="#ef4444";}
    return {acute:+acute.toFixed(1),chronic:+cw.toFixed(1),ratio,zone,color};
  }

  function consecutiveDays(activities) {
    const now=dayStart(new Date()), ds=new Set();
    (activities||[]).forEach(a=>ds.add(dayStart(new Date(a.date||a.start_date)).getTime()));
    let c=0;
    for(let i=0;i<365;i++){const ch=new Date(now);ch.setDate(ch.getDate()-i);if(ds.has(dayStart(ch).getTime()))c++;else break;}
    return {count:c,alert:c>=3};
  }

  function volumeSpike(activities) {
    const now=dayStart(new Date()), mon=new Date(now);
    mon.setDate(mon.getDate()-((mon.getDay()+6)%7));
    let tw=0; const wk=[0,0,0,0];
    (activities||[]).forEach(a=>{
      const d=dayStart(new Date(a.date||a.start_date)), km=parseFloat(a.distance_km||a.km||0), age=diffDays(mon,d);
      if(d>=mon)tw+=km; else if(age<7)wk[0]+=km; else if(age<14)wk[1]+=km; else if(age<21)wk[2]+=km; else if(age<28)wk[3]+=km;
    });
    const avg=wk.reduce((s,v)=>s+v,0)/4;
    const sp=avg>0?+(((tw-avg)/avg)*100).toFixed(1):0;
    return {thisWeek:+tw.toFixed(1),avg4w:+avg.toFixed(1),spikePercent:sp,alert:sp>30};
  }

  function getInjuryRisk(activities) {
    const acwr=calcACWR(activities), consec=consecutiveDays(activities), spike=volumeSpike(activities);
    const alerts=[]; let score=0;
    if(acwr.zone==="danger"){score+=40;alerts.push("\u26a0\ufe0f ACWR "+acwr.ratio+" \u2014 strefa niebezpieczna");}
    else if(acwr.zone==="caution"){score+=20;alerts.push("\u26a1 ACWR "+acwr.ratio+" \u2014 uwaga, rosnace obciazenie");}
    else if(acwr.zone==="undertrained"){score+=10;alerts.push("\ud83d\udd35 ACWR "+acwr.ratio+" \u2014 niski trening");}
    if(consec.count>=5){score+=25;alerts.push("\ud83d\udd34 "+consec.count+" dni z rzedu bez odpoczynku!");}
    else if(consec.count>=3){score+=10;alerts.push("\ud83d\udfe1 "+consec.count+" dni z rzedu \u2014 rozwaz rest day");}
    if(spike.spikePercent>50){score+=35;alerts.push("\ud83d\udd34 Volume spike +"+spike.spikePercent+"% \u2014 duze ryzyko!");}
    else if(spike.spikePercent>30){score+=15;alerts.push("\ud83d\udfe1 Volume spike +"+spike.spikePercent+"% \u2014 przekroczony prog 30%");}
    let level,color;
    if(score>=60){level="critical";color="#dc2626";}
    else if(score>=35){level="high";color="#ef4444";}
    else if(score>=15){level="moderate";color="#f59e0b";}
    else{level="low";color="#22c55e";}
    if(alerts.length===0) alerts.push("\u2705 Brak alertow \u2014 mozesz trenowac!");
    return {level,alerts,color,acwr,consecutive:consec,spike};
  }


function getTodayPlan(){
    try {
      if(!window.PLAN_FLAT) return null;
      var today=todayISO();
      var plan=window.PLAN_FLAT;
      var entry=plan.find(function(p){return p.date===today;});
      if(!entry) return null;

      // 1) Trening DZIS — najwyzszy priorytet
      var logToday=S.getLog(today);
      if(logToday && logToday.distance){
        entry._status="done";
        entry._logDate=today;
        return entry;
      }

      // 2) Sprawdz "wczesniej zrobiony" — TYLKO jesli:
      //    - dystans pasuje (ratio 0.85-1.15, ciasniej!)
      //    - typ treningu pasuje (intervals/tempo/long/easy)
      //    - w tym dniu NIE bylo wlasnego planu (zeby nie kradnac)
      function normalizeType(t){
        var s=(t||"").toLowerCase();
        if(s.indexOf("interval")>=0||s.indexOf("interw")>=0) return "intervals";
        if(s.indexOf("tempo")>=0||s.indexOf("fartlek")>=0) return "tempo";
        if(s.indexOf("long")>=0) return "long";
        if(s.indexOf("recovery")>=0) return "recovery";
        return "easy";
      }
      var entryType=normalizeType(entry.type);

      for(var i=1;i<=2;i++){
        var d=new Date(today);d.setDate(d.getDate()-i);
        var prevDate=d.toISOString().slice(0,10);
        var log=S.getLog(prevDate);
        if(!log || !log.distance) continue;

        // CHECK A: czy ten dzien mial WLASNY plan? Jesli tak — zostaw go w spokoju
        var ownPlan=plan.find(function(p){return p.date===prevDate;});
        if(ownPlan){
          var ownRatio=parseFloat(log.distance)/(ownPlan.km||1);
          // Jesli trening pasuje do wlasnego planu (±15%) — to nie jest "przeniesiony", to jest "swoj"
          if(ownRatio>0.85 && ownRatio<1.15) continue;
        }

        // CHECK B: dystans w ciasnej tolerancji (±15%)
        var ratio=parseFloat(log.distance)/entry.km;
        if(ratio<0.85 || ratio>1.15) continue;

        // CHECK C: typ treningu pasuje
        var logType=normalizeType(log.type||log.workout_type);
        if(logType!=="easy" && entryType!=="easy" && logType!==entryType) continue;

        // Wszystko sie zgadza — to faktycznie "moved"
        entry._status="moved";
        entry._logDate=prevDate;
        return entry;
      }

      entry._status="pending";
      return entry;
    } catch(e){console.warn(TAG,"PLAN error",e);return null;}
  }


  function getRecentForm(activities, days) {
    if(!days) days=7;
    const now=dayStart(new Date()), cut=new Date(now), cutP=new Date(now);
    cut.setDate(cut.getDate()-days); cutP.setDate(cutP.getDate()-days*2);
    const recent=[],prior=[];
    (activities||[]).forEach(a=>{
      const d=dayStart(new Date(a.date||a.start_date));
      if(d>=cut && d<=now) recent.push(a);
      else if(d>=cutP && d<cut) prior.push(a);
    });
    const st=function(arr){
      const km=arr.reduce(function(s,a){return s+parseFloat(a.distance_km||a.km||0);},0);
      const hrs=arr.map(function(a){return parseFloat(a.avg_hr||a.average_heartrate||0);}).filter(function(h){return h>0;});
      const paces=arr.map(function(a){return parsePace(a.pace||a.avg_pace);}).filter(function(p){return p;});
      return {
        totalKm:+km.toFixed(1), sessions:arr.length,
        avgHR:hrs.length?Math.round(hrs.reduce(function(s,v){return s+v;},0)/hrs.length):null,
        avgPace:paces.length?Math.round(paces.reduce(function(s,v){return s+v;},0)/paces.length):null
      };
    };
    const curr=st(recent),prev=st(prior);
    const kmDelta=prev.totalKm>0?+(((curr.totalKm-prev.totalKm)/prev.totalKm)*100).toFixed(1):null;
    return {current:curr,previous:prev,kmDelta:kmDelta,days:days};
  }

  function getReadinessScore(risk, form) {
    var score=100;
    var pen={low:0,moderate:15,high:35,critical:55};
    score-=pen[risk.level]||0;
    if(form.current.sessions>5) score-=15;
    else if(form.current.sessions>4) score-=5;
    if(form.kmDelta!==null && form.kmDelta>40) score-=10;
    return clamp(Math.round(score),0,100);
  }

  function el(tag,cls,text){var e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;}

  function arcPath(cx,cy,r,sa,ea){
    var rad=function(a){return((a-90)*Math.PI)/180;};
    return "M "+(cx+r*Math.cos(rad(sa)))+" "+(cy+r*Math.sin(rad(sa)))+" A "+r+" "+r+" 0 "+(ea-sa>180?1:0)+" 1 "+(cx+r*Math.cos(rad(ea)))+" "+(cy+r*Math.sin(rad(ea)));
  }

  function renderGauge(value,color,label,size){
    if(!size) size=100;
    var ns="http://www.w3.org/2000/svg";
    var svg=document.createElementNS(ns,"svg");
    svg.setAttribute("viewBox","0 0 120 120");svg.setAttribute("width",size);svg.setAttribute("height",size);
    svg.style.display="block";svg.style.margin="0 auto";
    var bg=document.createElementNS(ns,"path");
    bg.setAttribute("d",arcPath(60,60,48,0,360));bg.setAttribute("fill","none");
    bg.setAttribute("stroke","#e5e7eb");bg.setAttribute("stroke-width","8");bg.setAttribute("stroke-linecap","round");
    svg.appendChild(bg);
    var angle=(clamp(value,0,100)/100)*360;
    if(angle>0){
      var va=document.createElementNS(ns,"path");
      va.setAttribute("d",arcPath(60,60,48,0,Math.min(angle,359.9)));va.setAttribute("fill","none");
      va.setAttribute("stroke",color);va.setAttribute("stroke-width","8");va.setAttribute("stroke-linecap","round");
      svg.appendChild(va);
    }
    var txt=document.createElementNS(ns,"text");
    txt.setAttribute("x","60");txt.setAttribute("y","58");txt.setAttribute("text-anchor","middle");
    txt.setAttribute("font-size","28");txt.setAttribute("font-weight","bold");txt.setAttribute("fill",color);
    txt.textContent=value;svg.appendChild(txt);
    var lbl=document.createElementNS(ns,"text");
    lbl.setAttribute("x","60");lbl.setAttribute("y","78");lbl.setAttribute("text-anchor","middle");
    lbl.setAttribute("font-size","10");lbl.setAttribute("fill","#6b7280");
    lbl.textContent=label;svg.appendChild(lbl);
    return svg;
  }

  function renderBar(value,max,color,label){
    var wrap=el("div","briefing-bar-wrap");
    wrap.appendChild(el("div","briefing-bar-label",label));
    var track=el("div","briefing-bar-track"),fill=el("div","briefing-bar-fill");
    fill.style.width=(max>0?clamp((value/max)*100,0,100):0)+"%";
    fill.style.backgroundColor=color;track.appendChild(fill);wrap.appendChild(track);
    return wrap;
  }

  async function render(containerId) {
    console.log(TAG,"Rendering briefing...");
    var container=document.getElementById(containerId);
    if(!container){console.error(TAG,"No container");return;}
    container.innerHTML="";

    var activities=[];
    try{activities=await DB.getAll();}catch(e){console.warn(TAG,"DB err",e);}

    // === PLAN ===
    var planCard=el("div","briefing-card briefing-plan");
    planCard.appendChild(el("h3","briefing-card-title","Dzisiejszy Plan"));
    var plan=getTodayPlan();
    if(plan){
      if(plan._status==="moved"||plan._status==="done"){
        planCard.appendChild(el("p","briefing-ok","\u2705 Trening wykonany ("+plan._logDate+")"));
        planCard.appendChild(el("p","briefing-reco","\u27a1\ufe0f Rekomendacja na dzis: recovery / easy run"));
      } else {
        var pg=el("div","briefing-plan-grid");
        [["Typ",plan.type||"--"],["Dystans",plan.km?plan.km+" km":"--"],["Tempo",plan.pace||"--"],["Strefa HR",plan.hr_zone||"--"]].forEach(function(f){
          var it=el("div","briefing-plan-item");
          it.appendChild(el("span","briefing-plan-key",f[0]));
          it.appendChild(el("span","briefing-plan-val",f[1]));
          pg.appendChild(it);
        });
        planCard.appendChild(pg);
        if(plan.notes) planCard.appendChild(el("p","briefing-plan-notes",plan.notes));
        planCard.appendChild(el("p","briefing-warning","\u23f3 Trening jeszcze nie wykonany"));
      }
    } else {
      planCard.appendChild(el("p","briefing-rest","Brak planu \u2014 dzien odpoczynku"));
    }
    container.appendChild(planCard);

    // === WEATHER ===
    try{
      if(typeof Weather!=="undefined" && Weather.getCurrent){
        var wc=el("div","briefing-card briefing-weather");
        wc.appendChild(el("h3","briefing-card-title","Pogoda i Ubior"));
        var cur=await Weather.getCurrent();
        if(cur){
          var info=el("div","briefing-weather-info");
          info.appendChild(el("span",null,cur.temp+"\u00b0C "+(cur.description||"")));
          if(cur.wind) info.appendChild(el("span",null,cur.wind+" km/h"));
          if(cur.humidity) info.appendChild(el("span",null,cur.humidity+"%"));
          wc.appendChild(info);
        }
        if(Weather.getAdvisor){
          var adv=await Weather.getAdvisor();
          if(adv && adv.clothing) wc.appendChild(el("p","briefing-clothing",adv.clothing));
          if(adv && adv.notes) wc.appendChild(el("p","briefing-weather-note",adv.notes));
        }
        container.appendChild(wc);
      }
    }catch(e){console.warn(TAG,"Weather err",e);}

    // === INJURY RISK ===
    var risk=getInjuryRisk(activities);
    var rc=el("div","briefing-card briefing-risk");
    rc.appendChild(el("h3","briefing-card-title","Ryzyko Kontuzji"));
    var riskRow=el("div","briefing-risk-row");
    riskRow.appendChild(renderGauge(risk.acwr.ratio,risk.acwr.color,"ACWR \u2014 "+risk.acwr.zone,90));
    rc.appendChild(riskRow);
    rc.appendChild(renderBar(risk.spike.thisWeek,Math.max(risk.spike.avg4w*1.3,risk.spike.thisWeek,1),risk.spike.alert?"#ef4444":"#22c55e","Volume: "+risk.spike.thisWeek+" km (avg "+risk.spike.avg4w+" km, "+(risk.spike.spikePercent>0?"+":"")+risk.spike.spikePercent+"%)"));
    rc.appendChild(el("p",risk.consecutive.alert?"briefing-risk-alert":"briefing-risk-ok","Dni z rzedu: "+risk.consecutive.count));
    var alertList=el("ul","briefing-alert-list");
    risk.alerts.forEach(function(a){alertList.appendChild(el("li",null,a));});
    rc.appendChild(alertList);
    var badge=el("span","briefing-risk-badge risk-"+risk.level,risk.level.toUpperCase());
    badge.style.backgroundColor=risk.color;
    rc.insertBefore(badge,rc.children[1]);
    container.appendChild(rc);

    // === FORMA 7d ===
    var form=getRecentForm(activities,7);
    var fc=el("div","briefing-card briefing-form");
    fc.appendChild(el("h3","briefing-card-title","Forma (ostatnie 7 dni)"));
    var formGrid=el("div","briefing-form-grid");
    [["Dystans",form.current.totalKm+" km"],["Sesje",""+form.current.sessions],["Avg Pace",formatPace(form.current.avgPace)],["Avg HR",form.current.avgHR?form.current.avgHR+" bpm":"--"]].forEach(function(f){
      var it=el("div","briefing-form-item");
      it.appendChild(el("span","briefing-form-key",f[0]));
      it.appendChild(el("span","briefing-form-val",f[1]));
      formGrid.appendChild(it);
    });
    fc.appendChild(formGrid);
    if(form.kmDelta!==null){
      var trend=form.kmDelta>0?"\u2191 +"+form.kmDelta+"%":"\u2193 "+form.kmDelta+"%";
      fc.appendChild(el("p","briefing-trend "+(form.kmDelta>20?"trend-up-alert":form.kmDelta>0?"trend-up":"trend-down"),"vs poprzedni tydzien: "+trend));
    }
    container.appendChild(fc);

    // === READINESS ===
    var readiness=getReadinessScore(risk,form);
    var rdCard=el("div","briefing-card briefing-readiness");
    rdCard.appendChild(el("h3","briefing-card-title","Gotowosc do Treningu"));
    rdCard.appendChild(renderGauge(readiness,readiness>=80?"#22c55e":readiness>=50?"#f59e0b":"#ef4444","Readiness",120));
    var rm;
    if(readiness>=80) rm="Jestes gotowy \u2014 daj z siebie wszystko!";
    else if(readiness>=50) rm="Uwazaj na intensywnosc \u2014 sluchaj ciala.";
    else rm="Rozwaz lzejszy trening lub odpoczynek.";
    rdCard.appendChild(el("p","briefing-readiness-msg",rm));
    container.appendChild(rdCard);

    console.log(TAG,"Dashboard gotowy");
  }

  return {
    render:render, getInjuryRisk:getInjuryRisk, calcACWR:calcACWR,
    _activityLoad:activityLoad, _consecutiveDays:consecutiveDays,
    _volumeSpike:volumeSpike, _getRecentForm:getRecentForm,
    _getReadinessScore:getReadinessScore, _getTodayPlan:getTodayPlan
  };
})();

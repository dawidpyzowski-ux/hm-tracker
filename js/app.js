// HM Tracker v5.0 - Sprint 1+2+3+4+11 (Deep Analytics + Briefing/Compare/Report/EF/Notifications)
let CUR='dash',WI=0;
const EMO=['','😫','😣','😕','😐','🙂','😊','😄','😃','🤩','🔥'];
const TAGS={baza:'#0A84FF',budowa:'#BF5AF2',szczyt:'#FF9F0A',peak:'#FF453A',deload:'#30D158',taper:'#64D2FF',race:'#FF453A'};

function today(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function fmtD(s){const p=s.split('-');return p[2]+'.'+p[1]}
function toast(m){const t=document.getElementById('toast');t.textContent=m;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2000)}
function autoWeek(){const t=today();for(let i=0;i<PLAN.length;i++){const w=PLAN[i],end=getDayDate(w.start,6);if(t>=w.start&&t<=end)return i}return 0}
WI=autoWeek();

// --- SHIFT MATCHING HELPER ---
function findShiftedLog(wStart,wEnd,targetDate,targetKm){
  for(const offset of [-1,1,-2,2]){
    const d=new Date(targetDate+'T12:00:00');
    d.setDate(d.getDate()+offset);
    const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),dy=String(d.getDate()).padStart(2,'0');
    const nearby=y+'-'+m+'-'+dy;
    if(nearby<wStart||nearby>wEnd)continue;
    
    const nLog=S.getLog(nearby);
    if(nLog&&nLog.distance){
      const nKm=parseFloat(nLog.distance);
      // Ciasna tolerancja 85-115% (zamiast 60-140%)
      if(nKm<targetKm*0.85||nKm>targetKm*1.15)continue;
      // Sprawdz czy ten dzien NIE mial wlasnego planu (zeby nie kradnac)
      let ownPlanKm=0;
      try{
        if(window.PLAN_FLAT){
          const ownP=window.PLAN_FLAT.find(p=>p.date===nearby);
          if(ownP)ownPlanKm=ownP.km||0;
        }
      }catch(e){}
      if(ownPlanKm>0){
        const ownRatio=nKm/ownPlanKm;
        // Jesli pasuje do wlasnego planu (+/-15%) — zostaw go w spokoju
        if(ownRatio>=0.85&&ownRatio<=1.15)continue;
      }
      return{date:nearby,log:nLog};
    }

  }
  return null;
}

// Sprint 11: dodano briefing, compare, report, efficiency do mapy renderowania
function nav(s){CUR=s;document.querySelectorAll('.scr').forEach(el=>el.classList.remove('act'));document.querySelectorAll('.tab').forEach(el=>el.classList.remove('act'));document.getElementById('s-'+s).classList.add('act');document.querySelector(`.tab[data-s="${s}"]`).classList.add('act');({dash:rDash,plan:rPlan,nutr:rNutr,stat:rStat,sett:rSett,briefing:rBriefing,compare:rCompare,report:rReport,efficiency:rEfficiency})[s]()}

// --- DASHBOARD ---
async function rDash(){
  const el=document.getElementById('s-dash');
  const t=today(),dd=Math.ceil((new Date(RACE.date+'T12:00:00')-new Date(t+'T12:00:00'))/(86400000));
  const pct=Math.min(100,Math.max(0,Math.round((1-dd/89)*100)));
  let tw=null,td=null;
  for(const w of PLAN){for(const d of w.days){if(getDayDate(w.start,d.dow)===t){tw=w;td=d;break}}if(td)break}
  const cw=PLAN[WI];let done=0;
  if(cw)cw.days.forEach(d=>{const l=S.getLog(getDayDate(cw.start,d.dow));if(l&&l.distance)done+=parseFloat(l.distance)});
  const wpct=cw?Math.round(done/cw.km*100):0;
  let h=`<h1>HM Tracker</h1><p class="sub">${RACE.name}</p>`;
  h+=`<div id="weather-slot"></div>`;
  if(typeof WeekSummary!=='undefined')h+=WeekSummary.render();
  const rec=S.getRecovery(t);
  if(rec){
    const cls=rec.score>=80?'green':rec.score>=60?'yellow':'red';
    const lbl=rec.score>=80?'Swietna regeneracja! Trenuj normalnie.':rec.score>=60?'Srednia regeneracja. Rozwaz lzejszy trening.':'Slaba regeneracja! Odpoczywaj lub easy run.';
    h+=`<div class="rcard"><div class="rcard-head"><div><div class="rcard-title">💤 Recovery Score</div><div class="rcard-label">${lbl}</div></div><div class="rcard-score ${cls}">${rec.score}</div></div><div class="rcard-bar"><div class="rcard-fill ${cls}" style="width:${rec.score}%"></div></div>`;
    if(rec.score<60)h+=`<div class="rcard-alert">⚠️ Dwa dni z rzedu ponizej 60 = sygnal do odpoczynku!</div>`;
    h+=`</div>`;
  }else{
    h+=`<div class="rcard"><div class="rcard-title">💤 Poranny check-in</div><p class="sub" style="margin:8px 0">Jak sie dzisiaj czujesz?</p><div class="rform">`;
    h+=`<div class="rform-q">Sen (jakosc)</div><div class="rform-row" id="rf-sleep">`;
    for(let i=1;i<=5;i++){const em=['😩','😴','😐','😊','🤩'][i-1];h+=`<div class="rform-btn" data-g="sleep" data-v="${i}" onclick="rSel(this)">${em}</div>`}
    h+=`</div><div class="rform-q">Spoczynkowe tetno (z zegarka)</div><div class="fr"><div class="fg"><input type="number" id="rf-rhr" placeholder="np. 52" style="background:var(--bg);border:.5px solid var(--bd);border-radius:8px;color:var(--fg);padding:10px;font-size:15px;width:100%"></div></div>`;
    h+=`<div class="rform-q">Bol miesni / stawow</div><div class="rform-row" id="rf-sore">`;
    ['Brak','Lekki','Mocny'].forEach((l,i)=>{h+=`<div class="rform-btn sm" data-g="sore" data-v="${i}" onclick="rSel(this)">${l}</div>`});
    h+=`</div><div class="rform-q">Poziom energii</div><div class="rform-row" id="rf-energy">`;
    for(let i=1;i<=5;i++){const em=['🪫','🔋','😐','⚡','🔥'][i-1];h+=`<div class="rform-btn" data-g="energy" data-v="${i}" onclick="rSel(this)">${em}</div>`}
    h+=`</div><button class="rform-save" onclick="saveRecovery()">Zapisz</button></div></div>`;
  }
  TL.update();
  const pred=Pred.getCurrent();
  if(pred){
    const trendIcon=pred.trend==='up'?'⬆️':pred.trend==='down'?'⬇️':'➡️';
    const trendCls=pred.trend==='up'?'up':pred.trend==='down'?'down':'';
    h+=`<div class="pred-card"><div class="pred-head"><span class="pred-label">🎯 Prognoza polmaratonu</span><span class="pred-trend ${trendCls}">${trendIcon}${pred.prevFmt?' vs '+pred.prevFmt:''}</span></div><div class="pred-time">${pred.formatted}</div><div class="pred-pace">${pred.pace} min/km • na podstawie ${pred.fromDist} km @ ${pred.fromPace}</div><div class="pred-bar"><div class="pred-fill" style="width:${pred.pct}%"></div></div><div class="pred-target">Cel: ${Pred.fmtTime(Pred.TARGET)} • ${pred.pct}% gotowosci</div></div>`;
  }
  const fit=TL.get();
  if(fit.history.length){
    const tc=TL.tsbColor(fit.tsb),tl=TL.tsbLabel(fit.tsb);
    h+=`<div class="tl-card"><div class="tl-head">❤️‍🔥 Forma treningowa</div><div class="tl-row"><div class="tl-item"><div class="tl-val green">${fit.ctl}</div><div class="tl-lab">Fitness (CTL)</div></div><div class="tl-item"><div class="tl-val red">${fit.atl}</div><div class="tl-lab">Zmeczenie (ATL)</div></div><div class="tl-item"><div class="tl-val ${tc}">${fit.tsb>0?'+':''}${fit.tsb}</div><div class="tl-lab">Forma (TSB)</div></div></div><div class="tl-msg ${tc}">${tl}</div></div>`;
  }
  if(td){
    const cls=td.rest?'rest':td.race?'race-day':'';
    const icon=td.race?'🏁':td.rest?'🛋️':'🏃';
    h+=`<div class="hero ${cls}"><div class="hero-icon">${icon}</div><div class="hero-label">${td.rest?'Dzien wolny':'Dzisiejszy trening'}</div><div class="hero-t">${td.type}</div><div class="hero-d">${td.desc}</div>`;
    if(!td.rest)h+=`<div class="hero-m"><span>📏 ${td.km} km</span><span>⏱️ ${td.pace}</span></div>`;
    h+=`</div>`;
  }
  h+=`<div class="srow"><div class="scard"><div class="sv" style="color:${dd<=0?'var(--g)':'var(--fg)'}">${Math.max(0,dd)}</div><div class="sl">dni do wyscigu</div></div><div class="scard"><div class="sv">${wpct}%</div><div class="sl">tydzien ${cw?cw.weekNum:'-'}</div><div class="pbar"><div class="pfill" style="width:${wpct}%"></div></div></div><div class="scard"><div class="sv">${pct}%</div><div class="sl">plan ukonczony</div></div></div>`;
  h+=`<div class="stit">Nadchodzace treningi</div>`;
  let cnt=0;
  for(const w of PLAN){for(const d of w.days){const dt=getDayDate(w.start,d.dow);if(dt>t&&!d.rest&&!d.opt&&cnt<4){const log=S.getLog(dt);h+=`<div class="uitem"><span class="ud">${d.name} ${fmtD(dt)}</span><div><div class="ut">${d.type}</div><div class="uk">${d.km} km</div></div><span class="ub">${log.status==='done'?'✅':''}</span></div>`;cnt++}}}
  if(!cnt)h+=`<div class="empty">Brak nadchodzacych treningow</div>`;
  h+=`<button class="pacer-start" onclick="showPacer()" style="margin-top:16px">🏁 Race Day Pacer</button>`;
  el.innerHTML=h;
  loadWeather();
}


async function loadWeather(){
  const slot=document.getElementById('weather-slot');if(!slot)return;
  slot.innerHTML='<div class="wcard"><div class="wcard-icon">⏳</div><div class="wcard-info"><div class="wcard-temp">Laduje pogode...</div></div></div>';
  const w=await Weather.get();
  if(!w||!w.current){slot.innerHTML='';return}
  slot.innerHTML=Weather.renderAdvisor(w,Weather._fasting);
}


function rSel(btn){btn.parentElement.querySelectorAll('.rform-btn').forEach(b=>b.classList.remove('act'));btn.classList.add('act')}
function saveRecovery(){
  const sl=document.querySelector('#rf-sleep .rform-btn.act'),so=document.querySelector('#rf-sore .rform-btn.act'),en=document.querySelector('#rf-energy .rform-btn.act');
  const rhr=document.getElementById('rf-rhr');
  if(!sl||!so||!en){toast('Wypelnij wszystkie pola!');return}
  const sleep=+sl.dataset.v,soreness=+so.dataset.v,energy=+en.dataset.v;
  const rhrVal=rhr&&rhr.value?+rhr.value:(S.getSettings().rhr||50);
  const score=calcRecovery(sleep,rhrVal,soreness,energy);
  S.setRecovery(today(),{sleep,rhr:rhrVal,soreness,energy,score});
  toast('Recovery Score: '+score+' '+(score>=80?'🟢':score>=60?'🟡':'🔴'));
  rDash();
}

// --- PLAN (with auto-shift matching) ---
function rPlan(){
  const el=document.getElementById('s-plan');
  const w=PLAN[WI],t=today();
  const endD=getDayDate(w.start,6);
  const wStart=w.start,wEnd=endD;
  const tc=TAGS[w.tag]||'var(--fg2)';
  let h=`<h1>Plan treningowy</h1><p class="sub">Tydzien ${w.weekNum} / 13 • ${w.phase}</p>`;
  h+=`<div class="wnav"><button class="nbtn" onclick="WI=Math.max(0,WI-1);rPlan()" ${WI===0?'disabled':''}>◀</button><div class="winfo"><div class="wn">Tydzien ${w.weekNum}</div><div class="wp" style="color:${tc}">${w.phase}</div><div class="wd">${fmtD(w.start)} - ${fmtD(endD)}</div><div class="wk">📏 ${w.km} km</div></div><button class="nbtn" onclick="WI=Math.min(PLAN.length-1,WI+1);rPlan()" ${WI===PLAN.length-1?'disabled':''}>▶</button></div>`;
  w.days.forEach((d,i)=>{
    const dt=getDayDate(w.start,d.dow);const log=S.getLog(dt);const isToday=dt===t;
    let shifted=null,effLog=log,effStatus=log.status||'';
    if(!d.rest&&d.km>0&&!log.distance){shifted=findShiftedLog(wStart,wEnd,dt,d.km);if(shifted){effLog=shifted.log;effStatus='done'}}
    let cls='dc';if(isToday)cls+=' today';if(d.rest)cls+=' rs';if(d.opt)cls+=' op';if(d.race)cls+=' rc';if(effStatus==='done')cls+=' dn';if(effStatus==='skipped')cls+=' sk';
    const si=effStatus==='done'?(shifted?'🔄':'✅'):effStatus==='skipped'?'⏭️':d.rest?'🛋️':d.race?'🏁':'⬜';
    h+=`<div class="${cls}" id="dc-${WI}-${i}"><div class="dh" onclick="toggleDay(${WI},${i})"><div class="dl"><span class="ds">${si}</span><div><div class="dn-l">${d.name} <span class="dd-l">${fmtD(dt)}</span></div><div class="dt-l">${d.type}</div></div></div><div class="dr">${d.km>0?`<span class="dk-l">${d.km} km</span>`:''}<span class="ei">▼</span></div></div><div class="db"><div class="db-d">${d.desc}</div>${d.pace!=='-'?`<div class="db-p">Tempo: ${d.pace}</div>`:''}`;
    if(shifted){h+=`<div class="shift-hint">🔄 Przesuniety z ${fmtD(shifted.date)}: ${shifted.log.distance} km${shifted.log.pace?' @ '+shifted.log.pace:''}${shifted.log.hr?' ❤ '+shifted.log.hr+' bpm':''}</div>`}
    if(d.rest&&d.desc.toLowerCase().includes('silowy')){
      STR.initDay(dt);const stl=STR.getLog(dt);
      if(stl){
        h+=`<div class="str-card"><div class="str-title">🏋️ Trening silowy</div>`;
        if(stl.done)h+=`<div class="str-done-msg">✅ Wszystkie serie wykonane!</div>`;
        stl.exercises.forEach((ex,ei)=>{h+=`<div class="str-ex"><div><div class="str-ex-name">${ex.name}</div><div class="str-ex-target">${ex.target}</div></div><div class="str-sets">`;for(let si=0;si<ex.totalSets;si++){h+=`<div class="str-dot${si<ex.setsDone?' done':''}" onclick="strToggle('${dt}',${ei})">${si<ex.setsDone?'✓':''}</div>`}h+=`</div></div>`});
        h+=`<div class="str-timer"><button class="str-timer-btn" onclick="strTimer(this)">⏱ Odpoczynek 90s</button><div class="str-timer-display" id="str-tmr"></div></div></div>`;
      }
    }
    if(!d.rest){
      h+=`<div class="lf" id="lf-${WI}-${i}"><div class="fr"><div class="fg"><label>Dystans (km)</label><input type="number" step="0.1" id="ld-${WI}-${i}" value="${effLog.distance||''}"></div><div class="fg"><label>Tempo</label><input type="text" placeholder="6:30" id="lp-${WI}-${i}" value="${effLog.pace||''}"></div><div class="fg"><label>HR sr.</label><input type="number" id="lh-${WI}-${i}" value="${effLog.hr||''}"></div></div><div class="fg"><label>Samopoczucie</label><div class="fs">`;
      for(let f=1;f<=10;f++)h+=`<div class="fb${effLog.feeling==f?' act':''}" onclick="setFeeling(${WI},${i},${f})" data-f="${f}">${EMO[f]}</div>`;
      h+=`</div></div>`;
      const shoes=Shoes.getAll().filter(s=>!s.retired);const curShoe=Shoes.getForDate(dt);
      if(shoes.length){h+=`<div class="fg"><label>Buty</label><select class="shoe-select" onchange="Shoes.setForDate('${dt}',+this.value||null)"><option value="">-- wybierz --</option>`;shoes.forEach(s=>{h+=`<option value="${s.id}"${curShoe===s.id?' selected':''}>👟 ${s.name}</option>`});h+=`</select></div>`}
      h+=`<div class="fg"><label>Notatki</label><textarea id="ln-${WI}-${i}">${effLog.notes||''}</textarea></div><div class="fa"><button class="bs${effStatus==='done'?' act':''}" onclick="setStatus(${WI},${i},'done')">✅ Wykonany</button><button class="bs${effStatus==='skipped'?' act':''}" onclick="setStatus(${WI},${i},'skipped')">⏭️ Pominiety</button><button class="bsv" onclick="saveLog(${WI},${i})">Zapisz</button></div></div>`;
    }
    h+=`</div></div>`;
  });
  // Extra workouts

const wPlannedDates={};w.days.forEach(d=>{wPlannedDates[getDayDate(wStart,d.dow)]=d});
const shiftedDates=new Set();
w.days.forEach(d=>{if(!d.rest&&d.km>0){const dt=getDayDate(w.start,d.dow);const log=S.getLog(dt);if(!log||!log.distance){const sh=findShiftedLog(wStart,wEnd,dt,d.km);if(sh)shiftedDates.add(sh.date);}}});
const allLogs=S.getAllLogs();const extraLogs=[];
Object.entries(allLogs).forEach(([date,l])=>{if(date>=wStart&&date<=wEnd&&l.distance&&!shiftedDates.has(date)){const planned=wPlannedDates[date];if(!planned||planned.rest)extraLogs.push({date,log:l})}});

  if(extraLogs.length){
    h+=`<div class="extra-section"><div class="extra-title">✨ Dodatkowe treningi w tym tygodniu (${extraLogs.length})</div>`;
    extraLogs.forEach(e=>{const dd=new Date(e.date+'T12:00:00');const DOW=['Nd','Pn','Wt','Sr','Cz','Pt','Sb'];h+=`<div class="extra-card"><span class="extra-dt">${DOW[dd.getDay()]} ${fmtD(e.date)}</span><span class="extra-km">${e.log.distance} km</span>${e.log.pace?`<span class="extra-pace">⏱ ${e.log.pace}</span>`:''}${e.log.hr?`<span class="extra-hr">❤ ${e.log.hr}</span>`:''}</div>`});
    h+=`</div>`;
  }
  el.innerHTML=h;
}

function toggleDay(wi,di){document.getElementById('dc-'+wi+'-'+di).classList.toggle('exp')}
function setFeeling(wi,di,f){document.querySelectorAll('#lf-'+wi+'-'+di+' .fb').forEach(b=>b.classList.remove('act'));document.querySelector('#lf-'+wi+'-'+di+' .fb[data-f="'+f+'"]').classList.add('act')}
function setStatus(wi,di,st){const w=PLAN[wi],d=w.days[di],dt=getDayDate(w.start,d.dow);const log=S.getLog(dt);log.status=log.status===st?'':st;S.setLog(dt,log);rPlan()}
function saveLog(wi,di){const w=PLAN[wi],d=w.days[di],dt=getDayDate(w.start,d.dow);const dist=document.getElementById('ld-'+wi+'-'+di).value;const pace=document.getElementById('lp-'+wi+'-'+di).value;const hr=document.getElementById('lh-'+wi+'-'+di).value;const notes=document.getElementById('ln-'+wi+'-'+di).value;const fb=document.querySelector('#lf-'+wi+'-'+di+' .fb.act');const feeling=fb?fb.dataset.f:'';S.setLog(dt,{distance:dist,pace,hr,feeling,notes,status:'done'});TL.update();toast('Trening zapisany! 💪');rPlan()}

// --- NUTRITION ---
let nutrTab='today';
function rNutr(){
  const el=document.getElementById('s-nutr');
  let h=`<h1>Plan zywieniowy</h1><p class="sub">Dostosowany do polmaratonu sub 1:45</p>`;
  h+=`<div class="ts"><button class="tb${nutrTab==='today'?' act':''}" onclick="nutrTab='today';rNutr()">Dzisiaj</button><button class="tb${nutrTab==='hydration'?' act':''}" onclick="nutrTab='hydration';rNutr()">Nawodnienie</button><button class="tb${nutrTab==='suppl'?' act':''}" onclick="nutrTab='suppl';rNutr()">Suplementy</button><button class="tb${nutrTab==='zones'?' act':''}" onclick="nutrTab='zones';rNutr()">Strefy</button><button class="tb${nutrTab==='carb'?' act':''}" onclick="nutrTab='carb';rNutr()">Carb Loading</button><button class="tb${nutrTab==='race'?' act':''}" onclick="nutrTab='race';rNutr()">Dzien wyscigu</button><button class="tb${nutrTab==='check'?' act':''}" onclick="nutrTab='check';rNutr()">Checklista</button><button class="tb${nutrTab==='rules'?' act':''}" onclick="nutrTab='rules';rNutr()">Zasady</button></div>`;
  if(nutrTab==='today'){const t=today();let isT=false;for(const w of PLAN){for(const d of w.days){if(getDayDate(w.start,d.dow)===t&&!d.rest){isT=true;break}}}const meals=isT?NUTR.training:NUTR.rest;const wt=S.getSettings().weight||75;h+=`<div class="ndl">${isT?'🏃 Dzien treningowy':'🛋️ Dzien wolny'}</div>`;h+=`<div class="ms"><div class="mi"><span class="mv">${Math.round(wt*(isT?6:4.5))}</span><span class="mu">g wegl.</span></div><div class="mi"><span class="mv">${Math.round(wt*1.6)}</span><span class="mu">g bialka</span></div><div class="mi"><span class="mv">${Math.round(wt*1.1)}</span><span class="mu">g tluszczu</span></div></div>`;meals.forEach(m=>{h+=`<div class="mc"><div class="mc-t">${m.time}</div><div class="mc-n">${m.name}</div><div class="mc-d">${m.desc}</div><div class="mc-e">${m.examples}</div><div class="mc-m">${m.macro}</div></div>`})}
  if(nutrTab==='hydration'){h+=`<div class="ndl">💧 Nawodnienie</div>`;NUTR.hydration.forEach(x=>{h+=`<div class="hc"><div class="hc-t">${x.type}</div><div class="hc-r"><span class="hc-l">Przed: </span>${x.before}</div><div class="hc-r"><span class="hc-l">W trakcie: </span>${x.during}</div><div class="hc-r"><span class="hc-l">Po: </span>${x.after}</div></div>`})}
  if(nutrTab==='suppl'){h+=`<div class="ndl">💊 Suplementacja</div>`;NUTR.supplements.forEach(x=>{h+=`<div class="sc"><div class="sc-n">${x.name}</div><div class="sc-d">${x.dose}</div><div class="sc-w">Kiedy: ${x.when}</div><div class="sc-y">${x.why}</div></div>`})}
  if(nutrTab==='zones'){h+=`<div class="ndl">🎯 Strefy treningowe</div>`;ZONES.forEach(z=>{h+=`<div class="zcard"><span class="z-s">${z.sym}</span><span class="z-n">${z.name}</span><span class="z-p">${z.pace}</span><span class="z-u">${z.usage}</span></div>`})}
  if(nutrTab==='carb'){h+=`<div class="ndl">🍝 Carb Loading</div>`;NUTR.carbLoading.forEach((x,i)=>{h+=`<div class="cbday${i>=3?' hl':''}"><div class="cb-dn">${x.day}</div><div class="cb-c">${x.carbs}</div><div class="cb-f">Blonnik: ${x.fiber}</div><div class="cb-n">${x.notes}</div></div>`})}
  if(nutrTab==='race'){h+=`<div class="ndl">🏁 Harmonogram dnia wyscigu</div>`;NUTR.raceDay.forEach((x,i)=>{h+=`<div class="tli${i===6||i===9?' big':''}"><span class="tl-t">${x.time}</span><div><div class="tl-w">${x.what}</div><div class="tl-d">${x.details}</div></div></div>`})}
  if(nutrTab==='check'){h+=`<div class="ndl">✅ Checklista</div>`;const cl=S.getChecklist();NUTR.checklist.forEach((x,i)=>{h+=`<label class="chi"><input type="checkbox" ${cl[i]?'checked':''} onchange="toggleCheck(${i},this.checked)"><span>${x}</span></label>`})}
  if(nutrTab==='rules'){h+=`<div class="ndl">📋 Zasady</div><div class="rl">`;NUTR.rules.forEach(r=>{h+=`<div class="ri">${r}</div>`});h+=`</div>`}
  el.innerHTML=h;
}
function toggleCheck(i,v){const cl=S.getChecklist();cl[i]=v;S.setChecklist(cl)}

// --- STATS (with shift-aware heatmap + history + detail expand + PR) ---
function rStat(){
  const el=document.getElementById('s-stat');
  const t=today();
  TL.update();
  const DOW=['Niedz','Pon','Wt','Sr','Czw','Pt','Sob'];
  let h=`<h1>Statystyki</h1><p class="sub">Postepy treningowe</p>`;

  // Build shift map
  const shiftMap={};
  PLAN.forEach(w=>{const we=getDayDate(w.start,6);w.days.forEach(d=>{
    if(d.rest||d.km<=0)return;const dt=getDayDate(w.start,d.dow);const log=S.getLog(dt);
    if(log&&log.distance)return;
    const sh=findShiftedLog(w.start,we,dt,d.km);
    if(sh)shiftMap[sh.date]={week:w.weekNum,type:d.type,plannedDate:dt,km:d.km};
  })});

  // Heatmap (shift-aware)
  h+=`<div class="hmap"><div class="hmap-title">🟩 Mapa aktywnosci (13 tygodni)</div>`;
  const dayH=['Pn','Wt','Sr','Cz','Pt','Sb','Nd'];
  h+=`<div class="hmap-days"><div></div>`;dayH.forEach(d=>{h+=`<div class="hmap-dh">${d}</div>`});h+=`</div>`;
  h+=`<div class="hmap-grid">`;
  PLAN.forEach(w=>{const we=getDayDate(w.start,6);h+=`<div class="hmap-wk">T${w.weekNum}</div>`;w.days.forEach(d=>{
    const dt=getDayDate(w.start,d.dow);const log=S.getLog(dt);const past=dt<t;const isToday=dt===t;
    let hasShifted=false;
    if(!d.rest&&d.km>0&&!log.distance&&!log.status){const sh=findShiftedLog(w.start,we,dt,d.km);if(sh)hasShifted=true}
    let cls='hm-cell';
    if(d.rest)cls+=' rest';else if(!past&&!isToday)cls+=' future';else if(log.status==='done'||hasShifted)cls+=' done';else if(log.status==='skipped')cls+=' skip';else if(past)cls+=' miss';else cls+=' future';
    if(isToday)cls+=' today-cell';
    h+=`<div class="${cls}" title="${d.name} ${fmtD(dt)} - ${d.type}${d.km>0?' ('+d.km+' km)':''}${hasShifted?' (przesuniety)':''}"></div>`;
  })});
  h+=`</div>`;
  h+=`<div class="hmap-leg"><div class="hmap-li"><div class="hmap-lc" style="background:var(--g)"></div>Wykonany</div><div class="hmap-li"><div class="hmap-lc" style="background:var(--o)"></div>Brak logu</div><div class="hmap-li"><div class="hmap-lc" style="background:var(--r)"></div>Pominiety</div><div class="hmap-li"><div class="hmap-lc" style="background:var(--c3);opacity:.3"></div>Rest</div><div class="hmap-li"><div class="hmap-lc" style="background:var(--c2);border:.5px solid var(--c3)"></div>Przyszlosc</div></div>`;
  h+=`</div>`;

  // Personal Records (Sprint 4)
if(typeof Analytics!=='undefined'){h+=Analytics.render()}

  // History (shift-aware + clickable detail expand)
  const logs=S.getAllLogs();
  const sortedDates=Object.keys(logs).filter(d=>logs[d].distance).sort((a,b)=>b.localeCompare(a));
  let totalKm=0;sortedDates.forEach(d=>{if(logs[d].distance)totalKm+=parseFloat(logs[d].distance)});
  const plannedDates={};
  try{if(window.PLAN_FLAT){window.PLAN_FLAT.forEach(function(pf){if(!plannedDates[pf.date])plannedDates[pf.date]={type:pf.type,km:pf.km,week:'—'}})}}catch(e){}
  h+=`<div class="stit">🏃 Historia treningow</div>`;
  h+=`<div class="hist-head"><span class="hist-count">${sortedDates.length} treningow</span><span class="hist-total">${Math.round(totalKm*10)/10} km lacznie</span></div>`;

  if(sortedDates.length){
    sortedDates.forEach(date=>{
      const l=logs[date];
      const dd=new Date(date+'T12:00:00');
      const dowName=DOW[dd.getDay()];
      const planned=plannedDates[date];
      const shiftInfo=shiftMap[date];
      const hasDet=!!l.strava_id;
      const isExtra=!planned&&!shiftInfo;

      h+=`<div class="wlog${isExtra?' extra':''}" ${hasDet?`onclick="toggleDetail(this,${l.strava_id})" style="cursor:pointer"`:''}>`;
      h+=`<div class="wlog-date"><div class="wlog-d">${fmtD(date)}</div><div class="wlog-dow">${dowName}</div></div>`;
      h+=`<div class="wlog-info"><div class="wlog-top">`;
      h+=`<span class="wlog-km">${l.distance} km</span>`;
      if(l.pace)h+=`<span class="wlog-pace">⏱ ${l.pace}/km</span>`;
      if(l.hr)h+=`<span class="wlog-hr">❤ ${l.hr} bpm</span>`;
      if(l.feeling)h+=`<span class="wlog-feel">${EMO[+l.feeling]||''}</span>`;
      if(planned)h+=`<span class="wlog-match">✅ T${planned.week}: ${planned.type}</span>`;
      else if(shiftInfo)h+=`<span class="wlog-match">🔄 T${shiftInfo.week}: ${shiftInfo.type}</span>`;
      else h+=`<span class="wlog-tag">✨ Poza planem</span>`;
      if(hasDet)h+=`<span class="wlog-expand-btn">▼ szczegoly</span>`;
      h+=`</div>`;
      if(l.notes)h+=`<div class="wlog-note">${l.notes}</div>`;
      // Hidden detail container (Sprint 4)
      if(hasDet)h+=`<div class="wlog-detail" id="det-${l.strava_id}"></div>`;
      h+=`</div></div>`;
    });
  }else{h+=`<div class="empty">Brak zalogowanych treningow</div>`}

  // Charts
  h+=`<div class="chc"><div class="ch-t">❤️‍🔥 Training Load (CTL / ATL / TSB)</div><canvas id="ch-tl"></canvas></div>`;
  h+=`<div class="chc"><div class="ch-t">🎯 Prognoza polmaratonu - trend</div><canvas id="ch-pred"></canvas></div>`;
  h+=`<div class="chc"><div class="ch-t">📊 Km tygodniowy (plan vs realizacja)</div><canvas id="ch1"></canvas></div>`;
  h+=`<div class="chc"><div class="ch-t">⏱️ Trend tempa</div><canvas id="ch2"></canvas></div>`;
  h+=`<div class="chc"><div class="ch-t">😊 Samopoczucie</div><canvas id="ch3"></canvas></div>`;
  h+=`<div class="chc"><div class="ch-t">📅 Objetosc miesieczna</div><canvas id="ch4"></canvas></div>`;
  el.innerHTML=h;
  setTimeout(()=>{if(typeof Analytics!=='undefined')try{Analytics.drawCharts()}catch(e){console.warn(e)};Charts.weeklyKm('ch1');Charts.paceTrend('ch2');Charts.feelingTrend('ch3');Charts.monthlyVol('ch4');Charts.trainingLoad('ch-tl');Charts.predTrend('ch-pred')},100);
}

// --- SPRINT 4: Toggle detail view for a workout ---

function toggleDetail(el,sid){
  if(el.classList.contains('expanded')){
    el.classList.remove('expanded');
    const det=document.getElementById('det-'+sid);
    if(det)det.innerHTML='';
    return;
  }
  document.querySelectorAll('.wlog.expanded').forEach(w=>{
    w.classList.remove('expanded');
    const d=w.querySelector('.wlog-detail');
    if(d)d.innerHTML='';
  });
  el.classList.add('expanded');
  const det=document.getElementById('det-'+sid);
  if(!det)return;
  if(typeof ActDetail!=='undefined'){
    det.innerHTML=ActDetail.render(sid);
    setTimeout(()=>ActDetail.drawCharts(sid),100);
  }
}


// --- SETTINGS ---
function rSett(){
  const el=document.getElementById('s-sett');const set=S.getSettings();
  let h=`<h1>Ustawienia</h1><p class="sub">Konfiguracja</p>`;
  h+=`<div class="ss"><div class="stit">Dane osobowe</div><div class="card"><div class="lf"><div class="fr"><div class="fg"><label>Waga (kg)</label><input type="number" id="sw" value="${set.weight||75}"></div><div class="fg"><label>Spoczynkowe HR</label><input type="number" id="srhr" value="${set.rhr||50}"></div></div><button class="bsv" onclick="S.setSettings({weight:+document.getElementById('sw').value,rhr:+document.getElementById('srhr').value});TL.update();toast('Zapisano!')">Zapisz</button></div></div></div>`;
  h+=`<div class="ss"><div class="stit">👟 Buty</div><div class="card"><div class="shoe-add"><input type="text" id="shoe-name" placeholder="Nazwa (np. Nike Vaporfly 3)"><select id="shoe-type"><option>Startowe</option><option>Treningowe</option><option>Trail</option></select><input type="number" id="shoe-max" placeholder="Max km" value="600" style="max-width:80px"></div><button class="bsv" onclick="Shoes.add(document.getElementById('shoe-name').value,document.getElementById('shoe-type').value,+document.getElementById('shoe-max').value);toast('Dodano!');rSett()" style="margin-bottom:12px">Dodaj buty</button>`;
  const stats=Shoes.getStats();
  if(stats.length){stats.forEach(s=>{const cls=s.pct>=80?'danger':s.pct>=60?'warn':'ok';h+=`<div class="shoe-card"><div class="shoe-head"><span class="shoe-name">👟 ${s.shoe.name}</span><span class="shoe-type">${s.shoe.type}</span></div><div class="shoe-km">${s.km} / ${s.shoe.maxKm} km (${s.pct}%)</div><div class="shoe-bar"><div class="shoe-fill ${cls}" style="width:${Math.min(100,s.pct)}%"></div></div>${s.pct>=80?'<div class="shoe-alert">⚠️ Czas na nowe buty!</div>':''}<div class="shoe-actions"><button onclick="Shoes.retire(${s.shoe.id});toast('Wycofano');rSett()">Wycofaj</button><button onclick="if(confirm('Usunac?')){Shoes.del(${s.shoe.id});rSett()}">Usun</button></div></div>`})}else{h+=`<div class="empty">Brak butow. Dodaj swoja pierwsza pare!</div>`}
  h+=`</div></div>`;
  h+='<div style="margin:12px 0"><button onclick="SmartNotifications_requestPerm()" style="width:100%;padding:12px;border-radius:8px;background:#3b82f6;color:#fff;border:none;font-size:1em;cursor:pointer">Wlacz powiadomienia</button></div>';
  h+=`<div class="ss"><div class="stit">Strava</div><div class="card"><p style="font-size:13px;color:var(--fg2);margin-bottom:12px">${Strava.isConnected()?'✅ Polaczono ze Strava':'Polacz konto Strava aby importowac treningi.'}</p>${Strava.isConnected()?'<button class="btns" onclick="syncStr()">🔄 Synchronizuj</button><button class="btnd" onclick="Strava.disconnect();rSett();toast(\'Rozlaczono\')">Rozlacz</button>':'<button class="btn-str" onclick="Strava.authorize()">Polacz ze Strava</button>'}</div></div>`;
  h+=`<div class="ss"><div class="stit">Dane</div><button class="btns" onclick="exportData()">📤 Eksportuj (JSON)</button><button class="btnd" onclick="if(confirm('Na pewno?')){S.clearAll();toast('Usunieto');rSett()}">🗑️ Usun dane</button></div>`;
  // Sprint 11: wersja zaktualizowana
  h+=`<div class="ainfo"><p>HM Tracker v5.0 (Sprint 11)</p><p>Sub 1:45 🏃</p></div>`;
  el.innerHTML=h;
}

// Sprint 11: syncStr z hookiem SmartNotifications
async function syncStr(){
  toast('Synchronizuje...');
  const n=await Strava.syncWorkouts();
  toast(n>0?'Zsynchronizowano '+n+' treningow!':'Brak nowych. Dane szczegolowe pobrane.');
  // Sprint 11: powiadomienie o nowym treningu
  try{
    if(typeof SmartNotifications!=='undefined'&&n>0){
      const acts=await DB.getAll();
      if(acts&&acts.length>0){
        const latest=acts.sort((a,b)=>new Date(b.date||b.start_date)-new Date(a.date||a.start_date))[0];
        SmartNotifications.onActivitySync(latest);
      }
    }
  }catch(e){console.warn('[App] SmartNotifications sync hook error:',e)}
  nav(CUR);
}

function exportData(){const d=S.exportAll();const b=new Blob([d],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='hm-tracker-backup.json';a.click();toast('Wyeksportowano!')}

// --- STRENGTH ---
function strToggle(dt,idx){STR.toggleSet(dt,idx);rPlan()}
function strTimer(btn){let sec=90;btn.disabled=true;const el=document.getElementById('str-tmr');const iv=setInterval(()=>{sec--;el.textContent=sec+'s';if(sec<=0){clearInterval(iv);el.textContent='✅ Gotowy!';btn.disabled=false;toast('Nastepna seria!')}},1000)}

function toggleNotify(){if(Notify.isEnabled()){Notify.disable()}else{Notify.requestPermission().then(ok=>{if(ok)Notify.enable()})}rSett()}
function showPacer(){document.querySelectorAll('.scr').forEach(el=>el.classList.remove('act'));document.getElementById('pacer-view').classList.add('act');Pacer.renderPacer()}

// =========================================================
//  Sprint 11: Nowe render functions dla nowych zakladek
// =========================================================

function rBriefing(){
  try{
    Briefing.render('briefing-container');
  }catch(e){
    console.warn('[App] Briefing render error:',e);
    document.getElementById('briefing-container').innerHTML='<p style="padding:20px;color:var(--fg2)">⚠️ Błąd ładowania Briefing</p>';
  }
}

function rCompare(){
  try{
    DB.getAll().then(acts=>{
      if(acts&&acts.length>0){
        const latest=acts.sort((a,b)=>new Date(b.date||b.start_date)-new Date(a.date||a.start_date))[0];
        TrainingCompare.render(latest.sid||latest.id,'compare-container');
      }else{
        document.getElementById('compare-container').innerHTML='<p style="padding:20px;color:var(--fg2)">Brak aktywności do porównania. Zsynchronizuj treningi ze Strava.</p>';
      }
    });
  }catch(e){
    console.warn('[App] Compare render error:',e);
    document.getElementById('compare-container').innerHTML='<p style="padding:20px;color:var(--fg2)">⚠️ Błąd ładowania Compare</p>';
  }
}

function rReport(){
  try{
    WeeklyReport.render('report-container',0);
  }catch(e){
    console.warn('[App] WeeklyReport render error:',e);
    document.getElementById('report-container').innerHTML='<p style="padding:20px;color:var(--fg2)">⚠️ Błąd ładowania Raportu</p>';
  }
}

function rEfficiency(){
  try{
    Efficiency.render('efficiency-container');
  }catch(e){
    console.warn('[App] Efficiency render error:',e);
    document.getElementById('efficiency-container').innerHTML='<p style="padding:20px;color:var(--fg2)">⚠️ Błąd ładowania Efficiency</p>';
  }
}

// =========================================================


// --- INIT ---

document.querySelector('.tabs').addEventListener('click',e=>{const tab=e.target.closest('.tab');if(tab)nav(tab.dataset.s)});
DB.init().then(function(){
  (async()=>{
    if(window.location.search.includes('code=')){
      const ok=await Strava.handleCallback();
      if(ok){toast('Strava polaczona!');await Strava.syncWorkouts()}
    }
  
    nav('dash');

    // Sprint 19: Auto-enrich weather przy starcie (background)
    try {
      if (typeof WeatherHistory !== 'undefined' && WeatherHistory.enrichAll) {
        DB.getAll().then(function(acts) {
         
WeatherHistory.enrichAll(acts).then(function(enrichedActs) {
  var count = enrichedActs ? enrichedActs.filter(function(a) { return a._weather; }).length : 0;
  console.log('[App] Weather enriched:', count, '/', acts.length);
}).catch(function(e) {
            console.warn('[App] Weather enrich failed:', e);
          });
        });
      }
    } catch(e) { console.warn('[App] Weather init error:', e); }

    // Sprint 11: PLAN_FLAT dostepny jako lookup

    try{if(window.PLAN_FLAT){window.PLAN_FLAT_MAP={};window.PLAN_FLAT.forEach(function(p){window.PLAN_FLAT_MAP[p.date]=p})}}catch(e){}


    // Sprint 11: Inicjalizacja Smart Notifications
    try{
      if(typeof SmartNotifications!=='undefined'){
        SmartNotifications.init();
        SmartNotifications.renderBell('notif-bell-container');
        console.log('[App] SmartNotifications zainicjalizowane ✅');
      }
    }catch(e){console.warn('[App] SmartNotifications init error:',e)}

  })();
});

// --- SERVICE WORKER + AUTO-UPDATE ---
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('sw.js').then(function(reg){
    reg.addEventListener('updatefound',function(){
      var nw=reg.installing;
      nw.addEventListener('statechange',function(){
        if(nw.state==='installed'&&navigator.serviceWorker.controller){
          var bar=document.createElement('div');
          bar.innerHTML='🔄 Nowa wersja dostepna! <button onclick="location.reload()" style="margin-left:8px;padding:4px 12px;border-radius:6px;border:none;background:#0A84FF;color:#fff;cursor:pointer">Odswiez</button>';
          bar.style.cssText='position:fixed;top:0;left:0;right:0;padding:10px 16px;background:#1a1a2e;color:#fff;font-size:14px;z-index:9999;text-align:center;border-bottom:2px solid #0A84FF';
          document.body.appendChild(bar);
        }
      });
    });
    // Check for updates every 5 min
    setInterval(function(){reg.update();},300000);
  });
  function SmartNotifications_requestPerm(){if(typeof Notification!=='undefined'){Notification.requestPermission().then(function(r){alert('Powiadomienia: '+r)});}else{alert('Brak wsparcia Notification API');}}
}

if (typeof HealthSync !== "undefined") {
  HealthSync.auto();
}


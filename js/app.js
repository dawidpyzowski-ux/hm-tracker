// HM Tracker v3 - Sprint 1: Weather + Recovery + Heatmap
let CUR='dash',WI=0;
const EMO=['','\uD83D\uDE2B','\uD83D\uDE23','\uD83D\uDE15','\uD83D\uDE10','\uD83D\uDE42','\uD83D\uDE0A','\uD83D\uDE04','\uD83D\uDE03','\uD83E\uDD29','\uD83D\uDD25'];
const TAGS={baza:'#0A84FF',budowa:'#BF5AF2',szczyt:'#FF9F0A',peak:'#FF453A',deload:'#30D158',taper:'#64D2FF',race:'#FF453A'};

// TIMEZONE-SAFE today
function today(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function fmtD(s){const p=s.split('-');return p[2]+'.'+p[1]}
function toast(m){const t=document.getElementById('toast');t.textContent=m;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2000)}

function autoWeek(){const t=today();for(let i=0;i<PLAN.length;i++){const w=PLAN[i],end=getDayDate(w.start,6);if(t>=w.start&&t<=end)return i}return 0}
WI=autoWeek();

// ─── Navigate ───
function nav(s){CUR=s;document.querySelectorAll('.scr').forEach(el=>el.classList.remove('act'));document.querySelectorAll('.tab').forEach(el=>el.classList.remove('act'));document.getElementById('s-'+s).classList.add('act');document.querySelector(`.tab[data-s="${s}"]`).classList.add('act');({dash:rDash,plan:rPlan,nutr:rNutr,stat:rStat,sett:rSett})[s]()}

// ─── DASHBOARD ───
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

  // ═══ WEATHER (Sprint 1) ═══
  h+=`<div id="weather-slot"></div>`;

  // ═══ RECOVERY SCORE (Sprint 1) ═══
  const rec=S.getRecovery(t);
  if(rec){
    const cls=rec.score>=80?'green':rec.score>=60?'yellow':'red';
    const lbl=rec.score>=80?'Swietna regeneracja! Trenuj normalnie.':rec.score>=60?'Srednia regeneracja. Rozważ lzejszy trening.':'Slaba regeneracja! Odpoczywaj lub easy run.';
    h+=`<div class="rcard"><div class="rcard-head"><div><div class="rcard-title">\uD83D\uDCA4 Recovery Score</div><div class="rcard-label">${lbl}</div></div><div class="rcard-score ${cls}">${rec.score}</div></div><div class="rcard-bar"><div class="rcard-fill ${cls}" style="width:${rec.score}%"></div></div>`;
    if(rec.score<60)h+=`<div class="rcard-alert">\u26A0\uFE0F Dwa dni z rzędu poniżej 60 = sygnał do odpoczynku!</div>`;
    h+=`</div>`;
  }else{
    h+=`<div class="rcard"><div class="rcard-title">\uD83D\uDCA4 Poranny check-in</div><p class="sub" style="margin:8px 0">Jak sie dzisiaj czujesz?</p><div class="rform">`;
    h+=`<div class="rform-q">Sen (jakosc)</div><div class="rform-row" id="rf-sleep">`;
    for(let i=1;i<=5;i++){const em=['\uD83D\uDE29','\uD83D\uDE34','\uD83D\uDE10','\uD83D\uDE0A','\uD83E\uDD29'][i-1];h+=`<div class="rform-btn" data-g="sleep" data-v="${i}" onclick="rSel(this)">${em}</div>`}
    h+=`</div><div class="rform-q">Spoczynkowe tetno (z zegarka)</div><div class="fr"><div class="fg"><input type="number" id="rf-rhr" placeholder="np. 52" style="background:var(--bg);border:.5px solid var(--bd);border-radius:8px;color:var(--fg);padding:10px;font-size:15px;width:100%"></div></div>`;
    h+=`<div class="rform-q">Bol miesni / stawow</div><div class="rform-row" id="rf-sore">`;
    ['Brak','Lekki','Mocny'].forEach((l,i)=>{h+=`<div class="rform-btn sm" data-g="sore" data-v="${i}" onclick="rSel(this)">${l}</div>`});
    h+=`</div><div class="rform-q">Poziom energii</div><div class="rform-row" id="rf-energy">`;
    for(let i=1;i<=5;i++){const em=['\uD83E\uDEAB','\uD83D\uDD0B','\uD83D\uDE10','\u26A1','\uD83D\uDD25'][i-1];h+=`<div class="rform-btn" data-g="energy" data-v="${i}" onclick="rSel(this)">${em}</div>`}
    h+=`</div><button class="rform-save" onclick="saveRecovery()">Zapisz</button></div></div>`;
  }

  // ═══ RACE PREDICTOR (Sprint 2) ═══
  TL.update();
  const pred=Pred.getCurrent();
  if(pred){
    const trendIcon=pred.trend==='up'?'\u2B06\uFE0F':pred.trend==='down'?'\u2B07\uFE0F':'\u27A1\uFE0F';
    const trendCls=pred.trend==='up'?'up':pred.trend==='down'?'down':'';
    h+=`<div class="pred-card"><div class="pred-head"><span class="pred-label">\uD83C\uDFAF Prognoza polmaratonu</span><span class="pred-trend ${trendCls}">${trendIcon}${pred.prevFmt?' vs '+pred.prevFmt:''}</span></div><div class="pred-time">${pred.formatted}</div><div class="pred-pace">${pred.pace} min/km \u2022 na podstawie ${pred.fromDist} km @ ${pred.fromPace}</div><div class="pred-bar"><div class="pred-fill" style="width:${pred.pct}%"></div></div><div class="pred-target">Cel: ${Pred.fmtTime(Pred.TARGET)} \u2022 ${pred.pct}% gotowosci</div></div>`;
  }

  // ═══ TRAINING LOAD (Sprint 2) ═══
  const fit=TL.get();
  if(fit.history.length){
    const tc=TL.tsbColor(fit.tsb),tl=TL.tsbLabel(fit.tsb);
    h+=`<div class="tl-card"><div class="tl-head">\u2764\uFE0F\u200D\uD83D\uDD25 Forma treningowa</div><div class="tl-row"><div class="tl-item"><div class="tl-val green">${fit.ctl}</div><div class="tl-lab">Fitness (CTL)</div></div><div class="tl-item"><div class="tl-val red">${fit.atl}</div><div class="tl-lab">Zmeczenie (ATL)</div></div><div class="tl-item"><div class="tl-val ${tc}">${fit.tsb>0?'+':''}${fit.tsb}</div><div class="tl-lab">Forma (TSB)</div></div></div><div class="tl-msg ${tc}">${tl}</div></div>`;
  }

  // ═══ TODAY'S WORKOUT ═══
  if(td){
    const cls=td.rest?'rest':td.race?'race-day':'';
    const icon=td.race?'\uD83C\uDFC1':td.rest?'\uD83D\uDECB\uFE0F':'\uD83C\uDFC3';
    h+=`<div class="hero ${cls}"><div class="hero-icon">${icon}</div><div class="hero-label">${td.rest?'Dzien wolny':'Dzisiejszy trening'}</div><div class="hero-t">${td.type}</div><div class="hero-d">${td.desc}</div>`;
    if(!td.rest)h+=`<div class="hero-m"><span>\uD83D\uDCCF ${td.km} km</span><span>\u23F1\uFE0F ${td.pace}</span></div>`;
    h+=`</div>`;
  }

  // ═══ STATS ROW ═══
  h+=`<div class="srow"><div class="scard"><div class="sv" style="color:${dd<=0?'var(--g)':'var(--fg)'}">${Math.max(0,dd)}</div><div class="sl">dni do wyscigu</div></div><div class="scard"><div class="sv">${wpct}%</div><div class="sl">tydzien ${cw?cw.weekNum:'-'}</div><div class="pbar"><div class="pfill" style="width:${wpct}%"></div></div></div><div class="scard"><div class="sv">${pct}%</div><div class="sl">plan ukonczony</div></div></div>`;

  // ═══ UPCOMING ═══
  h+=`<div class="stit">Nadchodzace treningi</div>`;
  let cnt=0;
  for(const w of PLAN){for(const d of w.days){const dt=getDayDate(w.start,d.dow);if(dt>t&&!d.rest&&!d.opt&&cnt<4){const log=S.getLog(dt);h+=`<div class="uitem"><span class="ud">${d.name} ${fmtD(dt)}</span><div><div class="ut">${d.type}</div><div class="uk">${d.km} km</div></div><span class="ub">${log.status==='done'?'\u2705':''}</span></div>`;cnt++}}}
  if(!cnt)h+=`<div class="empty">Brak nadchodzacych treningow</div>`;

  el.innerHTML=h;

  // Async weather load
  loadWeather();
}

async function loadWeather(){
  const slot=document.getElementById('weather-slot');
  if(!slot)return;
  slot.innerHTML='<div class="wcard"><div class="wcard-icon">\u23F3</div><div class="wcard-info"><div class="wcard-temp">Laduje pogode...</div></div></div>';
  const w=await Weather.get();
  if(!w||!w.current){slot.innerHTML='';return}
  const temp=Math.round(w.current.temperature_2m);
  const code=w.current.weathercode;
  const wind=Math.round(w.current.windspeed_10m);
  const rain=w.daily?Math.round(w.daily.precipitation_sum[0]*10)/10:0;
  const adj=Weather.paceAdj(temp);
  const acls=adj.adj===0?'ok':adj.adj<=15?'warn':'hot';
  slot.innerHTML=`<div class="wcard"><div class="wcard-icon">${Weather.wmo(code)}</div><div class="wcard-info"><div class="wcard-temp">${temp}°C</div><div class="wcard-det">\uD83C\uDF2C\uFE0F ${wind} km/h${rain>0?' · \uD83C\uDF27\uFE0F '+rain+' mm':''}</div><div class="wcard-adj ${acls}">${adj.icon} ${adj.msg}</div></div></div>`;
}

// Recovery form helpers
function rSel(btn){
  btn.parentElement.querySelectorAll('.rform-btn').forEach(b=>b.classList.remove('act'));
  btn.classList.add('act');
}
function saveRecovery(){
  const sl=document.querySelector('#rf-sleep .rform-btn.act');
  const so=document.querySelector('#rf-sore .rform-btn.act');
  const en=document.querySelector('#rf-energy .rform-btn.act');
  const rhr=document.getElementById('rf-rhr');
  if(!sl||!so||!en){toast('Wypelnij wszystkie pola!');return}
  const sleep=+sl.dataset.v, soreness=+so.dataset.v, energy=+en.dataset.v;
  const rhrVal=rhr&&rhr.value?+rhr.value:(S.getSettings().rhr||50);
  const score=calcRecovery(sleep,rhrVal,soreness,energy);
  S.setRecovery(today(),{sleep,rhr:rhrVal,soreness,energy,score});
  toast('Recovery Score: '+score+' '+( score>=80?'\uD83D\uDFE2':score>=60?'\uD83D\uDFE1':'\uD83D\uDD34'));
  rDash();
}

// ─── PLAN ───
function rPlan(){
  const el=document.getElementById('s-plan');
  const w=PLAN[WI],t=today();
  const endD=getDayDate(w.start,6);
  const tc=TAGS[w.tag]||'var(--fg2)';
  let h=`<h1>Plan treningowy</h1><p class="sub">Tydzien ${w.weekNum} / 13 \u2022 ${w.phase}</p>`;
  h+=`<div class="wnav"><button class="nbtn" onclick="WI=Math.max(0,WI-1);rPlan()" ${WI===0?'disabled':''}>◀</button><div class="winfo"><div class="wn">Tydzien ${w.weekNum}</div><div class="wp" style="color:${tc}">${w.phase}</div><div class="wd">${fmtD(w.start)} - ${fmtD(endD)}</div><div class="wk">\uD83D\uDCCF ${w.km} km</div></div><button class="nbtn" onclick="WI=Math.min(PLAN.length-1,WI+1);rPlan()" ${WI===PLAN.length-1?'disabled':''}>▶</button></div>`;
  w.days.forEach((d,i)=>{
    const dt=getDayDate(w.start,d.dow);const log=S.getLog(dt);const isToday=dt===t;
    let cls='dc';if(isToday)cls+=' today';if(d.rest)cls+=' rs';if(d.opt)cls+=' op';if(d.race)cls+=' rc';if(log.status==='done')cls+=' dn';if(log.status==='skipped')cls+=' sk';
    const si=log.status==='done'?'\u2705':log.status==='skipped'?'\u23ED\uFE0F':d.rest?'\uD83D\uDECB\uFE0F':d.race?'\uD83C\uDFC1':'\u2B1C';
    h+=`<div class="${cls}" id="dc-${WI}-${i}"><div class="dh" onclick="toggleDay(${WI},${i})"><div class="dl"><span class="ds">${si}</span><div><div class="dn-l">${d.name} <span class="dd-l">${fmtD(dt)}</span></div><div class="dt-l">${d.type}</div></div></div><div class="dr">${d.km>0?`<span class="dk-l">${d.km} km</span>`:''}<span class="ei">\u25BC</span></div></div><div class="db"><div class="db-d">${d.desc}</div>${d.pace!=='-'?`<div class="db-p">Tempo: ${d.pace}</div>`:''}`;
   
    // Strength training panel for rest/strength days
    if(d.rest && d.desc.toLowerCase().includes('silowy')){
      STR.initDay(dt);
      const stl=STR.getLog(dt);
      if(stl){
        h+=`<div class="str-card"><div class="str-title">\uD83C\uDFCB\uFE0F Trening silowy</div>`;
        if(stl.done)h+=`<div class="str-done-msg">\u2705 Wszystkie serie wykonane!</div>`;
        stl.exercises.forEach((ex,ei)=>{
          h+=`<div class="str-ex"><div><div class="str-ex-name">${ex.name}</div><div class="str-ex-target">${ex.target}</div></div><div class="str-sets">`;
          for(let si=0;si<ex.totalSets;si++){
            h+=`<div class="str-dot${si<ex.setsDone?' done':''}" onclick="strToggle('${dt}',${ei})">${si<ex.setsDone?'\u2713':''}</div>`;
          }
          h+=`</div></div>`;
        });
        h+=`<div class="str-timer"><button class="str-timer-btn" onclick="strTimer(this)">⏱ Odpoczynek 90s</button><div class="str-timer-display" id="str-tmr"></div></div></div>`;
      }
    }

    if(!d.rest){
      h+=`<div class="lf" id="lf-${WI}-${i}"><div class="fr"><div class="fg"><label>Dystans (km)</label><input type="number" step="0.1" id="ld-${WI}-${i}" value="${log.distance||''}"></div><div class="fg"><label>Tempo</label><input type="text" placeholder="6:30" id="lp-${WI}-${i}" value="${log.pace||''}"></div><div class="fg"><label>HR sr.</label><input type="number" id="lh-${WI}-${i}" value="${log.hr||''}"></div></div><div class="fg"><label>Samopoczucie</label><div class="fs">`;
      for(let f=1;f<=10;f++)h+=`<div class="fb${log.feeling==f?' act':''}" onclick="setFeeling(${WI},${i},${f})" data-f="${f}">${EMO[f]}</div>`;
      h+=`</div></div>
      
      // Shoe selector
      const shoes=Shoes.getAll().filter(s=>!s.retired);
      const curShoe=Shoes.getForDate(dt);
      if(shoes.length){
        h+=`<div class="fg"><label>Buty</label><select class="shoe-select" onchange="Shoes.setForDate('${dt}',+this.value||null)"><option value="">-- wybierz --</option>`;
        shoes.forEach(s=>{h+=`<option value="${s.id}"${curShoe===s.id?' selected':''}>${s.name}</option>`});
        h+=`</select></div>`;
      }

      
      <div class="fg"><label>Notatki</label><textarea id="ln-${WI}-${i}">${log.notes||''}</textarea></div><div class="fa"><button class="bs${log.status==='done'?' act':''}" onclick="setStatus(${WI},${i},'done')">\u2705 Wykonany</button><button class="bs${log.status==='skipped'?' act':''}" onclick="setStatus(${WI},${i},'skipped')">\u23ED\uFE0F Pominiety</button><button class="bsv" onclick="saveLog(${WI},${i})">Zapisz</button></div></div>`;
    }
    h+=`</div></div>`;
  });
  el.innerHTML=h;
}
function toggleDay(wi,di){document.getElementById('dc-'+wi+'-'+di).classList.toggle('exp')}
function setFeeling(wi,di,f){document.querySelectorAll('#lf-'+wi+'-'+di+' .fb').forEach(b=>b.classList.remove('act'));document.querySelector('#lf-'+wi+'-'+di+' .fb[data-f="'+f+'"]').classList.add('act')}
function setStatus(wi,di,st){const w=PLAN[wi],d=w.days[di],dt=getDayDate(w.start,d.dow);const log=S.getLog(dt);log.status=log.status===st?'':st;S.setLog(dt,log);rPlan()}
function saveLog(wi,di){const w=PLAN[wi],d=w.days[di],dt=getDayDate(w.start,d.dow);const dist=document.getElementById('ld-'+wi+'-'+di).value;const pace=document.getElementById('lp-'+wi+'-'+di).value;const hr=document.getElementById('lh-'+wi+'-'+di).value;const notes=document.getElementById('ln-'+wi+'-'+di).value;const fb=document.querySelector('#lf-'+wi+'-'+di+' .fb.act');const feeling=fb?fb.dataset.f:'';S.setLog(dt,{distance:dist,pace:pace,hr:hr,feeling:feeling,notes:notes,status:'done'});TL.update();toast('Trening zapisany! \uD83D\uDCAA');rPlan()}

// ─── NUTRITION ───
let nutrTab='today';
function rNutr(){
  const el=document.getElementById('s-nutr');
  let h=`<h1>Plan zywieniowy</h1><p class="sub">Dostosowany do polmaratonu sub 1:45</p>`;
  h+=`<div class="ts"><button class="tb${nutrTab==='today'?' act':''}" onclick="nutrTab='today';rNutr()">Dzisiaj</button><button class="tb${nutrTab==='hydration'?' act':''}" onclick="nutrTab='hydration';rNutr()">Nawodnienie</button><button class="tb${nutrTab==='suppl'?' act':''}" onclick="nutrTab='suppl';rNutr()">Suplementy</button><button class="tb${nutrTab==='zones'?' act':''}" onclick="nutrTab='zones';rNutr()">Strefy</button><button class="tb${nutrTab==='carb'?' act':''}" onclick="nutrTab='carb';rNutr()">Carb Loading</button><button class="tb${nutrTab==='race'?' act':''}" onclick="nutrTab='race';rNutr()">Dzien wyscigu</button><button class="tb${nutrTab==='check'?' act':''}" onclick="nutrTab='check';rNutr()">Checklista</button><button class="tb${nutrTab==='rules'?' act':''}" onclick="nutrTab='rules';rNutr()">Zasady</button></div>`;
  if(nutrTab==='today'){
    const t=today();let isT=false;for(const w of PLAN){for(const d of w.days){if(getDayDate(w.start,d.dow)===t&&!d.rest){isT=true;break}}}
    const meals=isT?NUTR.training:NUTR.rest;const wt=S.getSettings().weight||75;
    h+=`<div class="ndl">${isT?'\uD83C\uDFC3 Dzien treningowy':'\uD83D\uDECB\uFE0F Dzien wolny'}</div>`;
    h+=`<div class="ms"><div class="mi"><span class="mv">${Math.round(wt*(isT?6:4.5))}</span><span class="mu">g wegl.</span></div><div class="mi"><span class="mv">${Math.round(wt*1.6)}</span><span class="mu">g bialka</span></div><div class="mi"><span class="mv">${Math.round(wt*1.1)}</span><span class="mu">g tluszczu</span></div></div>`;
    meals.forEach(m=>{h+=`<div class="mc"><div class="mc-t">${m.time}</div><div class="mc-n">${m.name}</div><div class="mc-d">${m.desc}</div><div class="mc-e">${m.examples}</div><div class="mc-m">${m.macro}</div></div>`});
  }
  if(nutrTab==='hydration'){h+=`<div class="ndl">\uD83D\uDCA7 Nawodnienie</div>`;NUTR.hydration.forEach(x=>{h+=`<div class="hc"><div class="hc-t">${x.type}</div><div class="hc-r"><span class="hc-l">Przed: </span>${x.before}</div><div class="hc-r"><span class="hc-l">W trakcie: </span>${x.during}</div><div class="hc-r"><span class="hc-l">Po: </span>${x.after}</div></div>`})}
  if(nutrTab==='suppl'){h+=`<div class="ndl">\uD83D\uDC8A Suplementacja</div>`;NUTR.supplements.forEach(x=>{h+=`<div class="sc"><div class="sc-n">${x.name}</div><div class="sc-d">${x.dose}</div><div class="sc-w">Kiedy: ${x.when}</div><div class="sc-y">${x.why}</div></div>`})}
  if(nutrTab==='zones'){h+=`<div class="ndl">\uD83C\uDFAF Strefy treningowe</div>`;ZONES.forEach(z=>{h+=`<div class="zcard"><span class="z-s">${z.sym}</span><span class="z-n">${z.name}</span><span class="z-p">${z.pace}</span><span class="z-u">${z.usage}</span></div>`})}
  if(nutrTab==='carb'){h+=`<div class="ndl">\uD83C\uDF5D Carb Loading</div>`;NUTR.carbLoading.forEach((x,i)=>{h+=`<div class="cbday${i>=3?' hl':''}"><div class="cb-dn">${x.day}</div><div class="cb-c">${x.carbs}</div><div class="cb-f">Blonnik: ${x.fiber}</div><div class="cb-n">${x.notes}</div></div>`})}
  if(nutrTab==='race'){h+=`<div class="ndl">\uD83C\uDFC1 Harmonogram dnia wyscigu</div>`;NUTR.raceDay.forEach((x,i)=>{h+=`<div class="tli${i===6||i===9?' big':''}"><span class="tl-t">${x.time}</span><div><div class="tl-w">${x.what}</div><div class="tl-d">${x.details}</div></div></div>`})}
  if(nutrTab==='check'){h+=`<div class="ndl">\u2705 Checklista</div>`;const cl=S.getChecklist();NUTR.checklist.forEach((x,i)=>{h+=`<label class="chi"><input type="checkbox" ${cl[i]?'checked':''} onchange="toggleCheck(${i},this.checked)"><span>${x}</span></label>`})}
  if(nutrTab==='rules'){h+=`<div class="ndl">\uD83D\uDCCB Zasady</div><div class="rl">`;NUTR.rules.forEach(r=>{h+=`<div class="ri">${r}</div>`});h+=`</div>`}
  el.innerHTML=h;
}
function toggleCheck(i,v){const cl=S.getChecklist();cl[i]=v;S.setChecklist(cl)}

// ─── STATS (Sprint 1: Heatmap) ───
function rStat(){
  const el=document.getElementById('s-stat');
  const t=today();
  TL.update();let h=`<h1>Statystyki</h1><p class="sub">Postepy treningowe</p>`;
  setTimeout(()=>{Charts.weeklyKm('ch1');Charts.paceTrend('ch2');Charts.feelingTrend('ch3');Charts.monthlyVol('ch4');Charts.trainingLoad('ch-tl');Charts.predTrend('ch-pred')},100);

  // ═══ HEAT MAP ═══
  h+=`<div class="hmap"><div class="hmap-title">\uD83D\uDFE9 Mapa aktywnosci (13 tygodni)</div>`;
  const dayH=['Pn','Wt','Sr','Cz','Pt','Sb','Nd'];
  h+=`<div class="hmap-days"><div></div>`;dayH.forEach(d=>{h+=`<div class="hmap-dh">${d}</div>`});h+=`</div>`;
  h+=`<div class="hmap-grid">`;
  PLAN.forEach(w=>{
    h+=`<div class="hmap-wk">T${w.weekNum}</div>`;
    w.days.forEach(d=>{
      const dt=getDayDate(w.start,d.dow);const log=S.getLog(dt);const past=dt<t;const isToday=dt===t;
      let cls='hm-cell';
      if(d.rest)cls+=' rest';
      else if(!past&&!isToday)cls+=' future';
      else if(log.status==='done')cls+=' done';
      else if(log.status==='skipped')cls+=' skip';
      else if(past)cls+=' miss';
      else cls+=' future';
      if(isToday)cls+=' today-cell';
      h+=`<div class="${cls}" title="${d.name} ${fmtD(dt)} - ${d.type}${d.km>0?' ('+d.km+' km)':''}"></div>`;
    });
  });
  h+=`</div>`;
  h+=`<div class="hmap-leg"><div class="hmap-li"><div class="hmap-lc" style="background:var(--g)"></div>Wykonany</div><div class="hmap-li"><div class="hmap-lc" style="background:var(--o)"></div>Brak logu</div><div class="hmap-li"><div class="hmap-lc" style="background:var(--r)"></div>Pominiety</div><div class="hmap-li"><div class="hmap-lc" style="background:var(--c3);opacity:.3"></div>Rest</div><div class="hmap-li"><div class="hmap-lc" style="background:var(--c2);border:.5px solid var(--c3)"></div>Przyszlosc</div></div>`;
  h+=`</div>`;

  // ═══ TRAINING LOAD CHART (Sprint 2) ═══
  h+=`<div class="chc"><div class="ch-t">\u2764\uFE0F\u200D\uD83D\uDD25 Training Load (CTL / ATL / TSB)</div><canvas id="ch-tl"></canvas></div>`;

  // ═══ PREDICTOR TREND (Sprint 2) ═══
  h+=`<div class="chc"><div class="ch-t">\uD83C\uDFAF Prognoza polmaratonu - trend</div><canvas id="ch-pred"></canvas></div>`;

  // CHARTS
  h+=`<div class="chc"><div class="ch-t">\uD83D\uDCCA Km tygodniowy (plan vs realizacja)</div><canvas id="ch1"></canvas></div>`;
  h+=`<div class="chc"><div class="ch-t">\u23F1\uFE0F Trend tempa</div><canvas id="ch2"></canvas></div>`;
  h+=`<div class="chc"><div class="ch-t">\uD83D\uDE0A Samopoczucie</div><canvas id="ch3"></canvas></div>`;
  h+=`<div class="chc"><div class="ch-t">\uD83D\uDCC5 Objetosc miesieczna</div><canvas id="ch4"></canvas></div>`;
  el.innerHTML=h;
  setTimeout(()=>{Charts.weeklyKm('ch1');Charts.paceTrend('ch2');Charts.feelingTrend('ch3');Charts.monthlyVol('ch4')},100);
}

// ─── SETTINGS ───
function rSett(){
  const el=document.getElementById('s-sett');const set=S.getSettings();
  el.innerHTML=`<h1>Ustawienia</h1><p class="sub">Konfiguracja</p><div class="ss"><div class="stit">Dane osobowe</div><div class="card"><div class="lf"><div class="fr"><div class="fg"><label>Waga (kg)</label><input type="number" id="sw" value="${set.weight||75}"></div><div class="fg"><label>Spoczynkowe HR</label><input type="number" id="srhr" value="${set.rhr||50}"></div></div><button class="bsv" onclick="S.setSettings({weight:+document.getElementById('sw').value,rhr:+document.getElementById('srhr').value});TL.update();toast('Zapisano!')">Zapisz</button></div></div></div><div class="ss"><div class="stit">\uD83D\uDC5F Buty</div>
    <div class="card">
      <div class="shoe-add">
        <input type="text" id="shoe-name" placeholder="Nazwa (np. Nike Vaporfly 3)">
        <select id="shoe-type"><option>Startowe</option><option>Treningowe</option><option>Trail</option></select>
        <input type="number" id="shoe-max" placeholder="Max km" value="600" style="max-width:80px">
      </div>
      <button class="bsv" onclick="Shoes.add(document.getElementById('shoe-name').value,document.getElementById('shoe-type').value,+document.getElementById('shoe-max').value);toast('Dodano!');rSett()" style="margin-bottom:12px">Dodaj buty</button>`;
    const stats=Shoes.getStats();
    if(stats.length){
      stats.forEach(s=>{
        const cls=s.pct>=80?'danger':s.pct>=60?'warn':'ok';
        h+=`<div class="shoe-card"><div class="shoe-head"><span class="shoe-name">\uD83D\uDC5F ${s.shoe.name}</span><span class="shoe-type">${s.shoe.type}</span></div><div class="shoe-km">${s.km} / ${s.shoe.maxKm} km (${s.pct}%)</div><div class="shoe-bar"><div class="shoe-fill ${cls}" style="width:${Math.min(100,s.pct)}%"></div></div>${s.pct>=80?'<div class="shoe-alert">\u26A0\uFE0F Czas na nowe buty!</div>':''}<div class="shoe-actions"><button onclick="Shoes.retire(${s.shoe.id});toast('Wycofano');rSett()">Wycofaj</button><button onclick="if(confirm('Usunac?')){Shoes.del(${s.shoe.id});rSett()}">Usun</button></div></div>`;
      });
    }else{h+=`<div class="empty">Brak butow. Dodaj swoja pierwsza pare!</div>`}
    h+=`</div></div><div class="ss"><div class="stit">Strava</div><div class="card"><p style="font-size:13px;color:var(--fg2);margin-bottom:12px">${Strava.isConnected()?'\u2705 Polaczono ze Strava':'Polacz konto Strava aby importowac treningi.'}</p>${Strava.isConnected()?`<button class="btns" onclick="syncStr()">\uD83D\uDD04 Synchronizuj</button><button class="btnd" onclick="Strava.disconnect();rSett();toast('Rozlaczono')">Rozlacz</button>`:`<button class="btn-str" onclick="Strava.authorize()">Polacz ze Strava</button>`}</div></div><div class="ss"><div class="stit">Dane</div><button class="btns" onclick="exportData()">\uD83D\uDCE4 Eksportuj (JSON)</button><button class="btnd" onclick="if(confirm('Na pewno?')){S.clearAll();toast('Usunieto');rSett()}">\uD83D\uDDD1\uFE0F Usun dane</button></div><div class="ainfo"><p>HM Tracker v3.0 (Sprint 1)</p><p>Sub 1:45 \uD83C\uDFC3</p></div>`;
}
async function syncStr(){toast('Synchronizuje...');const n=await Strava.syncWorkouts();toast(n>0?`Zsynchronizowano ${n} treningow!`:'Brak nowych');rPlan()}
function exportData(){const d=S.exportAll();const b=new Blob([d],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='hm-tracker-backup.json';a.click();toast('Wyeksportowano!')}


// ─── STRENGTH (Sprint 3) ───
function strToggle(dt,idx){STR.toggleSet(dt,idx);rPlan()}
function strTimer(btn){
  let sec=90;btn.disabled=true;
  const el=document.getElementById('str-tmr');
  const iv=setInterval(()=>{
    sec--;el.textContent=sec+'s';
    if(sec<=0){clearInterval(iv);el.textContent='\u2705 Gotowy!';btn.disabled=false;toast('Nastepna seria!')}
  },1000);
}


// ─── INIT ───
document.querySelector('.tabs').addEventListener('click',e=>{const tab=e.target.closest('.tab');if(tab)nav(tab.dataset.s)});
(async()=>{if(window.location.search.includes('code=')){const ok=await Strava.handleCallback();if(ok){toast('Strava polaczona!');await Strava.syncWorkouts()}}nav('dash')})();

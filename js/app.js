// HM Tracker - App Controller
let CUR='dash', WI=0;
const EMO=['','😫','😣','😕','😐','🙂','😊','😄','😃','🤩','🔥'];
const TAGS={baza:'#0A84FF',budowa:'#BF5AF2',szczyt:'#FF9F0A',peak:'#FF453A',deload:'#30D158',taper:'#64D2FF',race:'#FF453A'};

function today(){return new Date().toISOString().substring(0,10)}
function fmtD(s){const p=s.split('-');return p[2]+'.'+p[1]}
function toast(m){const t=document.getElementById('toast');t.textContent=m;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2000)}

// Auto-detect current week
function autoWeek(){
  const t=today();
  for(let i=0;i<PLAN.length;i++){
    const w=PLAN[i],end=getDayDate(w.start,6);
    if(t>=w.start&&t<=end)return i;
  }
  return 0;
}
WI=autoWeek();

// ─── Navigate ───
function nav(s){
  CUR=s;
  document.querySelectorAll('.scr').forEach(el=>el.classList.remove('act'));
  document.querySelectorAll('.tab').forEach(el=>el.classList.remove('act'));
  document.getElementById('s-'+s).classList.add('act');
  document.querySelector(`.tab[data-s="${s}"]`).classList.add('act');
  ({dash:rDash,plan:rPlan,nutr:rNutr,stat:rStat,sett:rSett})[s]();
}

// ─── DASHBOARD ───
function rDash(){
  const el=document.getElementById('s-dash');
  const t=today(), dd=Math.ceil((new Date(RACE.date)-new Date(t))/(86400000));
  const pct=Math.min(100,Math.max(0,Math.round((1-dd/89)*100)));

  // Find today's workout
  let tw=null, td=null;
  for(const w of PLAN){
    for(const d of w.days){
      if(getDayDate(w.start,d.dow)===t){tw=w;td=d;break}
    }
    if(td)break;
  }

  // Week km progress
  const cw=PLAN[WI];
  let done=0;
  if(cw)cw.days.forEach(d=>{const l=S.getLog(getDayDate(cw.start,d.dow));if(l&&l.distance)done+=parseFloat(l.distance)});
  const wpct=cw?Math.round(done/cw.km*100):0;

  let h=`<h1>HM Tracker</h1><p class="sub">${RACE.name}</p>`;

  // Today card
  if(td){
    const cls=td.rest?'rest':td.race?'race-day':'';
    const icon=td.race?'🏁':td.rest?'🛋️':'🏃';
    h+=`<div class="hero ${cls}">
      <div class="hero-icon">${icon}</div>
      <div class="hero-label">${td.rest?'Dzien wolny':'Dzisiejszy trening'}</div>
      <div class="hero-t">${td.type}</div>
      <div class="hero-d">${td.desc}</div>`;
    if(!td.rest)h+=`<div class="hero-m"><span>📏 ${td.km} km</span><span>⏱️ ${td.pace}</span></div>`;
    h+=`</div>`;
  }

  // Stats row
  h+=`<div class="srow">
    <div class="scard"><div class="sv" style="color:${dd<=0?'var(--g)':'var(--fg)'}">${Math.max(0,dd)}</div><div class="sl">dni do wyscigu</div></div>
    <div class="scard"><div class="sv">${wpct}%</div><div class="sl">tydzien ${cw?cw.weekNum:'-'}</div>
      <div class="pbar"><div class="pfill" style="width:${wpct}%"></div></div>
    </div>
    <div class="scard"><div class="sv">${pct}%</div><div class="sl">plan ukonczony</div></div>
  </div>`;

  // Upcoming
  h+=`<div class="stit">Nadchodzace treningi</div>`;
  let cnt=0;
  for(const w of PLAN){
    for(const d of w.days){
      const dt=getDayDate(w.start,d.dow);
      if(dt>t&&!d.rest&&!d.opt&&cnt<4){
        const log=S.getLog(dt);
        h+=`<div class="uitem${log.status?' dn':''}">
          <span class="ud">${d.name} ${fmtD(dt)}</span>
          <div><div class="ut">${d.type}</div><div class="uk">${d.km} km</div></div>
          <span class="ub">${log.status==='done'?'✅':''}</span>
        </div>`;
        cnt++;
      }
    }
  }
  if(!cnt)h+=`<div class="empty">Brak nadchodzacych treningow</div>`;

  el.innerHTML=h;
}

// ─── PLAN ───
function rPlan(){
  const el=document.getElementById('s-plan');
  const w=PLAN[WI], t=today();
  const endD=getDayDate(w.start,6);
  const tc=TAGS[w.tag]||'var(--fg2)';

  let h=`<h1>Plan treningowy</h1><p class="sub">Tydzien ${w.weekNum} / 13 &bull; ${w.phase}</p>`;

  // Week nav
  h+=`<div class="wnav">
    <button class="nbtn" onclick="WI=Math.max(0,WI-1);rPlan()" ${WI===0?'disabled':''}>◀</button>
    <div class="winfo">
      <div class="wn">Tydzien ${w.weekNum}</div>
      <div class="wp" style="color:${tc}">${w.phase}</div>
      <div class="wd">${fmtD(w.start)} - ${fmtD(endD)}</div>
      <div class="wk">📏 ${w.km} km zaplanowane</div>
    </div>
    <button class="nbtn" onclick="WI=Math.min(PLAN.length-1,WI+1);rPlan()" ${WI===PLAN.length-1?'disabled':''}>▶</button>
  </div>`;

  // Day cards
  w.days.forEach((d,i)=>{
    const dt=getDayDate(w.start,d.dow);
    const log=S.getLog(dt);
    const isToday=dt===t;
    let cls='dc';
    if(isToday)cls+=' today';
    if(d.rest)cls+=' rs';
    if(d.opt)cls+=' op';
    if(d.race)cls+=' rc';
    if(log.status==='done')cls+=' dn';
    if(log.status==='skipped')cls+=' sk';

    const statusIcon=log.status==='done'?'✅':log.status==='skipped'?'⏭️':d.rest?'🛋️':d.race?'🏁':'⬜';

    h+=`<div class="${cls}" id="dc-${WI}-${i}">
      <div class="dh" onclick="toggleDay(${WI},${i})">
        <div class="dl">
          <span class="ds">${statusIcon}</span>
          <div>
            <div class="dn-l">${d.name} <span class="dd-l">${fmtD(dt)}</span></div>
            <div class="dt-l">${d.type}</div>
          </div>
        </div>
        <div class="dr">${d.km>0?`<span class="dk-l">${d.km} km</span>`:''}
          <span class="ei">▼</span>
        </div>
      </div>
      <div class="db">
        <div class="db-d">${d.desc}</div>
        ${d.pace!=='-'?`<div class="db-p">Tempo: ${d.pace}</div>`:''}`;

    // Log form (not for rest days)
    if(!d.rest){
      h+=`<div class="lf" id="lf-${WI}-${i}">
        <div class="fr">
          <div class="fg"><label>Dystans (km)</label><input type="number" step="0.1" id="ld-${WI}-${i}" value="${log.distance||''}"></div>
          <div class="fg"><label>Tempo (min/km)</label><input type="text" placeholder="6:30" id="lp-${WI}-${i}" value="${log.pace||''}"></div>
          <div class="fg"><label>Tetno sr.</label><input type="number" id="lh-${WI}-${i}" value="${log.hr||''}"></div>
        </div>
        <div class="fg"><label>Samopoczucie</label>
          <div class="fs">`;
      for(let f=1;f<=10;f++){
        h+=`<div class="fb${log.feeling==f?' act':''}" onclick="setFeeling(${WI},${i},${f})" data-f="${f}">${EMO[f]}</div>`;
      }
      h+=`</div></div>
        <div class="fg"><label>Notatki</label><textarea id="ln-${WI}-${i}">${log.notes||''}</textarea></div>
        <div class="fa">
          <button class="bs${log.status==='done'?' act':''}" onclick="setStatus(${WI},${i},'done')">✅ Wykonany</button>
          <button class="bs${log.status==='skipped'?' act':''}" onclick="setStatus(${WI},${i},'skipped')">⏭️ Pominiety</button>
          <button class="bsv" onclick="saveLog(${WI},${i})">Zapisz</button>
        </div>
      </div>`;
    }
    h+=`</div></div>`;
  });

  el.innerHTML=h;
}

function toggleDay(wi,di){
  document.getElementById('dc-'+wi+'-'+di).classList.toggle('exp');
}

function setFeeling(wi,di,f){
  document.querySelectorAll('#lf-'+wi+'-'+di+' .fb').forEach(b=>b.classList.remove('act'));
  document.querySelector('#lf-'+wi+'-'+di+' .fb[data-f="'+f+'"]').classList.add('act');
}

function setStatus(wi,di,st){
  const w=PLAN[wi],d=w.days[di],dt=getDayDate(w.start,d.dow);
  const log=S.getLog(dt);
  log.status=log.status===st?'':st;
  S.setLog(dt,log);
  rPlan();
}

function saveLog(wi,di){
  const w=PLAN[wi],d=w.days[di],dt=getDayDate(w.start,d.dow);
  const dist=document.getElementById('ld-'+wi+'-'+di).value;
  const pace=document.getElementById('lp-'+wi+'-'+di).value;
  const hr=document.getElementById('lh-'+wi+'-'+di).value;
  const notes=document.getElementById('ln-'+wi+'-'+di).value;
  const fb=document.querySelector('#lf-'+wi+'-'+di+' .fb.act');
  const feeling=fb?fb.dataset.f:'';
  S.setLog(dt,{distance:dist,pace:pace,hr:hr,feeling:feeling,notes:notes,status:'done'});
  toast('Trening zapisany! 💪');
  rPlan();
}

// ─── NUTRITION ───
let nutrTab='today';
function rNutr(){
  const el=document.getElementById('s-nutr');
  let h=`<h1>Plan zywieniowy</h1><p class="sub">Dostosowany do polmaratonu sub 1:45</p>`;
  h+=`<div class="ts">
    <button class="tb${nutrTab==='today'?' act':''}" onclick="nutrTab='today';rNutr()">Dzisiaj</button>
    <button class="tb${nutrTab==='hydration'?' act':''}" onclick="nutrTab='hydration';rNutr()">Nawodnienie</button>
    <button class="tb${nutrTab==='suppl'?' act':''}" onclick="nutrTab='suppl';rNutr()">Suplementy</button>
    <button class="tb${nutrTab==='zones'?' act':''}" onclick="nutrTab='zones';rNutr()">Strefy</button>
    <button class="tb${nutrTab==='carb'?' act':''}" onclick="nutrTab='carb';rNutr()">Carb Loading</button>
    <button class="tb${nutrTab==='race'?' act':''}" onclick="nutrTab='race';rNutr()">Dzien wyscigu</button>
    <button class="tb${nutrTab==='check'?' act':''}" onclick="nutrTab='check';rNutr()">Checklista</button>
    <button class="tb${nutrTab==='rules'?' act':''}" onclick="nutrTab='rules';rNutr()">Zasady</button>
  </div>`;

  if(nutrTab==='today'){
    // Auto-detect training vs rest day
    const t=today();
    let isTraining=false;
    for(const w of PLAN){for(const d of w.days){if(getDayDate(w.start,d.dow)===t&&!d.rest){isTraining=true;break}}}
    const meals=isTraining?NUTR.training:NUTR.rest;
    h+=`<div class="ndl">${isTraining?'🏃 Dzien treningowy':'🛋️ Dzien wolny'}</div>`;
    const set=S.getSettings();
    const wt=set.weight||75;
    h+=`<div class="ms">
      <div class="mi"><span class="mv">${Math.round(wt*(isTraining?6:4.5))}</span><span class="mu">g wegl.</span></div>
      <div class="mi"><span class="mv">${Math.round(wt*1.6)}</span><span class="mu">g bialka</span></div>
      <div class="mi"><span class="mv">${Math.round(wt*1.1)}</span><span class="mu">g tluszczu</span></div>
    </div>`;
    meals.forEach(m=>{
      h+=`<div class="mc">
        <div class="mc-t">${m.time}</div>
        <div class="mc-n">${m.name}</div>
        <div class="mc-d">${m.desc}</div>
        <div class="mc-e">${m.examples}</div>
        <div class="mc-m">${m.macro}</div>
      </div>`;
    });
  }

  if(nutrTab==='hydration'){
    h+=`<div class="ndl">💧 Strategia nawodnienia</div>`;
    NUTR.hydration.forEach(x=>{
      h+=`<div class="hc"><div class="hc-t">${x.type}</div>
        <div class="hc-r"><span class="hc-l">Przed: </span>${x.before}</div>
        <div class="hc-r"><span class="hc-l">W trakcie: </span>${x.during}</div>
        <div class="hc-r"><span class="hc-l">Po: </span>${x.after}</div></div>`;
    });
  }

  if(nutrTab==='suppl'){
    h+=`<div class="ndl">💊 Suplementacja</div>`;
    NUTR.supplements.forEach(x=>{
      h+=`<div class="sc"><div class="sc-n">${x.name}</div>
        <div class="sc-d">${x.dose}</div>
        <div class="sc-w">Kiedy: ${x.when}</div>
        <div class="sc-y">${x.why}</div></div>`;
    });
  }

  if(nutrTab==='zones'){
    h+=`<div class="ndl">🎯 Strefy treningowe</div>`;
    ZONES.forEach(z=>{
      h+=`<div class="zcard"><span class="z-s">${z.sym}</span><span class="z-n">${z.name}</span><span class="z-p">${z.pace}</span><span class="z-u">${z.usage}</span></div>`;
    });
  }

  if(nutrTab==='carb'){
    h+=`<div class="ndl">🍝 Carb Loading - tydzien przed wyscigiem</div>`;
    NUTR.carbLoading.forEach((x,i)=>{
      h+=`<div class="cbday${i>=3?' hl':''}"><div class="cb-dn">${x.day}</div>
        <div class="cb-c">${x.carbs}</div>
        <div class="cb-f">Blonnik: ${x.fiber}</div>
        <div class="cb-n">${x.notes}</div></div>`;
    });
  }

  if(nutrTab==='race'){
    h+=`<div class="ndl">🏁 Harmonogram dnia wyscigu (bieg nocny ~21:00)</div>`;
    NUTR.raceDay.forEach((x,i)=>{
      const big=i===6||i===9;
      h+=`<div class="tli${big?' big':''}"><span class="tl-t">${x.time}</span>
        <div><div class="tl-w">${x.what}</div><div class="tl-d">${x.details}</div></div></div>`;
    });
  }

  if(nutrTab==='check'){
    h+=`<div class="ndl">✅ Checklista przed wyscigiem</div>`;
    const cl=S.getChecklist();
    NUTR.checklist.forEach((x,i)=>{
      h+=`<label class="chi"><input type="checkbox" ${cl[i]?'checked':''} onchange="toggleCheck(${i},this.checked)"><span>${x}</span></label>`;
    });
  }

  if(nutrTab==='rules'){
    h+=`<div class="ndl">📋 Zlote zasady zywienia biegacza</div><div class="rl">`;
    NUTR.rules.forEach(r=>{h+=`<div class="ri">${r}</div>`});
    h+=`</div>`;
  }

  el.innerHTML=h;
}

function toggleCheck(i,v){const cl=S.getChecklist();cl[i]=v;S.setChecklist(cl)}

// ─── STATS ───
function rStat(){
  const el=document.getElementById('s-stat');
  el.innerHTML=`<h1>Statystyki</h1><p class="sub">Postepy treningowe</p>
    <div class="chc"><div class="ch-t">📊 Kilometraz tygodniowy (plan vs realizacja)</div><canvas id="ch1"></canvas></div>
    <div class="chc"><div class="ch-t">⏱️ Trend tempa</div><canvas id="ch2"></canvas></div>
    <div class="chc"><div class="ch-t">😊 Samopoczucie</div><canvas id="ch3"></canvas></div>
    <div class="chc"><div class="ch-t">📅 Objetosc miesieczna</div><canvas id="ch4"></canvas></div>`;
  setTimeout(()=>{Charts.weeklyKm('ch1');Charts.paceTrend('ch2');Charts.feelingTrend('ch3');Charts.monthlyVol('ch4')},100);
}

// ─── SETTINGS ───
function rSett(){
  const el=document.getElementById('s-sett');
  const set=S.getSettings();
  el.innerHTML=`<h1>Ustawienia</h1><p class="sub">Konfiguracja aplikacji</p>
    <div class="ss"><div class="stit">Dane osobowe</div>
      <div class="card"><div class="lf">
        <div class="fg"><label>Masa ciala (kg)</label><input type="number" id="sw" value="${set.weight||75}"></div>
        <button class="bsv" onclick="S.setSettings({weight:+document.getElementById('sw').value});toast('Zapisano!')">Zapisz</button>
      </div></div>
    </div>
    <div class="ss"><div class="stit">Strava</div>
      <div class="card">
        <p style="font-size:13px;color:var(--fg2);margin-bottom:12px">${Strava.isConnected()?'✅ Polaczono ze Strava':'Polacz konto Strava, aby automatycznie importowac treningi.'}</p>
        ${Strava.isConnected()?
          `<button class="btns" onclick="syncStrava()">🔄 Synchronizuj</button><button class="btnd" onclick="Strava.disconnect();rSett();toast('Rozlaczono')">Rozlacz</button>`:
          `<button class="btn-str" onclick="Strava.authorize()">Polacz ze Strava</button>`}
      </div>
    </div>
    <div class="ss"><div class="stit">Dane</div>
      <button class="btns" onclick="exportData()">📤 Eksportuj dane (JSON)</button>
      <button class="btnd" onclick="if(confirm('Na pewno usunac wszystkie dane?')){S.clearAll();toast('Dane usuniete');rSett()}">🗑️ Usun wszystkie dane</button>
    </div>
    <div class="ainfo"><p>HM Tracker v2.0</p><p>Polmaraton Sub 1:45</p><p>Dawid Pyzowski</p></div>`;
}

async function syncStrava(){
  toast('Synchronizuję...');
  const n=await Strava.syncWorkouts();
  toast(n>0?`Zsynchronizowano ${n} treningow!`:'Brak nowych treningow');
  rPlan();
}

function exportData(){
  const d=S.exportAll();
  const b=new Blob([d],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(b);
  a.download='hm-tracker-backup.json';
  a.click();
  toast('Wyeksportowano!');
}

// ─── INIT ───
document.querySelector('.tabs').addEventListener('click',e=>{
  const tab=e.target.closest('.tab');
  if(tab)nav(tab.dataset.s);
});

(async()=>{
  if(window.location.search.includes('code=')){
    const ok=await Strava.handleCallback();
    if(ok){toast('Strava polaczona!');await Strava.syncWorkouts()}
  }
  nav('dash');
})();

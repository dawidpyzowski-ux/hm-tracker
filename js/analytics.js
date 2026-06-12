// HM Tracker - Advanced Analytics (Sprint 6)
const Analytics={
  _ch(id,cfg){const el=document.getElementById(id);if(!el)return null;const x=Chart.getChart(el);if(x)x.destroy();return new Chart(el,cfg)},
  _pp(p){if(!p||p==='-')return 0;const s=p.split(':');return parseInt(s[0])+parseInt(s[1]||0)/60},
  _logs(){
    const logs=S.getAllLogs();const arr=[];
    Object.entries(logs).forEach(([d,l])=>{if(l.distance)arr.push({date:d,...l})});
    arr.sort((a,b)=>a.date.localeCompare(b.date));return arr;
  },

  // ═══ TIER 1 ═══

  // 1. Aerobic Efficiency: HR / speed (lower=fitter)
  getAE(){
    return this._logs().filter(l=>l.hr&&l.pace&&this._pp(l.pace)>0).map(l=>{
      const spdKmh=60/this._pp(l.pace);
      return{date:l.date,ae:Math.round(parseFloat(l.hr)/spdKmh*10)/10};
    });
  },

  // 2. VO2max (Jack Daniels simplified from best pace)
  
  getVO2(){
    const logs=this._logs().filter(l=>l.pace&&parseFloat(l.distance)>=3);
    const trend=[];
    logs.forEach(l=>{
      const pMin=this._pp(l.pace);if(pMin<=0)return;
      const km=parseFloat(l.distance);
      const vm=1000/pMin;
      const tMin=pMin*km;
      const oc=-4.60+0.182258*vm+0.000104*vm*vm;
      const frac=0.8+0.1894393*Math.exp(-0.012778*tMin)+0.2989558*Math.exp(-0.1932605*tMin);
      const vo2=oc/frac;
      if(vo2>20&&vo2<90)trend.push({date:l.date,vo2:Math.round(vo2*10)/10});
    });
    const cur=trend.length?trend[trend.length-1].vo2:0;
    const lvl=cur>=60?'Elitarny':cur>=55?'Swietny':cur>=50?'Bardzo dobry':cur>=45?'Dobry':cur>=40?'Sredni':'Poczatkujacy';
    return{current:cur,trend,level:lvl};
  },


  // 3. Training Distribution (by pace zones)
  getDist(){
    const z={easy:{km:0,label:'Easy (>5:30)'},tempo:{km:0,label:'Tempo (5:00-5:30)'},threshold:{km:0,label:'Threshold (4:30-5:00)'},interval:{km:0,label:'Interval (<4:30)'}};
    let total=0;
    this._logs().forEach(l=>{
      if(!l.pace)return;const p=this._pp(l.pace);const km=parseFloat(l.distance);if(p<=0||km<=0)return;
      total+=km;
      if(p>5.5)z.easy.km+=km;else if(p>5)z.tempo.km+=km;else if(p>4.5)z.threshold.km+=km;else z.interval.km+=km;
    });
    Object.values(z).forEach(v=>{v.km=Math.round(v.km*10)/10;v.pct=total>0?Math.round(v.km/total*100):0});
    return{zones:z,total:Math.round(total*10)/10};
  },

  // 4. Cumulative Distance (actual vs planned)
  getCumDist(){
    const labels=[],actual=[],planned=[];let ca=0,cp=0;
    PLAN.forEach(w=>{
      let wkA=0;const we=getDayDate(w.start,6);
      w.days.forEach(d=>{const dt=getDayDate(w.start,d.dow);const log=S.getLog(dt);if(log&&log.distance)wkA+=parseFloat(log.distance)});
      ca+=wkA;cp+=w.km;
      labels.push('T'+w.weekNum);actual.push(Math.round(ca*10)/10);planned.push(Math.round(cp*10)/10);
    });
    return{labels,actual,planned};
  },

  // 5. Race Readiness Score (0-100)
  getRR(){
    const fit=typeof TL!=='undefined'?TL.get():{ctl:0,atl:0,tsb:0};
    const con=this.getConsistency();
    const cd=this.getCumDist();
    const lastPlan=cd.planned[cd.planned.length-1]||1;
    const lastActual=cd.actual[cd.actual.length-1]||0;
    const fitScore=Math.min(100,Math.round(fit.ctl*2));
    const volScore=Math.min(100,Math.round(lastActual/lastPlan*100));
    const conScore=con.score;
    const freshScore=Math.min(100,Math.max(0,50+fit.tsb*2));
    const score=Math.round(fitScore*0.3+volScore*0.25+conScore*0.25+freshScore*0.2);
    const lbl=score>=80?'Gotowy na wyscig!':score>=60?'Dobra forma':score>=40?'W budowie':'Poczatek drogi';
    return{score,components:{fitness:fitScore,volume:volScore,consistency:conScore,freshness:freshScore},label:lbl};
  },

  // ═══ TIER 2 ═══

  // 6. Pace at HR 150 (normalized)
  getPaceHR150(){
    return this._logs().filter(l=>l.hr&&l.pace&&this._pp(l.pace)>0).map(l=>{
      const p=this._pp(l.pace);const hr=parseFloat(l.hr);
      const norm=p*(hr/150);
      return{date:l.date,pace:Math.round(norm*100)/100};
    });
  },

  // 7. Week-over-Week
  getWoW(){
    return PLAN.map((w,i)=>{
      let km=0,ttime=0,thr=0,hrc=0,cnt=0;
      for(let d=0;d<7;d++){const dt=getDayDate(w.start,d);const log=S.getLog(dt);
        if(log&&log.distance){cnt++;km+=parseFloat(log.distance);
          if(log.pace){const p=this._pp(log.pace);if(p>0)ttime+=p*parseFloat(log.distance)}
          if(log.hr){thr+=parseFloat(log.hr);hrc++}
        }
      }
      const ap=km>0&&ttime>0?ttime/km:0;
      return{week:w.weekNum,km:Math.round(km*10)/10,avgPace:ap>0?Math.round(ap*100)/100:0,avgHR:hrc>0?Math.round(thr/hrc):0,workouts:cnt};
    });
  },

  // 8. HR Recovery (max HR - avg HR per workout as proxy)
  getHRRec(){
    const arr=[];
    this._logs().forEach(l=>{
      if(!l.strava_id)return;
      const det=JSON.parse(localStorage.getItem('strava_detail_'+l.strava_id)||'null');
      if(!det||!det.max_hr||!l.hr)return;
      arr.push({date:l.date,spread:det.max_hr-parseFloat(l.hr)});
    });
    return arr;
  },

  // 9. Cadence vs Pace
  getCadPace(){
    const arr=[];
    this._logs().forEach(l=>{
      if(!l.strava_id||!l.pace)return;
      const det=JSON.parse(localStorage.getItem('strava_detail_'+l.strava_id)||'null');
      if(!det||!det.cadence)return;
      arr.push({pace:this._pp(l.pace),cadence:Math.round(det.cadence*2),date:l.date});
    });
    return arr;
  },

  // 10. Fatigue Index (last 3km vs first 3km pace from splits)
  getFI(){
    const arr=[];
    this._logs().forEach(l=>{
      if(!l.strava_id||parseFloat(l.distance)<6)return;
      const det=JSON.parse(localStorage.getItem('strava_detail_'+l.strava_id)||'null');
      if(!det||!det.splits||det.splits.length<6)return;
      const sp=det.splits;
      let f3=0,l3=0;
      for(let i=0;i<3;i++){f3+=(sp[i].moving_time||0)/(sp[i].distance||1)*1000}
      for(let i=sp.length-3;i<sp.length;i++){if(sp[i])l3+=(sp[i].moving_time||0)/(sp[i].distance||1)*1000}
      f3/=3;l3/=3;
      const idx=Math.round((l3-f3)/f3*100);
      const lbl=idx<=0?'Negative split!':idx<=3?'Rowne tempo':idx<=6?'Lekki spadek':'Duzy spadek';
      arr.push({date:l.date,index:idx,label:lbl});
    });
    return arr;
  },

  // ═══ TIER 3 ═══

  // 11. Streak (weeks >=80% plan)
  getStreak(){
    let cur=0,best=0,active=true;
    const t=today();
    for(let i=0;i<PLAN.length;i++){
      const w=PLAN[i];const we=getDayDate(w.start,6);
      if(w.start>t)break;
      let km=0;
      for(let d=0;d<7;d++){const dt=getDayDate(w.start,d);const log=S.getLog(dt);if(log&&log.distance)km+=parseFloat(log.distance)}
      if(w.km>0&&km/w.km>=0.8){cur++;if(cur>best)best=cur}else{if(we<t)cur=0}
    }
    return{current:cur,best};
  },

  // 12. Consistency
  getConsistency(){
    let done=0,total=0;const t=today();
    PLAN.forEach(w=>{w.days.forEach(d=>{
      if(d.rest)return;const dt=getDayDate(w.start,d.dow);if(dt>t)return;
      total++;const log=S.getLog(dt);if(log&&(log.distance||log.status==='done'))done++;
    })});
    return{score:total>0?Math.round(done/total*100):0,done,total};
  },

  // 13. Monthly comparison
  getMonthly(){
    const months={};
    this._logs().forEach(l=>{
      const m=l.date.substring(0,7);
      if(!months[m])months[m]={km:0,workouts:0,ttime:0,thr:0,hrc:0};
      const mo=months[m];mo.km+=parseFloat(l.distance);mo.workouts++;
      if(l.pace){const p=this._pp(l.pace);if(p>0)mo.ttime+=p*parseFloat(l.distance)}
      if(l.hr){mo.thr+=parseFloat(l.hr);mo.hrc++}
    });
    return Object.entries(months).sort().map(([m,d])=>({
      month:m,km:Math.round(d.km*10)/10,workouts:d.workouts,
      avgPace:d.km>0&&d.ttime>0?Math.round(d.ttime/d.km*100)/100:0,
      avgHR:d.hrc>0?Math.round(d.thr/d.hrc):0
    }));
  },

  // 14. Cumulative elevation
  getCumElev(){
    let total=0;const byWeek=[];
    PLAN.forEach(w=>{
      let wElev=0;
      for(let d=0;d<7;d++){
        const dt=getDayDate(w.start,d);const log=S.getLog(dt);
        if(log&&log.strava_id){
          const det=JSON.parse(localStorage.getItem('strava_detail_'+log.strava_id)||'null');
          if(det&&det.total_elevation_gain)wElev+=det.total_elevation_gain;
        }
      }
      total+=wElev;byWeek.push({week:w.weekNum,elev:Math.round(wElev),cum:Math.round(total)});
    });
    return{total:Math.round(total),byWeek};
  },

  // ═══ RENDER ═══
  render(){
    const rr=this.getRR();const str=this.getStreak();const con=this.getConsistency();const vo2=this.getVO2();
    let h='';

    // Race Readiness Gauge
    h+=`<div class="an-section"><div class="an-title">\uD83C\uDFC1 Race Readiness</div>`;
    h+=`<div class="an-gauge-wrap"><div class="an-gauge" style="--pct:${rr.score}"><div class="an-gauge-val">${rr.score}</div></div><div class="an-gauge-label">${rr.label}</div></div>`;
    h+=`<div class="an-rr-row"><div class="an-rr-item"><div class="an-rr-v">${rr.components.fitness}</div><div class="an-rr-l">Fitness</div></div><div class="an-rr-item"><div class="an-rr-v">${rr.components.volume}</div><div class="an-rr-l">Objetosc</div></div><div class="an-rr-item"><div class="an-rr-v">${rr.components.consistency}</div><div class="an-rr-l">Stalowac</div></div><div class="an-rr-item"><div class="an-rr-v">${rr.components.freshness}</div><div class="an-rr-l">Swiezosc</div></div></div></div>`;

    // Badges row
    h+=`<div class="an-badges"><div class="an-badge fire"><span class="an-badge-icon">\uD83D\uDD25</span><span class="an-badge-val">${str.current}</span><span class="an-badge-l">Streak (tygodni)</span></div>`;
    h+=`<div class="an-badge check"><span class="an-badge-icon">\u2705</span><span class="an-badge-val">${con.score}%</span><span class="an-badge-l">Stalowac (${con.done}/${con.total})</span></div>`;
    if(str.best>str.current)h+=`<div class="an-badge trophy"><span class="an-badge-icon">\uD83C\uDFC6</span><span class="an-badge-val">${str.best}</span><span class="an-badge-l">Najlepszy streak</span></div>`;
    h+=`</div>`;

    // VO2max card
    if(vo2.current>0){
      h+=`<div class="an-section"><div class="an-title">\uD83E\uDEC0 VO2max</div><div class="an-vo2-row"><div class="an-vo2-val">${vo2.current}</div><div class="an-vo2-info"><div class="an-vo2-level">${vo2.level}</div><div class="an-vo2-sub">ml/kg/min</div></div></div>`;
      if(vo2.trend.length>1)h+=`<canvas id="an-vo2"></canvas>`;
      h+=`</div>`;
    }

    // Charts
    h+=`<div class="an-section"><div class="an-title">\u2764\uFE0F Aerobic Efficiency (nizszy = lepiej)</div><canvas id="an-ae"></canvas></div>`;
    h+=`<div class="an-section"><div class="an-title">\uD83C\uDFAF Training Distribution (80/20)</div><canvas id="an-dist"></canvas></div>`;
    h+=`<div class="an-section"><div class="an-title">\uD83D\uDCC8 Dystans narastajacy (plan vs realizacja)</div><canvas id="an-cum"></canvas></div>`;
    h+=`<div class="an-section"><div class="an-title">\u26A1 Tempo @ HR 150 (nizszy = lepiej)</div><canvas id="an-hr150"></canvas></div>`;
    h+=`<div class="an-section"><div class="an-title">\uD83D\uDCCA Tydzien po tygodniu</div><canvas id="an-wow"></canvas></div>`;
    h+=`<div class="an-section"><div class="an-title">\uD83D\uDCA4 Fatigue Index (% spadku tempa)</div><canvas id="an-fi"></canvas></div>`;
    h+=`<div class="an-section"><div class="an-title">\uD83D\uDC63 Kadencja vs Tempo</div><canvas id="an-cad"></canvas></div>`;
    h+=`<div class="an-section"><div class="an-title">\u26F0\uFE0F Narastajace przewyzszenie</div><canvas id="an-elev"></canvas></div>`;

    // Monthly comparison cards
    const mo=this.getMonthly();
    if(mo.length){
      h+=`<div class="an-section"><div class="an-title">\uD83D\uDCC5 Porownanie miesieczne</div><div class="an-months">`;
      const MN=['','Sty','Lut','Mar','Kwi','Maj','Cze','Lip','Sie','Wrz','Paz','Lis','Gru'];
      mo.forEach(m=>{
        const mi=parseInt(m.month.split('-')[1]);
        const ap=m.avgPace>0?Math.floor(m.avgPace)+':'+String(Math.round((m.avgPace%1)*60)).padStart(2,'0'):'-';
        h+=`<div class="an-month"><div class="an-month-name">${MN[mi]} ${m.month.split('-')[0]}</div><div class="an-month-km">${m.km} km</div><div class="an-month-det">${m.workouts} treningow \u2022 ${ap}/km${m.avgHR?' \u2022 \u2764 '+m.avgHR:''}</div></div>`;
      });
      h+=`</div></div>`;
    }

    return h;
  },

  drawCharts(){
    const ae=this.getAE();
    if(ae.length)this._ch('an-ae',{type:'line',data:{labels:ae.map(a=>a.date.substring(5)),datasets:[{data:ae.map(a=>a.ae),borderColor:'#FF9F0A',borderWidth:2,pointRadius:3,pointBackgroundColor:'#FF9F0A',fill:false,tension:.3}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#999',maxTicksLimit:10}},y:{reverse:true,ticks:{color:'#999'}}}}});

    const vo2=this.getVO2();
    if(vo2.trend.length>1)this._ch('an-vo2',{type:'line',data:{labels:vo2.trend.map(v=>v.date.substring(5)),datasets:[{data:vo2.trend.map(v=>v.vo2),borderColor:'#30D158',borderWidth:2,pointRadius:3,pointBackgroundColor:'#30D158',fill:true,backgroundColor:'rgba(48,209,88,.1)',tension:.3}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#999',maxTicksLimit:8}},y:{ticks:{color:'#999'}}}}});

    const dist=this.getDist();
    const dz=dist.zones;
    this._ch('an-dist',{type:'doughnut',data:{labels:[dz.easy.label+' '+dz.easy.pct+'%',dz.tempo.label+' '+dz.tempo.pct+'%',dz.threshold.label+' '+dz.threshold.pct+'%',dz.interval.label+' '+dz.interval.pct+'%'],datasets:[{data:[dz.easy.km,dz.tempo.km,dz.threshold.km,dz.interval.km],backgroundColor:['#30D158','#0A84FF','#FF9F0A','#FF453A'],borderWidth:0}]},options:{responsive:true,plugins:{legend:{display:true,position:'bottom',labels:{color:'#ccc',font:{size:11}}}}}});

    const cd=this.getCumDist();
    this._ch('an-cum',{type:'line',data:{labels:cd.labels,datasets:[{label:'Plan',data:cd.planned,borderColor:'#555',borderWidth:2,borderDash:[5,5],pointRadius:0,fill:false},{label:'Realizacja',data:cd.actual,borderColor:'#0A84FF',borderWidth:2,pointRadius:3,pointBackgroundColor:'#0A84FF',fill:true,backgroundColor:'rgba(10,132,255,.1)'}]},options:{responsive:true,plugins:{legend:{display:true,labels:{color:'#ccc'}}},scales:{x:{ticks:{color:'#999'}},y:{ticks:{color:'#999'}}}}});

    const hr150=this.getPaceHR150();
    if(hr150.length)this._ch('an-hr150',{type:'line',data:{labels:hr150.map(h=>h.date.substring(5)),datasets:[{data:hr150.map(h=>h.pace),borderColor:'#BF5AF2',borderWidth:2,pointRadius:3,pointBackgroundColor:'#BF5AF2',fill:false,tension:.3}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#999',maxTicksLimit:10}},y:{reverse:true,ticks:{color:'#999',callback:v=>{const m=Math.floor(v);const s=Math.round((v-m)*60);return m+':'+String(s).padStart(2,'0')}}}}}});

    const wow=this.getWoW();
    this._ch('an-wow',{type:'bar',data:{labels:wow.map(w=>'T'+w.week),datasets:[{label:'km',data:wow.map(w=>w.km),backgroundColor:'rgba(10,132,255,.6)',borderRadius:4}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#999'}},y:{ticks:{color:'#999'}}}}});

    const fi=this.getFI();
    if(fi.length)this._ch('an-fi',{type:'bar',data:{labels:fi.map(f=>f.date.substring(5)),datasets:[{data:fi.map(f=>f.index),backgroundColor:fi.map(f=>f.index<=0?'#30D158':f.index<=3?'#0A84FF':f.index<=6?'#FF9F0A':'#FF453A'),borderRadius:4}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#999',maxTicksLimit:10}},y:{ticks:{color:'#999',callback:v=>v+'%'}}}}});

    const cp=this.getCadPace();
    if(cp.length)this._ch('an-cad',{type:'scatter',data:{datasets:[{data:cp.map(c=>({x:c.pace,y:c.cadence})),backgroundColor:'#64D2FF',pointRadius:5}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{x:{reverse:true,title:{display:true,text:'Tempo (min/km)',color:'#999'},ticks:{color:'#999',callback:v=>{const m=Math.floor(v);const s=Math.round((v-m)*60);return m+':'+String(s).padStart(2,'0')}}},y:{title:{display:true,text:'Kadencja (kroki/min)',color:'#999'},ticks:{color:'#999'}}}}});

    const elev=this.getCumElev();
    if(elev.byWeek.length)this._ch('an-elev',{type:'bar',data:{labels:elev.byWeek.map(e=>'T'+e.week),datasets:[{label:'Tygodniowe (m)',data:elev.byWeek.map(e=>e.elev),backgroundColor:'rgba(100,210,255,.5)',borderRadius:4},{label:'Narastajace (m)',data:elev.byWeek.map(e=>e.cum),type:'line',borderColor:'#FF9F0A',borderWidth:2,pointRadius:2,fill:false,yAxisID:'y2'}]},options:{responsive:true,plugins:{legend:{display:true,labels:{color:'#ccc'}}},scales:{x:{ticks:{color:'#999'}},y:{position:'left',ticks:{color:'#999'}},y2:{position:'right',grid:{display:false},ticks:{color:'#999'}}}}});
  }
};

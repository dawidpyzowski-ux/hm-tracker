// HM Tracker - Weekly Summary (Sprint 5)
const WeekSummary={
  getStats(wi){
    const w=PLAN[wi];if(!w)return null;
    let km=0,ttime=0,thr=0,hrc=0,tf=0,fc=0,wk=0;
    for(let day=0;day<7;day++){
      const dt=getDayDate(w.start,day);const log=S.getLog(dt);
      if(log&&log.distance){
        wk++;km+=parseFloat(log.distance);
        if(log.pace){const p=log.pace.split(':');const ps=parseInt(p[0])*60+parseInt(p[1]||0);ttime+=ps*parseFloat(log.distance)}
        if(log.hr){thr+=parseFloat(log.hr);hrc++}
        if(log.feeling){tf+=parseInt(log.feeling);fc++}
      }
    }
    const ap=km>0&&ttime>0?ttime/km:0;
    const aps=ap>0?Math.floor(ap/60)+':'+String(Math.round(ap%60)).padStart(2,'0'):'-';
    return{km:Math.round(km*10)/10,plannedKm:w.km,workouts:wk,avgPace:aps,avgHR:hrc>0?Math.round(thr/hrc):0,avgFeeling:fc>0?Math.round(tf/fc*10)/10:0,weekNum:w.weekNum,pct:w.km>0?Math.round(km/w.km*100):0};
  },
  render(){
    const t=today();let ci=-1;
    for(let i=0;i<PLAN.length;i++){const w=PLAN[i],e=getDayDate(w.start,6);if(t>=w.start&&t<=e){ci=i;break}}
    if(ci<0)return'';
    const c=this.getStats(ci),p=ci>0?this.getStats(ci-1):null;
    if(!c)return'';
    let h='<div class="ws-card"><div class="ws-title">\uD83D\uDCC5 Tydzien '+c.weekNum+' - podsumowanie</div><div class="ws-row">';
    h+='<div class="ws-item"><div class="ws-val">'+c.km+'</div><div class="ws-label">km</div>';
    if(p&&p.km>0){const d=c.km-p.km;h+='<div class="ws-diff '+(d>=0?'up':'down')+'">'+(d>0?'+':'')+Math.round(d*10)/10+'</div>'}
    h+='</div>';
    h+='<div class="ws-item"><div class="ws-val">'+c.workouts+'</div><div class="ws-label">treningi</div></div>';
    h+='<div class="ws-item"><div class="ws-val">'+c.avgPace+'</div><div class="ws-label">sr. tempo</div></div>';
    if(c.avgHR>0){h+='<div class="ws-item"><div class="ws-val">'+c.avgHR+'</div><div class="ws-label">sr. HR</div>';
    if(p&&p.avgHR>0){const d=c.avgHR-p.avgHR;h+='<div class="ws-diff '+(d<=0?'up':'down')+'">'+(d>0?'+':'')+d+'</div>'}
    h+='</div>'}
    h+='</div>';
    h+='<div class="ws-prog"><div class="ws-prog-text">'+c.km+' / '+c.plannedKm+' km ('+c.pct+'%)</div><div class="ws-prog-bar"><div class="ws-prog-fill" style="width:'+Math.min(100,c.pct)+'%"></div></div></div>';
    h+='</div>';
    return h;
  }
};

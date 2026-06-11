// Race Predictor - Riegel formula
const Pred={
  HM:21.0975,
  TARGET:6300, // 1:45:00 in seconds
  predict(distKm,timeSec){
    if(distKm<=0||timeSec<=0)return 0;
    return timeSec*Math.pow(this.HM/distKm,1.06);
  },
  fmtTime(sec){
    if(!sec||sec<=0)return'--:--';
    const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=Math.round(sec%60);
    return h>0?h+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0'):m+':'+String(s).padStart(2,'0');
  },
  fmtPace(sec,dist){
    if(!sec||!dist)return'--:--';
    const p=sec/dist,m=Math.floor(p/60),s=Math.round(p%60);
    return m+':'+String(s).padStart(2,'0');
  },
  getEfforts(){
    const logs=S.getAllLogs(),efforts=[];
    Object.entries(logs).forEach(([date,l])=>{
      if(l.distance&&l.pace&&l.pace.includes(':')){
        const d=parseFloat(l.distance);
        const p=l.pace.split(':'),dec=+p[0]+ +p[1]/60;
        if(dec<6&&d>=1){ // quality workouts only, min 1km
          const timeSec=d*dec*60;
          const hmPred=this.predict(d,timeSec);
          efforts.push({date,dist:d,pace:l.pace,timeSec,hmPred});
        }
      }
    });
    efforts.sort((a,b)=>a.hmPred-b.hmPred);
    return efforts;
  },
  getCurrent(){
    const efforts=this.getEfforts();
    if(!efforts.length)return null;
    const best=efforts[0];
    const t=today();
    // This week vs last week comparison
    const thisWeek=efforts.filter(e=>e.date>=getDayDate(t,-6));
    const lastWeek=efforts.filter(e=>e.date>=getDayDate(t,-13)&&e.date<getDayDate(t,-6));
    const bestThis=thisWeek.length?thisWeek[0]:null;
    const bestLast=lastWeek.length?lastWeek[0]:null;
    let trend='stable',prevFmt='';
    if(bestThis&&bestLast){
      const diff=bestThis.hmPred-bestLast.hmPred;
      trend=diff<-15?'up':diff>15?'down':'stable';
      prevFmt=this.fmtTime(bestLast.hmPred);
    }
    return{
      time:best.hmPred,
      formatted:this.fmtTime(best.hmPred),
      pace:this.fmtPace(best.hmPred,this.HM),
      trend,prevFmt,
      pct:Math.min(100,Math.max(0,Math.round((1-(best.hmPred-this.TARGET)/this.TARGET)*100))),
      fromDate:best.date,
      fromDist:best.dist,
      fromPace:best.pace
    };
  },
  getWeeklyTrend(){
    const efforts=this.getEfforts();
    if(!efforts.length)return[];
    // Group by week, take best per week
    const weeks={};
    efforts.forEach(e=>{
      const w=PLAN.findIndex(p=>e.date>=p.start&&e.date<=getDayDate(p.start,6));
      if(w>=0&&(!weeks[w]||e.hmPred<weeks[w].hmPred)){
        weeks[w]={weekNum:PLAN[w].weekNum,hmPred:e.hmPred};
      }
    });
    return Object.values(weeks).sort((a,b)=>a.weekNum-b.weekNum);
  }
};
// Helper for predictor: getDayDate with offset from a date string
function getDayOffset(dateStr,offset){
  const d=new Date(dateStr+'T12:00:00');
  d.setDate(d.getDate()+offset);
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}

// HM Tracker - Personal Records Module (Sprint 4)
const PR={
  DISTS:[1,3,5,10,15,21.1],

  calculate(){
    const logs=S.getAllLogs();
    const records={};
    this.DISTS.forEach(d=>{records[d]=null});

    Object.entries(logs).forEach(([date,log])=>{
      if(!log.strava_id)return;
      const det=JSON.parse(localStorage.getItem('strava_detail_'+log.strava_id)||'null');
      if(!det||!det.splits||!det.splits.length)return;

      // Build cumulative time/distance from splits
      const splits=det.splits;
      const cumTime=[];const cumDist=[];
      let tSum=0,dSum=0;
      cumTime.push(0);cumDist.push(0);
      splits.forEach(sp=>{
        tSum+=sp.moving_time||0;
        dSum+=sp.distance||0;
        cumTime.push(tSum);
        cumDist.push(dSum);
      });

      // For each target distance, find best time using consecutive splits
      this.DISTS.forEach(target=>{
        const targetM=target*1000;
        if(dSum<targetM*0.95)return; // activity too short

        // Sliding window over cumulative data
        for(let start=0;start<cumDist.length-1;start++){
          for(let end=start+1;end<cumDist.length;end++){
            const segDist=cumDist[end]-cumDist[start];
            const segTime=cumTime[end]-cumTime[start];
            if(segDist>=targetM*0.95&&segDist<=targetM*1.05){
              // Normalize time to exact target distance
              const normTime=segTime*(targetM/segDist);
              if(!records[target]||normTime<records[target].time){
                records[target]={time:Math.round(normTime),date:date,dist:target};
              }
            }
          }
        }
      });
    });
    return records;
  },

  fmtTime(sec){
    if(!sec)return '-';
    const h=Math.floor(sec/3600);
    const m=Math.floor((sec%3600)/60);
    const s=Math.round(sec%60);
    if(h>0)return h+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
    return m+':'+String(s).padStart(2,'0');
  },

  fmtPace(sec,distKm){
    if(!sec||!distKm)return '-';
    const paceS=sec/distKm;
    const m=Math.floor(paceS/60);
    const s=Math.round(paceS%60);
    return m+':'+String(s).padStart(2,'0')+'/km';
  },

  render(){
    const recs=this.calculate();
    let h='<div class="pr-section"><div class="ad-title">\uD83C\uDFC6 Rekordy osobiste</div>';
    let any=false;
    this.DISTS.forEach(d=>{
      const r=recs[d];
      const label=d>=10?d+'K':d+'K';
      if(r){
        any=true;
        h+=`<div class="pr-card"><div class="pr-dist">${d>=21?'HM':label}</div><div class="pr-data"><div class="pr-time">${this.fmtTime(r.time)}</div><div class="pr-pace">${this.fmtPace(r.time,d)}</div></div><div class="pr-date">${r.date.split('-').reverse().join('.')}</div></div>`;
      }else{
        h+=`<div class="pr-card empty-pr"><div class="pr-dist">${d>=21?'HM':label}</div><div class="pr-data"><div class="pr-time">-</div></div><div class="pr-date">brak danych</div></div>`;
      }
    });
    if(!any)h+='<div class="empty">Zsynchronizuj Strave aby zobaczyc rekordy</div>';
    h+='</div>';
    return h;
  }
};

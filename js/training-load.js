// Training Load: CTL (fitness), ATL (fatigue), TSB (form)
const TL={
  calcLoad(distKm,paceStr){
    if(!paceStr||!paceStr.includes(':'))return distKm||0;
    const p=paceStr.split(':'),dec=+p[0]+ +p[1]/60;
    if(dec<=0)return 0;
    const IF=Math.pow(6.5/dec,2);
    return Math.round(distKm*IF*10)/10;
  },
  update(){
    const logs=S.getAllLogs(),dates=Object.keys(logs).sort();
    if(!dates.length){S.setTL({ctl:0,atl:0,tsb:0,history:[]});return}
    // Fill date range from first log to today
    const start=new Date(dates[0]+'T12:00:00'),end=new Date(today()+'T12:00:00');
    let ctl=0,atl=0;const history=[];
    for(let d=new Date(start);d<=end;d.setDate(d.getDate()+1)){
      const ds=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
      const log=logs[ds];
      let load=0;
      if(log&&log.distance&&log.pace){
        load=this.calcLoad(parseFloat(log.distance),log.pace);
      }
      ctl=ctl+(load-ctl)/42;
      atl=atl+(load-atl)/7;
      history.push({date:ds,load:Math.round(load*10)/10,ctl:Math.round(ctl*10)/10,atl:Math.round(atl*10)/10,tsb:Math.round((ctl-atl)*10)/10});
    }
    S.setTL({ctl:Math.round(ctl*10)/10,atl:Math.round(atl*10)/10,tsb:Math.round((ctl-atl)*10)/10,history});
  },
  get(){return S.getTL()||{ctl:0,atl:0,tsb:0,history:[]}},
  tsbColor(v){
    if(v>=5&&v<=25)return'green';
    if((v>=-10&&v<5)||(v>25&&v<=35))return'yellow';
    return'red';
  },
  tsbLabel(v){
    if(v>=15&&v<=25)return'Swietna forma! Gotowy do startu.';
    if(v>=5&&v<15)return'Dobra forma. Trening idzie dobrze.';
    if(v>=0&&v<5)return'Neutralna forma. Budujesz baze.';
    if(v>=-10&&v<0)return'Lekkie zmeczenie. Pilnuj regeneracji.';
    if(v<-10)return'Duze zmeczenie! Rozważ odpoczynek.';
    if(v>35)return'Detrenowany. Czas wrócić do treningow.';
    return'Dobra forma.';
  }
};

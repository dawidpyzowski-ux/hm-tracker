// HM Tracker - Advanced Analytics (Sprint 6 v4)
const Analytics={
  _ch(id,cfg){var el=document.getElementById(id);if(!el)return null;var x=Chart.getChart(el);if(x)x.destroy();return new Chart(el,cfg)},
  _pp(p){if(!p||p==='-')return 0;var s=p.split(':');return parseInt(s[0])+parseInt(s[1]||0)/60},
  _logs(){
    var logs=S.getAllLogs();var arr=[];
    Object.entries(logs).forEach(function(e){var d=e[0],l=e[1];if(l.distance)arr.push(Object.assign({date:d},l))});
    arr.sort(function(a,b){return a.date.localeCompare(b.date)});return arr;
  },

  getAE(){
    var self=this;
    return this._logs().filter(function(l){return l.hr&&l.pace&&self._pp(l.pace)>0}).map(function(l){
      var spdKmh=60/self._pp(l.pace);
      return{date:l.date,ae:Math.round(parseFloat(l.hr)/spdKmh*10)/10};
    });
  },

  _vo2calc(paceMinKm,distKm){
    if(paceMinKm<=0||distKm<=0)return 0;
    var vm=1000/paceMinKm;
    var tMin=paceMinKm*distKm;
    var oc=-4.60+0.182258*vm+0.000104*vm*vm;
    var frac=0.8+0.1894393*Math.exp(-0.012778*tMin)+0.2989558*Math.exp(-0.1932605*tMin);
    if(frac<=0)return 0;
    return oc/frac;
  },
  getVO2(){
    var self=this;
    var logs=this._logs().filter(function(l){return l.pace&&parseFloat(l.distance)>=3});
    var trend=[];
    logs.forEach(function(l){
      var pMin=self._pp(l.pace);if(pMin<=0)return;
      var km=parseFloat(l.distance);
      var bestVO2=self._vo2calc(pMin,km);
      if(l.strava_id){
        var det=JSON.parse(localStorage.getItem('strava_detail_'+l.strava_id)||'null');
        if(det&&det.splits&&det.splits.length>=3){
          var sp=det.splits;
          for(var len=3;len<=Math.min(sp.length,10);len++){
            for(var start=0;start<=sp.length-len;start++){
              var d=0,t=0;
              for(var i=start;i<start+len;i++){d+=(sp[i].distance||0);t+=(sp[i].moving_time||0)}
              if(d>0&&t>0){
                var v=self._vo2calc(t/d*1000/60,d/1000);
                if(v>bestVO2)bestVO2=v;
              }
            }
          }
        }
      }
      if(bestVO2>20&&bestVO2<90)trend.push({date:l.date,vo2:Math.round(bestVO2*10)/10});
    });
    // Uth formula ONLY as fallback when no trend data
    if(trend.length===0){
      var rhr=S.getSettings().rhr||0;
      if(rhr>0){
        var maxHR=0;
        logs.forEach(function(l){
          if(!l.strava_id)return;
          var det=JSON.parse(localStorage.getItem('strava_detail_'+l.strava_id)||'null');
          if(det&&det.max_hr&&det.max_hr>maxHR)maxHR=det.max_hr;
        });
        if(maxHR>0){
          var uthVO2=Math.round(15.3*(maxHR/rhr)*10)/10;
          trend.push({date:logs[logs.length-1].date,vo2:uthVO2});
        }
      }
    }
    var cur=trend.length?trend[trend.length-1].vo2:0;
    var lvl=cur>=60?'Elitarny':cur>=55?'Swietny':cur>=50?'Bardzo dobry':cur>=45?'Dobry':cur>=40?'Sredni':'Poczatkujacy';
    return{current:cur,trend:trend,level:lvl};
  },

  getDist(){
    var self=this;
    var z={easy:{km:0,label:'Easy (>5:30)'},tempo:{km:0,label:'Tempo (5:00-5:30)'},threshold:{km:0,label:'Threshold (4:30-5:00)'},interval:{km:0,label:'Interval (<4:30)'}};
    var total=0;
    var usedSplits=false;
    this._logs().forEach(function(l){
      var km=parseFloat(l.distance);if(km<=0)return;
      // Try per-km splits from Strava detail
      if(l.strava_id){
        var det=JSON.parse(localStorage.getItem('strava_detail_'+l.strava_id)||'null');
        if(det&&det.splits&&det.splits.length>0){
          usedSplits=true;
          det.splits.forEach(function(sp){
            if(!sp.distance||sp.distance<100||!sp.moving_time)return;
            var spKm=sp.distance/1000;
            var spPace=sp.moving_time/sp.distance*1000/60;
            total+=spKm;
            if(spPace>5.5)z.easy.km+=spKm;
            else if(spPace>5)z.tempo.km+=spKm;
            else if(spPace>4.5)z.threshold.km+=spKm;
            else z.interval.km+=spKm;
          });
          return;
        }
      }
      // Fallback: use avg pace for whole workout
      if(!l.pace)return;
      var p=self._pp(l.pace);if(p<=0)return;
      total+=km;
      if(p>5.5)z.easy.km+=km;else if(p>5)z.tempo.km+=km;else if(p>4.5)z.threshold.km+=km;else z.interval.km+=km;
    });
    Object.values(z).forEach(function(v){v.km=Math.round(v.km*10)/10;v.pct=total>0?Math.round(v.km/total*100):0});
    return{zones:z,total:Math.round(total*10)/10,usedSplits:usedSplits};
  },

  getCumDist(){
    var labels=[],actual=[],planned=[];var ca=0,cp=0;
    PLAN.forEach(function(w){
      var wkA=0;
      for(var d=0;d<7;d++){var dt=getDayDate(w.start,d);var log=S.getLog(dt);if(log&&log.distance)wkA+=parseFloat(log.distance)}
      ca+=wkA;cp+=w.km;
      labels.push('T'+w.weekNum);actual.push(Math.round(ca*10)/10);planned.push(Math.round(cp*10)/10);
    });
    return{labels:labels,actual:actual,planned:planned};
  },

  getRR(){
    var fit=typeof TL!=='undefined'?TL.get():{ctl:0,atl:0,tsb:0};
    var con=this.getConsistency();
    var cd=this.getCumDist();
    var lastPlan=cd.planned[cd.planned.length-1]||1;
    var lastActual=cd.actual[cd.actual.length-1]||0;
    var fitScore=Math.min(100,Math.round(fit.ctl*2));
    var volScore=Math.min(100,Math.round(lastActual/lastPlan*100));
    var conScore=con.score;
    var freshScore=Math.min(100,Math.max(0,50+fit.tsb*2));
    var score=Math.round(fitScore*0.3+volScore*0.25+conScore*0.25+freshScore*0.2);
    var lbl=score>=80?'Gotowy na wyscig!':score>=60?'Dobra forma':score>=40?'W budowie':'Poczatek drogi';
    return{score:score,components:{fitness:fitScore,volume:volScore,consistency:conScore,freshness:freshScore},label:lbl};
  },

  getPaceHR150(){
    var self=this;
    return this._logs().filter(function(l){return l.hr&&l.pace&&self._pp(l.pace)>0&&parseFloat(l.hr)>100}).map(function(l){
      var p=self._pp(l.pace);var hr=parseFloat(l.hr);
      return{date:l.date,pace:Math.round(p*(hr/150)*100)/100};
    });
  },

  getWoW(){
    return PLAN.map(function(w){
      var km=0,ttime=0,thr=0,hrc=0,cnt=0;
      for(var d=0;d<7;d++){var dt=getDayDate(w.start,d);var log=S.getLog(dt);
        if(log&&log.distance){cnt++;km+=parseFloat(log.distance);
          if(log.pace){var p=Analytics._pp(log.pace);if(p>0)ttime+=p*parseFloat(log.distance)}
          if(log.hr){thr+=parseFloat(log.hr);hrc++}
        }
      }
      var ap=km>0&&ttime>0?ttime/km:0;
      return{week:w.weekNum,km:Math.round(km*10)/10,avgPace:ap>0?Math.round(ap*100)/100:0,avgHR:hrc>0?Math.round(thr/hrc):0,workouts:cnt};
    });
  },

  getHRRec(){
    var arr=[];
    this._logs().forEach(function(l){
      if(!l.strava_id)return;
      var det=JSON.parse(localStorage.getItem('strava_detail_'+l.strava_id)||'null');
      if(!det||!det.max_hr||!l.hr)return;
      arr.push({date:l.date,spread:det.max_hr-parseFloat(l.hr)});
    });
    return arr;
  },

  getCadPace(){
    var arr=[];
    this._logs().forEach(function(l){
      if(!l.strava_id||!l.pace)return;
      var det=JSON.parse(localStorage.getItem('strava_detail_'+l.strava_id)||'null');
      if(!det||!det.cadence)return;
      arr.push({pace:Analytics._pp(l.pace),cadence:Math.round(det.cadence*2),date:l.date});
    });
    return arr;
  },

  getFI(){
    var arr=[];
    this._logs().forEach(function(l){
      if(!l.strava_id||parseFloat(l.distance)<6)return;
      var det=JSON.parse(localStorage.getItem('strava_detail_'+l.strava_id)||'null');
      if(!det||!det.splits||det.splits.length<6)return;
      var sp=det.splits;
      var f3=0,l3x=0;
      for(var i=0;i<3;i++){if(sp[i]&&sp[i].distance>0)f3+=(sp[i].moving_time||0)/(sp[i].distance)*1000}
      for(var i=sp.length-3;i<sp.length;i++){if(sp[i]&&sp[i].distance>0)l3x+=(sp[i].moving_time||0)/(sp[i].distance)*1000}
      f3/=3;l3x/=3;if(f3<=0)return;
      var idx=Math.round((l3x-f3)/f3*100);
      arr.push({date:l.date,index:idx});
    });
    return arr;
  },

  getStreak(){
    var cur=0,best=0;var t=today();
    for(var i=0;i<PLAN.length;i++){
      var w=PLAN[i];var we=getDayDate(w.start,6);if(w.start>t)break;
      var km=0;
      for(var d=0;d<7;d++){var dt=getDayDate(w.start,d);var log=S.getLog(dt);if(log&&log.distance)km+=parseFloat(log.distance)}
      if(w.km>0&&km/w.km>=0.8){cur++;if(cur>best)best=cur}else{if(we<t)cur=0}
    }
    return{current:cur,best:best};
  },

  getConsistency(){
    var done=0,total=0;var t=today();
    PLAN.forEach(function(w){w.days.forEach(function(d){
      if(d.rest)return;var dt=getDayDate(w.start,d.dow);if(dt>t)return;
      total++;var log=S.getLog(dt);if(log&&(log.distance||log.status==='done'))done++;
    })});
    return{score:total>0?Math.round(done/total*100):0,done:done,total:total};
  },

  getMonthly(){
    var months={};
    this._logs().forEach(function(l){
      var m=l.date.substring(0,7);
      if(!months[m])months[m]={km:0,workouts:0,ttime:0,thr:0,hrc:0};
      var mo=months[m];mo.km+=parseFloat(l.distance);mo.workouts++;
      if(l.pace){var p=Analytics._pp(l.pace);if(p>0)mo.ttime+=p*parseFloat(l.distance)}
      if(l.hr){mo.thr+=parseFloat(l.hr);mo.hrc++}
    });
    return Object.entries(months).sort().map(function(e){
      var m=e[0],d=e[1];
      return{month:m,km:Math.round(d.km*10)/10,workouts:d.workouts,
        avgPace:d.km>0&&d.ttime>0?Math.round(d.ttime/d.km*100)/100:0,
        avgHR:d.hrc>0?Math.round(d.thr/d.hrc):0};
    });
  },

  getCumElev(){
    var total=0;var byWeek=[];
    PLAN.forEach(function(w){
      var wElev=0;
      for(var d=0;d<7;d++){
        var dt=getDayDate(w.start,d);var log=S.getLog(dt);
        if(log&&log.strava_id){
          var det=JSON.parse(localStorage.getItem('strava_detail_'+log.strava_id)||'null');
          if(det&&det.total_elevation_gain)wElev+=det.total_elevation_gain;
        }
      }
      total+=wElev;byWeek.push({week:w.weekNum,elev:Math.round(wElev),cum:Math.round(total)});
    });
    return{total:Math.round(total),byWeek:byWeek};
  },

  render(){
    try{
    var rr=this.getRR();var str=this.getStreak();var con=this.getConsistency();var vo2=this.getVO2();
    var h='';

    h+='<div class="an-section"><div class="an-title">\uD83C\uDFC1 Race Readiness</div>';
    h+='<div class="an-gauge-wrap"><div class="an-gauge" style="--pct:'+rr.score+'"><div class="an-gauge-val">'+rr.score+'</div></div><div class="an-gauge-label">'+rr.label+'</div></div>';
    h+='<div class="an-rr-row"><div class="an-rr-item"><div class="an-rr-v">'+rr.components.fitness+'</div><div class="an-rr-l">Fitness</div></div><div class="an-rr-item"><div class="an-rr-v">'+rr.components.volume+'</div><div class="an-rr-l">Objetosc</div></div><div class="an-rr-item"><div class="an-rr-v">'+rr.components.consistency+'</div><div class="an-rr-l">Stalosc</div></div><div class="an-rr-item"><div class="an-rr-v">'+rr.components.freshness+'</div><div class="an-rr-l">Swiezosc</div></div></div></div>';

    h+='<div class="an-badges"><div class="an-badge fire"><span class="an-badge-icon">\uD83D\uDD25</span><span class="an-badge-val">'+str.current+'</span><span class="an-badge-l">Streak (tyg.)</span></div>';
    h+='<div class="an-badge check"><span class="an-badge-icon">\u2705</span><span class="an-badge-val">'+con.score+'%</span><span class="an-badge-l">Stalosc ('+con.done+'/'+con.total+')</span></div>';
    if(str.best>str.current)h+='<div class="an-badge trophy"><span class="an-badge-icon">\uD83C\uDFC6</span><span class="an-badge-val">'+str.best+'</span><span class="an-badge-l">Najlepszy streak</span></div>';
    h+='</div>';

    if(vo2.current>0){
      h+='<div class="an-section"><div class="an-title">\uD83E\uDEC0 VO2max</div><div class="an-vo2-row"><div class="an-vo2-val">'+vo2.current+'</div><div class="an-vo2-info"><div class="an-vo2-level">'+vo2.level+'</div><div class="an-vo2-sub">ml/kg/min</div></div></div>';
      if(vo2.trend.length>1)h+='<canvas id="an-vo2"></canvas>';
      h+='</div>';
    }

    h+='<div class="an-section"><div class="an-title">\u2764\uFE0F Aerobic Efficiency (nizszy = lepiej)</div><canvas id="an-ae"></canvas></div>';
    h+='<div class="an-section"><div class="an-title">\uD83C\uDFAF Training Distribution (80/20)</div><canvas id="an-dist"></canvas></div>';
    h+='<div class="an-section"><div class="an-title">\uD83D\uDCC8 Dystans narastajacy (plan vs realizacja)</div><canvas id="an-cum"></canvas></div>';
    h+='<div class="an-section"><div class="an-title">\u26A1 Tempo @ HR 150 (nizszy = lepiej)</div><canvas id="an-hr150"></canvas></div>';
    h+='<div class="an-section"><div class="an-title">\uD83D\uDCCA Tydzien po tygodniu</div><canvas id="an-wow"></canvas></div>';
    h+='<div class="an-section"><div class="an-title">\uD83D\uDCA4 Fatigue Index (% spadku tempa)</div><canvas id="an-fi"></canvas></div>';
    h+='<div class="an-section"><div class="an-title">\uD83D\uDC63 Kadencja vs Tempo</div><canvas id="an-cad"></canvas></div>';
    h+='<div class="an-section"><div class="an-title">\u26F0\uFE0F Narastajace przewyzszenie</div><canvas id="an-elev"></canvas></div>';

    var mo=this.getMonthly();
    if(mo.length){
      h+='<div class="an-section"><div class="an-title">\uD83D\uDCC5 Porownanie miesieczne</div><div class="an-months">';
      var MN=['','Sty','Lut','Mar','Kwi','Maj','Cze','Lip','Sie','Wrz','Paz','Lis','Gru'];
      mo.forEach(function(m){
        var mi=parseInt(m.month.split('-')[1]);
        var ap=m.avgPace>0?Math.floor(m.avgPace)+':'+String(Math.round((m.avgPace%1)*60)).padStart(2,'0'):'-';
        h+='<div class="an-month"><div class="an-month-name">'+MN[mi]+' '+m.month.split('-')[0]+'</div><div class="an-month-km">'+m.km+' km</div><div class="an-month-det">'+m.workouts+' treningow \u2022 '+ap+'/km'+(m.avgHR?' \u2022 \u2764 '+m.avgHR:'')+'</div></div>';
      });
      h+='</div></div>';
    }

    return h;
    }catch(e){console.error('Analytics render error:',e);return '<div class="empty">Blad Analytics: '+e.message+'</div>'}
  },

  drawCharts(){
    try{
    console.log('Analytics drawCharts START');

    var ae=this.getAE();
    console.log('AE:',ae.length);
    if(ae.length>0){try{this._ch('an-ae',{type:'line',data:{labels:ae.map(function(a){return a.date.substring(5)}),datasets:[{data:ae.map(function(a){return a.ae}),borderColor:'#FF9F0A',borderWidth:2,pointRadius:3,pointBackgroundColor:'#FF9F0A',fill:false,tension:.3}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#999',maxTicksLimit:10}},y:{reverse:true,ticks:{color:'#999'}}}}})}catch(e){console.warn('AE err',e)}}

    var vo2=this.getVO2();
    console.log('VO2:',vo2.trend.length,'cur:',vo2.current);
    if(vo2.trend.length>1){try{this._ch('an-vo2',{type:'line',data:{labels:vo2.trend.map(function(v){return v.date.substring(5)}),datasets:[{data:vo2.trend.map(function(v){return v.vo2}),borderColor:'#30D158',borderWidth:2,pointRadius:3,pointBackgroundColor:'#30D158',fill:true,backgroundColor:'rgba(48,209,88,.1)',tension:.3}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#999',maxTicksLimit:8}},y:{ticks:{color:'#999'}}}}})}catch(e){console.warn('VO2 err',e)}}

    var dist=this.getDist();var dz=dist.zones;
    console.log('Dist:',dz.easy.km,'e',dz.tempo.km,'t',dz.threshold.km,'th',dz.interval.km,'i','splits:',dist.usedSplits);
    try{this._ch('an-dist',{type:'doughnut',data:{labels:[dz.easy.label+' '+dz.easy.pct+'%',dz.tempo.label+' '+dz.tempo.pct+'%',dz.threshold.label+' '+dz.threshold.pct+'%',dz.interval.label+' '+dz.interval.pct+'%'],datasets:[{data:[dz.easy.km,dz.tempo.km,dz.threshold.km,dz.interval.km],backgroundColor:['#30D158','#0A84FF','#FF9F0A','#FF453A'],borderWidth:0}]},options:{responsive:true,plugins:{legend:{display:true,position:'bottom',labels:{color:'#ccc',font:{size:11}}}}}})}catch(e){console.warn('Dist err',e)}

    var cd=this.getCumDist();
    console.log('CumDist:',cd.actual.length);
    try{this._ch('an-cum',{type:'line',data:{labels:cd.labels,datasets:[{label:'Plan',data:cd.planned,borderColor:'#555',borderWidth:2,borderDash:[5,5],pointRadius:0,fill:false},{label:'Realizacja',data:cd.actual,borderColor:'#0A84FF',borderWidth:2,pointRadius:3,pointBackgroundColor:'#0A84FF',fill:true,backgroundColor:'rgba(10,132,255,.1)'}]},options:{responsive:true,plugins:{legend:{display:true,labels:{color:'#ccc'}}},scales:{x:{ticks:{color:'#999'}},y:{ticks:{color:'#999'}}}}})}catch(e){console.warn('CumDist err',e)}

    var hr150=this.getPaceHR150();
    console.log('HR150:',hr150.length);
    if(hr150.length>0){try{this._ch('an-hr150',{type:'line',data:{labels:hr150.map(function(h){return h.date.substring(5)}),datasets:[{data:hr150.map(function(h){return h.pace}),borderColor:'#BF5AF2',borderWidth:2,pointRadius:3,pointBackgroundColor:'#BF5AF2',fill:false,tension:.3}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#999',maxTicksLimit:10}},y:{reverse:true,ticks:{color:'#999',callback:function(v){var m=Math.floor(v);var s=Math.round((v-m)*60);return m+':'+String(s).padStart(2,'0')}}}}}})}catch(e){console.warn('HR150 err',e)}}

    var wow=this.getWoW();
    console.log('WoW:',wow.length);
    try{this._ch('an-wow',{type:'bar',data:{labels:wow.map(function(w){return 'T'+w.week}),datasets:[{label:'km',data:wow.map(function(w){return w.km}),backgroundColor:'rgba(10,132,255,.6)',borderRadius:4}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#999'}},y:{ticks:{color:'#999'}}}}})}catch(e){console.warn('WoW err',e)}

    var fi=this.getFI();
    console.log('FI:',fi.length);
    if(fi.length>0){try{this._ch('an-fi',{type:'bar',data:{labels:fi.map(function(f){return f.date.substring(5)}),datasets:[{data:fi.map(function(f){return f.index}),backgroundColor:fi.map(function(f){return f.index<=0?'#30D158':f.index<=3?'#0A84FF':f.index<=6?'#FF9F0A':'#FF453A'}),borderRadius:4}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#999',maxTicksLimit:10}},y:{ticks:{color:'#999',callback:function(v){return v+'%'}}}}}})}catch(e){console.warn('FI err',e)}}

    var cp=this.getCadPace();
    console.log('CadPace:',cp.length);
    if(cp.length>0){try{this._ch('an-cad',{type:'scatter',data:{datasets:[{data:cp.map(function(c){return{x:c.pace,y:c.cadence}}),backgroundColor:'#64D2FF',pointRadius:5}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{x:{reverse:true,title:{display:true,text:'Tempo (min/km)',color:'#999'},ticks:{color:'#999',callback:function(v){var m=Math.floor(v);var s=Math.round((v-m)*60);return m+':'+String(s).padStart(2,'0')}}},y:{title:{display:true,text:'Kadencja (kroki/min)',color:'#999'},ticks:{color:'#999'}}}}})}catch(e){console.warn('Cad err',e)}}

    var elev=this.getCumElev();
    console.log('Elev:',elev.total);
    if(elev.byWeek.length>0&&elev.total>0){try{this._ch('an-elev',{type:'bar',data:{labels:elev.byWeek.map(function(e){return 'T'+e.week}),datasets:[{label:'Tygodniowe (m)',data:elev.byWeek.map(function(e){return e.elev}),backgroundColor:'rgba(100,210,255,.5)',borderRadius:4},{label:'Narastajace (m)',data:elev.byWeek.map(function(e){return e.cum}),type:'line',borderColor:'#FF9F0A',borderWidth:2,pointRadius:2,fill:false,yAxisID:'y2'}]},options:{responsive:true,plugins:{legend:{display:true,labels:{color:'#ccc'}}},scales:{x:{ticks:{color:'#999'}},y:{position:'left',ticks:{color:'#999'}},y2:{position:'right',grid:{display:false},ticks:{color:'#999'}}}}})}catch(e){console.warn('Elev err',e)}}

    console.log('Analytics drawCharts DONE');
    }catch(e){console.error('Analytics drawCharts global error:',e)}
  }
};

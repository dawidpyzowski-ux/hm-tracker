var Charts={I:{},
d:function(id){if(this.I[id]){this.I[id].destroy();delete this.I[id]}},
O:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#8E8E93',boxWidth:12}}},scales:{x:{ticks:{color:'#636',font:{size:10}},grid:{color:'#333'}},y:{ticks:{color:'#636',font:{size:10}},grid:{color:'#333'}}}},
weeklyKm:function(id){this.d(id);var c=document.getElementById(id);if(!c)return;var L=[],P=[],A=[];PLAN.forEach(function(w){L.push('T'+w.weekNum);P.push(w.km);var t=0;w.days.forEach(function(d){var l=S.getLog(getDayDate(w.start,d.dow));if(l&&l.distance)t+=parseFloat(l.distance)});A.push(t||0)});this.I[id]=new Chart(c,{type:'bar',data:{labels:L,datasets:[{label:'Plan',data:P,backgroundColor:'#444',borderRadius:4},{label:'Realizacja',data:A,backgroundColor:'#30D158',borderRadius:4}]},options:this.O})},

paceTrend:function(id){
  this.d(id);var c=document.getElementById(id);if(!c)return;
  var L=[],V=[];
  var logs=S.getAllLogs();
  var dates=Object.keys(logs).sort();
  for(var i=0;i<dates.length;i++){
    var d=dates[i],l=logs[d];
    if(l.pace&&l.pace.indexOf(':')!==-1){
      var p=l.pace.split(':');
      L.push(d.slice(5));
      V.push(+p[0]+ +p[1]/60);
    }
  }
  if(!V.length)return;
  var minV=V[0],maxV=V[0];
  for(i=0;i<V.length;i++){if(V[i]<minV)minV=V[i];if(V[i]>maxV)maxV=V[i];}
  var yMin=Math.floor(minV)-0.5;
  var yMax=Math.ceil(maxV)+0.5;
  this.I[id]=new Chart(c,{type:'line',
    data:{labels:L,datasets:[{label:'Tempo (min/km)',data:V,borderColor:'#0A84FF',fill:false,tension:.3,pointRadius:3}]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{labels:{color:'#8E8E93',boxWidth:12}},
        tooltip:{callbacks:{label:function(ctx){
          var v=ctx.raw;var m=Math.floor(v);var s=Math.round((v-m)*60);
          return 'Tempo: '+m+':'+(s<10?'0':'')+s+'/km';
        }}}
      },
      scales:{
        x:{ticks:{color:'#636',font:{size:10}},grid:{color:'#333'}},
        y:{reverse:true,min:yMin,max:yMax,
          ticks:{color:'#636',font:{size:10},
            callback:function(v){var m=Math.floor(v);var s=Math.round((v-m)*60);return m+':'+(s<10?'0':'')+s;}
          },
          grid:{color:'#333'}
        }
      }
    }
  });
},

feelingTrend:function(id){this.d(id);var c=document.getElementById(id);if(!c)return;var L=[],V=[];var logs=S.getAllLogs();var dates=Object.keys(logs).sort();for(var i=0;i<dates.length;i++){var d=dates[i],l=logs[d];if(l.feeling){L.push(d.slice(5));V.push(+l.feeling)}}if(!V.length)return;this.I[id]=new Chart(c,{type:'line',data:{labels:L,datasets:[{label:'Samopoczucie',data:V,borderColor:'#30D158',fill:false,tension:.3,pointRadius:4}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#8E8E93',boxWidth:12}}},scales:{x:{ticks:{color:'#636',font:{size:10}},grid:{color:'#333'}},y:{ticks:{color:'#636',font:{size:10}},grid:{color:'#333'},min:0,max:10}}}})},

monthlyVol:function(id){this.d(id);var c=document.getElementById(id);if(!c)return;var M=['Sty','Lut','Mar','Kwi','Maj','Cze','Lip','Sie','Wrz'],V=[14.4,0,22.2,65.2,160,0,0,0,0];var logs=S.getAllLogs();var entries=Object.keys(logs);for(var i=0;i<entries.length;i++){var d=entries[i],l=logs[d];if(l.distance){var m=+d.split('-')[1];if(m>=1&&m<=9)V[m-1]+=parseFloat(l.distance)}}this.I[id]=new Chart(c,{type:'bar',data:{labels:M,datasets:[{data:V,backgroundColor:V.map(function(_,i){return i<5?'#0A84FF':'#30D158'}),borderRadius:4}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#636',font:{size:10}},grid:{color:'#333'}},y:{ticks:{color:'#636',font:{size:10}},grid:{color:'#333'}}}}})},

trainingLoad:function(id){
  this.d(id);var c=document.getElementById(id);if(!c)return;
  var f=TL.get();
  if(!f||!f.history||!f.history.length)return;
  var last=f.history.slice(-60);
  var L=last.map(function(h){return h.date.slice(5)});
  var C=last.map(function(h){return h.ctl});
  var A=last.map(function(h){return h.atl});
  var T=last.map(function(h){return h.tsb});
  this.I[id]=new Chart(c,{type:'line',
    data:{labels:L,datasets:[
      {label:'Fitness (CTL)',data:C,borderColor:'#30D158',backgroundColor:'rgba(48,209,88,.08)',fill:true,tension:.3,pointRadius:0,borderWidth:2},
      {label:'Zmeczenie (ATL)',data:A,borderColor:'#FF453A',fill:false,tension:.3,pointRadius:0,borderWidth:2},
      {label:'Forma (TSB)',data:T,borderColor:'#0A84FF',borderDash:[5,3],fill:false,tension:.3,pointRadius:0,borderWidth:2}
    ]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#8E8E93',boxWidth:12,usePointStyle:true}}},scales:{x:{ticks:{color:'#636',font:{size:10},maxTicksLimit:10},grid:{color:'#333'}},y:{ticks:{color:'#636',font:{size:10}},grid:{color:'#333'}}}}
  });
},

predTrend:function(id){
  this.d(id);var c=document.getElementById(id);if(!c)return;

  var L=[],V=[];

  // Try official Pred module first
  var wk=null;
  try{wk=Pred.getWeeklyTrend();}catch(e){}

  if(wk&&wk.length){
    for(var i=0;i<wk.length;i++){
      L.push('T'+wk[i].weekNum);
      V.push(Math.round(wk[i].hmPred/60*10)/10);
    }
  } else {
    // Fallback: build from logged runs using Riegel formula
    // hmTime = runTimeSec * (21.0975 / distKm) ^ 1.06
    var logs;try{logs=S.getAllLogs();}catch(e){return;}
    var dates=Object.keys(logs).sort();
    var pts=[];
    for(var j=0;j<dates.length;j++){
      var dt=dates[j],ll=logs[dt];
      if(!ll.distance||!ll.pace||ll.pace.indexOf(':')===-1)continue;
      var distKm=parseFloat(ll.distance);
      if(distKm<3)continue;
      var pp=ll.pace.split(':');
      var paceSec=(+pp[0])*60+(+pp[1]||0);
      var runTime=paceSec*distKm;
      var hmPred=runTime*Math.pow(21.0975/distKm,1.06);
      var hmMin=Math.round(hmPred/60*10)/10;
      if(hmMin>70&&hmMin<180)pts.push({date:dt,mins:hmMin});
    }
    if(!pts.length)return;

    // Group by week
    var wks={};
    for(j=0;j<pts.length;j++){
      var d2=new Date(pts[j].date+'T12:00:00');
      var j1=new Date(d2.getFullYear(),0,1);
      var wn=Math.ceil(((d2-j1)/86400000+j1.getDay()+1)/7);
      var wkey=d2.getFullYear()+'-W'+(wn<10?'0':'')+wn;
      if(!wks[wkey])wks[wkey]=[];
      wks[wkey].push(pts[j].mins);
    }
    var sortedW=Object.keys(wks).sort();
    for(j=0;j<sortedW.length;j++){
      var arr=wks[sortedW[j]];
      var sum=0;for(var k=0;k<arr.length;k++)sum+=arr[k];
      L.push(sortedW[j].slice(5));
      V.push(Math.round(sum/arr.length*10)/10);
    }
  }

  if(!V.length)return;

  // Format mm:ss for display
  this.I[id]=new Chart(c,{type:'line',
    data:{labels:L,datasets:[
      {label:'Prognoza HM (min)',data:V,borderColor:'#BF5AF2',backgroundColor:'rgba(191,90,242,.1)',fill:true,tension:.3,pointRadius:4,borderWidth:2}
    ]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},
        tooltip:{callbacks:{label:function(ctx){
          var v=ctx.raw;var h=Math.floor(v/60);var m=Math.floor(v%60);var s=Math.round((v-Math.floor(v))*60);
          return 'Prognoza: '+h+':'+((m<10)?'0':'')+m+':'+((s<10)?'0':'')+s;
        }}}
      },
      scales:{x:{ticks:{color:'#636',font:{size:10}},grid:{color:'#333'}},
        y:{ticks:{color:'#636',font:{size:10},
          callback:function(v){var h=Math.floor(v/60);var m=Math.round(v%60);return h+':'+((m<10)?'0':'')+m;}
        },grid:{color:'#333'},reverse:true}}
    }
  });
}
};

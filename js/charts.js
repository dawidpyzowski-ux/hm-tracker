const Charts={I:{},
d(id){if(this.I[id]){this.I[id].destroy();delete this.I[id]}},
O:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#8E8E93',boxWidth:12}}},scales:{x:{ticks:{color:'#636',font:{size:10}},grid:{color:'#333'}},y:{ticks:{color:'#636',font:{size:10}},grid:{color:'#333'}}}},
weeklyKm(id){this.d(id);const c=document.getElementById(id);if(!c)return;const L=[],P=[],A=[];PLAN.forEach(w=>{L.push('T'+w.weekNum);P.push(w.km);let t=0;w.days.forEach(d=>{const l=S.getLog(getDayDate(w.start,d.dow));if(l&&l.distance)t+=parseFloat(l.distance)});A.push(t||0)});this.I[id]=new Chart(c,{type:'bar',data:{labels:L,datasets:[{label:'Plan',data:P,backgroundColor:'#444',borderRadius:4},{label:'Realizacja',data:A,backgroundColor:'#30D158',borderRadius:4}]},options:this.O})},
paceTrend(id){this.d(id);const c=document.getElementById(id);if(!c)return;const L=[],V=[];const logs=S.getAllLogs();Object.keys(logs).sort().forEach(d=>{const l=logs[d];if(l.pace&&l.pace.includes(':')){const p=l.pace.split(':');L.push(d.slice(5));V.push(+p[0]+ +p[1]/60)}});if(!V.length)return;this.I[id]=new Chart(c,{type:'line',data:{labels:L,datasets:[{label:'Tempo (min/km)',data:V,borderColor:'#0A84FF',fill:false,tension:.3,pointRadius:3}]},options:{...this.O,scales:{...this.O.scales,y:{...this.O.scales.y,reverse:true}}}})},
feelingTrend(id){this.d(id);const c=document.getElementById(id);if(!c)return;const L=[],V=[];const logs=S.getAllLogs();Object.keys(logs).sort().forEach(d=>{const l=logs[d];if(l.feeling){L.push(d.slice(5));V.push(+l.feeling)}});if(!V.length)return;this.I[id]=new Chart(c,{type:'line',data:{labels:L,datasets:[{label:'Samopoczucie',data:V,borderColor:'#30D158',fill:false,tension:.3,pointRadius:4}]},options:{...this.O,scales:{...this.O.scales,y:{...this.O.scales.y,min:0,max:10}}}})},
monthlyVol(id){this.d(id);const c=document.getElementById(id);if(!c)return;const M=['Sty','Lut','Mar','Kwi','Maj','Cze','Lip','Sie','Wrz'],V=[14.4,0,22.2,65.2,160,0,0,0,0];const logs=S.getAllLogs();Object.entries(logs).forEach(([d,l])=>{if(l.distance){const m=+d.split('-')[1];if(m>=1&&m<=9)V[m-1]+=parseFloat(l.distance)}});this.I[id]=new Chart(c,{type:'bar',data:{labels:M,datasets:[{data:V,backgroundColor:V.map((_,i)=>i<5?'#0A84FF':'#30D158'),borderRadius:4}]},options:{...this.O,plugins:{legend:{display:false}}}})},
trainingLoad(id){
  this.d(id);
  const c=document.getElementById(id);
  if(!c)return;
  const f=TL.get();
  if(!f||!f.history||!f.history.length)return;
  const last=f.history.slice(-60);
  const L=last.map(h=>h.date.slice(5));
  const C=last.map(h=>h.ctl);
  const A=last.map(h=>h.atl);
  const T=last.map(h=>h.tsb);
  this.I[id]=new Chart(c,{
    type:'line',
    data:{labels:L,datasets:[
      {label:'Fitness (CTL)',data:C,borderColor:'#30D158',backgroundColor:'rgba(48,209,88,.08)',fill:true,tension:.3,pointRadius:0,borderWidth:2},
      {label:'Zmeczenie (ATL)',data:A,borderColor:'#FF453A',fill:false,tension:.3,pointRadius:0,borderWidth:2},
      {label:'Forma (TSB)',data:T,borderColor:'#0A84FF',borderDash:[5,3],fill:false,tension:.3,pointRadius:0,borderWidth:2}
    ]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#8E8E93',boxWidth:12,usePointStyle:true}}},scales:{x:{ticks:{color:'#636',font:{size:10},maxTicksLimit:10},grid:{color:'#333'}},y:{ticks:{color:'#636',font:{size:10}},grid:{color:'#333'}}}}
  });
},
predTrend(id){
  this.d(id);
  const c=document.getElementById(id);
  if(!c)return;
  const wk=Pred.getWeeklyTrend();
  if(!wk||!wk.length)return;
  const L=wk.map(w=>'T'+w.weekNum);
  const V=wk.map(w=>Math.round(w.hmPred/60*10)/10);
  this.I[id]=new Chart(c,{
    type:'line',
    data:{labels:L,datasets:[
      {label:'Prognoza HM (min)',data:V,borderColor:'#BF5AF2',backgroundColor:'rgba(191,90,242,.1)',fill:true,tension:.3,pointRadius:4,borderWidth:2}
    ]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#636',font:{size:10}},grid:{color:'#333'}},y:{ticks:{color:'#636',font:{size:10}},grid:{color:'#333'},reverse:true}}}
  });
}
};

// HM Tracker - Activity Detail Module (Sprint 4)
const ActDetail={
  ZONES:[
    {name:'Z1 Recovery',min:0,max:130,color:'#30D158'},
    {name:'Z2 Easy',min:130,max:150,color:'#0A84FF'},
    {name:'Z3 Tempo',min:150,max:165,color:'#FF9F0A'},
    {name:'Z4 Threshold',min:165,max:178,color:'#FF453A'},
    {name:'Z5 Max',min:178,max:999,color:'#BF5AF2'}
  ],

  getData(sid){
    if(!sid)return null;
    const detail=JSON.parse(localStorage.getItem('strava_detail_'+sid)||'null');
    const streams=JSON.parse(localStorage.getItem('strava_streams_'+sid)||'null');
    return {detail,streams};
  },

  // Extract stream data (handles both array-of-objects and keyed-object formats)
  _s(streams,key){
    if(!streams)return null;
    if(streams[key]&&streams[key].data)return streams[key].data;
    if(Array.isArray(streams)){const s=streams.find(x=>x.type===key);return s?s.data:null}
    return null;
  },

  render(sid,logData){
    const d=this.getData(sid);
    if(!d||!d.detail)return '<div class="empty">Brak szczegolowych danych. Zsynchronizuj Strave.</div>';
    const det=d.detail;
    let h='';

    // Summary row
    h+='<div class="ad-summary">';
    if(det.max_hr)h+=`<div class="ad-stat"><div class="ad-sv" style="color:var(--r)">${det.max_hr}</div><div class="ad-sl">\u2764 Max HR</div></div>`;
    if(det.cadence)h+=`<div class="ad-stat"><div class="ad-sv" style="color:var(--b)">${Math.round(det.cadence*2)}</div><div class="ad-sl">\uD83D\uDC63 Kadencja</div></div>`;
    if(det.total_elevation_gain)h+=`<div class="ad-stat"><div class="ad-sv" style="color:var(--g)">${Math.round(det.total_elevation_gain)}m</div><div class="ad-sl">\u26F0\uFE0F Przewyzszenie</div></div>`;
    if(det.calories)h+=`<div class="ad-stat"><div class="ad-sv" style="color:var(--o)">${det.calories}</div><div class="ad-sl">\uD83D\uDD25 kcal</div></div>`;
    if(det.suffer_score)h+=`<div class="ad-stat"><div class="ad-sv" style="color:var(--r)">${det.suffer_score}</div><div class="ad-sl">\uD83D\uDCAA Effort</div></div>`;
    if(det.gear)h+=`<div class="ad-stat"><div class="ad-sv" style="font-size:13px">\uD83D\uDC5F</div><div class="ad-sl">${det.gear}</div></div>`;
    h+='</div>';

    // Splits table
    if(det.splits&&det.splits.length){
      let fastest=Infinity,slowest=0,fi=-1,si=-1;
      det.splits.forEach((sp,i)=>{
        if(sp.moving_time>0&&sp.distance>500){
          const p=sp.moving_time/sp.distance*1000;
          if(p<fastest){fastest=p;fi=i}
          if(p>slowest){slowest=p;si=i}
        }
      });
      h+='<div class="ad-section"><div class="ad-title">\uD83C\uDFC3 Km Splits</div><table class="ad-splits"><thead><tr><th>Km</th><th>Tempo</th><th>HR</th><th>Elev</th></tr></thead><tbody>';
      det.splits.forEach((sp,i)=>{
        const pace=sp.moving_time>0?sp.moving_time/sp.distance*1000:0;
        const pm=Math.floor(pace/60),ps=Math.round(pace%60);
        const pStr=pm+':'+String(ps).padStart(2,'0');
        const cls=i===fi?' class="ad-split-fast"':i===si?' class="ad-split-slow"':'';
        h+=`<tr${cls}><td>${i+1}</td><td>${pStr}</td><td>${sp.average_heartrate?Math.round(sp.average_heartrate):'-'}</td><td>${sp.elevation_difference?sp.elevation_difference.toFixed(0)+'m':'-'}</td></tr>`;
      });
      h+='</tbody></table></div>';
    }

    // Chart sections
    const str=d.streams;
    const hasHR=!!this._s(str,'heartrate');
    const hasVel=!!this._s(str,'velocity_smooth');
    const hasAlt=!!this._s(str,'altitude');
    const hasCad=!!this._s(str,'cadence');
    const hasGPS=!!this._s(str,'latlng');

    if(hasHR)h+='<div class="ad-section"><div class="ad-title">\u2764\uFE0F Tetno</div><canvas id="ad-hr"></canvas></div>';
    if(hasVel)h+='<div class="ad-section"><div class="ad-title">\uD83D\uDCC9 Tempo</div><canvas id="ad-pace"></canvas></div>';
    if(hasAlt)h+='<div class="ad-section"><div class="ad-title">\u26F0\uFE0F Profil wysokosci</div><canvas id="ad-alt"></canvas></div>';
    if(hasCad)h+='<div class="ad-section"><div class="ad-title">\uD83D\uDC63 Kadencja</div><canvas id="ad-cad"></canvas></div>';
    if(hasHR)h+='<div class="ad-section"><div class="ad-title">\uD83D\uDCCA Strefy HR</div><canvas id="ad-zones"></canvas></div>';
    if(hasGPS)h+='<div class="ad-section"><div class="ad-title">\uD83D\uDDFA\uFE0F Trasa</div><div id="ad-map" style="height:250px;border-radius:10px;z-index:1"></div></div>';

    return h;
  },

 
  _ch(id,cfg){const c=Chart.getChart(id);if(c)c.destroy();return new Chart(id,cfg)},

  drawCharts(sid){
    const d=this.getData(sid);
    if(!d||!d.streams)return;

    const str=d.streams;
    const dist=this._s(str,'distance');
    const hr=this._s(str,'heartrate');
    const vel=this._s(str,'velocity_smooth');
    const alt=this._s(str,'altitude');
    const cad=this._s(str,'cadence');
    const latlng=this._s(str,'latlng');
    const time=this._s(str,'time');

    // Convert distance to km for x-axis
    const distKm=dist?dist.map(d=>Math.round(d/10)/100):null;

    // Downsample for performance (every Nth point)
    const maxPts=300;
    const step=distKm?Math.max(1,Math.floor(distKm.length/maxPts)):1;
    const ds=(arr)=>{if(!arr)return[];const r=[];for(let i=0;i<arr.length;i+=step)r.push(arr[i]);return r};

    const dkm=ds(distKm);
    const labels=dkm.map(d=>d.toFixed(1));

    if(hr&&document.getElementById('ad-hr')){
      const hrDs=ds(hr);
      const colors=hrDs.map(v=>{
        for(let i=this.ZONES.length-1;i>=0;i--){if(v>=this.ZONES[i].min)return this.ZONES[i].color}
        return '#999';
      });
      this._ch('ad-hr',{type:'line',data:{labels,datasets:[{data:hrDs,borderColor:colors,segment:{borderColor:ctx=>{const v=hrDs[ctx.p1DataIndex];for(let i=this.ZONES.length-1;i>=0;i--){if(v>=this.ZONES[i].min)return this.ZONES[i].color}return '#999'}},borderWidth:1.5,pointRadius:0,fill:false,tension:.3}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{x:{display:true,title:{display:true,text:'km',color:'#999'},ticks:{color:'#999',maxTicksLimit:8}},y:{title:{display:true,text:'bpm',color:'#999'},ticks:{color:'#999'}}}}});
    }

    if(vel&&document.getElementById('ad-pace')){
      const velDs=ds(vel);
      // Convert velocity to pace (min/km) - invert
      const paceData=velDs.map(v=>v>0?1000/v/60:0);
      this._ch('ad-pace',{type:'line',data:{labels,datasets:[{data:paceData,borderColor:'#0A84FF',borderWidth:1.5,pointRadius:0,fill:true,backgroundColor:'rgba(10,132,255,.15)',tension:.3}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#999',maxTicksLimit:8}},y:{reverse:true,title:{display:true,text:'min/km',color:'#999'},ticks:{color:'#999',callback:v=>{const m=Math.floor(v);const s=Math.round((v-m)*60);return m+':'+String(s).padStart(2,'0')}}}}}});
    }

    if(alt&&document.getElementById('ad-alt')){
      const altDs=ds(alt);
      this._ch('ad-alt',{type:'line',data:{labels,datasets:[{data:altDs,borderColor:'#64D2FF',borderWidth:1.5,pointRadius:0,fill:true,backgroundColor:'rgba(100,210,255,.2)',tension:.3}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#999',maxTicksLimit:8}},y:{title:{display:true,text:'m n.p.m.',color:'#999'},ticks:{color:'#999'}}}}});
    }

    if(cad&&document.getElementById('ad-cad')){
      const cadDs=ds(cad).map(c=>c*2); // Strava half-cadence for running
      this._ch('ad-cad',{type:'line',data:{labels,datasets:[{data:cadDs,borderColor:'#BF5AF2',borderWidth:1.5,pointRadius:0,fill:true,backgroundColor:'rgba(191,90,242,.15)',tension:.3}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#999',maxTicksLimit:8}},y:{title:{display:true,text:'kroki/min',color:'#999'},ticks:{color:'#999'}}}}});
    }

    if(hr&&document.getElementById('ad-zones')){
      // Calculate time in each zone
      const zoneSec=this.ZONES.map(()=>0);
      const dt=time?time.map((t,i)=>i>0?t-time[i-1]:1):hr.map(()=>1);
      hr.forEach((v,i)=>{
        for(let z=this.ZONES.length-1;z>=0;z--){
          if(v>=this.ZONES[z].min){zoneSec[z]+=(dt[i]||1);break}
        }
      });
      const total=zoneSec.reduce((a,b)=>a+b,1);
      const pcts=zoneSec.map(s=>Math.round(s/total*100));
      const mins=zoneSec.map(s=>Math.round(s/60));
      this._ch('ad-zones',{type:'doughnut',data:{labels:this.ZONES.map((z,i)=>`${z.name} ${pcts[i]}% (${mins[i]}min)`),datasets:[{data:zoneSec,backgroundColor:this.ZONES.map(z=>z.color),borderWidth:0}]},options:{responsive:true,plugins:{legend:{display:true,position:'bottom',labels:{color:'#ccc',font:{size:11},padding:8}}}}});
    }

    if(latlng&&document.getElementById('ad-map')&&typeof L!=='undefined'){
      const coords=latlng.filter(c=>c&&c.length===2);
      if(coords.length){
        const map=L.map('ad-map',{zoomControl:false,attributionControl:false});
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18}).addTo(map);
        const line=L.polyline(coords,{color:'#0A84FF',weight:3,opacity:.8}).addTo(map);
        map.fitBounds(line.getBounds(),{padding:[20,20]});
        L.circleMarker(coords[0],{radius:6,color:'#30D158',fillColor:'#30D158',fillOpacity:1}).addTo(map).bindPopup('Start');
        L.circleMarker(coords[coords.length-1],{radius:6,color:'#FF453A',fillColor:'#FF453A',fillOpacity:1}).addTo(map).bindPopup('Meta');
      }
    }
  }
};

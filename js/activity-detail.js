// HM Tracker - Activity Detail (Sprint 7 - Power/GAP/Laps)
const ActDetail={
  ZONES:[{name:'Z1 Recovery',min:0,max:130,color:'#30D158'},{name:'Z2 Easy',min:130,max:150,color:'#0A84FF'},{name:'Z3 Tempo',min:150,max:165,color:'#FF9F0A'},{name:'Z4 Threshold',min:165,max:178,color:'#FF453A'},{name:'Z5 Max',min:178,max:999,color:'#BF5AF2'}],
  PZCLR:['','#30D158','#0A84FF','#FF9F0A','#FF453A','#BF5AF2'],
  getData(sid){if(!sid)return null;var detail=JSON.parse(localStorage.getItem('strava_detail_'+sid)||'null');var streams=JSON.parse(localStorage.getItem('strava_streams_'+sid)||'null');return{detail:detail,streams:streams}},
  _s(streams,key){if(!streams)return null;if(streams[key]&&streams[key].data)return streams[key].data;if(Array.isArray(streams)){var s=streams.find(function(x){return x.type===key});return s?s.data:null}return null},
  _ch(id,cfg){var el=document.getElementById(id);if(!el)return null;var existing=Chart.getChart(el);if(existing)existing.destroy();return new Chart(el,cfg)},
  _fmtPace(sPerKm){if(!sPerKm||sPerKm<=0)return'-';var m=Math.floor(sPerKm/60),s=Math.round(sPerKm%60);return m+':'+String(s).padStart(2,'0')},
  _speedToPace(ms){if(!ms||ms<=0)return'-';var sPerKm=1000/ms;return this._fmtPace(sPerKm)},
  render(sid){
    var d=this.getData(sid);if(!d||!d.detail)return'<div class="empty">Brak danych. Zsynchronizuj Strave.</div>';
    var det=d.detail;var id=sid;var h='';
    h+='<div class="ad-summary">';
    if(det.max_hr)h+='<div class="ad-stat"><div class="ad-sv" style="color:var(--r)">'+det.max_hr+'</div><div class="ad-sl">\u2764 Max HR</div></div>';
    var totalW=0,wCnt=0;
    if(det.laps){det.laps.forEach(function(lap){if(lap.average_watts>0){totalW+=lap.average_watts*lap.moving_time;wCnt+=lap.moving_time}})}
    if(wCnt>0)h+='<div class="ad-stat"><div class="ad-sv" style="color:#FFD60A">'+Math.round(totalW/wCnt)+'W</div><div class="ad-sl">\u26A1 Moc</div></div>';
    if(det.total_elevation_gain)h+='<div class="ad-stat"><div class="ad-sv" style="color:var(--g)">'+Math.round(det.total_elevation_gain)+'m</div><div class="ad-sl">\u26F0\uFE0F Przewyzszenie</div></div>';
    var standT=0;if(det.splits){det.splits.forEach(function(sp){if(sp.elapsed_time&&sp.moving_time)standT+=sp.elapsed_time-sp.moving_time})}
    if(standT>5)h+='<div class="ad-stat"><div class="ad-sv" style="color:var(--fg2)">'+Math.round(standT)+'s</div><div class="ad-sl">\u23F8 Pauzy</div></div>';
    if(det.calories)h+='<div class="ad-stat"><div class="ad-sv" style="color:var(--o)">'+det.calories+'</div><div class="ad-sl">\uD83D\uDD25 kcal</div></div>';
    if(det.suffer_score)h+='<div class="ad-stat"><div class="ad-sv" style="color:var(--r)">'+det.suffer_score+'</div><div class="ad-sl">\uD83D\uDCAA Effort</div></div>';
    h+='</div>';
    if(det.splits&&det.splits.length){
      var fastest=Infinity,slowest=0,fi=-1,si=-1;
      det.splits.forEach(function(sp,i){if(sp.moving_time>0&&sp.distance>500){var p=sp.moving_time/sp.distance*1000;if(p<fastest){fastest=p;fi=i}if(p>slowest){slowest=p;si=i}}});
      h+='<div class="ad-section"><div class="ad-title">\uD83C\uDFC3 Km Splits</div><table class="ad-splits"><thead><tr><th>Km</th><th>Tempo</th><th>GAP</th><th>HR</th><th>\u26A1W</th><th>Elev</th></tr></thead><tbody>';
      det.splits.forEach(function(sp,i){
        var pace=sp.moving_time>0?sp.moving_time/sp.distance*1000:0;var pStr=ActDetail._fmtPace(pace);
        var gap=sp.average_grade_adjusted_speed?ActDetail._speedToPace(sp.average_grade_adjusted_speed):'-';
        var cls=i===fi?' class="ad-split-fast"':i===si?' class="ad-split-slow"':'';
        var watts='-';if(det.laps){det.laps.forEach(function(lap){if(Math.abs(lap.distance-sp.distance)<200&&lap.average_watts)watts=Math.round(lap.average_watts)})}
        var pzClr=ActDetail.PZCLR[sp.pace_zone||0]||'';var pzStyle=pzClr?' style="border-left:3px solid '+pzClr+'"':'';
        h+='<tr'+cls+'><td'+pzStyle+'>'+(i+1)+'</td><td>'+pStr+'</td><td>'+gap+'</td><td>'+(sp.average_heartrate?Math.round(sp.average_heartrate):'-')+'</td><td>'+watts+'</td><td>'+(sp.elevation_difference!=null?sp.elevation_difference.toFixed(0)+'m':'-')+'</td></tr>';
      });h+='</tbody></table></div>';
    }
    if(det.laps&&det.laps.length>1){
      h+='<div class="ad-section"><div class="ad-title">\uD83D\uDCCD Laps (okrazenia z zegarka)</div><table class="ad-splits"><thead><tr><th>Lap</th><th>Dystans</th><th>Tempo</th><th>\u26A1W</th><th>HR</th><th>Max HR</th></tr></thead><tbody>';
      det.laps.forEach(function(lap,i){var lapPace=lap.moving_time>0&&lap.distance>0?lap.moving_time/lap.distance*1000:0;var pStr=ActDetail._fmtPace(lapPace);var watts=lap.average_watts?Math.round(lap.average_watts):'-';h+='<tr><td>'+(i+1)+'</td><td>'+(lap.distance/1000).toFixed(2)+'km</td><td>'+pStr+'</td><td>'+watts+'</td><td>'+(lap.average_heartrate?Math.round(lap.average_heartrate):'-')+'</td><td>'+(lap.max_heartrate||'-')+'</td></tr>'});
      h+='</tbody></table></div>';
      var hasW=det.laps.some(function(l){return l.average_watts>0});
      if(hasW)h+='<div class="ad-section"><div class="ad-title">\u26A1 Moc per Lap</div><canvas id="ad-pow-'+id+'"></canvas></div>';
    }
    var str=d.streams;var hasHR=!!this._s(str,'heartrate');var hasVel=!!this._s(str,'velocity_smooth');var hasAlt=!!this._s(str,'altitude');var hasGPS=!!this._s(str,'latlng');
    if(hasHR)h+='<div class="ad-section"><div class="ad-title">\u2764\uFE0F Tetno</div><canvas id="ad-hr-'+id+'"></canvas></div>';
    if(hasVel)h+='<div class="ad-section"><div class="ad-title">\uD83D\uDCC9 Tempo</div><canvas id="ad-pace-'+id+'"></canvas></div>';
    if(hasAlt)h+='<div class="ad-section"><div class="ad-title">\u26F0\uFE0F Profil wysokosci</div><canvas id="ad-alt-'+id+'"></canvas></div>';
    if(hasHR)h+='<div class="ad-section"><div class="ad-title">\uD83D\uDCCA Strefy HR</div><canvas id="ad-zones-'+id+'"></canvas></div>';
    if(hasGPS)h+='<div class="ad-section"><div class="ad-title">\uD83D\uDDFA\uFE0F Trasa</div><div id="ad-map-'+id+'" style="height:250px;border-radius:10px;z-index:1"></div></div>';
    return h;
  },
  drawCharts(sid){
    var d=this.getData(sid);if(!d||!d.streams)return;var str=d.streams;var det=d.detail;var id=sid;
    var dist=this._s(str,'distance');var hr=this._s(str,'heartrate');var vel=this._s(str,'velocity_smooth');var alt=this._s(str,'altitude');var latlng=this._s(str,'latlng');var time=this._s(str,'time');
    var distKm=dist?dist.map(function(d){return Math.round(d/10)/100}):null;
    var maxPts=300;var step=distKm?Math.max(1,Math.floor(distKm.length/maxPts)):1;
    var ds=function(arr){if(!arr)return[];var r=[];for(var i=0;i<arr.length;i+=step)r.push(arr[i]);return r};
    var dkm=ds(distKm);var labels=dkm.map(function(d){return d.toFixed(1)});
    if(det&&det.laps&&det.laps.some(function(l){return l.average_watts>0})){try{this._ch('ad-pow-'+id,{type:'bar',data:{labels:det.laps.map(function(l,i){return'L'+(i+1)}),datasets:[{data:det.laps.map(function(l){return l.average_watts||0}),backgroundColor:det.laps.map(function(l){var w=l.average_watts||0;return w>250?'#FF453A':w>200?'#FF9F0A':w>150?'#0A84FF':'#30D158'}),borderRadius:4}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#999'}},y:{ticks:{color:'#999',callback:function(v){return v+'W'}}}}}})}catch(e){console.warn('Power err',e)}}
    if(hr&&document.getElementById('ad-hr-'+id)){try{this._ch('ad-hr-'+id,{type:'line',data:{labels:labels,datasets:[{data:ds(hr),borderColor:'#FF453A',borderWidth:1.5,pointRadius:0,fill:false,tension:.3}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{x:{display:true,title:{display:true,text:'km',color:'#999'},ticks:{color:'#999',maxTicksLimit:8}},y:{title:{display:true,text:'bpm',color:'#999'},ticks:{color:'#999'}}}}})}catch(e){console.warn('HR err',e)}}
    if(vel&&document.getElementById('ad-pace-'+id)){try{var velDs=ds(vel);var paceData=velDs.map(function(v){return v>0?1000/v/60:0});this._ch('ad-pace-'+id,{type:'line',data:{labels:labels,datasets:[{data:paceData,borderColor:'#0A84FF',borderWidth:1.5,pointRadius:0,fill:true,backgroundColor:'rgba(10,132,255,.15)',tension:.3}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#999',maxTicksLimit:8}},y:{reverse:true,title:{display:true,text:'min/km',color:'#999'},ticks:{color:'#999',callback:function(v){var m=Math.floor(v);var s=Math.round((v-m)*60);return m+':'+String(s).padStart(2,'0')}}}}}})}catch(e){console.warn('Pace err',e)}}
    if(alt&&document.getElementById('ad-alt-'+id)){try{this._ch('ad-alt-'+id,{type:'line',data:{labels:labels,datasets:[{data:ds(alt),borderColor:'#64D2FF',borderWidth:1.5,pointRadius:0,fill:true,backgroundColor:'rgba(100,210,255,.2)',tension:.3}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#999',maxTicksLimit:8}},y:{title:{display:true,text:'m n.p.m.',color:'#999'},ticks:{color:'#999'}}}}})}catch(e){console.warn('Alt err',e)}}
    if(hr&&document.getElementById('ad-zones-'+id)){try{var zoneSec=this.ZONES.map(function(){return 0});var dt=time?time.map(function(t,i){return i>0?t-time[i-1]:1}):hr.map(function(){return 1});hr.forEach(function(v,i){for(var z=ActDetail.ZONES.length-1;z>=0;z--){if(v>=ActDetail.ZONES[z].min){zoneSec[z]+=(dt[i]||1);break}}});var total=zoneSec.reduce(function(a,b){return a+b},1);var pcts=zoneSec.map(function(s){return Math.round(s/total*100)});var mins=zoneSec.map(function(s){return Math.round(s/60)});this._ch('ad-zones-'+id,{type:'doughnut',data:{labels:ActDetail.ZONES.map(function(z,i){return z.name+' '+pcts[i]+'% ('+mins[i]+'min)'}),datasets:[{data:zoneSec,backgroundColor:ActDetail.ZONES.map(function(z){return z.color}),borderWidth:0}]},options:{responsive:true,plugins:{legend:{display:true,position:'bottom',labels:{color:'#ccc',font:{size:11},padding:8}}}}})}catch(e){console.warn('Zones err',e)}}
    if(latlng&&document.getElementById('ad-map-'+id)&&typeof L!=='undefined'){try{var mapEl=document.getElementById('ad-map-'+id);if(mapEl._leaflet_id){mapEl._leaflet_id=null;mapEl.innerHTML=''}var coords=latlng.filter(function(c){return c&&c.length===2});if(coords.length){var map=L.map('ad-map-'+id,{zoomControl:false,attributionControl:false});L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18}).addTo(map);var line=L.polyline(coords,{color:'#0A84FF',weight:3,opacity:.8}).addTo(map);map.fitBounds(line.getBounds(),{padding:[20,20]});L.circleMarker(coords[0],{radius:6,color:'#30D158',fillColor:'#30D158',fillOpacity:1}).addTo(map).bindPopup('Start');L.circleMarker(coords[coords.length-1],{radius:6,color:'#FF453A',fillColor:'#FF453A',fillOpacity:1}).addTo(map).bindPopup('Meta')}}catch(e){console.warn('Map err',e)}}
  }
};

/**
 * HM Tracker - activity-detail.js (Sprint 7 v4)
 * Laps + Splits + Power/GAP + Map + HR Zones in minutes
 */
var ActDetail = (function() {
  var _charts = {};
  function _destroy(key) {
    if (_charts[key]) {
      if (_charts[key].remove) _charts[key].remove();
      else if (_charts[key].destroy) _charts[key].destroy();
      delete _charts[key];
    }
  }

  var RHO = 1.225, CD = 0.9, FA = 0.5;

  function _weight() {
    var w = parseFloat(localStorage.getItem('hm_user_weight'));
    if (w && w > 0) return w;
    try { var s = S.getSettings(); if (s && s.weight) return s.weight; } catch(e) {}
    return 75;
  }
  function _maxHR() {
    var m = parseInt(localStorage.getItem('hm_user_max_hr'), 10);
    return (m && m > 100) ? m : 190;
  }
  function _sa(streams, key) {
    if (!streams || !streams[key]) return null;
    if (Array.isArray(streams[key])) return streams[key];
    if (streams[key].data && Array.isArray(streams[key].data)) return streams[key].data;
    return null;
  }
  function _findLog(sid) {
    var sidStr = String(sid);
    try {
      var logs = S.getAllLogs();
      var dates = Object.keys(logs);
      for (var i = 0; i < dates.length; i++) {
        var l = logs[dates[i]];
        if (l.strava_id && String(l.strava_id) == sidStr) return { log: l, date: dates[i] };
      }
    } catch(e) {}
    return null;
  }
  function _getData(sid) {
    var detail = null, streams = null, sidStr = String(sid);
    var dPre = ['strava_detail_','hm_strava_detail_','hm_detail_','detail_'];
    var sPre = ['strava_streams_','hm_strava_streams_','hm_streams_','streams_'];
    var i, raw;
    for (i = 0; i < dPre.length; i++) { raw = localStorage.getItem(dPre[i]+sidStr); if (raw) { try{detail=JSON.parse(raw);}catch(e){} break; } }
    for (i = 0; i < sPre.length; i++) { raw = localStorage.getItem(sPre[i]+sidStr); if (raw) { try{streams=JSON.parse(raw);}catch(e){} break; } }
    var found = _findLog(sid);
    return { detail: detail, streams: streams, log: found ? found.log : null, date: found ? found.date : null };
  }

  function _fmtPace(ms) {
    if (!ms || ms <= 0) return '--:--';
    var s = 1000/ms, m = Math.floor(s/60), sc = Math.round(s%60);
    return m + ':' + (sc<10?'0':'') + sc;
  }
  function _fmtTime(sec) {
    if (!sec || sec <= 0) return '0:00';
    var h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60), s = Math.round(sec%60);
    if (h > 0) return h + ':' + (m<10?'0':'') + m + ':' + (s<10?'0':'') + s;
    return m + ':' + (s<10?'0':'') + s;
  }
  function _paceToSec(p) { if(!p) return 0; var pp=p.split(':'); return(+pp[0])*60+(+pp[1]||0); }

  function _minettiCost(gr) {
    return 155.4*Math.pow(gr,5)-30.4*Math.pow(gr,4)-43.3*Math.pow(gr,3)+46.3*Math.pow(gr,2)+19.5*gr+3.6;
  }
  function _calcPower(v, grade, mass) {
    var c = _minettiCost(grade);
    return Math.max(0, c*mass*v*0.25 + 0.5*RHO*CD*FA*Math.pow(v,3));
  }
  function _powerStream(str) {
    var vel=_sa(str,'velocity_smooth'), alt=_sa(str,'altitude'), tm=_sa(str,'time'), dst=_sa(str,'distance');
    if (!vel||!alt||!tm||vel.length<3) return null;
    var mass=_weight(), n=vel.length, pw=[], i;
    for (i=0;i<n;i++) pw.push(0);
    for (i=1;i<n-1;i++) {
      var dd=(dst?dst[i+1]-dst[i-1]:vel[i]*(tm[i+1]-tm[i-1]))||1;
      var gr=(alt[i+1]-alt[i-1])/Math.max(dd,0.1);
      gr=Math.max(-0.5,Math.min(0.5,gr));
      pw[i]=_calcPower(vel[i],gr,mass);
    }
    pw[0]=pw[1]; pw[n-1]=pw[n-2]; return pw;
  }
  function _normalizedPower(pw,tm) {
    if(!pw||pw.length<30||!tm) return null;
    var r=[],ws=0,wS=0,wC=0,i;
    for(i=0;i<pw.length;i++){wS+=pw[i];wC++;while(tm[i]-tm[ws]>30){wS-=pw[ws];wC--;ws++;}if(wC>0)r.push(wS/wC);}
    if(!r.length)return null;
    var a4=0; for(i=0;i<r.length;i++)a4+=Math.pow(r[i],4); a4/=r.length;
    return Math.pow(a4,0.25);
  }
  function _gapSpeed(v,gr){var cf=_minettiCost(0),cg=_minettiCost(gr);return(cf>0&&cg>0)?v*(cg/cf):v;}
  function _gapStream(str) {
    var vel=_sa(str,'velocity_smooth'),alt=_sa(str,'altitude'),dst=_sa(str,'distance'),tm=_sa(str,'time');
    if(!vel||!alt||vel.length<3) return null;
    var n=vel.length,g=[],i;
    for(i=0;i<n;i++)g.push(0);
    for(i=1;i<n-1;i++){var dd=(dst?dst[i+1]-dst[i-1]:vel[i]*(tm[i+1]-tm[i-1]))||1;var gr2=(alt[i+1]-alt[i-1])/Math.max(dd,0.1);gr2=Math.max(-0.5,Math.min(0.5,gr2));g[i]=_gapSpeed(vel[i],gr2);}
    g[0]=g[1];g[n-1]=g[n-2];return g;
  }

  function _buildLaps(detail) {
    var laps=[];
    if(!detail||!detail.laps||detail.laps.length===0) return laps;
    for(var i=0;i<detail.laps.length;i++){
      var lp=detail.laps[i];
      laps.push({i:i+1,name:lp.name||('Lap '+(i+1)),dist:lp.distance||0,time:lp.moving_time||lp.elapsed_time||0,
        pace:_fmtPace(lp.average_speed),hr:lp.average_heartrate?Math.round(lp.average_heartrate):'--',
        pwr:lp.average_watts?Math.round(lp.average_watts):'--',elev:lp.total_elevation_gain?Math.round(lp.total_elevation_gain):0,
        pSec:lp.average_speed>0?1000/lp.average_speed:9999});
    }
    return laps;
  }
  function _buildSplits(detail,streams,pwStream) {
    var splits=[];
    if(!detail||!detail.splits||detail.splits.length===0) return splits;
    var hrD=_sa(streams,'heartrate'),altD=_sa(streams,'altitude'),dstD=_sa(streams,'distance');
    for(var idx=0;idx<detail.splits.length;idx++){
      var sp=detail.splits[idx];
      var avgSpd=sp.average_speed||(sp.distance/sp.moving_time);
      var gapSpd=sp.average_grade_adjusted_speed||avgSpd;
      var eg=0,el2=0,pS=0,pC=0;
      if(dstD&&pwStream){var ls=0;for(var k=0;k<idx;k++)ls+=detail.splits[k].distance;var le=ls+sp.distance;
        for(var j=0;j<dstD.length;j++){if(dstD[j]>=ls&&dstD[j]<=le){if(pwStream[j]){pS+=pwStream[j];pC++;}
          if(altD&&j>0&&dstD[j-1]>=ls){var da=altD[j]-altD[j-1];if(da>0)eg+=da;else el2+=Math.abs(da);}}}}
      splits.push({i:idx+1,dist:sp.distance,time:sp.moving_time,pace:_fmtPace(avgSpd),gap:_fmtPace(gapSpd),
        hr:sp.average_heartrate?Math.round(sp.average_heartrate):'--',pwr:pC>0?Math.round(pS/pC):'--',
        eg:Math.round(eg),el:Math.round(el2),pSec:avgSpd>0?1000/avgSpd:9999,gSec:gapSpd>0?1000/gapSpd:9999});
    }
    return splits;
  }
  function _paceColor(sec,mn,mx){var r=mx-mn||1;var ratio=Math.max(0,Math.min(1,(sec-mn)/r));return 'rgb('+Math.round(255*ratio)+','+Math.round(255*(1-ratio))+',60)';}
  function _hrZones(){var mx=_maxHR();return[
    {n:'Z1 Recovery',mn:0,mx:mx*0.60,c:'rgba(150,150,150,0.35)'},
    {n:'Z2 Easy',mn:mx*0.60,mx:mx*0.70,c:'rgba(86,180,233,0.35)'},
    {n:'Z3 Aerobic',mn:mx*0.70,mx:mx*0.80,c:'rgba(0,158,115,0.35)'},
    {n:'Z4 Threshold',mn:mx*0.80,mx:mx*0.90,c:'rgba(240,228,66,0.35)'},
    {n:'Z5 Max',mn:mx*0.90,mx:mx*1.00,c:'rgba(213,94,0,0.35)'}];}

  // ======== render ========
  function render(sid) {
    var data=_getData(sid); var det=data.detail,str=data.streams,log=data.log;
    if(!det&&!log) return '<div class="empty">Brak danych szczegolowych. Zsynchronizuj Strave.</div>';
    var pwStr=str?_powerStream(str):null;
    var gapStr=str?_gapStream(str):null;
    var laps=_buildLaps(det);
    var splits=_buildSplits(det,str,pwStr);
    var distKm=log&&log.distance?parseFloat(log.distance):0;
    var paceStr=log&&log.pace?log.pace:'--:--';
    var avgHR=log&&log.hr?log.hr:'--';
    var elev=det&&det.total_elevation_gain?Math.round(det.total_elevation_gain):0;
    var movTime=0;
    if(det&&det.splits){for(var si=0;si<det.splits.length;si++)movTime+=(det.splits[si].moving_time||0);}
    var durStr=_fmtTime(movTime);
    var avgPwr='--',maxPwr='--',normPwr='--';
    if(pwStr){var pSum=0,pMax=0;for(var pi=0;pi<pwStr.length;pi++){pSum+=pwStr[pi];if(pwStr[pi]>pMax)pMax=pwStr[pi];}
      avgPwr=Math.round(pSum/pwStr.length);maxPwr=Math.round(pMax);
      var np=_normalizedPower(pwStr,_sa(str,'time'));normPwr=np?Math.round(np):'--';}
    var overallGAP='--';
    if(gapStr){var gSum=0;for(var gi=0;gi<gapStr.length;gi++)gSum+=gapStr[gi];overallGAP=_fmtPace(gSum/gapStr.length);}

    var h='<div class="detail-summary"><div class="stat-grid">';
    h+='<div class="stat"><span class="stat-label">Dystans</span><span class="stat-value">'+distKm.toFixed(1)+' km</span></div>';
    h+='<div class="stat"><span class="stat-label">Czas</span><span class="stat-value">'+durStr+'</span></div>';
    h+='<div class="stat"><span class="stat-label">Tempo</span><span class="stat-value">'+paceStr+' /km</span></div>';
    h+='<div class="stat"><span class="stat-label">GAP</span><span class="stat-value">'+overallGAP+' /km</span></div>';
    h+='<div class="stat"><span class="stat-label">Avg HR</span><span class="stat-value">'+avgHR+' bpm</span></div>';
    h+='<div class="stat"><span class="stat-label">Przewyzszenie</span><span class="stat-value">'+elev+' m</span></div>';
    h+='<div class="stat"><span class="stat-label">Avg Power</span><span class="stat-value">'+avgPwr+' W</span></div>';
    h+='<div class="stat"><span class="stat-label">Norm Power</span><span class="stat-value">'+normPwr+' W</span></div>';
    h+='<div class="stat"><span class="stat-label">Max Power</span><span class="stat-value">'+maxPwr+' W</span></div>';
    h+='</div></div>';

    // Laps table
    if(laps.length>0){var lpA=[];for(var li=0;li<laps.length;li++)lpA.push(laps[li].pSec);
      var lmn=Math.min.apply(null,lpA),lmx=Math.max.apply(null,lpA);
      h+='<div class="table-section"><h3>Okrazenia (segmenty treningu)</h3>';
      h+='<table class="laps-table"><thead><tr><th>#</th><th>Nazwa</th><th>Dyst</th><th>Czas</th><th>Tempo</th><th>HR</th><th>Moc</th><th>Elev</th></tr></thead><tbody>';
      for(var ti=0;ti<laps.length;ti++){var ll=laps[ti];var bg=_paceColor(ll.pSec,lmn,lmx);
        h+='<tr style="background:'+bg+'22"><td>'+ll.i+'</td><td>'+ll.name+'</td><td>'+(ll.dist/1000).toFixed(2)+'</td><td>'+_fmtTime(ll.time)+'</td><td><strong>'+ll.pace+'</strong></td><td>'+ll.hr+'</td><td>'+(ll.pwr!=='--'?ll.pwr+'W':'--')+'</td><td>+'+ll.elev+'m</td></tr>';}
      h+='</tbody></table></div>';}

    // Splits table
    if(splits.length>0){var spA=[];for(var si2=0;si2<splits.length;si2++)spA.push(splits[si2].gSec);
      var smn=Math.min.apply(null,spA),smx=Math.max.apply(null,spA);
      h+='<div class="table-section"><h3>Splity (per km)</h3>';
      h+='<table class="laps-table"><thead><tr><th>Km</th><th>Dyst</th><th>Czas</th><th>Tempo</th><th>GAP</th><th>HR</th><th>Moc</th><th>&#8593;</th><th>&#8595;</th></tr></thead><tbody>';
      for(var si3=0;si3<splits.length;si3++){var sp=splits[si3];var bg2=_paceColor(sp.gSec,smn,smx);
        h+='<tr style="background:'+bg2+'22"><td>'+sp.i+'</td><td>'+(sp.dist/1000).toFixed(2)+'</td><td>'+_fmtTime(sp.time)+'</td><td>'+sp.pace+'</td><td><strong>'+sp.gap+'</strong></td><td>'+sp.hr+'</td><td>'+(sp.pwr!=='--'?sp.pwr+'W':'--')+'</td><td>+'+sp.eg+'m</td><td>-'+sp.el+'m</td></tr>';}
      h+='</tbody></table></div>';}

    // Map container
    var latlng=_sa(str,'latlng');
    if(latlng&&latlng.length>2)
      h+='<div class="chart-section"><h3>Mapa trasy</h3><div id="ad-map-'+sid+'" style="height:250px;border-radius:8px;z-index:1"></div></div>';

    // Chart containers
    var hrArr=_sa(str,'heartrate'),dstArr=_sa(str,'distance');
    var hasHR=hrArr&&hrArr.length>0,hasDst=dstArr&&dstArr.length>0;
    if(hasHR&&hasDst) h+='<div class="chart-section"><h3>Tetno</h3><canvas id="ad-hr-'+sid+'"></canvas></div>';
    if(pwStr&&hasDst) h+='<div class="chart-section"><h3>Moc biegowa</h3><canvas id="ad-pwr-'+sid+'"></canvas></div>';
    if(splits.length>0) h+='<div class="chart-section"><h3>Tempo vs GAP</h3><canvas id="ad-gap-'+sid+'"></canvas></div>';
    if(hasHR) h+='<div class="chart-section"><h3>Strefy HR</h3><canvas id="ad-zone-'+sid+'"></canvas></div>';
    return h;
  }

  // ======== drawCharts ========
  function drawCharts(sid) {
    var data=_getData(sid); var str=data.streams,det=data.detail;
    if(!str) return;
    var hrD=_sa(str,'heartrate'),dstD=_sa(str,'distance'),tmD=_sa(str,'time');
    var pwStr=_powerStream(str);
    var splits=_buildSplits(det,str,pwStr);
    var i,key,cv,labels;

    // 1. HR chart
    if(hrD&&hrD.length&&dstD){
      key='ad-hr-'+sid; _destroy(key); cv=document.getElementById(key);
      if(cv){labels=[];for(i=0;i<dstD.length;i++)labels.push((dstD[i]/1000).toFixed(1));
        var zones=_hrZones();var hrMin=hrD[0],hrMax=hrD[0];
        for(i=1;i<hrD.length;i++){if(hrD[i]<hrMin)hrMin=hrD[i];if(hrD[i]>hrMax)hrMax=hrD[i];}
        var zP={id:'hrZB'+sid,beforeDraw:function(chart){var ctx2=chart.ctx,ca=chart.chartArea,yS=chart.scales.y;
          for(var zi=0;zi<zones.length;zi++){var yt=yS.getPixelForValue(Math.min(zones[zi].mx,yS.max)),yb=yS.getPixelForValue(Math.max(zones[zi].mn,yS.min));
            ctx2.fillStyle=zones[zi].c;ctx2.fillRect(ca.left,yt,ca.right-ca.left,yb-yt);}}};
        _charts[key]=new Chart(cv.getContext('2d'),{type:'line',
          data:{labels:labels,datasets:[{label:'HR (bpm)',data:hrD,borderColor:'rgba(213,94,0,0.9)',backgroundColor:'rgba(213,94,0,0.1)',fill:true,pointRadius:0,borderWidth:1.5,tension:0.3}]},
          options:{responsive:true,plugins:{legend:{display:false}},scales:{x:{title:{display:true,text:'km'},ticks:{maxTicksLimit:12}},y:{title:{display:true,text:'bpm'},min:hrMin-10,max:hrMax+10}}},
          plugins:[zP]});}}

    // 2. Power chart
    if(pwStr&&dstD){key='ad-pwr-'+sid;_destroy(key);cv=document.getElementById(key);
      if(cv){var smooth=[];for(i=0;i<pwStr.length;i++){var s1=Math.max(0,i-5),e1=Math.min(pwStr.length,i+5),sm=0;for(var j=s1;j<e1;j++)sm+=pwStr[j];smooth.push(Math.round(sm/(e1-s1)));}
        labels=[];for(i=0;i<dstD.length;i++)labels.push((dstD[i]/1000).toFixed(1));
        _charts[key]=new Chart(cv.getContext('2d'),{type:'line',
          data:{labels:labels,datasets:[{label:'Moc (W)',data:smooth,borderColor:'rgba(120,60,200,0.9)',backgroundColor:'rgba(120,60,200,0.1)',fill:true,pointRadius:0,borderWidth:1.5,tension:0.3}]},
          options:{responsive:true,plugins:{legend:{display:false}},scales:{x:{title:{display:true,text:'km'},ticks:{maxTicksLimit:12}},y:{title:{display:true,text:'W'},beginAtZero:true}}}});}}

    // 3. Pace vs GAP bar
    if(splits.length>0){key='ad-gap-'+sid;_destroy(key);cv=document.getElementById(key);
      if(cv){var gL=[],gP=[],gG=[];for(i=0;i<splits.length;i++){gL.push('Km '+splits[i].i);gP.push(splits[i].pSec);gG.push(splits[i].gSec);}
        _charts[key]=new Chart(cv.getContext('2d'),{type:'bar',
          data:{labels:gL,datasets:[{label:'Tempo',data:gP,backgroundColor:'rgba(86,180,233,0.7)'},{label:'GAP',data:gG,backgroundColor:'rgba(230,159,0,0.7)'}]},
          options:{responsive:true,plugins:{tooltip:{callbacks:{label:function(ctx){var v=ctx.raw,m=Math.floor(v/60),s=Math.round(v%60);return ctx.dataset.label+': '+m+':'+(s<10?'0':'')+s+'/km';}}}},
            scales:{x:{title:{display:true,text:'Split'}},y:{title:{display:true,text:'s/km'},reverse:true,ticks:{callback:function(v){var m=Math.floor(v/60),s=Math.round(v%60);return m+':'+(s<10?'0':'')+s;}}}}}});}}

    // 4. HR Zone donut - TIME IN MINUTES
    if(hrD&&hrD.length&&tmD){
      key='ad-zone-'+sid;_destroy(key);cv=document.getElementById(key);
      if(cv){var zones2=_hrZones();var secZ=[0,0,0,0,0];
        for(i=1;i<hrD.length;i++){var dt=tmD[i]-tmD[i-1];if(dt<0||dt>60)dt=1;
          for(var z=zones2.length-1;z>=0;z--){if(hrD[i]>=zones2[z].mn){secZ[z]+=dt;break;}}}
        var totalSec=0;for(i=0;i<secZ.length;i++)totalSec+=secZ[i];
        if(totalSec===0)totalSec=1;
        var minZ=[],zLb=[],zCl=[];
        for(i=0;i<zones2.length;i++){
          minZ.push(Math.round(secZ[i]/6)/10);
          var pct=((secZ[i]/totalSec)*100).toFixed(1);
          zLb.push(zones2[i].n+' ('+pct+'%) - '+minZ[i]+' min');
          zCl.push(zones2[i].c.replace('0.35','0.75'));}
        _charts[key]=new Chart(cv.getContext('2d'),{type:'doughnut',
          data:{labels:zLb,datasets:[{data:minZ,backgroundColor:zCl}]},
          options:{responsive:true,plugins:{legend:{position:'bottom'},
            tooltip:{callbacks:{label:function(ctx){return ctx.label;}}}}}});}}

    // 5. Map
    var latlng=_sa(str,'latlng');
    if(latlng&&latlng.length>2&&typeof L!=='undefined'){
      key='ad-map-'+sid;_destroy(key);
      var mapDiv=document.getElementById(key);
      if(mapDiv){
        var map=L.map(mapDiv,{zoomControl:true,attributionControl:false});
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{maxZoom:19}).addTo(map);
        var coords=[];for(i=0;i<latlng.length;i++){if(latlng[i]&&latlng[i].length===2)coords.push(latlng[i]);}
        if(coords.length>1){var line=L.polyline(coords,{color:'#e94560',weight:3,opacity:0.9}).addTo(map);
          map.fitBounds(line.getBounds(),{padding:[20,20]});
          L.circleMarker(coords[0],{radius:6,color:'#30D158',fillColor:'#30D158',fillOpacity:1}).addTo(map).bindPopup('Start');
          L.circleMarker(coords[coords.length-1],{radius:6,color:'#FF453A',fillColor:'#FF453A',fillOpacity:1}).addTo(map).bindPopup('Meta');}
        _charts[key]=map;}}
  }

  return { render: render, drawCharts: drawCharts };
})();

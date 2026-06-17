/* health-history.js */
var HealthHistory=(function(){"use strict";
function bar(vals,colors,labels,title,w,h){
  if(!vals||vals.length===0)return"";w=w||320;h=h||180;
  var pt=30,pr=10,pb=40,pl=40,cw=w-pl-pr,ch=h-pt-pb;
  var maxV=Math.max.apply(null,vals.map(function(v){return Array.isArray(v)?v.reduce(function(a,b){return a+b;},0):v;}))||1;
  var bW=Math.max(8,Math.min(28,cw/vals.length-4)),gap=(cw-bW*vals.length)/(vals.length+1);
  var s='<svg viewBox="0 0 '+w+' '+h+'" style="width:100%;max-width:'+w+'px;height:auto;">';
  s+='<text x="'+w/2+'" y="16" text-anchor="middle" fill="#d1d5db" font-size="12">'+title+'</text>';
  for(var yi=0;yi<=4;yi++){var yy=pt+ch-ch*(yi/4);s+='<line x1="'+pl+'" y1="'+yy+'" x2="'+(w-pr)+'" y2="'+yy+'" stroke="#374151" stroke-width="0.5"/>';s+='<text x="'+(pl-4)+'" y="'+(yy+3)+'" text-anchor="end" fill="#6b7280" font-size="9">'+Math.round(maxV*yi/4)+'</text>';}
  for(var i=0;i<vals.length;i++){var x=pl+gap+(bW+gap)*i;
    if(Array.isArray(vals[i])){var cumY=0;for(var si=vals[i].length-1;si>=0;si--){var segH=vals[i][si]/maxV*ch;s+='<rect x="'+x+'" y="'+(pt+ch-cumY-segH)+'" width="'+bW+'" height="'+Math.max(1,segH)+'" rx="2" fill="'+(colors[si]||"#3b82f6")+'" opacity="0.85"/>';cumY+=segH;}}
    else{var bh=vals[i]/maxV*ch;s+='<rect x="'+x+'" y="'+(pt+ch-bh)+'" width="'+bW+'" height="'+Math.max(1,bh)+'" rx="2" fill="'+(typeof colors==="string"?colors:(colors[i%colors.length]))+'" opacity="0.85"/>';}
    if(labels&&labels[i])s+='<text x="'+(x+bW/2)+'" y="'+(h-pb+14)+'" text-anchor="middle" fill="#9ca3af" font-size="8" transform="rotate(-45,'+(x+bW/2)+','+(h-pb+14)+')">'+labels[i]+'</text>';
  }
  s+='</svg>';return s;
}
function render(containerId){
  var c=document.getElementById(containerId);if(!c)return;
  if(typeof HealthImport==="undefined"){c.innerHTML="<p>HealthImport not loaded</p>";return;}
  var hist=HealthImport.getHistory(30);if(hist.length===0){c.innerHTML="<p style='color:#9ca3af;text-align:center;padding:20px;'>Brak danych.</p>";return;}
  hist.reverse();var html="<div style='padding:0 4px;'>";
  // Sleep Score today
  if(typeof HealthScore!=="undefined"){var td=HealthImport.getToday();if(td){var ss=HealthScore.sleepScore(td);if(ss){
    var scol=ss.score>=85?"#22c55e":ss.score>=70?"#84cc16":ss.score>=50?"#f59e0b":"#ef4444";
    html+="<div style='background:#1f2937;border-radius:12px;padding:16px;margin:8px 0;'><h3 style='color:#f9fafb;margin:0 0 8px;'>Sleep Score (dzis)</h3>";
    html+="<div style='text-align:center;margin:8px 0;'><div style='display:inline-block;width:70px;height:70px;border-radius:50%;border:4px solid "+scol+";line-height:70px;font-size:24px;font-weight:700;color:"+scol+";'>"+ss.score+"</div><div style='color:#d1d5db;margin-top:4px;'>"+ss.label+"</div></div>";
    ss.factors.forEach(function(f){var pct=f.max?Math.round(f.pts/f.max*100):0;var bc=pct>=80?"#22c55e":pct>=50?"#f59e0b":"#ef4444";
      html+="<div style='margin:4px 0;'><div style='display:flex;justify-content:space-between;color:#d1d5db;font-size:0.85em;'><span>"+f.name+": "+f.val+"</span><span>"+f.pts+"/"+f.max+"</span></div><div style='background:#374151;border-radius:4px;height:6px;margin-top:2px;'><div style='background:"+bc+";height:6px;border-radius:4px;width:"+pct+"%;'></div></div></div>";});
    if(ss.missing.length>0){html+="<div style='margin-top:8px;padding:8px;background:#1e1b4b;border-radius:6px;'><p style='color:#a5b4fc;font-size:0.8em;margin:0;'>Brakujace dane:</p>";ss.missing.forEach(function(m){html+="<p style='color:#818cf8;font-size:0.8em;margin:2px 0;'>- "+m+"</p>";});html+="</div>";}
    html+="</div>";}}}
  // Chart: Sleep stacked
  var sS=[],sL=[];hist.forEach(function(h){if(h.sleepMin){var d=h.deepMin||0,r=h.remMin||0,co=h.coreMin||0;if(d||r||co)sS.push([co,d,r]);else sS.push([h.sleepMin]);sL.push(h.date?h.date.slice(5):"");}});
  if(sS.length>0){html+="<div style='background:#1f2937;border-radius:12px;padding:16px;margin:8px 0;'>"+bar(sS,["#60a5fa","#8b5cf6","#f472b6"],sL,"Sen (Core/Deep/REM) min",340,200)+"<div style='display:flex;gap:12px;justify-content:center;margin-top:6px;'><span style='color:#60a5fa;font-size:0.75em;'>Core</span><span style='color:#8b5cf6;font-size:0.75em;'>Deep</span><span style='color:#f472b6;font-size:0.75em;'>REM</span></div></div>";}
  // Chart: RHR
  var rV=[],rL=[];hist.forEach(function(h){if(h.rhr){rV.push(h.rhr);rL.push(h.date?h.date.slice(5):"");}});
  if(rV.length>0){html+="<div style='background:#1f2937;border-radius:12px;padding:16px;margin:8px 0;'>"+bar(rV,"#ef4444",rL,"RHR (bpm)",340,180)+"</div>";}
  // Chart: HRV
  var hV=[],hL=[];hist.forEach(function(h){if(h.hrv){hV.push(h.hrv);hL.push(h.date?h.date.slice(5):"");}});
  if(hV.length>0){html+="<div style='background:#1f2937;border-radius:12px;padding:16px;margin:8px 0;'>"+bar(hV,"#22c55e",hL,"HRV (ms)",340,180)+"</div>";}
  // Chart: Sleep Score trend
  if(typeof HealthScore!=="undefined"){var ssV=[],ssL=[],ssC=[];hist.forEach(function(h){var s=HealthScore.sleepScore(h);if(s){ssV.push(s.score);ssL.push(h.date?h.date.slice(5):"");ssC.push(s.score>=85?"#22c55e":s.score>=70?"#84cc16":s.score>=50?"#f59e0b":"#ef4444");}});
  if(ssV.length>0){html+="<div style='background:#1f2937;border-radius:12px;padding:16px;margin:8px 0;'>"+bar(ssV,ssC,ssL,"Sleep Score (trend)",340,180)+"</div>";}}
  // Table
  html+="<div style='background:#1f2937;border-radius:12px;padding:12px;margin:8px 0;overflow-x:auto;'><h3 style='color:#f9fafb;margin:0 0 8px;'>Historia</h3><table style='width:100%;border-collapse:collapse;font-size:0.75em;color:#d1d5db;'><tr style='border-bottom:1px solid #374151;'><th style='padding:4px;text-align:left;'>Data</th><th>Sen</th><th>Deep</th><th>REM</th><th>RHR</th><th>HRV</th><th>Score</th></tr>";
  var dH=hist.slice().reverse();dH.forEach(function(h){var ss2=typeof HealthScore!=="undefined"?HealthScore.sleepScore(h):null;var sc2=ss2?(ss2.score>=70?"#22c55e":ss2.score>=50?"#f59e0b":"#ef4444"):"#6b7280";
    html+="<tr style='border-bottom:1px solid #1f2937;'><td style='padding:4px;'>"+((h.date||"").slice(5))+"</td><td style='text-align:center;'>"+(h.sleepMin?(h.sleepMin/60).toFixed(1)+"h":"-")+"</td><td style='text-align:center;'>"+(h.deepMin?h.deepMin+"m":"-")+"</td><td style='text-align:center;'>"+(h.remMin?h.remMin+"m":"-")+"</td><td style='text-align:center;'>"+(h.rhr||"-")+"</td><td style='text-align:center;'>"+(h.hrv||"-")+"</td><td style='text-align:center;color:"+sc2+";font-weight:600;'>"+(ss2?ss2.score:"-")+"</td></tr>";});
  html+="</table></div></div>";c.innerHTML=html;
}
return{render:render};
})();

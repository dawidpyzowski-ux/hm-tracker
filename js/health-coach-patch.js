
/* health-coach-patch.js v3 - Trends + Alerts + Readiness + Sleep Score */
(function(){"use strict";var TAG="[HealthPatch]";
if(typeof Briefing!=="undefined"&&Briefing.render){
var origR=Briefing.render;
Briefing.render=async function(id){await origR.call(Briefing,id);var c=document.getElementById(id);if(!c)return;
if(typeof HealthScore!=="undefined"&&typeof HealthImport!=="undefined"){
var readiness=HealthScore.getReadiness();
if(readiness){
var card=document.createElement("div");card.className="briefing-card briefing-health";
var col=readiness.score>=80?"#22c55e":readiness.score>=65?"#84cc16":readiness.score>=45?"#f59e0b":readiness.score>=30?"#f97316":"#ef4444";
var h="<h3 class='briefing-card-title'>Gotowosc (Health)</h3>";
h+="<div style='display:flex;gap:16px;align-items:center;justify-content:center;margin:8px 0;'>";
h+="<div style='text-align:center;'><div style='display:inline-block;width:70px;height:70px;border-radius:50%;border:4px solid "+col+";line-height:70px;font-size:24px;font-weight:700;color:"+col+";'>"+readiness.score+"</div><div style='color:#9ca3af;font-size:0.7em;margin-top:2px;'>Gotowosc</div></div>";
var ss=HealthScore.getTodaySleepScore();
if(ss){var scol=ss.score>=85?"#22c55e":ss.score>=70?"#84cc16":ss.score>=50?"#f59e0b":"#ef4444";
h+="<div style='text-align:center;'><div style='display:inline-block;width:70px;height:70px;border-radius:50%;border:4px solid "+scol+";line-height:70px;font-size:24px;font-weight:700;color:"+scol+";'>"+ss.score+"</div><div style='color:#9ca3af;font-size:0.7em;margin-top:2px;'>Sen</div></div>";}
h+="</div>";
h+="<div style='color:#d1d5db;font-size:0.85em;text-align:center;margin:4px 0;'>"+readiness.recommendation+"</div>";
h+="<div style='margin:6px 0;'>";
readiness.factors.forEach(function(f){var fc=f.pts>0?"#22c55e":f.pts<0?"#ef4444":"#6b7280";h+="<div style='display:flex;justify-content:space-between;padding:2px 0;border-bottom:1px solid #374151;font-size:0.82em;'><span style='color:#d1d5db;'>"+f.name+": "+f.val+"</span><span style='color:"+fc+";font-weight:600;'>"+(f.pts>0?"+":"")+f.pts+"</span></div>";});
h+="</div>";
if(readiness.warnings.length>0)readiness.warnings.forEach(function(w){h+="<p style='background:#450a0a;color:#fca5a5;padding:5px 8px;border-radius:6px;margin:3px 0;font-size:0.8em;'>"+w+"</p>";});
if(ss&&ss.missing&&ss.missing.length>0){h+="<div style='background:#1e1b4b;border-radius:6px;padding:6px 8px;margin:6px 0;'><p style='color:#a5b4fc;font-size:0.75em;margin:0;'>Brakujace dane:</p>";ss.missing.forEach(function(m){h+="<p style='color:#818cf8;font-size:0.75em;margin:1px 0;'>- "+m+"</p>";});h+="</div>";}
if(typeof HealthTrends!=="undefined"){
var ta=HealthTrends.analyze(14);
if(ta&&ta.trends){
var tr=ta.trends;
h+="<div style='margin-top:10px;padding-top:8px;border-top:1px solid #374151;'>";
h+="<h4 style='color:#d1d5db;margin:0 0 6px;font-size:0.85em;'>Trendy (14 dni)</h4>";
h+="<div style='display:flex;gap:6px;flex-wrap:wrap;justify-content:center;'>";
if(tr.rhr&&tr.rhr.data.mean){h+="<div style='background:#1f2937;border-radius:8px;padding:6px 10px;text-align:center;'><div style='font-size:1.1em;color:"+(tr.rhr.good?"#22c55e":"#ef4444")+";'>"+tr.rhr.arrow+"</div><div style='color:#9ca3af;font-size:0.7em;'>RHR</div></div>";}
if(tr.hrv&&tr.hrv.data.mean){h+="<div style='background:#1f2937;border-radius:8px;padding:6px 10px;text-align:center;'><div style='font-size:1.1em;color:"+(tr.hrv.good?"#22c55e":"#ef4444")+";'>"+tr.hrv.arrow+"</div><div style='color:#9ca3af;font-size:0.7em;'>HRV</div></div>";}
if(tr.sleep&&tr.sleep.data.mean){h+="<div style='background:#1f2937;border-radius:8px;padding:6px 10px;text-align:center;'><div style='font-size:1.1em;color:"+(tr.sleep.good?"#22c55e":"#ef4444")+";'>"+tr.sleep.arrow+"</div><div style='color:#9ca3af;font-size:0.7em;'>Sen</div></div>";}
if(tr.deep&&tr.deep.data.mean){h+="<div style='background:#1f2937;border-radius:8px;padding:6px 10px;text-align:center;'><div style='font-size:1.1em;color:"+(tr.deep.good?"#22c55e":"#ef4444")+";'>"+tr.deep.arrow+"</div><div style='color:#9ca3af;font-size:0.7em;'>Deep</div></div>";}
h+="</div>";
if(ta.alerts&&ta.alerts.length>0){
h+="<div style='margin-top:8px;'>";
ta.alerts.forEach(function(a){
  var bg=a.type==="danger"?"#450a0a":a.type==="warning"?"#451a03":a.type==="positive"?"#052e16":"#1e1b4b";
  var fg=a.type==="danger"?"#fca5a5":a.type==="warning"?"#fde68a":a.type==="positive"?"#86efac":"#a5b4fc";
  h+="<div style='background:"+bg+";color:"+fg+";padding:6px 8px;border-radius:6px;margin:3px 0;font-size:0.8em;'>"+a.msg+"</div>";
});
h+="</div>";}
h+="</div>";
}}
h+="<div style='margin-top:10px;text-align:center;'><div id='health-hist-box'></div></div>";
card.innerHTML=h;
var btn=document.createElement("button");
btn.textContent="Pokaz historie";
btn.style.cssText="padding:8px 16px;border-radius:6px;background:#1f2937;border:1px solid #4b5563;color:#60a5fa;font-size:0.85em;cursor:pointer;margin-top:6px;";
btn.addEventListener("click",function(){var hc=document.getElementById("health-hist-box");if(hc.innerHTML){hc.innerHTML="";}else{HealthHistory.render("health-hist-box");}});
card.appendChild(btn);
var cc=c.querySelector(".briefing-coach");if(cc&&cc.nextSibling)c.insertBefore(card,cc.nextSibling);else c.appendChild(card);
}else{
var pr=document.createElement("div");pr.className="briefing-card briefing-health";
pr.innerHTML="<h3 class='briefing-card-title'>Poranny Check-in</h3><p style='color:#9ca3af;text-align:center;padding:8px;'>Brak danych na dzis</p><div id='health-form-brief'></div>";
var cc2=c.querySelector(".briefing-coach");if(cc2&&cc2.nextSibling)c.insertBefore(pr,cc2.nextSibling);else c.appendChild(pr);
HealthImport.renderForm("health-form-brief");
}}};console.log(TAG,"Briefing patched v3 + trends");}
console.log(TAG,"Init OK v3");
})();

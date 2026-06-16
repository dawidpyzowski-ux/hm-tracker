/* health-coach-patch.js - Sprint 13: Patches Briefing with health readiness */
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
h+="<div style='text-align:center;margin:8px 0;'><div style='display:inline-block;width:80px;height:80px;border-radius:50%;border:4px solid "+col+";line-height:80px;font-size:28px;font-weight:700;color:"+col+";'>"+readiness.score+"</div>";
h+="<div style='color:#d1d5db;font-size:0.85em;margin-top:4px;'>"+readiness.recommendation+"</div></div>";
h+="<div style='margin:8px 0;'>";
readiness.factors.forEach(function(f){var fc=f.pts>0?"#22c55e":f.pts<0?"#ef4444":"#6b7280";h+="<div style='display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid #374151;'><span style='color:#d1d5db;'>"+f.name+": "+f.val+"</span><span style='color:"+fc+";font-weight:600;'>"+(f.pts>0?"+":"")+f.pts+"</span></div>";});
h+="</div>";
if(readiness.warnings.length>0)readiness.warnings.forEach(function(w){h+="<p style='background:#450a0a;color:#fca5a5;padding:6px 10px;border-radius:6px;margin:4px 0;font-size:0.85em;'>"+w+"</p>";});
card.innerHTML=h;
var cc=c.querySelector(".briefing-coach");if(cc&&cc.nextSibling)c.insertBefore(card,cc.nextSibling);else c.appendChild(card);
console.log(TAG,"Readiness:",readiness.score);
}else{
var pr=document.createElement("div");pr.className="briefing-card briefing-health";
pr.innerHTML="<h3 class='briefing-card-title'>Poranny Check-in</h3><p style='color:#9ca3af;text-align:center;padding:8px;'>Brak danych zdrowotnych na dzis</p><div id='health-form-brief'></div>";
var cc2=c.querySelector(".briefing-coach");if(cc2&&cc2.nextSibling)c.insertBefore(pr,cc2.nextSibling);else c.appendChild(pr);
HealthImport.renderForm("health-form-brief");
console.log(TAG,"Form rendered (no data)");
}}};console.log(TAG,"Briefing patched");}
console.log(TAG,"Init OK");
})();

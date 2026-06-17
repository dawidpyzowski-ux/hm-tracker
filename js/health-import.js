/* health-import.js v2 */
var HealthImport=(function(){"use strict";
var TAG="[Health]",PFX="health_";
function todayISO(){var d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
function save(date,data){data.date=date;data.ts=Date.now();localStorage.setItem(PFX+date,JSON.stringify(data));var idx=JSON.parse(localStorage.getItem("health_index")||"[]");if(idx.indexOf(date)<0){idx.push(date);idx.sort();localStorage.setItem("health_index",JSON.stringify(idx));}console.log(TAG,"Saved",date,data);}
function get(date){var r=localStorage.getItem(PFX+(date||todayISO()));return r?JSON.parse(r):null;}
function getToday(){return get(todayISO());}
function getAllDates(){return JSON.parse(localStorage.getItem("health_index")||"[]");}
function getHistory(days){if(!days)days=30;var result=[],d=new Date();for(var i=0;i<days;i++){var k=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");var data=get(k);if(data)result.push(data);d.setDate(d.getDate()-1);}return result;}
function avg(arr){return arr.length?arr.reduce(function(s,v){return s+v;},0)/arr.length:null;}
function stdev(arr){var a=avg(arr);if(!a)return 0;return Math.sqrt(arr.reduce(function(s,x){return s+Math.pow(x-a,2);},0)/arr.length);}
function getBaselines(days){var hist=getHistory(days||14);if(hist.length<3)return null;var rhrs=hist.map(function(h){return h.rhr;}).filter(function(v){return v&&v>0;});var hrvs=hist.map(function(h){return h.hrv;}).filter(function(v){return v&&v>0;});var sleeps=hist.map(function(h){return h.sleepMin;}).filter(function(v){return v&&v>0;});return{rhrAvg:avg(rhrs),rhrStd:stdev(rhrs),hrvAvg:avg(hrvs),hrvStd:stdev(hrvs),sleepAvg:avg(sleeps),sleepStd:stdev(sleeps),samples:hist.length};}
function checkURLImport(){var p=new URLSearchParams(window.location.search);if(p.get("health")!=="1")return false;var date=p.get("date")||todayISO();var data={sleepMin:parseFloat(p.get("sleep"))||null,deepMin:parseFloat(p.get("deep"))||null,remMin:parseFloat(p.get("rem"))||null,coreMin:parseFloat(p.get("core"))||null,awakeMin:parseFloat(p.get("awake"))||null,rhr:parseFloat(p.get("rhr"))||null,hrv:parseFloat(p.get("hrv"))||null,source:"shortcut"};save(date,data);window.history.replaceState({},"",window.location.pathname);showToast("Dane zdrowotne zapisane za "+date);return true;}
function showToast(msg){var t=document.createElement("div");t.style.cssText="position:fixed;top:80px;left:50%;transform:translateX(-50%);background:#22c55e;color:#fff;padding:12px 24px;border-radius:8px;z-index:99999;font-size:14px;box-shadow:0 4px 12px rgba(0,0,0,0.3);";t.textContent=msg;document.body.appendChild(t);setTimeout(function(){t.remove();},3000);}
function renderForm(containerId){
  var c=document.getElementById(containerId);if(!c)return;var today=getToday();
  var h="<div style='padding:12px;'><h3 style='color:#f9fafb;margin:0 0 12px;'>Poranny Check-in</h3>";
  h+="<div style='display:flex;gap:8px;margin:6px 0;'><div style='flex:1;'><label style='color:#9ca3af;font-size:0.8em;'>Sen (h)</label><input type='number' id='hf-sh' step='1' min='0' max='14' value='"+(today&&today.sleepMin?Math.floor(today.sleepMin/60):"")+"' style='width:100%;padding:8px;background:#374151;border:1px solid #4b5563;border-radius:6px;color:#f3f4f6;'></div>";
  h+="<div style='flex:1;'><label style='color:#9ca3af;font-size:0.8em;'>Sen (min)</label><input type='number' id='hf-sm' step='5' min='0' max='59' value='"+(today&&today.sleepMin?Math.round(today.sleepMin%60):"")+"' style='width:100%;padding:8px;background:#374151;border:1px solid #4b5563;border-radius:6px;color:#f3f4f6;'></div></div>";
  h+="<div style='display:flex;gap:8px;margin:6px 0;'><div style='flex:1;'><label style='color:#9ca3af;font-size:0.8em;'>Deep (min)</label><input type='number' id='hf-deep' min='0' max='300' value='"+(today&&today.deepMin?today.deepMin:"")+"' style='width:100%;padding:8px;background:#374151;border:1px solid #4b5563;border-radius:6px;color:#f3f4f6;'></div>";
  h+="<div style='flex:1;'><label style='color:#9ca3af;font-size:0.8em;'>REM (min)</label><input type='number' id='hf-rem' min='0' max='300' value='"+(today&&today.remMin?today.remMin:"")+"' style='width:100%;padding:8px;background:#374151;border:1px solid #4b5563;border-radius:6px;color:#f3f4f6;'></div></div>";
  h+="<div style='display:flex;gap:8px;margin:6px 0;'><div style='flex:1;'><label style='color:#9ca3af;font-size:0.8em;'>RHR</label><input type='number' id='hf-rhr' min='30' max='120' value='"+(today&&today.rhr?today.rhr:"")+"' style='width:100%;padding:8px;background:#374151;border:1px solid #4b5563;border-radius:6px;color:#f3f4f6;'></div>";
  h+="<div style='flex:1;'><label style='color:#9ca3af;font-size:0.8em;'>HRV</label><input type='number' id='hf-hrv' min='1' max='200' value='"+(today&&today.hrv?today.hrv:"")+"' style='width:100%;padding:8px;background:#374151;border:1px solid #4b5563;border-radius:6px;color:#f3f4f6;'></div></div>";
  h+="<button id='hf-save' style='width:100%;padding:12px;border-radius:8px;background:#3b82f6;color:#fff;border:none;font-size:1em;cursor:pointer;margin-top:8px;'>Zapisz</button></div>";
  c.innerHTML=h;
  document.getElementById("hf-save").onclick=function(){var sH=parseFloat(document.getElementById("hf-sh").value)||0;var sM=parseFloat(document.getElementById("hf-sm").value)||0;save(todayISO(),{sleepMin:sH*60+sM,deepMin:parseFloat(document.getElementById("hf-deep").value)||null,remMin:parseFloat(document.getElementById("hf-rem").value)||null,rhr:parseFloat(document.getElementById("hf-rhr").value)||null,hrv:parseFloat(document.getElementById("hf-hrv").value)||null,source:"manual"});showToast("Zapisano!");};
}
setTimeout(checkURLImport,500);
return{save:save,get:get,getToday:getToday,getHistory:getHistory,getAllDates:getAllDates,getBaselines:getBaselines,checkURLImport:checkURLImport,renderForm:renderForm,todayISO:todayISO,showToast:showToast};
})();

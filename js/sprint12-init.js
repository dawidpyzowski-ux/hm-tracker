
/* sprint12-init.js - Patches Briefing with Coach + Weather + Trends */
(function(){"use strict";var TAG="[S12]";

// === PATCH BRIEFING: add Coach + Forecast ===
if(typeof Briefing!=="undefined"&&Briefing.render){
  var origRender=Briefing.render.bind(Briefing);
  Briefing.render=async function(id){
    await origRender(id);
    var c=document.getElementById(id);if(!c)return;
    var acts=[];try{acts=await DB.getAll();}catch(e){}
    if(typeof WeatherHistory!=="undefined"){try{acts=await WeatherHistory.enrichAll(acts);}catch(e){}}
    if(typeof Coach!=="undefined"){try{
      var a=Coach.getAdvice(acts);
      var card=document.createElement("div");card.className="briefing-card briefing-coach";
      var html="<h3 class='briefing-card-title'>Coach (Level "+a.dataLevel+", "+a.confidence+"%)</h3>";
      var cls=a.suggestion.type==="rest"?"coach-rest":a.suggestion.type==="easy"?"coach-easy":"coach-go";
      html+="<div class='coach-headline "+cls+"'>"+a.headline+"</div>";
      if(a.suggestion.reason){var st=a.suggestion.type.toUpperCase();if(a.suggestion.km>0)st+=" | "+a.suggestion.km+" km";if(a.suggestion.hrCap)st+=" | HR max "+a.suggestion.hrCap;
        html+="<p class='coach-suggestion'>"+st+"</p><p class='coach-reason'>"+a.suggestion.reason+"</p>";}
      if(a.context.fitness){var f=a.context.fitness;html+="<div class='coach-fitness'><span class='coach-ctl'>Fitness: "+f.ctl+"</span><span class='coach-atl'>Fatigue: "+f.atl+"</span><span class='coach-tsb'>Form: "+f.tsb+"</span><span class='coach-trend'>"+f.trend+"</span></div>";}
      if(a.race){var r=a.race;html+="<div class='coach-race'><div class='coach-race-name'>"+r.name+" -- "+r.daysLeft+" dni</div><div>Prognoza: <strong>"+r.prediction+"</strong> @ "+r.predictedPace+"/km</div><div>Cel: "+r.targetPace+"/km | <span class='coach-status-"+r.status+"'>"+r.status.toUpperCase().replace("_"," ")+"</span></div></div>";}
      if(a.warnings&&a.warnings.length>0)a.warnings.forEach(function(w){html+="<p class='coach-warning'>"+w+"</p>";});
      if(a.insights&&a.insights.length>0){html+="<div class='coach-insights'><h4>Twoje wzorce:</h4>";a.insights.forEach(function(ins){html+="<p class='coach-insight'>"+ins.text+" ("+ins.confidence+"%)</p>";});html+="</div>";}
      if(a.tips&&a.tips.length>0){html+="<div class='coach-tips'><h4>Porady:</h4>";a.tips.forEach(function(t){html+="<p class='coach-tip'>"+t+"</p>";});html+="</div>";}
      card.innerHTML=html;
      var first=c.querySelector(".briefing-plan");if(first&&first.nextSibling)c.insertBefore(card,first.nextSibling);else c.appendChild(card);
      console.log(TAG,"Coach rendered",a.confidence+"%");
    }catch(e){console.warn(TAG,"Coach err",e);}}
    if(typeof WeatherHistory!=="undefined"&&WeatherHistory.getForecast){try{
      var fc=await WeatherHistory.getForecast();if(fc&&fc.length>=2){var tom=fc[1];
        var fCard=document.createElement("div");fCard.className="briefing-card briefing-forecast";
        fCard.innerHTML="<h3 class='briefing-card-title'>Pogoda jutro</h3><div class='briefing-weather-info'><span>"+tom.description+"</span><span>"+tom.tempMin+"--"+tom.tempMax+" C</span>"+(tom.rain>0?"<span>Deszcz: "+tom.rain+" mm</span>":"")+"<span>Wiatr: "+tom.windMax+" km/h</span></div>";
        c.appendChild(fCard);}
    }catch(e){}}
  };console.log(TAG,"Briefing patched");
}

// === WEATHER BADGES ON STAT CARDS ===
function addWeatherBadges(){
  if(typeof WeatherHistory==="undefined"||typeof DB==="undefined") return;
  DB.getAll().then(function(acts){
    WeatherHistory.enrichAll(acts).then(function(enriched){
      document.querySelectorAll('.weather-badge').forEach(function(b){b.remove();});
      var wlogs=document.querySelectorAll('.wlog');
      wlogs.forEach(function(wlog){
        var dateEl=wlog.querySelector('.wlog-d');
        if(!dateEl) return;
        var dateTxt=dateEl.textContent.trim();
        var parts=dateTxt.split('.');
        if(parts.length!==2) return;
        var day=parts[0],month=parts[1];
        var act=enriched.find(function(a){
          var d=(a.date||'').slice(0,10);
          return d.endsWith('-'+month+'-'+day);
        });
        if(act&&act._weather){
          var w=act._weather;
          var top=wlog.querySelector('.wlog-top');
          if(top&&!top.querySelector('.weather-badge')){
            var badge=document.createElement('div');
            badge.className='weather-badge';
            badge.textContent=w.temp+'C | '+w.description+' | wilg. '+w.humidity+'% | wiatr '+w.wind+' km/h';
            badge.style.marginTop='6px';
            top.appendChild(badge);
          }
        }
      });
      console.log(TAG,"Weather badges: done");
    });
  });
}

// Auto-add badges when stats tab is shown
var origNav=window.nav;
if(typeof origNav==="function"){
  window.nav=function(){
    origNav.apply(this,arguments);
    setTimeout(addWeatherBadges, 500);
  };
}
// Also run on load with delay
setTimeout(addWeatherBadges, 2000);

console.log(TAG,"Init OK");
})();

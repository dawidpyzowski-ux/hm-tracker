/* health-score.js v2 */
var HealthScore=(function(){"use strict";
function sleepScore(d){
  if(!d||!d.sleepMin)return null;var score=0,max=0,factors=[],missing=[];var totalH=d.sleepMin/60;
  max+=35;var sp=totalH>=8?35:totalH>=7?Math.round(25+10*(totalH-7)):totalH>=6?Math.round(15+10*(totalH-6)):Math.max(0,Math.round(15*(totalH/6)));score+=sp;
  factors.push({name:"Czas snu",val:totalH.toFixed(1)+"h",pts:sp,max:35});
  if(d.deepMin!=null&&d.deepMin>0){max+=25;var dp=d.deepMin>=60&&d.deepMin<=120?25:d.deepMin>=45?20:d.deepMin>=30?12:5;score+=dp;var deepPct=d.deepMin/d.sleepMin*100;factors.push({name:"Deep",val:d.deepMin+"min ("+deepPct.toFixed(0)+"%)",pts:dp,max:25});}else{missing.push("Deep sleep");}
  if(d.remMin!=null&&d.remMin>0){max+=25;var rp=d.remMin>=90?25:d.remMin>=60?18:d.remMin>=40?10:4;score+=rp;var remPct=d.remMin/d.sleepMin*100;factors.push({name:"REM",val:d.remMin+"min ("+remPct.toFixed(0)+"%)",pts:rp,max:25});}else{missing.push("REM");}
  if(d.coreMin!=null&&d.deepMin!=null&&d.remMin!=null){max+=15;var as=d.coreMin+d.deepMin+d.remMin;var eff=as/d.sleepMin*100;var ep=eff>=90?15:eff>=80?10:5;score+=ep;factors.push({name:"Efektywnosc",val:eff.toFixed(0)+"%",pts:ep,max:15});}else if(!d.coreMin){missing.push("Core sleep");}
  var pct=max>0?Math.round(score/max*100):0;var label=pct>=85?"Doskonaly":pct>=70?"Dobry":pct>=50?"Przecietny":pct>=30?"Slaby":"Bardzo slaby";
  return{score:pct,label:label,factors:factors,missing:missing};
}
function calcReadiness(d,b){
  if(!d)return null;var score=50,factors=[],warnings=[];
  if(d.sleepMin){var h=d.sleepMin/60;var p=h>=8?30:h>=7?25:h>=6?15:h>=5?5:-10;score+=p;factors.push({name:"Sen",val:h.toFixed(1)+"h",pts:p});if(h<6)warnings.push("Sen < 6h");}
  if(d.deepMin){var p2=d.deepMin>=60?10:d.deepMin>=40?5:-5;score+=p2;factors.push({name:"Deep",val:d.deepMin+"min",pts:p2});}
  if(d.remMin){var p3=d.remMin>=90?10:d.remMin>=60?5:-3;score+=p3;factors.push({name:"REM",val:d.remMin+"min",pts:p3});}
  if(d.rhr&&b&&b.rhrAvg){var rd=d.rhr-b.rhrAvg;var p4=rd<=-2?20:rd<=2?15:rd<=5?5:-10;score+=p4;factors.push({name:"RHR",val:d.rhr+"bpm ("+(rd>0?"+":"")+rd.toFixed(0)+")",pts:p4});if(rd>5)warnings.push("RHR wysoko!");}
  else if(d.rhr){var p5=d.rhr<=55?15:d.rhr<=65?10:0;score+=p5;factors.push({name:"RHR",val:d.rhr+"bpm",pts:p5});}
  if(d.hrv&&b&&b.hrvAvg){var hd=d.hrv-b.hrvAvg;var p6=hd>=5?20:hd>=-3?15:hd>=-8?5:-10;score+=p6;factors.push({name:"HRV",val:d.hrv+"ms ("+(hd>0?"+":"")+hd.toFixed(0)+")",pts:p6});if(hd<-8)warnings.push("HRV niskie!");}
  else if(d.hrv){var p7=d.hrv>=50?15:d.hrv>=30?10:0;score+=p7;factors.push({name:"HRV",val:d.hrv+"ms",pts:p7});}
  score=Math.max(0,Math.min(100,Math.round(score)));
  var rec=score>=80?"Pelna gotowosc -- trenuj hard":score>=65?"Dobra -- trening wg planu":score>=45?"Umiarkowana -- ogranicz intensywnosc":score>=30?"Niska -- easy run":"Odpoczynek!";
  return{score:score,recommendation:rec,factors:factors,warnings:warnings};
}
function getReadiness(){if(typeof HealthImport==="undefined")return null;var t=HealthImport.getToday();if(!t)return null;return calcReadiness(t,HealthImport.getBaselines(14));}
function getTodaySleepScore(){if(typeof HealthImport==="undefined")return null;return sleepScore(HealthImport.getToday());}
return{calcReadiness:calcReadiness,getReadiness:getReadiness,sleepScore:sleepScore,getTodaySleepScore:getTodaySleepScore};
})();

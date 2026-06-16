/* health-score.js - Sprint 13: Readiness calculator */
var HealthScore=(function(){"use strict";
function calcReadiness(d,b){if(!d)return null;var score=50,factors=[],warnings=[];
if(d.sleepMin){var h=d.sleepMin/60;var p=h>=8?30:h>=7?25:h>=6?15:h>=5?5:-10;score+=p;factors.push({name:"Sen",val:h.toFixed(1)+"h",pts:p});if(h<6)warnings.push("Sen < 6h -- unikaj hard treningu");if(h<5)warnings.push("Sen < 5h -- odpoczynek!");}
if(d.deepMin){var p2=d.deepMin>=60?10:d.deepMin>=40?5:-5;score+=p2;factors.push({name:"Deep",val:d.deepMin+"min",pts:p2});if(d.deepMin<40)warnings.push("Malo deep sleep -- slaba regeneracja miesni");}
if(d.remMin){var p3=d.remMin>=90?10:d.remMin>=60?5:-3;score+=p3;factors.push({name:"REM",val:d.remMin+"min",pts:p3});}
if(d.rhr&&b&&b.rhrAvg){var rd=d.rhr-b.rhrAvg;var p4=rd<=-2?20:rd<=2?15:rd<=5?5:-10;score+=p4;factors.push({name:"RHR",val:d.rhr+"bpm ("+(rd>0?"+":"")+rd.toFixed(0)+")",pts:p4});if(rd>5)warnings.push("RHR wysoko! +"+rd.toFixed(0)+" bpm vs norma");}else if(d.rhr){var p5=d.rhr<=55?15:d.rhr<=65?10:0;score+=p5;factors.push({name:"RHR",val:d.rhr+"bpm",pts:p5});}
if(d.hrv&&b&&b.hrvAvg){var hd=d.hrv-b.hrvAvg;var p6=hd>=5?20:hd>=-3?15:hd>=-8?5:-10;score+=p6;factors.push({name:"HRV",val:d.hrv+"ms ("+(hd>0?"+":"")+hd.toFixed(0)+")",pts:p6});if(hd<-8)warnings.push("HRV bardzo niskie! Odpoczynek wskazany");}else if(d.hrv){var p7=d.hrv>=50?15:d.hrv>=30?10:0;score+=p7;factors.push({name:"HRV",val:d.hrv+"ms",pts:p7});}
if(d.energy){var ep=(d.energy-3)*5;score+=ep;factors.push({name:"Energia",val:d.energy+"/5",pts:ep});if(d.energy<=2)warnings.push("Niska energia -- sluchaj ciala");}
if(d.soreness){var sp=(3-d.soreness)*3;score+=sp;factors.push({name:"Bol",val:d.soreness+"/5",pts:sp});if(d.soreness>=4)warnings.push("Silny bol miesni -- unikaj hard");}
score=Math.max(0,Math.min(100,Math.round(score)));
var lev=score>=80?"excellent":score>=65?"good":score>=45?"moderate":score>=30?"low":"poor";
var rec=score>=80?"Pelna gotowosc -- mozesz trenowac hard":score>=65?"Dobra gotowosc -- trening wg planu":score>=45?"Umiarkowana -- ogranicz intensywnosc":score>=30?"Niska -- easy run lub odpoczynek":"Odpoczynek! Regeneracja priorytetem";
return{score:score,level:lev,recommendation:rec,factors:factors,warnings:warnings};}
function getReadiness(){if(typeof HealthImport==="undefined")return null;var t=HealthImport.getToday();if(!t)return null;return calcReadiness(t,HealthImport.getBaselines(14));}
return{calcReadiness:calcReadiness,getReadiness:getReadiness};
})();

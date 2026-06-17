
/* health-trends.js - Sprint 13.2: Trend Analysis + Smart Alerts */
var HealthTrends=(function(){"use strict";
var TAG="[Trends]";

function linreg(arr){
  var n=arr.length;if(n<3)return{slope:0,trend:"flat",r2:0};
  var sx=0,sy=0,sxy=0,sx2=0;
  for(var i=0;i<n;i++){sx+=i;sy+=arr[i];sxy+=i*arr[i];sx2+=i*i;}
  var slope=(n*sxy-sx*sy)/(n*sx2-sx*sx);
  var mean=sy/n;
  var ssres=0,sstot=0;
  for(var j=0;j<n;j++){var pred=(slope*j)+(sy-slope*sx)/n;ssres+=Math.pow(arr[j]-pred,2);sstot+=Math.pow(arr[j]-mean,2);}
  var r2=sstot>0?1-ssres/sstot:0;
  var trend=Math.abs(slope)<0.3?"flat":slope>0?"up":"down";
  return{slope:Math.round(slope*100)/100,trend:trend,r2:Math.round(r2*100)/100,mean:Math.round(mean*10)/10};
}

function analyze(days){
  if(typeof HealthImport==="undefined")return null;
  var hist=HealthImport.getHistory(days||14);
  if(hist.length<3)return{alerts:[{type:"info",msg:"Za malo danych (min. 3 dni) do analizy trendow"}],trends:{}};

  hist.reverse();
  var rhrs=[],hrvs=[],sleeps=[],deeps=[],rems=[];
  hist.forEach(function(h){
    if(h.rhr&&h.rhr>0)rhrs.push(h.rhr);
    if(h.hrv&&h.hrv>0)hrvs.push(h.hrv);
    if(h.sleepMin&&h.sleepMin>0)sleeps.push(h.sleepMin);
    if(h.deepMin&&h.deepMin>0)deeps.push(h.deepMin);
    if(h.remMin&&h.remMin>0)rems.push(h.remMin);
  });

  var rhrT=linreg(rhrs);
  var hrvT=linreg(hrvs);
  var sleepT=linreg(sleeps);
  var deepT=linreg(deeps);
  var remT=linreg(rems);

  var alerts=[];
  var baselines=HealthImport.getBaselines(14);

  if(rhrT.trend==="up"&&rhrT.slope>0.5){
    alerts.push({type:"warning",metric:"RHR",msg:"RHR rosnie (+"+(rhrT.slope*7).toFixed(1)+" bpm/tydzien) -- mozliwe zmeczenie",severity:rhrT.slope>1?"high":"medium"});
  }
  if(baselines&&baselines.rhrAvg&&rhrs.length>0){
    var lastRhr=rhrs[rhrs.length-1];
    var diff=lastRhr-baselines.rhrAvg;
    if(diff>7){alerts.push({type:"danger",metric:"RHR",msg:"RHR +"+diff.toFixed(0)+" bpm vs norma! Odpoczynek lub choroba?",severity:"high"});}
    else if(diff>4){alerts.push({type:"warning",metric:"RHR",msg:"RHR podwyzszone +"+diff.toFixed(0)+" bpm vs norma",severity:"medium"});}
  }

  if(hrvT.trend==="down"&&hrvT.slope<-0.5){
    alerts.push({type:"warning",metric:"HRV",msg:"HRV spada ("+(hrvT.slope*7).toFixed(1)+" ms/tydzien) -- organizm nie regeneruje",severity:hrvT.slope<-1?"high":"medium"});
  }
  if(baselines&&baselines.hrvAvg&&hrvs.length>0){
    var lastHrv=hrvs[hrvs.length-1];
    var hdiff=lastHrv-baselines.hrvAvg;
    if(hdiff<-10){alerts.push({type:"danger",metric:"HRV",msg:"HRV bardzo niskie! "+lastHrv+"ms vs norma "+baselines.hrvAvg.toFixed(0)+"ms",severity:"high"});}
  }

  var shortSleep=0;
  for(var si=Math.max(0,sleeps.length-3);si<sleeps.length;si++){
    if(sleeps[si]<360)shortSleep++;
  }
  if(shortSleep>=2){alerts.push({type:"warning",metric:"Sen",msg:"Sen < 6h przez "+shortSleep+" z ostatnich 3 nocy!",severity:"high"});}
  if(sleepT.trend==="down"&&sleepT.slope<-5){
    alerts.push({type:"warning",metric:"Sen",msg:"Czas snu maleje ("+(sleepT.slope*7).toFixed(0)+" min/tydzien)",severity:"medium"});
  }

  var lowDeep=0;
  for(var di=Math.max(0,deeps.length-3);di<deeps.length;di++){
    if(deeps[di]<30)lowDeep++;
  }
  if(lowDeep>=2){alerts.push({type:"warning",metric:"Deep",msg:"Deep sleep < 30min "+lowDeep+"x w ostatnich 3 dniach -- slaba regeneracja",severity:"high"});}

  if(rhrT.trend==="up"&&hrvT.trend==="down"){
    alerts.push({type:"danger",metric:"Ogolne",msg:"Zmeczenie rosnie! RHR w gore + HRV w dol. Priorytet: regeneracja!",severity:"high"});
  }

  if(rhrT.trend==="down"&&rhrT.slope<-0.3){
    alerts.push({type:"positive",metric:"RHR",msg:"RHR spada -- dobra regeneracja!",severity:"low"});
  }
  if(hrvT.trend==="up"&&hrvT.slope>0.3){
    alerts.push({type:"positive",metric:"HRV",msg:"HRV rosnie -- organizm sie regeneruje!",severity:"low"});
  }

  var trends={
    rhr:{data:rhrT,arrow:rhrT.trend==="up"?"\u2191":rhrT.trend==="down"?"\u2193":"\u2192",good:rhrT.trend==="down"||rhrT.trend==="flat"},
    hrv:{data:hrvT,arrow:hrvT.trend==="up"?"\u2191":hrvT.trend==="down"?"\u2193":"\u2192",good:hrvT.trend==="up"||hrvT.trend==="flat"},
    sleep:{data:sleepT,arrow:sleepT.trend==="up"?"\u2191":sleepT.trend==="down"?"\u2193":"\u2192",good:sleepT.trend==="up"||sleepT.trend==="flat"},
    deep:{data:deepT,arrow:deepT.trend==="up"?"\u2191":deepT.trend==="down"?"\u2193":"\u2192",good:deepT.trend==="up"||deepT.trend==="flat"},
    rem:{data:remT,arrow:remT.trend==="up"?"\u2191":remT.trend==="down"?"\u2193":"\u2192",good:remT.trend==="up"||remT.trend==="flat"}
  };

  fireNotifications(alerts);
  console.log(TAG,"Analyzed",hist.length,"days. Alerts:",alerts.length);
  return{alerts:alerts,trends:trends,days:hist.length};
}

function fireNotifications(alerts){
  if(typeof Notification==="undefined"||Notification.permission!=="granted")return;
  var high=alerts.filter(function(a){return a.severity==="high"&&(a.type==="danger"||a.type==="warning");});
  if(high.length===0)return;
  var body=high.map(function(a){return a.msg;}).join("\n");
  try{
    if(navigator.serviceWorker&&navigator.serviceWorker.ready){
      navigator.serviceWorker.ready.then(function(reg){reg.showNotification("HM Tracker - Health Alert",{body:body,tag:"health-alert"});});
    }else{
      new Notification("HM Tracker - Health Alert",{body:body,tag:"health-alert"});
    }
  }catch(e){console.log(TAG,"Notification error:",e);}
}

return{analyze:analyze,linreg:linreg};
})();

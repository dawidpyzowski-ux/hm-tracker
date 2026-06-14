
/* plan-data.js — Pelny plan treningowy HM Tracker */
(function(){
  var hist = [
    {date:"2026-04-11",type:"long_run",km:12.5,pace:"5:30",notes:"Long run 12.5 km"},
    {date:"2026-04-13",type:"intervals",km:8,pace:"4:40",notes:"2km WU + 8x400m @ 4:40 z przerwami 200m + 1km CD"},
    {date:"2026-04-16",type:"tempo",km:8,pace:"5:40",notes:"2km WU + 5km @ 5:40 + 1km CD"},
    {date:"2026-04-19",type:"easy",km:10,pace:"6:20",notes:"10 km Easy run"},
    {date:"2026-04-26",type:"easy",km:8,pace:"6:20",notes:"8 km Easy run"},
    {date:"2026-04-28",type:"intervals",km:9,pace:"4:40",notes:"2km WU + 4x1000m @ 4:40 z przerwami 400m + 1km CD"},
    {date:"2026-04-30",type:"tempo",km:10,pace:"5:30",notes:"2km WU + 7km @ 5:30 + 1km CD"},
    {date:"2026-05-03",type:"long_run",km:14,pace:"5:30",notes:"Long run 14 km"},
    {date:"2026-05-05",type:"intervals",km:12,pace:"4:40",notes:"3km WU + 5x1000m @ 4:40 + 1.5km CD z przerwami 400m"},
    {date:"2026-05-07",type:"tempo",km:8.5,pace:"5:40",notes:"1km WU + 6.66km @ 5:40 + 810m CD"},
    {date:"2026-05-10",type:"long_run",km:16,pace:"5:30",notes:"Long run 16 km"},
    {date:"2026-05-12",type:"intervals",km:12,pace:"4:40",notes:"2km WU + 6x1000m @ 4:40 + 1km CD z przerwami 400m"},
    {date:"2026-05-14",type:"tempo",km:13,pace:"5:30",notes:"2km WU + 10km @ 5:30 + 1km CD"},
    {date:"2026-05-16",type:"long_run",km:18,pace:"5:30",notes:"Long run 18 km"},
    {date:"2026-05-18",type:"easy",km:8.5,pace:"6:20",notes:"7.7km Easy + 6x100m rytmy z przerwa 45s"},
    {date:"2026-05-20",type:"tempo",km:8.5,pace:"5:45",notes:"2km WU + 5km @ 5:45 + 1.5km CD"},
    {date:"2026-05-23",type:"easy",km:10,pace:"6:20",notes:"10 km Easy run"},
    {date:"2026-05-26",type:"easy",km:8.5,pace:"6:20",notes:"7.5km Easy + rytmy 5x100m + 500m CD"},
    {date:"2026-05-27",type:"intervals",km:8.5,pace:"5:00",notes:"2km WU + 4x1000m @ 5:00 3min marsz + 1.5km CD"},
    {date:"2026-05-29",type:"recovery",km:6,pace:"6:40",notes:"Recovery run 6 km"},
    {date:"2026-05-30",type:"long_run",km:15,pace:"5:30",notes:"Long run 15 km"},
    {date:"2026-06-01",type:"easy",km:9,pace:"6:30",notes:"Easy 8km + 5x100m rytmow + 0.5km CD"},
    {date:"2026-06-02",type:"intervals",km:8,pace:"5:00",notes:"2km WU + 4x1km @ 5:00 (przerwy 2:30 marsz) + 1.5km CD"},
    {date:"2026-06-05",type:"recovery",km:6,pace:"6:40",notes:"Recovery run 6 km"}
  ];

  if(!window.PLAN_FLAT) window.PLAN_FLAT = [];
  var existing = {};
  for(var i = 0; i < window.PLAN_FLAT.length; i++){
    existing[window.PLAN_FLAT[i].date] = true;
  }
  for(var j = 0; j < hist.length; j++){
    if(!existing[hist[j].date]){
      window.PLAN_FLAT.push(hist[j]);
      existing[hist[j].date] = true;
    }
  }

  try {
    if(typeof PLAN !== "undefined" && Array.isArray(PLAN)){
      for(var wi = 0; wi < PLAN.length; wi++){
        var w = PLAN[wi];
        if(!w.days) continue;
        for(var di = 0; di < w.days.length; di++){
          var d = w.days[di];
          if(d.rest) continue;
          var dt = null;
          try { dt = getDayDate(w.start, d.dow); } catch(e){}
          if(dt && !existing[dt]){
            window.PLAN_FLAT.push({
              date: dt,
              type: d.type || "easy",
              km: d.km || 0,
              pace: d.pace || "-",
              notes: d.desc || d.type || ""
            });
            existing[dt] = true;
          }
        }
      }
    }
  } catch(e){}

  window.PLAN_FLAT.sort(function(a,b){ return a.date.localeCompare(b.date); });
  console.log("[PlanData] Zaladowano", window.PLAN_FLAT.length, "wpisow planu");
})();

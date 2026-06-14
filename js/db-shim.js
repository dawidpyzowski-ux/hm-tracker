
/* db-shim.js v4 — S.getAllLogs() + PLAN_FLAT + DB.getDetail SYNC */
(function(){
  "use strict";
  var TAG = "[DB-Shim]";

  function parsePace(p){
    if(!p) return null;
    var parts = String(p).split(":");
    if(parts.length !== 2) return null;
    return parseInt(parts[0],10)*60 + parseInt(parts[1],10);
  }

  function estimateDuration(paceStr, km){
    var ps = parsePace(paceStr);
    if(!ps || !km) return null;
    return +(ps * km / 60).toFixed(1);
  }

  function speedToPaceStr(speed){
    if(!speed || speed <= 0) return null;
    var secPerKm = Math.round(1000 / speed);
    var m = Math.floor(secPerKm / 60);
    var s = secPerKm % 60;
    return m + ":" + String(s).padStart(2,"0");
  }

  var _cache = null;
  var _cacheTime = 0;
  var CACHE_TTL = 30000;

  DB.getAll = function(){
    if(_cache && (Date.now() - _cacheTime < CACHE_TTL)){
      return Promise.resolve(_cache);
    }
    try {
      var logs = S.getAllLogs();
      var activities = [];
      var dates = Object.keys(logs);
      for(var i = 0; i < dates.length; i++){
        var date = dates[i];
        var log = logs[date];
        if(!log.distance || parseFloat(log.distance) <= 0) continue;
        var km = parseFloat(log.distance);
        var durationMin = estimateDuration(log.pace, km);
        var planType = null;
        try {
          if(window.PLAN_FLAT){
            for(var pi = 0; pi < window.PLAN_FLAT.length; pi++){
              if(window.PLAN_FLAT[pi].date === date){
                planType = window.PLAN_FLAT[pi].type;
                break;
              }
            }
          }
        } catch(e){}
        var act = {
          date: date,
          start_date: date,
          sid: log.strava_id || null,
          id: log.strava_id || date,
          strava_id: log.strava_id || null,
          distance_km: km,
          km: km,
          distance: km,
          pace: log.pace || null,
          avg_pace: log.pace || null,
          avg_hr: log.hr ? parseFloat(log.hr) : null,
          average_heartrate: log.hr ? parseFloat(log.hr) : null,
          duration_min: durationMin,
          moving_time_min: durationMin,
          moving_time: durationMin ? durationMin * 60 : null,
          status: log.status || null,
          feeling: log.feeling || null,
          notes: log.notes || null,
          type: planType || null,
          workout_type: null,
          total_elevation_gain: null,
          elevation_gain: null,
          calories: null,
          avg_cadence: null,
          average_cadence: null,
          max_hr: null,
          gear_id: null,
          gear: null
        };
        if(log.strava_id){
          try {
            var detail = DB.getDetail(log.strava_id);
            if(detail){
              if(detail.total_elevation_gain){
                act.total_elevation_gain = detail.total_elevation_gain;
                act.elevation_gain = detail.total_elevation_gain;
              }
              if(detail.calories) act.calories = detail.calories;
              if(detail.cadence){
                act.avg_cadence = detail.cadence;
                act.average_cadence = detail.cadence;
              }
              if(detail.max_hr) act.max_hr = detail.max_hr;
              if(detail.gear) act.gear = detail.gear;
              if(detail.gear_id) act.gear_id = detail.gear_id;
              if(!act.pace && detail.splits && detail.splits.length > 0){
                var speeds = [];
                for(var si = 0; si < detail.splits.length; si++){
                  if(detail.splits[si].average_speed > 0) speeds.push(detail.splits[si].average_speed);
                }
                if(speeds.length > 0){
                  var sum = 0;
                  for(var j = 0; j < speeds.length; j++) sum += speeds[j];
                  act.pace = speedToPaceStr(sum / speeds.length);
                  act.avg_pace = act.pace;
                }
              }
              if(!act.duration_min && detail.splits && detail.splits.length > 0){
                var totalSec = 0;
                for(var k = 0; k < detail.splits.length; k++){
                  totalSec += (detail.splits[k].moving_time || 0);
                }
                if(totalSec > 0){
                  act.duration_min = +(totalSec / 60).toFixed(1);
                  act.moving_time_min = act.duration_min;
                  act.moving_time = totalSec;
                }
              }
            }
          } catch(e){}
        }
        activities.push(act);
      }
      activities.sort(function(a,b){ return b.date.localeCompare(a.date); });
      _cache = activities;
      _cacheTime = Date.now();
      console.log(TAG, "v4", activities.length, "aktywnosci enriched");
      return Promise.resolve(activities);
    } catch(e){
      console.error(TAG, "Blad:", e);
      return Promise.resolve([]);
    }
  };

  DB.getActivity = function(sid){
    return DB.getAll().then(function(acts){
      return acts.find(function(a){ return String(a.sid) === String(sid) || String(a.id) === String(sid); }) || null;
    });
  };

  DB.invalidateCache = function(){
    _cache = null;
    _cacheTime = 0;
  };

  console.log(TAG, "v4 SYNC+PLAN_FLAT zainstalowany");
})();

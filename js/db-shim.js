/* =========================================================
 *  db-shim.js — Compatibility layer: S.getAllLogs() → DB.getAll()
 *  Sprint 11 · HM Tracker PWA v2 — with detail enrichment + caching
 * ========================================================= */
(function(){
  "use strict";
  const TAG = "[DB-Shim]";

  /** Parse pace "M:SS" → seconds/km */
  function parsePace(p){
    if(!p) return null;
    const parts = String(p).split(":");
    if(parts.length !== 2) return null;
    return parseInt(parts[0],10)*60 + parseInt(parts[1],10);
  }

  /** Estimate duration from pace × distance */
  function estimateDuration(paceStr, km){
    const ps = parsePace(paceStr);
    if(!ps || !km) return null;
    return +(ps * km / 60).toFixed(1);
  }

  /** speed m/s → pace "M:SS" */
  function speedToPaceStr(speed){
    if(!speed || speed <= 0) return null;
    const secPerKm = Math.round(1000 / speed);
    const m = Math.floor(secPerKm / 60);
    const s = secPerKm % 60;
    return m + ":" + String(s).padStart(2,"0");
  }

  // Cache
  let _cache = null;
  let _cacheTime = 0;
  const CACHE_TTL = 30000; // 30 seconds

  /**
   * DB.getAll() — returns Promise<Array<Activity>>
   * Reads from S.getAllLogs(), enriches with DB.getDetail()
   */
  DB.getAll = async function(){
    // Return cache if fresh
    if(_cache && (Date.now() - _cacheTime < CACHE_TTL)){
      return _cache;
    }

    try {
      const logs = S.getAllLogs();
      const activities = [];

      for(const [date, log] of Object.entries(logs)){
        if(!log.distance || parseFloat(log.distance) <= 0) continue;

        const km = parseFloat(log.distance);
        const durationMin = estimateDuration(log.pace, km);

        // Try to get plan type
        let planType = null;
        try {
          if(typeof PLAN !== 'undefined'){
            for(const w of PLAN){
              for(const d of w.days){
                if(typeof getDayDate === 'function' && getDayDate(w.start, d.dow) === date){
                  planType = d.type;
                  break;
                }
              }
              if(planType) break;
            }
          }
        } catch(_){}

        const act = {
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
          gear_id: null,
          gear: null
        };

        // Enrich from Strava detail
        if(log.strava_id){
          try {
            const detail = await DB.getDetail(log.strava_id);
            if(detail){
              if(detail.total_elevation_gain) {
                act.total_elevation_gain = detail.total_elevation_gain;
                act.elevation_gain = detail.total_elevation_gain;
              }
              if(detail.calories) act.calories = detail.calories;
              if(detail.average_cadence) {
                act.avg_cadence = detail.average_cadence;
                act.average_cadence = detail.average_cadence;
              }
              if(detail.gear_id) act.gear_id = detail.gear_id;
              if(detail.gear) act.gear = detail.gear;

              // Better pace from average_speed if no pace logged
              if(detail.average_speed && !act.pace){
                act.pace = speedToPaceStr(detail.average_speed);
                act.avg_pace = act.pace;
              }

              // Better duration from moving_time
              if(detail.moving_time && !act.duration_min){
                act.duration_min = +(detail.moving_time / 60).toFixed(1);
                act.moving_time_min = act.duration_min;
                act.moving_time = detail.moving_time;
              }
            }
          } catch(_){}
        }

        activities.push(act);
      }

      // Sort newest first
      activities.sort(function(a,b){ return b.date.localeCompare(a.date); });

      // Cache
      _cache = activities;
      _cacheTime = Date.now();

      console.log(TAG, "Załadowano", activities.length, "aktywności (enriched)");
      return activities;
    } catch(e){
      console.error(TAG, "Błąd:", e);
      return [];
    }
  };

  /**
   * DB.getActivity(sid) — find single activity by strava_id
   */
  DB.getActivity = function(sid){
    return DB.getAll().then(function(acts){
      return acts.find(function(a){ return String(a.sid) === String(sid) || String(a.id) === String(sid); }) || null;
    });
  };

  /**
   * DB.invalidateCache() — force refresh on next getAll()
   */
  DB.invalidateCache = function(){
    _cache = null;
    _cacheTime = 0;
  };

  console.log(TAG, "DB.getAll() shim v2 zainstalowany ✅");
})();

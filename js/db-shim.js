/* =========================================================
 *  db-shim.js — Compatibility layer: S.getAllLogs() → DB.getAll()
 *  Sprint 11 · HM Tracker PWA
 *  Łączy localStorage (S) z modułami Sprint 11
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
    return +(ps * km / 60).toFixed(1); // minutes
  }

  /**
   * DB.getAll() — zwraca Promise<Array<Activity>>
   * Czyta z S.getAllLogs(), normalizuje pola do formatu Sprint 11
   */
  DB.getAll = function(){
    return new Promise(function(resolve){
      try {
        const logs = S.getAllLogs();
        const activities = [];

        Object.entries(logs).forEach(function(entry){
          const date = entry[0];
          const log = entry[1];
          if(!log.distance || parseFloat(log.distance) <= 0) return;

          const km = parseFloat(log.distance);
          const durationMin = estimateDuration(log.pace, km);

          // Spróbuj pobrać dodatkowe dane z PLAN
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

          // Spróbuj pobrać szczegóły z DB detail cache
          let detail = null;
          try {
            if(log.strava_id && DB.hasDetail && DB.hasDetail(log.strava_id)){
              // Nie wywołujemy async getDetail tutaj — tylko sprawdzamy cache
            }
          } catch(_){}

          activities.push({
            // Identyfikatory
            date: date,
            start_date: date,
            sid: log.strava_id || null,
            id: log.strava_id || date,
            strava_id: log.strava_id || null,

            // Dystans
            distance_km: km,
            km: km,
            distance: km,

            // Tempo
            pace: log.pace || null,
            avg_pace: log.pace || null,

            // HR
            avg_hr: log.hr ? parseFloat(log.hr) : null,
            average_heartrate: log.hr ? parseFloat(log.hr) : null,

            // Czas
            duration_min: durationMin,
            moving_time_min: durationMin,
            moving_time: durationMin ? durationMin * 60 : null,

            // Status / meta
            status: log.status || null,
            feeling: log.feeling || null,
            notes: log.notes || null,

            // Typ treningu
            type: planType || null,
            workout_type: null,

            // Elevation / calories (z detali Strava jeśli dostępne)
            total_elevation_gain: null,
            elevation_gain: null,
            calories: null,
            avg_cadence: null,
            average_cadence: null
          });
        });

        // Posortuj od najnowszych
        activities.sort(function(a,b){ return b.date.localeCompare(a.date); });

        console.log(TAG, "Załadowano", activities.length, "aktywności z S.getAllLogs()");
        resolve(activities);
      } catch(e){
        console.error(TAG, "Błąd:", e);
        resolve([]);
      }
    });
  };

  /**
   * DB.getActivity(sid) — znajdź aktywność po strava_id
   */
  DB.getActivity = function(sid){
    return DB.getAll().then(function(acts){
      return acts.find(function(a){ return String(a.sid) === String(sid) || String(a.id) === String(sid); }) || null;
    });
  };

  /**
   * Wzbogać aktywności o dane z DB.getDetail (async)
   * Wywoływane raz po załadowaniu modułu
   */
  async function enrichActivities(){
    try {
      const acts = await DB.getAll();
      let enriched = 0;
      for(const act of acts){
        if(!act.strava_id) continue;
        try {
          const detail = await DB.getDetail(act.strava_id);
          if(detail){
            if(detail.total_elevation_gain) act.total_elevation_gain = detail.total_elevation_gain;
            if(detail.calories) act.calories = detail.calories;
            if(detail.average_cadence) act.avg_cadence = detail.average_cadence;
            if(detail.gear_id) act.gear_id = detail.gear_id;
            if(detail.average_speed){
              // average_speed w m/s → pace sec/km
              const paceFromSpeed = detail.average_speed > 0 ? Math.round(1000 / detail.average_speed) : null;
              if(paceFromSpeed && !act.pace){
                const m = Math.floor(paceFromSpeed / 60);
                const s = paceFromSpeed % 60;
                act.pace = m + ":" + String(s).padStart(2,"0");
                act.avg_pace = act.pace;
              }
            }
            enriched++;
          }
        } catch(_){}
      }
      if(enriched > 0) console.log(TAG, "Wzbogacono", enriched, "aktywności o dane ze Strava");
    } catch(e){
      console.warn(TAG, "enrichActivities error:", e);
    }
  }

  // Auto-enrich po załadowaniu
  setTimeout(enrichActivities, 2000);

  console.log(TAG, "DB.getAll() shim zainstalowany ✅");
})();

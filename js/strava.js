// HM Tracker - Strava Module v2 (Sprint 4: Deep Analytics)
const Strava={
  CID:'257506',
  URL:'https://hm-strava.dawid-pyzowski.workers.dev/',
  SCOPE:'read,activity:read_all',

  isConnected(){return !!localStorage.getItem('strava_refresh')},

  authorize(){
    const redir=encodeURIComponent(location.origin+location.pathname);
    location.href=`https://www.strava.com/oauth/authorize?client_id=${this.CID}&redirect_uri=${redir}&response_type=code&scope=${this.SCOPE}&approval_prompt=auto`;
  },

  async handleCallback(){
    const code=new URLSearchParams(location.search).get('code');
    if(!code)return false;
    try{
      const r=await fetch(this.URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code})});
      const d=await r.json();
      if(d.access_token){
        localStorage.setItem('strava_access',d.access_token);
        localStorage.setItem('strava_refresh',d.refresh_token);
        localStorage.setItem('strava_expires',d.expires_at);
        localStorage.setItem('strava_athlete',d.athlete?d.athlete.id:'');
        history.replaceState({},'',location.pathname);
        return true;
      }
    }catch(e){console.error('Strava callback error',e)}
    return false;
  },

  disconnect(){
    ['strava_access','strava_refresh','strava_expires','strava_athlete'].forEach(k=>localStorage.removeItem(k));
  },

  async getToken(){
    let token=localStorage.getItem('strava_access');
    const exp=+localStorage.getItem('strava_expires')||0;
    if(Date.now()/1000>exp-300){
      const refresh=localStorage.getItem('strava_refresh');
      if(!refresh)return null;
      try{
        const r=await fetch(this.URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({refresh_token:refresh})});
        const d=await r.json();
        if(d.access_token){
          localStorage.setItem('strava_access',d.access_token);
          localStorage.setItem('strava_refresh',d.refresh_token);
          localStorage.setItem('strava_expires',d.expires_at);
          token=d.access_token;
        }else return null;
      }catch(e){return null}
    }
    return token;
  },

  // --- NEW: Fetch activity detail (splits, laps, cadence, max HR...) ---
  async getActivityDetail(activityId){
    const token=await this.getToken();
    if(!token)return null;
    try{
      const r=await fetch(this.URL,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({action:'detail',access_token:token,activity_id:activityId})
      });
      return await r.json();
    }catch(e){console.error('Detail fetch error',e);return null}
  },

  // --- NEW: Fetch activity streams (HR, pace, altitude, cadence, GPS per second) ---
  async getActivityStreams(activityId){
    const token=await this.getToken();
    if(!token)return null;
    try{
      const r=await fetch(this.URL,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({action:'streams',access_token:token,activity_id:activityId})
      });
      return await r.json();
    }catch(e){console.error('Streams fetch error',e);return null}
  },

  // Helper: delay for rate limiting
  _delay(ms){return new Promise(r=>setTimeout(r,ms))},

  // Helper: format pace from m/s
  _fmtPace(mps){
    if(!mps||mps<=0)return'-';
    const sPerKm=1000/mps;
    const m=Math.floor(sPerKm/60);
    const s=Math.round(sPerKm%60);
    return m+':'+String(s).padStart(2,'0');
  },

  // --- UPDATED: Sync workouts with detail + streams ---
  async syncWorkouts(){
    const token=await this.getToken();
    if(!token)return 0;
    let count=0;
    try{
      // Fetch activity list
      const after=Math.floor(new Date('2026-04-13')/1000);
      const r=await fetch(`https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=100`,{
        headers:{'Authorization':'Bearer '+token}
      });
      const acts=await r.json();
      if(!Array.isArray(acts))return 0;

      // Filter runs only
      const runs=acts.filter(a=>a.type==='Run'||a.sport_type==='Run');

      for(const a of runs){
        const d=new Date(a.start_date_local);
        const key=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
        const existing=S.getLog(key);
        const dist=Math.round(a.distance/100)/10;
        const pace=this._fmtPace(a.average_speed);
        const hr=a.average_heartrate?Math.round(a.average_heartrate):'';

        // Save basic log
        if(!existing||!existing.distance){
          S.setLog(key,{
            distance:dist,
            pace:pace,
            hr:hr,
            feeling:existing?existing.feeling||'':'',
            notes:existing?existing.notes||'':'',
            status:'done',
            strava_id:a.id
          });
          count++;
        }else if(!existing.strava_id){
          // Update existing log with strava_id
          existing.strava_id=a.id;
          S.setLog(key,existing);
        }

        // Fetch detail + streams if not cached
        const detailKey='strava_detail_'+a.id;
        const streamsKey='strava_streams_'+a.id;

        if(!localStorage.getItem(detailKey)){
          await this._delay(150);
          const detail=await this.getActivityDetail(a.id);
          if(detail&&detail.id){
            // Extract what we need
            const dStore={
              splits:detail.splits_metric||[],
              laps:detail.laps||[],
              cadence:detail.average_cadence||null,
              max_hr:detail.max_heartrate||null,
              max_speed:detail.max_speed||null,
              calories:detail.calories||null,
              suffer_score:detail.suffer_score||null,
              elev_high:detail.elev_high||null,
              elev_low:detail.elev_low||null,
              total_elevation_gain:detail.total_elevation_gain||null,
              gear:detail.gear?detail.gear.name:null,
              description:detail.description||null
            };
            localStorage.setItem(detailKey,JSON.stringify(dStore));
          }
        }

        if(!localStorage.getItem(streamsKey)){
          await this._delay(150);
          const streams=await this.getActivityStreams(a.id);
          if(streams&&!streams.errors){
            localStorage.setItem(streamsKey,JSON.stringify(streams));
          }
        }
      }
    }catch(e){console.error('Strava sync error',e)}
    return count;
  }
};

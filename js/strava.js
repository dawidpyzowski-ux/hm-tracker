// HM Tracker - Strava v4 (Sprint 8: DB module)
const Strava={
  CID:'257506',
  URL:'https://hm-strava.dawid-pyzowski.workers.dev/',
  SCOPE:'read,activity:read_all',

  isConnected(){return !!localStorage.getItem('strava_refresh')},

  authorize(){
    const redir=encodeURIComponent(location.origin+location.pathname);
    location.href='https://www.strava.com/oauth/authorize?client_id='+this.CID+'&redirect_uri='+redir+'&response_type=code&scope='+this.SCOPE+'&approval_prompt=auto';
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

  async getActivityDetail(id){
    const token=await this.getToken();if(!token)return null;
    try{const r=await fetch(this.URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'detail',access_token:token,activity_id:id})});return await r.json();}catch(e){console.error('Detail error',e);return null}
  },

  async getActivityStreams(id){
    const token=await this.getToken();if(!token)return null;
    try{const r=await fetch(this.URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'streams',access_token:token,activity_id:id})});return await r.json();}catch(e){console.error('Streams error',e);return null}
  },

  _delay(ms){return new Promise(r=>setTimeout(r,ms))},

  _fmtPace(mps){
    if(!mps||mps<=0)return'-';
    const s=1000/mps,m=Math.floor(s/60),sc=Math.round(s%60);
    return m+':'+String(sc).padStart(2,'0');
  },

  _extractDetail(d){
    if(!d||!d.id)return null;
    return{splits:d.splits_metric||[],laps:d.laps||[],cadence:d.average_cadence||null,max_hr:d.max_heartrate||null,max_speed:d.max_speed||null,calories:d.calories||null,suffer_score:d.suffer_score||null,elev_high:d.elev_high||null,elev_low:d.elev_low||null,total_elevation_gain:d.total_elevation_gain||null,gear:d.gear?d.gear.name:null,description:d.description||null};
  },

  _betterActivity(a,b){
    const aL=(a.laps||[]).length,bL=(b.laps||[]).length;
    if(aL!==bL)return aL>bL?'a':'b';
    if((a.suffer_score||0)!==(b.suffer_score||0))return(a.suffer_score||0)>(b.suffer_score||0)?'a':'b';
    return 'a';
  },

  async _fetchAndStore(actId,force){
    if(!DB.hasDetail(actId)||force){
      await this._delay(150);
      const detail=await this.getActivityDetail(actId);
      if(detail){
        const ds=this._extractDetail(detail);
        if(ds){
          if(!force&&DB.hasDetail(actId)){
            const old=DB.getDetail(actId);
            if(old&&this._betterActivity(old,ds)==='a'){}
            else DB.setDetail(actId,ds);
          }else DB.setDetail(actId,ds);
        }
      }
    }
    if(!DB.hasStreams(actId)||force){
      await this._delay(150);
      const streams=await this.getActivityStreams(actId);
      if(streams&&!streams.errors) DB.setStreams(actId,streams);
    }
  },

  async syncWorkouts(){
    const token=await this.getToken();if(!token)return 0;
    let count=0;
    try{
      const after=Math.floor(new Date('2026-04-13')/1000);
      const r=await fetch('https://www.strava.com/api/v3/athlete/activities?after='+after+'&per_page=100',{headers:{'Authorization':'Bearer '+token}});
      const acts=await r.json();
      if(!Array.isArray(acts))return 0;
      const runs=acts.filter(a=>a.type==='Run'||a.sport_type==='Run');

      const byDate={};
      for(const a of runs){
        const key=(a.start_date_local||a.start_date||'').slice(0,10);
        if(!byDate[key])byDate[key]=[];
        byDate[key].push(a);
      }

      for(const key of Object.keys(byDate)){
        let activities=byDate[key];
        let bestAct=activities[0];

        if(activities.length>1){
          const groups=[];const used=new Set();
          for(let i=0;i<activities.length;i++){
            if(used.has(i))continue;
            const group=[activities[i]];used.add(i);
            for(let j=i+1;j<activities.length;j++){
              if(used.has(j))continue;
              const d1=activities[i].distance,d2=activities[j].distance;
              if((d1>d2?d2/d1:d1/d2)>0.8){group.push(activities[j]);used.add(j);}
            }
            groups.push(group);
          }
          const allBest=[];
          for(const group of groups){
            if(group.length===1){allBest.push(group[0]);continue;}
            let best=group[0];
            for(let g=1;g<group.length;g++){
              const bS=(best.suffer_score||0)+(best.average_heartrate||0);
              const gS=(group[g].suffer_score||0)+(group[g].average_heartrate||0);
              if(gS>bS||(gS===bS&&group[g].distance>best.distance))best=group[g];
            }
            allBest.push(best);
            console.log('[Strava] Dedup: '+group.length+' on '+key+', kept ID '+best.id);
          }
          allBest.sort((a,b)=>b.distance-a.distance);
          bestAct=allBest[0];
        }

        const a=bestAct;
        const existing=S.getLog(key);
        const dist=Math.round(a.distance/100)/10;
        const pace=this._fmtPace(a.average_speed);
        const hr=a.average_heartrate?Math.round(a.average_heartrate):'';

        if(!existing||!existing.distance){
          S.setLog(key,{distance:dist,pace:pace,hr:hr,feeling:existing?existing.feeling||'':'',notes:existing?existing.notes||'':'',status:'done',strava_id:a.id});
          count++;
        }else if(!existing.strava_id||String(existing.strava_id)!==String(a.id)){
          existing.strava_id=a.id;
          S.setLog(key,existing);
        }
        await this._fetchAndStore(a.id);
      }
    }catch(e){console.error('Strava sync error',e)}
    return count;
  },

  async resyncAll(){
    const token=await this.getToken();if(!token)return 0;
    let count=0;
    try{
      const logs=S.getAllLogs();
      for(const date of Object.keys(logs)){
        const l=logs[date];
        if(l.strava_id){
          console.log('[Resync] '+date+' (ID '+l.strava_id+')...');
          await this._fetchAndStore(l.strava_id,true);
          count++;
        }
      }
    }catch(e){console.error('Resync error',e)}
    console.log('[Resync] Done: '+count);
    return count;
  },

  storageInfo(){DB.storageInfo();}
};

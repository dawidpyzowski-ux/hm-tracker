const Weather={
  _c:null,_t:0,
  async get(){
    if(this._c&&Date.now()-this._t<3600000)return this._c;
    try{
      const r=await fetch('https://api.open-meteo.com/v1/forecast?latitude=52.23&longitude=21.01&current=temperature_2m,weathercode,windspeed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max&timezone=Europe/Warsaw&forecast_days=3');
      this._c=await r.json();this._t=Date.now();return this._c;
    }catch(e){return null}
  },
  paceAdj(t){
    if(t<10)return{adj:0,icon:'\u2744\uFE0F',msg:'Zimno - rozgrzej sie dobrze!'};
    if(t<15)return{adj:0,icon:'\uD83D\uDC4C',msg:'Idealna temperatura!'};
    if(t<20)return{adj:5,icon:'\u2600\uFE0F',msg:'+5 sek/km do planu'};
    if(t<25)return{adj:15,icon:'\uD83C\uDF21\uFE0F',msg:'+15 sek/km, pij wiecej!'};
    if(t<30)return{adj:25,icon:'\uD83D\uDD25',msg:'+25 sek/km, uwazaj!'};
    return{adj:35,icon:'\uD83D\uDEA8',msg:'+35 sek/km, przesun trening!'};
  },
  wmo(code){
    if(code<=1)return'\u2600\uFE0F';if(code<=3)return'\u26C5';
    if(code<=48)return'\uD83C\uDF2B\uFE0F';if(code<=67)return'\uD83C\uDF27\uFE0F';
    if(code<=77)return'\u2744\uFE0F';if(code<=82)return'\uD83C\uDF27\uFE0F';
    return'\u26C8\uFE0F';
  }
};

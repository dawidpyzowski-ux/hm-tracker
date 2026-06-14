// HM Tracker - Weather v2 (Sprint 9: Running Advisor)
const Weather={
  _cache:null,_ts:0,_pos:null,_fasting:false,

  getPosition(){
    return new Promise(function(res){
      if(Weather._pos)return res(Weather._pos);
      if(!navigator.geolocation)return res({lat:52.23,lon:21.01});
      navigator.geolocation.getCurrentPosition(
        function(p){Weather._pos={lat:p.coords.latitude,lon:p.coords.longitude};res(Weather._pos);},
        function(){res({lat:52.23,lon:21.01});},
        {timeout:5000,maximumAge:600000}
      );
    });
  },

  async get(){
    if(Weather._cache&&Date.now()-Weather._ts<600000)return Weather._cache;
    try{
      const pos=await Weather.getPosition();
      const url='https://api.open-meteo.com/v1/forecast?latitude='+pos.lat+'&longitude='+pos.lon
        +'&current=temperature_2m,relativehumidity_2m,apparent_temperature,weathercode,windspeed_10m,winddirection_10m,precipitation,uv_index'
        +'&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max&timezone=auto&forecast_days=1';
      const r=await fetch(url);const d=await r.json();
      Weather._cache=d;Weather._ts=Date.now();return d;
    }catch(e){console.error('Weather error',e);return null}
  },

  wmo(code){
    var m={0:'\u2600',1:'\u26C5',2:'\u26C5',3:'\u2601',45:'\uD83C\uDF2B',48:'\uD83C\uDF2B',
      51:'\uD83C\uDF26',53:'\uD83C\uDF26',55:'\uD83C\uDF27',61:'\uD83C\uDF27',63:'\uD83C\uDF27',65:'\uD83C\uDF27',
      71:'\u2744',73:'\u2744',75:'\u2744',80:'\uD83C\uDF26',81:'\uD83C\uDF27',82:'\u26C8',
      95:'\u26C8',96:'\u26C8',99:'\u26C8'};
    return m[code]||'\uD83C\uDF24';
  },

  paceAdj(temp){
    if(temp<=15)return{adj:0,msg:'Idealna temperatura!',icon:'\u2705'};
    if(temp<=20)return{adj:5,msg:'+5 s/km (cieplo)',icon:'\uD83C\uDF21'};
    if(temp<=25)return{adj:15,msg:'+15 s/km (goraco)',icon:'\u26A0'};
    if(temp<=30)return{adj:25,msg:'+25 s/km (upal!)',icon:'\uD83D\uDD25'};
    return{adj:40,msg:'+40 s/km (ekstremalny upal!)',icon:'\u2622'};
  },

  _windDir(deg){var d=['N','NE','E','SE','S','SW','W','NW'];return d[Math.round(deg/45)%8];},

  _clothing(temp,feelsLike,wind,humidity,rain,code){
    var t=feelsLike||temp;
    var layers={base:'',mid:'',outer:'',legs:'',acc:'',extra:[]};
    if(t<0)layers.base='Bielizna termoaktywna (merino/syntetyk)';
    else if(t<5)layers.base='Koszulka termoaktywna z dlugim rekawem';
    else if(t<10)layers.base='Koszulka z dlugim rekawem';
    else if(t<15)layers.base='Koszulka z dlugim lub krotkim rekawem';
    else if(t<20)layers.base='Koszulka techniczna';
    else layers.base='Lekka koszulka/singlet (najjasniejszy kolor)';

    if(t<-5)layers.mid='Bluza polarowa / softshell';
    else if(t<5)layers.mid='Lekka bluza biegowa';
    else if(t<10)layers.mid='Opcjonalnie: rekawki lub lekka bluza';
    else layers.mid='';

    if(rain>0||(code>=51&&code<=67))layers.outer='Kurtka przeciwdeszczowa (lekka, oddychajaca)';
    else if(t<0)layers.outer='Kurtka wiatroszczelna';
    else if(t<5&&wind>15)layers.outer='Kamizelka wiatroszczelna';
    else if(wind>25)layers.outer='Kamizelka wiatroszczelna';
    else layers.outer='';

    if(t<0)layers.legs='Getry termiczne / legginsy ocieplane';
    else if(t<5)layers.legs='Dluge legginsy biegowe';
    else if(t<10)layers.legs='Legginsy 3/4 lub dluge';
    else if(t<15)layers.legs='Krotkie spodenki lub legginsy 3/4';
    else layers.legs='Krotkie spodenki biegowe';

    var acc=[];
    if(t<0){acc.push('Rekawiczki ocieplane','Czapka/buff','Ocieplacz na szyje');}
    else if(t<5){acc.push('Lekkie rekawiczki','Opaska na uszy');}
    else if(t<10){acc.push('Opcjonalnie: cienkie rekawiczki');}
    if(t>20)acc.push('Czapka z daszkiem');
    if(t>22||(code<3&&t>15))acc.push('Krem z filtrem SPF 30+');
    if(humidity>75&&t>20)acc.push('Opaska na pot');
    layers.acc=acc.join(', ');

    if(t>28)layers.extra.push('\u26A0 UPAL: Rozwaz przesuniecie treningu na rano/wieczor');
    if(t<-10)layers.extra.push('\u26A0 MROZ: Oddychaj przez nos lub buff!');
    if(wind>30)layers.extra.push('\u26A0 SILNY WIATR: Wybierz oslaniana trase');
    if(rain>5)layers.extra.push('\u26A0 INTENSYWNY DESZCZ: Rozwaz bieznie lub przesun trening');
    if(humidity>85&&t>25)layers.extra.push('\u26A0 WYSOKA WILGOTNOSC + UPAL: Skroc trening, pij co 15 min');
    return layers;
  },

  _performance(temp,humidity,wind,rain){
    var score=10,effects=[];
    if(temp>=15&&temp<=18){effects.push({icon:'\u2705',text:'Idealna temperatura do biegania',impact:0});}
    else if(temp<0){var a=Math.round(Math.abs(temp)*2);effects.push({icon:'\u2744',text:'Zimno: organizm zuzywa energie na termoregulacje',impact:-a});score-=Math.min(3,a/10);}
    else if(temp<10){effects.push({icon:'\uD83C\uDF21',text:'Chlodno: dobra pogoda po rozgrzewce',impact:0});}
    else if(temp>25){var a2=Math.round((temp-15)*1.5);effects.push({icon:'\uD83D\uDD25',text:'Goraco: +'+a2+' s/km, szybsze odwodnienie',impact:-a2});score-=Math.min(4,a2/10);}
    else if(temp>20){var a3=Math.round((temp-15)*1);effects.push({icon:'\u26A0',text:'Cieplo: +'+a3+' s/km spowolnienie',impact:-a3});score-=1;}

    if(humidity>80&&temp>20){effects.push({icon:'\uD83D\uDCA6',text:'Wilgotnosc '+humidity+'%: pot nie odparowuje, gorsze chlodzenie',impact:-5});score-=2;}
    else if(humidity>70&&temp>22){effects.push({icon:'\uD83D\uDCA6',text:'Podwyzszona wilgotnosc: wiecej pij',impact:-2});score-=1;}
    else if(humidity<30){effects.push({icon:'\uD83C\uDFDC',text:'Suche powietrze: nawadniaj sluzowki',impact:0});}

    if(wind>25){effects.push({icon:'\uD83C\uDF2C',text:'Silny wiatr '+Math.round(wind)+' km/h: +'+Math.round(wind/5)+' s/km pod wiatr',impact:-Math.round(wind/5)});score-=2;}
    else if(wind>15){effects.push({icon:'\uD83C\uDF2C',text:'Wiatr '+Math.round(wind)+' km/h: lekki opor',impact:-Math.round(wind/8)});score-=1;}

    if(rain>2){effects.push({icon:'\uD83C\uDF27',text:'Deszcz: sliska nawierzchnia, ciezsze buty',impact:-3});score-=1;}

    score=Math.max(1,Math.min(10,Math.round(score)));
    return{score:score,effects:effects};
  },

  _nutrition(temp,humidity,fasting){
    var tips=[];
    if(fasting){
      tips.push({icon:'\uD83C\uDF19',text:'Bieg na czczo: max 60-75 min w strefie Z1-Z2'});
      tips.push({icon:'\u26A1',text:'Przed: szklanka wody + szczypta soli'});
      tips.push({icon:'\uD83C\uDF4C',text:'Miej ze soba zel energetyczny na wypadek slabosci'});
      if(temp>22)tips.push({icon:'\u26A0',text:'Goraco + na czczo = wieksze ryzyko hipoglikemii! Skroc trening'});
      tips.push({icon:'\uD83C\uDF73',text:'Po treningu: w ciagu 30 min posilek z weglowodanow + bialkiem'});
    }else{
      tips.push({icon:'\uD83C\uDF5D',text:'Posilek 1.5-2h przed treningiem'});
      tips.push({icon:'\u2705',text:'Idealne: tosty + banan + odrobina masla orzechowego'});
      if(temp>25){
        tips.push({icon:'\uD83D\uDCA7',text:'Upal: dodaj elektrolity do wody (sod, potas, magnez)'});
        tips.push({icon:'\u23F0',text:'Pij 400-600 ml 2h przed, 150-200 ml co 15 min w trakcie'});
      }else if(temp<5){
        tips.push({icon:'\u2615',text:'Zimno: ciepla herbata z miodem 30 min przed biegiem'});
        tips.push({icon:'\uD83C\uDF6B',text:'Wiecej weglowodanow - organizm zuzywa energie na ogrzewanie'});
      }
      tips.push({icon:'\uD83C\uDF73',text:'Po: bialko + weglowodany w ciagu 30-45 min'});
    }
    if(temp>20||humidity>70){
      tips.push({icon:'\uD83D\uDCA7',text:'Nawodnienie: '+Math.round(35+(temp>25?15:0)+(humidity>70?10:0))+' ml/kg masy ciala dziennie'});
    }
    return tips;
  },

  renderAdvisor(data,fasting){
    if(!data||!data.current)return'';
    var c=data.current;
    var temp=Math.round(c.temperature_2m);
    var feels=c.apparent_temperature?Math.round(c.apparent_temperature):temp;
    var hum=c.relativehumidity_2m||50;
    var wind=Math.round(c.windspeed_10m||0);
    var windDir=Weather._windDir(c.winddirection_10m||0);
    var rain=c.precipitation||0;
    var uv=c.uv_index||0;
    var code=c.weathercode||0;
    var wIcon=Weather.wmo(code);
    var fast=fasting||false;

    var cloth=Weather._clothing(temp,feels,wind,hum,rain,code);
    var perf=Weather._performance(temp,hum,wind,rain);
    var nutr=Weather._nutrition(temp,hum,fast);
    var pace=Weather.paceAdj(temp);

    var sCol=perf.score>=8?'#30D158':perf.score>=5?'#FF9F0A':'#FF453A';

    var h='<div class="weather-advisor">';

    h+='<div class="wa-conditions">';
    h+='<div class="wa-main"><span class="wa-icon">'+wIcon+'</span><span class="wa-temp">'+temp+'\u00B0C</span>';
    if(feels!==temp)h+='<span class="wa-feels">(odczuwalna '+feels+'\u00B0C)</span>';
    h+='</div>';
    h+='<div class="wa-details">';
    h+='<span>\uD83D\uDCA7 '+hum+'%</span>';
    h+='<span>\uD83C\uDF2C '+wind+' km/h '+windDir+'</span>';
    if(rain>0)h+='<span>\uD83C\uDF27 '+rain+' mm</span>';
    if(uv>0)h+='<span>\u2600 UV '+Math.round(uv)+'</span>';
    h+='</div></div>';

    h+='<div class="wa-score"><div class="wa-score-circle" style="border-color:'+sCol+'"><span style="color:'+sCol+'">'+perf.score+'</span><small>/10</small></div><div class="wa-score-label">Warunki do biegania</div>';
    if(pace.adj>0)h+='<div class="wa-pace-adj">'+pace.icon+' '+pace.msg+'</div>';
    h+='</div>';

    h+='<div class="wa-section"><div class="wa-section-title">\uD83D\uDC55 Co na siebie?</div>';
    if(cloth.base)h+='<div class="wa-item"><span class="wa-item-label">Baza:</span> '+cloth.base+'</div>';
    if(cloth.mid)h+='<div class="wa-item"><span class="wa-item-label">Warstwa sr.:</span> '+cloth.mid+'</div>';
    if(cloth.outer)h+='<div class="wa-item"><span class="wa-item-label">Zewn.:</span> '+cloth.outer+'</div>';
    if(cloth.legs)h+='<div class="wa-item"><span class="wa-item-label">Nogi:</span> '+cloth.legs+'</div>';
    if(cloth.acc)h+='<div class="wa-item"><span class="wa-item-label">Akcesoria:</span> '+cloth.acc+'</div>';
    cloth.extra.forEach(function(e){h+='<div class="wa-warning">'+e+'</div>';});
    h+='</div>';

    h+='<div class="wa-section"><div class="wa-section-title">\u26A1 Wplyw na wyniki</div>';
    perf.effects.forEach(function(e){h+='<div class="wa-effect"><span>'+e.icon+'</span> '+e.text+(e.impact?(' <strong style="color:'+(e.impact<0?'#FF453A':'#30D158')+'">'+e.impact+' s/km</strong>'):'')+'</div>';});
    if(!perf.effects.length)h+='<div class="wa-effect">\u2705 Brak negatywnych czynnikow!</div>';
    h+='</div>';

    h+='<div class="wa-section"><div class="wa-section-title">\uD83C\uDF4C Zywienie '+(fast?'(na czczo)':'(po posilku)')+'</div>';
    h+='<div class="wa-toggle"><button class="wa-btn'+(fast?'':' act')+'" onclick="Weather._setFast(false)">Po posilku</button><button class="wa-btn'+(fast?' act':'')+'" onclick="Weather._setFast(true)">Na czczo</button></div>';
    nutr.forEach(function(t){h+='<div class="wa-tip"><span>'+t.icon+'</span> '+t.text+'</div>';});
    h+='</div>';

    h+='</div>';
    return h;
  },

  _setFast(v){
    Weather._fasting=v;
    if(Weather._cache){
      var slot=document.getElementById('weather-slot');
      if(slot)slot.innerHTML=Weather.renderAdvisor(Weather._cache,v);
    }
  }
};


// HM Tracker - Weather v3 (Sprint 9: Netto Impact + HR + Fasting per Training)
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

 
  _layers(temp,humidity,wind,rain,c.uv_index){
    var l={base:'',mid:'',legs:'',accessories:[],warnings:[]};
    var acc=l.accessories, warn=l.warnings;
    
    // BASE LAYER
    if(temp>=27){
      l.base='Lekka, jasna koszulka/singlet z odprowadzaniem potu';
      acc.push('Mokra chusta na szyję/głowę (chłodzenie evaporative)');
    }
    else if(temp>=22){
      l.base='Lekka koszulka tech (jasny kolor)';
    }
    else if(temp>=15){
      l.base='Standardowa koszulka tech';
    }
    else if(temp>=10){
      l.base='Koszulka z długim rękawem tech';
    }
    else if(temp>=5){
      l.base='Termoaktywna koszulka długim rękawem';
    }
    else if(temp>=-5){
      l.base='Termoaktywna baza + lekki mid layer';
    }
    else{
      l.base='Termoaktywna baza warstwowo (Merino lub syntetyk)';
    }
    
    // MID LAYER
    if(temp>=20){
      l.mid='Nie potrzeba';
    }
    else if(temp>=10){
      l.mid='Opcjonalnie: rękawki lub lekka bluza tech';
    }
    else if(temp>=0){
      l.mid='Lekka bluza tech wiatroszczelna';
    }
    else if(temp>=-10){
      l.mid='Cieplejszy mid layer + windproof shell';
    }
    else{
      l.mid='Warstwowo: thermal + windproof + waterproof';
    }
    
    // LEGS
    if(temp>=22){
      l.legs='Krótkie spodenki biegowe';
    }
    else if(temp>=15){
      l.legs='Spodenki lub legginsy 3/4';
    }
    else if(temp>=5){
      l.legs='Legginsy lub spodnie tech (długie)';
    }
    else if(temp>=-5){
      l.legs='Termoaktywne legginsy lub kalesony + spodnie';
    }
    else{
      l.legs='Warstwowe: thermal + windproof spodnie';
    }
    
    // ACCESSORIES — heat-specific
    if(temp>=25){
      acc.push('Czapka z daszkiem lub wiszor (osłonie głowy)');
      acc.push('Krem SPF 30+ (twarz, kark, ramiona)');
      acc.push('Okulary przeciwsłoneczne');
      if(temp>=30){
        acc.unshift('🥶 LÓD: Bidon z lodem');
        acc.push('Elektrolity (sole) — woda nie wystarcza');
      }
    }
    
    // UV-specific
    if(uv!==undefined && uv!==null){
      if(uv>=8){
        acc.push('☀️ UV ' + uv + ' - krem SPF 50+ + czapka');
      }
      else if(uv>=6 && temp<25){
        acc.push('☀️ UV ' + uv + ' - krem SPF 30+');
      }
    }
    
    // COLD-specific
    if(temp<=5){
      acc.push('Rękawiczki tech (cienkie powyżej 0°C, grubsze poniżej)');
      acc.push('Buff lub czapka');
      if(temp<=-5){
        acc.push('Buff na usta (zapobiega zamarzaniu dróg oddechowych)');
        acc.push('Termiczne skarpetki tech');
      }
    }
    
    // RAIN
    if(rain>=5){
      acc.push('💧 Lekka kurtka przeciwdeszczowa');
      acc.push('Czapka z daszkiem (chroń oczy)');
    }
    else if(rain>=2){
      acc.push('Czapka z daszkiem');
    }
    
    // WIND
    if(wind>=25){
      acc.push('💨 Wiatroszczelne ubranie');
    }
    
    // WARNINGS — actionable
    if(temp>=35){
      warn.push('⛔ EKSTREMALNY upał: rozważ odwołanie/skrócenie treningu');
      warn.push('🕐 Najlepszy czas: 5:00-7:00 lub 21:00+');
      warn.push('🚰 Hydratacja CO 15 min, 200ml');
    }
    else if(temp>=30){
      warn.push('⚠️ Bardzo gorąco: skróć trening 30-50%');
      warn.push('🕐 Idealnie: wczesny ranek lub późny wieczór');
      warn.push('🚰 Elektrolity OBOWIĄZKOWE');
    }
    else if(temp>=27){
      warn.push('⚠️ Gorąco: skróć trening 15-25%, zwolnij tempo');
      warn.push('🕐 Wybierz wczesny ranek/wieczór');
      warn.push('🚰 Pij 150-200ml co 20 min');
    }
    else if(temp>=23){
      warn.push('🌡️ Cieplo: easy run OK, hard runs przenieś na wieczór');
    }
    
    if(temp<-10){
      warn.push('❄️ Ekstremalny mróz: rozważ trening w domu');
      warn.push('🫁 Oddychaj przez nos lub buff');
    }
    
    return l;
  },


  
  // ============================================
  // HEAT INDEX (NWS formula)
  // ============================================
  _heatIndex(tempC, rh){
    // NWS Heat Index — działa dla T>=27°C i RH>=40%
    var T=tempC*9/5+32; // C → F
    var R=rh;
    if(T<80||R<40) return tempC; // poniżej progu używamy raw
    var HI=-42.379+2.04901523*T+10.14333127*R-0.22475541*T*R
      -0.00683783*T*T-0.05481717*R*R+0.00122874*T*T*R
      +0.00085282*T*R*R-0.00000199*T*T*R*R;
    return Math.round((HI-32)*5/9*10)/10; // F → C
  },

  // ============================================
  // DEW POINT estimation (Magnus formula)
  // ============================================
  _dewPoint(tempC, rh){
    var a=17.27, b=237.7;
    var alpha=(a*tempC)/(b+tempC)+Math.log(rh/100);
    return (b*alpha)/(a-alpha);
  },

  // ============================================
  // PERFORMANCE SCORING — multi-factor, science-based
  // Based on: Mantzios 2022 (3891 marathoners),
  // Williams 2017, El Helou 2012, Kenney/Armstrong
  // ============================================
  _performance(temp,humidity,wind,rain,apparent,uv){
    var score=10, effects=[], totalPace=0, totalHR=0;
    
    // Use apparent temp jeśli dostarczone, fallback do raw
    var effTemp = (apparent !== undefined && apparent !== null) ? apparent : temp;
    var heatIdx = this._heatIndex(temp, humidity);
    var dewPt = this._dewPoint(temp, humidity);
    
    // For scoring, używamy MAX z: apparent, heat index (worse case dla biegacza)
    var scoreTemp = Math.max(effTemp, heatIdx);
    
    // ============================================
    // 1. TEMPERATURE penalty (sport science)
    // 5-13°C = optimal (Mantzios 2022 finding)
    // ============================================
    
    if(scoreTemp>=5 && scoreTemp<=13){
      // OPTIMAL ZONE
      effects.push({icon:'✅',text:'Idealna temperatura ('+Math.round(scoreTemp)+'°C odczuwalna): zero spowolnienia',pace:0,hr:0});
    }
    else if(scoreTemp>=14 && scoreTemp<=18){
      // Slight warmth
      var p1=Math.round((scoreTemp-13)*1);
      effects.push({icon:'🌡️',text:'Lekko cieplo ('+Math.round(scoreTemp)+'°C): minimalne spowolnienie',pace:+p1,hr:+1});
      totalPace+=p1; totalHR+=1; score-=0.5;
    }
    else if(scoreTemp>=19 && scoreTemp<=22){
      // Warm
      var p2=Math.round((scoreTemp-13)*1.5);
      var h2=Math.round((scoreTemp-18)*1);
      effects.push({icon:'🌡️',text:'Cieplo ('+Math.round(scoreTemp)+'°C): drobne spowolnienie',pace:+p2,hr:+h2});
      totalPace+=p2; totalHR+=h2; score-=1;
    }
    else if(scoreTemp>=23 && scoreTemp<=26){
      // Hot
      var p3=Math.round((scoreTemp-13)*2);
      var h3=Math.round((scoreTemp-18)*1.2);
      effects.push({icon:'🌡️',text:'Goraco ('+Math.round(scoreTemp)+'°C): znaczace spowolnienie (5%)',pace:+p3,hr:+h3});
      totalPace+=p3; totalHR+=h3; score-=2;
    }
    else if(scoreTemp>=27 && scoreTemp<=30){
      // Very hot
      var p4=Math.round((scoreTemp-13)*2.5);
      var h4=Math.round((scoreTemp-18)*1.5);
      effects.push({icon:'🔥',text:'Bardzo goraco ('+Math.round(scoreTemp)+'°C): spowolnienie 7-8%',pace:+p4,hr:+h4});
      totalPace+=p4; totalHR+=h4; score-=4;
    }
    else if(scoreTemp>=31 && scoreTemp<=34){
      // Dangerous
      var p5=Math.round((scoreTemp-13)*2.8);
      var h5=Math.round((scoreTemp-18)*1.7);
      effects.push({icon:'🔥',text:'NIEBEZPIECZNE ('+Math.round(scoreTemp)+'°C): spowolnienie 8-10%, ryzyko zdrowia',pace:+p5,hr:+h5});
      totalPace+=p5; totalHR+=h5; score-=6;
    }
    else if(scoreTemp>=35 && scoreTemp<=38){
      // Extreme
      var p6=Math.round((scoreTemp-13)*3);
      var h6=Math.round((scoreTemp-18)*1.8);
      effects.push({icon:'⛔',text:'EKSTREMALNE ('+Math.round(scoreTemp)+'°C): spowolnienie 10-12%, RYZYKO HIPERTERMII',pace:+p6,hr:+h6});
      totalPace+=p6; totalHR+=h6; score-=8;
    }
    else if(scoreTemp>=39){
      // Medical risk
      var p7=Math.round((scoreTemp-13)*3.5);
      var h7=Math.round((scoreTemp-18)*2);
      effects.push({icon:'⛔',text:'RYZYKO MEDYCZNE ('+Math.round(scoreTemp)+'°C): NIE BIEGAJ. Hipertermia',pace:+p7,hr:+h7});
      totalPace+=p7; totalHR+=h7; score=0;
    }
    // === COLD ===
    else if(scoreTemp>=0 && scoreTemp<=4){
      var pC1=Math.round((5-scoreTemp)*1);
      var hC1=Math.round((5-scoreTemp)*0.4);
      effects.push({icon:'❄️',text:'Chlodno ('+Math.round(scoreTemp)+'°C): rozgrzewka 15 min',pace:+pC1,hr:+hC1});
      totalPace+=pC1; totalHR+=hC1; score-=1;
    }
    else if(scoreTemp>=-5 && scoreTemp<=-1){
      var pC2=Math.round(Math.abs(scoreTemp)*1.5);
      var hC2=Math.round(Math.abs(scoreTemp)*0.6);
      effects.push({icon:'❄️',text:'Zimno ('+Math.round(scoreTemp)+'°C): termoregulacja kosztuje',pace:+pC2,hr:+hC2});
      totalPace+=pC2; totalHR+=hC2; score-=2;
    }
    else if(scoreTemp>=-10 && scoreTemp<=-6){
      var pC3=Math.round(Math.abs(scoreTemp)*2);
      var hC3=Math.round(Math.abs(scoreTemp)*0.8);
      effects.push({icon:'❄️',text:'Mroz ('+Math.round(scoreTemp)+'°C): oddychaj przez buff!',pace:+pC3,hr:+hC3});
      totalPace+=pC3; totalHR+=hC3; score-=4;
    }
    else if(scoreTemp<-10){
      var pC4=Math.round(Math.abs(scoreTemp)*2.5);
      var hC4=Math.round(Math.abs(scoreTemp)*1);
      effects.push({icon:'⛔',text:'EKSTREMALNY MROZ ('+Math.round(scoreTemp)+'°C): ryzyko zdrowia',pace:+pC4,hr:+hC4});
      totalPace+=pC4; totalHR+=hC4; score-=7;
    }
    
    // ============================================
    // 2. DEW POINT (lepiej niż RH dla biegacza)
    // ============================================
    if(dewPt>=21 && temp>18){
      effects.push({icon:'💧',text:'Dew point '+Math.round(dewPt)+'°C: oppressive, pot nie odparowuje',pace:+4,hr:+5});
      totalPace+=4; totalHR+=5; score-=2;
    }
    else if(dewPt>=18 && temp>18){
      effects.push({icon:'💧',text:'Dew point '+Math.round(dewPt)+'°C: muggy, redukcja chlodzenia',pace:+2,hr:+3});
      totalPace+=2; totalHR+=3; score-=1;
    }
    else if(dewPt>=16 && temp>20){
      effects.push({icon:'💧',text:'Dew point '+Math.round(dewPt)+'°C: sticky',pace:+1,hr:+1});
      totalPace+=1; totalHR+=1; score-=0.5;
    }
    
    // ============================================
    // 3. HUMIDITY (additional dla extreme)
    // ============================================
    if(humidity<25){
      effects.push({icon:'🏜️',text:'Bardzo sucho ('+humidity+'%): nawadniaj sluzowki',pace:0,hr:0});
    }
    
    // ============================================
    // 4. WIND
    // ============================================
    if(wind>=40){
      effects.push({icon:'💨',text:'EKSTREMALNY wiatr '+Math.round(wind)+' km/h: niebezpieczne',pace:+8,hr:+3});
      totalPace+=8; totalHR+=3; score-=3;
    }
    else if(wind>=25){
      var wp1=Math.round(wind/5);
      effects.push({icon:'💨',text:'Silny wiatr '+Math.round(wind)+' km/h (loop: ~+'+Math.round(wp1/2)+', out-back: ~zero)',pace:+Math.round(wp1/2),hr:+2});
      totalPace+=Math.round(wp1/2); totalHR+=2; score-=2;
    }
    else if(wind>=15){
      var wp2=Math.round(wind/8);
      effects.push({icon:'💨',text:'Wiatr '+Math.round(wind)+' km/h: lekki opor',pace:+wp2,hr:+1});
      totalPace+=wp2; totalHR+=1; score-=1;
    }
    
    // ============================================
    // 5. RAIN
    // ============================================
    if(rain>=15){
      effects.push({icon:'🌧️',text:'Ulewa '+rain.toFixed(1)+' mm/h: niebezpieczne, ryzyko hipotermii',pace:+8,hr:+2});
      totalPace+=8; totalHR+=2; score-=3;
    }
    else if(rain>=5){
      effects.push({icon:'🌧️',text:'Deszcz '+rain.toFixed(1)+' mm/h: sliska, mokra',pace:+4,hr:+1});
      totalPace+=4; totalHR+=1; score-=2;
    }
    else if(rain>=2){
      effects.push({icon:'🌦️',text:'Lekki deszcz: sliska nawierzchnia',pace:+2,hr:0});
      totalPace+=2; score-=1;
    }
    else if(rain>=0.5){
      effects.push({icon:'🌦️',text:'Mzawka: schlodzi, OK',pace:0,hr:0});
    }
    
    // ============================================
    // 6. UV INDEX (długi run >1h)
    // ============================================
    if(uv!==undefined && uv!==null){
      if(uv>=11){
        effects.push({icon:'☀️',text:'UV '+uv+' EKSTREMALNY: przesun trening, full shade',pace:0,hr:+1});
        totalHR+=1; score-=2;
      }
      else if(uv>=8){
        effects.push({icon:'☀️',text:'UV '+uv+' bardzo wysoki: SPF 50+, czapka',pace:0,hr:0});
        score-=1.5;
      }
      else if(uv>=6){
        effects.push({icon:'☀️',text:'UV '+uv+' wysoki: SPF 30+, czapka',pace:0,hr:0});
        score-=1;
      }
      else if(uv>=3){
        effects.push({icon:'☀️',text:'UV '+uv+' umiarkowany: krem SPF 30+',pace:0,hr:0});
        score-=0.5;
      }
    }
    
    // ============================================
    // FINAL SCORE
    // ============================================
    score=Math.max(0,Math.min(10,Math.round(score)));
    
    // Determine status emoji
    var status;
    if(score>=9) status='🟢';
    else if(score>=7) status='🟢';
    else if(score>=5) status='🟡';
    else if(score>=3) status='🟠';
    else if(score>=1) status='🔴';
    else status='⛔';
    
    return{
      score:score,
      status:status,
      effects:effects,
      totalPace:totalPace,
      totalHR:totalHR,
      heatIndex:Math.round(heatIdx*10)/10,
      dewPoint:Math.round(dewPt*10)/10,
      effectiveTemp:Math.round(scoreTemp*10)/10
    };
  },

  _getNextTraining(){
    if(typeof PLAN==='undefined'||typeof getDayDate==='undefined')return null;
    var now=new Date();
    var td=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');
    for(var wi=0;wi<PLAN.length;wi++){
      var w=PLAN[wi];
      for(var di=0;di<w.days.length;di++){
        var d=w.days[di];
        var dt=getDayDate(w.start,d.dow);
        if(dt===td&&!d.rest)return{type:d.type,km:d.km,desc:d.desc,date:dt,name:d.name,isToday:true};
      }
    }
    for(var wi2=0;wi2<PLAN.length;wi2++){
      var w2=PLAN[wi2];
      for(var di2=0;di2<w2.days.length;di2++){
        var d2=w2.days[di2];
        var dt2=getDayDate(w2.start,d2.dow);
        if(dt2>td&&!d2.rest)return{type:d2.type,km:d2.km,desc:d2.desc,date:dt2,name:d2.name,isToday:false};
      }
    }
    return null;
  },

  _fastingAdvice(training){
    if(!training)return{ok:true,icon:'\u2753',label:'Brak danych o treningu',msg:''};
    var t=training.type.toLowerCase();
    var km=training.km||0;

    if(km>=12)return{ok:false,icon:'\u274C',label:'NIE na czczo!',msg:'Dlugi bieg '+km+' km wymaga pelnych zapasow glikogenu. Zjedz 1.5-2h przed (owsianka/tosty + banan). Zel co 45 min w trakcie.'};

    if(t.indexOf('interwal')!==-1||t.indexOf('tempo')!==-1||t.indexOf('fartlek')!==-1||t.indexOf('progowy')!==-1||t.indexOf('threshold')!==-1)
      return{ok:false,icon:'\u274C',label:'NIE na czczo!',msg:'Trening '+training.type+' wymaga glikogenu na szybkosc. Lekki posilek 1.5-2h przed (tosty + banan + maslo orzechowe).'};

    if(t.indexOf('easy')!==-1||t.indexOf('lekki')!==-1||t.indexOf('regen')!==-1||t.indexOf('recovery')!==-1||km<=8)
      return{ok:true,icon:'\u2705',label:'OK na czczo',msg:'Lekki bieg '+km+' km w Z1-Z2. Max 60-75 min. Wez zel na wszelki wypadek. Woda + szczypta soli przed.'};

    if(km>8&&km<12)return{ok:false,icon:'\u26A0',label:'Lepiej po posilku',msg:'Bieg '+km+' km moze byc za dlugi na czczo. Lekki posilek 1.5h przed lub chociaz banan + kawa.'};

    return{ok:true,icon:'\u2753',label:'Zalezy od intensywnosci',msg:'Jesli bieg spokojny (<60 min) - ok na czczo. Jesli szybki - zjedz cos przed.'};
  },

  _nutrition(temp,humidity,fasting,training){
    var tips=[];
    var fa=Weather._fastingAdvice(training);

    if(fasting){
      tips.push({icon:fa.icon,text:fa.label+': '+fa.msg});
      if(fa.ok){
        tips.push({icon:'\u26A1',text:'Przed: szklanka wody + szczypta soli'});
        tips.push({icon:'\uD83C\uDF4C',text:'Miej ze soba zel energetyczny na wypadek slabosci'});
        if(temp>22)tips.push({icon:'\u26A0',text:'Goraco + na czczo = wieksze ryzyko hipoglikemii! Skroc trening'});
      }
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
    var perf=Weather._performance(temp,hum,wind,rain,c.apparent_temperature,c.uv_index);
    var training=Weather._getNextTraining();
    var nutr=Weather._nutrition(temp,hum,fast,training);
    var fa=Weather._fastingAdvice(training);

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

    h+='<div class="wa-score">';
    h+='<div class="wa-score-circle" style="border-color:'+sCol+'"><span style="color:'+sCol+'">'+perf.score+'</span><small>/10</small></div>';
    h+='<div class="wa-score-info"><div class="wa-score-label">Warunki do biegania</div>';
    h+='<div class="wa-netto">';
    if(perf.totalPace>0)h+='<span class="wa-netto-item pace">\u23F1 Tempo: <strong>+'+perf.totalPace+' s/km</strong></span>';
    else h+='<span class="wa-netto-item ok">\u23F1 Tempo: <strong>bez zmian</strong></span>';
    if(perf.totalHR>0)h+='<span class="wa-netto-item hr">\u2764 HR: <strong>+'+perf.totalHR+' bpm</strong></span>';
    else h+='<span class="wa-netto-item ok">\u2764 HR: <strong>bez zmian</strong></span>';
    h+='</div>';
    h+='</div></div>';

    h+='<div class="wa-section"><div class="wa-section-title">\uD83D\uDC55 Co na siebie?</div>';
    if(cloth.base)h+='<div class="wa-item"><span class="wa-item-label">Baza:</span> '+cloth.base+'</div>';
    if(cloth.mid)h+='<div class="wa-item"><span class="wa-item-label">Warstwa sr.:</span> '+cloth.mid+'</div>';
    if(cloth.outer)h+='<div class="wa-item"><span class="wa-item-label">Zewn.:</span> '+cloth.outer+'</div>';
    if(cloth.legs)h+='<div class="wa-item"><span class="wa-item-label">Nogi:</span> '+cloth.legs+'</div>';
    if(cloth.acc)h+='<div class="wa-item"><span class="wa-item-label">Akcesoria:</span> '+cloth.acc+'</div>';
    cloth.extra.forEach(function(e){h+='<div class="wa-warning">'+e+'</div>';});
    h+='</div>';

    h+='<div class="wa-section"><div class="wa-section-title">\u26A1 Wplyw na wyniki (szczegoly)</div>';
    perf.effects.forEach(function(e){
      var imp='';
      if(e.pace>0)imp+=' <strong style="color:#FF9F0A">+'+e.pace+' s/km</strong>';
      if(e.hr>0)imp+=' <strong style="color:#FF453A">+'+e.hr+' bpm</strong>';
      h+='<div class="wa-effect"><span>'+e.icon+'</span> '+e.text+imp+'</div>';
    });
    if(!perf.effects.length)h+='<div class="wa-effect">\u2705 Brak negatywnych czynnikow!</div>';
    h+='</div>';

    h+='<div class="wa-section"><div class="wa-section-title">\uD83C\uDF4C Zywienie '+(fast?'(na czczo)':'(po posilku)')+'</div>';

    if(training){
      var tCol=fa.ok?'#30D158':'#FF453A';
      h+='<div class="wa-training"><div class="wa-training-head">';
      h+='<span class="wa-training-label">'+(training.isToday?'\uD83C\uDFC3 Dzisiejszy trening':'\u27A1 Nastepny trening ('+training.name+')')+'</span>';
      h+='</div>';
      h+='<div class="wa-training-type">'+training.type+' \u2022 '+training.km+' km</div>';
      h+='<div class="wa-fasting-verdict" style="color:'+tCol+'">'+fa.icon+' '+fa.label+'</div>';
      h+='</div>';
    }

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

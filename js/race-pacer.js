// HM Tracker - Race Day Pacer (Sprint 5)
const Pacer={
  TGT:105*60,DIST:21.0975,curKm:0,splits:[],startT:null,running:false,timerIv:null,
  targets(){
    const avg=this.TGT/this.DIST;const sp=[];
    for(let i=1;i<=21;i++){
      let p;
      if(i<=5)p=avg+5;else if(i<=10)p=avg+2;else if(i<=15)p=avg-1;else if(i<=19)p=avg-4;else p=avg-8;
      sp.push({km:i,tp:Math.round(p),tt:0});
    }
    sp.push({km:21.0975,tp:Math.round(avg-10),tt:0});
    let ct=0;sp.forEach((s,i)=>{const d=i===0?1:(i<21?1:0.0975);ct+=s.tp*d;s.tt=Math.round(ct)});
    return sp;
  },
  ft(s){if(s==null)return'-';const h=Math.floor(s/3600),m=Math.floor(s%3600/60),sc=Math.round(s%60);return h>0?h+':'+String(m).padStart(2,'0')+':'+String(sc).padStart(2,'0'):m+':'+String(sc).padStart(2,'0')},
  fp(s){return Math.floor(s/60)+':'+String(Math.round(s%60)).padStart(2,'0')},
  start(){this.startT=Date.now();this.running=true;this.curKm=0;this.splits=[];this.timerIv=setInterval(()=>this.renderPacer(),1000);this.renderPacer()},
  split(){
    if(!this.running)return;
    this.curKm++;
    const el=Math.round((Date.now()-this.startT)/1000);
    const prev=this.splits.length?this.splits[this.splits.length-1].el:0;
    this.splits.push({km:this.curKm,st:Math.round(el-prev),el,pace:Math.round(el-prev)});
    if(this.curKm>=21){this.running=false;clearInterval(this.timerIv)}
    this.renderPacer();
  },
  predict(){if(!this.splits.length)return this.TGT;const l=this.splits[this.splits.length-1];return Math.round(l.el/l.km*this.DIST)},
  render(){
    const tg=this.targets();
    let h='<div class="pacer-screen"><h1>\uD83C\uDFC1 Race Day Pacer</h1><p class="sub">'+RACE.name+' | Cel: '+this.ft(this.TGT)+'</p>';
    if(!this.running&&!this.splits.length){
      h+='<div class="pacer-info">Plan splitow (negative split)</div>';
      h+='<table class="pacer-splits"><thead><tr><th>Km</th><th>Tempo</th><th>Czas</th></tr></thead><tbody>';
      tg.forEach(s=>{h+='<tr><td>'+(s.km<=21?s.km:'21.1')+'</td><td>'+this.fp(s.tp)+'/km</td><td>'+this.ft(s.tt)+'</td></tr>'});
      h+='</tbody></table>';
      h+='<button class="pacer-start" onclick="Pacer.start()">\u25B6 START</button>';
    }else{
      const el=this.running?Math.round((Date.now()-this.startT)/1000):(this.splits.length?this.splits[this.splits.length-1].el:0);
      const pred=this.predict();
      const diff=this.splits.length?this.splits[this.splits.length-1].el-(tg[this.splits.length-1]||{tt:0}).tt:0;
      const dc=diff<=0?'ahead':diff<=30?'close':'behind';
      h+='<div class="pacer-timer">'+this.ft(el)+'</div>';
      h+='<div class="pacer-status"><div class="pacer-km">'+this.curKm+' / 21.1 km</div>';
      h+='<div class="pacer-predicted">Prognoza: <span class="'+dc+'">'+this.ft(pred)+'</span></div>';
      if(this.splits.length)h+='<div class="pacer-diff '+dc+'">'+(diff<=0?'':'+')+diff+'s vs plan</div>';
      h+='</div>';
      if(this.splits.length&&this.running){
        const lp=this.splits[this.splits.length-1].pace;
        const tp=tg[this.splits.length-1]?tg[this.splits.length-1].tp:299;
        const pd=lp-tp;let msg='',mc='';
        if(pd<-10){msg='\u26A1 Za szybko! Zwolnij!';mc='warn'}
        else if(pd<-3){msg='\uD83D\uDD25 Szybciej niz plan - kontroluj';mc='ok'}
        else if(pd<=3){msg='\u2705 Idealnie w planie!';mc='perfect'}
        else if(pd<=10){msg='\uD83D\uDCAA Lekko wolniej - mozesz nadgonic';mc='ok'}
        else{msg='\u26A0\uFE0F Duzo wolniej niz plan!';mc='warn'}
        h+='<div class="pacer-msg '+mc+'">'+msg+'</div>';
      }
      if(this.running)h+='<button class="pacer-split-btn" onclick="Pacer.split()">\uD83D\uDCCD Km '+(this.curKm+1)+' zaliczony!</button>';
      else if(this.splits.length)h+='<div class="pacer-finish">\uD83C\uDFC1 META! '+this.ft(el)+'</div>';
      if(this.splits.length){
        h+='<table class="pacer-splits"><thead><tr><th>Km</th><th>Split</th><th>Tempo</th><th>Czas</th><th>vs Plan</th></tr></thead><tbody>';
        this.splits.forEach((s,i)=>{const t=tg[i]||{tp:0,tt:0};const d=s.el-t.tt;const c=d<=0?'ahead':d<=15?'close':'behind';
        h+='<tr class="'+c+'"><td>'+s.km+'</td><td>'+this.ft(s.st)+'</td><td>'+this.fp(s.pace)+'/km</td><td>'+this.ft(s.el)+'</td><td>'+(d<=0?'':'+')+d+'s</td></tr>'});
        h+='</tbody></table>';
      }
    }
    h+='</div>';return h;
  },
  renderPacer(){const el=document.getElementById('pacer-view');if(el)el.innerHTML=this.render()}
};

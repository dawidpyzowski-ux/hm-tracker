// HM Tracker - Notifications (Sprint 5)
const Notify={
  isSupported(){return 'Notification' in window},
  async requestPermission(){if(!this.isSupported())return false;const p=await Notification.requestPermission();return p==='granted'},
  isEnabled(){return this.isSupported()&&Notification.permission==='granted'&&localStorage.getItem('notify_on')==='1'},
  enable(){localStorage.setItem('notify_on','1');this.schedule()},
  disable(){localStorage.setItem('notify_on','0')},
  schedule(){
    if(!this.isEnabled())return;
    const t=today(),now=Date.now();
    PLAN.forEach(w=>{w.days.forEach(d=>{
      if(d.rest||d.opt)return;
      const dt=getDayDate(w.start,d.dow);if(dt<=t)return;
      // Evening before: 20:00
      const eve=new Date(dt+'T20:00:00');eve.setDate(eve.getDate()-1);
      const ms1=eve.getTime()-now;
      if(ms1>0&&ms1<7*864e5)setTimeout(()=>this.show('\uD83C\uDFC3 Jutro: '+d.type,d.km+' km | '+d.desc),ms1);
      // Morning of: 07:00
      const morn=new Date(dt+'T07:00:00');
      const ms2=morn.getTime()-now;
      if(ms2>0&&ms2<7*864e5)setTimeout(()=>this.show('\uD83D\uDCAA Dzisiaj: '+d.type,d.km+' km | '+d.desc),ms2);
    })});
  },
  show(title,body){
    if(!this.isEnabled())return;
    try{new Notification(title,{body,icon:'icon-192.png',tag:'hm-'+Date.now(),renotify:true})}catch(e){}
  },
  renderToggle(){
    if(!this.isSupported())return'<div class="empty">Powiadomienia nie wspierane</div>';
    const on=this.isEnabled();
    return '<div class="notify-row"><div><div class="notify-title">\uD83D\uDD14 Powiadomienia</div><div class="notify-desc">'+(on?'Wlaczone - przypomnienia o treningach':'Wylaczone')+'</div></div><button class="notify-btn '+(on?'on':'off')+'" onclick="toggleNotify()">'+(on?'Wylacz':'Wlacz')+'</button></div>';
  }
};

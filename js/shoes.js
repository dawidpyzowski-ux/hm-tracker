const Shoes={
  getAll(){return S.getShoes()||[]},
  save(arr){S.setShoes(arr)},
  add(name,type,maxKm){
    const all=this.getAll();
    all.push({id:Date.now(),name,type,maxKm:maxKm||600,retired:false});
    this.save(all);
  },
  retire(id){
    const all=this.getAll();
    const s=all.find(x=>x.id===id);
    if(s)s.retired=true;
    this.save(all);
  },
  del(id){this.save(this.getAll().filter(x=>x.id!==id))},
  getForDate(d){return S.getShoeLog(d)},
  setForDate(d,id){S.setShoeLog(d,id)},
  calcKm(id){
    const logs=S.getAllLogs();let km=0;
    Object.entries(logs).forEach(([d,l])=>{
      if(l.distance&&this.getForDate(d)===id)km+=parseFloat(l.distance);
    });
    return Math.round(km*10)/10;
  },
  getStats(){
    return this.getAll().filter(s=>!s.retired).map(s=>{
      const km=this.calcKm(s.id);
      return{shoe:s,km,pct:Math.round(km/s.maxKm*100)};
    }).sort((a,b)=>b.km-a.km);
  }
};

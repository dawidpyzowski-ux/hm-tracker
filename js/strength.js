const STR={
  PRESET:[
    {name:'Bulgarian Split Squat',sets:3,reps:10,unit:'na nogę'},
    {name:'Lunges',sets:3,reps:12,unit:'na nogę'},
    {name:'Single Leg Deadlift',sets:3,reps:10,unit:'na nogę'},
    {name:'Calf Raises',sets:3,reps:15,unit:''},
    {name:'Plank',sets:3,reps:45,unit:'sek'},
    {name:'Side Plank',sets:2,reps:30,unit:'sek/stronę'},
    {name:'Dead Bug',sets:2,reps:10,unit:'na stronę'},
    {name:'Glute Bridge',sets:3,reps:12,unit:''}
  ],
  getLog(d){return S.getStrength(d)},
  setLog(d,v){S.setStrength(d,v)},
  isDone(d){const l=this.getLog(d);return!!(l&&l.done)},
  initDay(d){
    if(this.getLog(d))return;
    this.setLog(d,{done:false,exercises:this.PRESET.map(e=>({name:e.name,target:e.sets+'x'+e.reps+(e.unit?' '+e.unit:''),setsDone:0,totalSets:e.sets}))});
  },
  toggleSet(d,idx){
    const l=this.getLog(d);if(!l)return;
    const ex=l.exercises[idx];
    ex.setsDone=ex.setsDone<ex.totalSets?ex.setsDone+1:0;
    l.done=l.exercises.every(e=>e.setsDone>=e.totalSets);
    this.setLog(d,l);
  },
  getWeekCount(){
    let n=0;const t=today();
    for(let i=0;i<7;i++){
      const d=getDayDate(t,-i);
      if(this.isDone(d))n++;
    }
    return n;
  }
};

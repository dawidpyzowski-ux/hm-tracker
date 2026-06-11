// HM Tracker - Training Data
function getDayDate(s,dow){const d=new Date(s+'T12:00:00');d.setDate(d.getDate()+dow);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}

function calcRecovery(sleep,rhr,soreness,energy){
  const base=S.getSettings().rhr||50;
  const a=(sleep/5)*30;
  const b=Math.max(0,Math.min(25,(1-(rhr-base)/15)*25));
  const c=(1-soreness/2)*20;
  const d=(energy/5)*25;
  return Math.round(a+b+c+d);
}

const RACE={date:'2026-09-05',name:'Wizz Air Praski Night Half Marathon',target:'1:44:30 - 1:45:00',pace:'4:58 min/km'};

const ZONES=[{sym:'R',name:'Recovery',pace:'6:50-7:15',usage:'Regeneracja'},{sym:'E',name:'Easy',pace:'6:15-6:40',usage:'Baza aerobowa'},{sym:'M',name:'Moderate',pace:'5:35-5:55',usage:'Biegi progresywne'},{sym:'T',name:'Tempo',pace:'4:55-5:05',usage:'Tempo docelowe'},{sym:'I',name:'Intervals',pace:'4:25-4:45',usage:'VO2max'},{sym:'S',name:'Strides',pace:'4:00-4:15',usage:'Technika'}];

const PLAN=[
 {weekNum:1,phase:'Baza',tag:'baza',start:'2026-06-08',km:42,days:[
  {dow:0,name:'Pon',type:'Odpoczynek',desc:'Dzien wolny / trening silowy',km:0,pace:'-',opt:false,rest:true,race:false},
  {dow:1,name:'Wt',type:'Easy + Rytmy',desc:'8 km @ 6:30-6:40 + 6x100m rytmy + 1.5 km CD',km:10,pace:'6:30-6:40',opt:false,rest:false,race:false},
  {dow:2,name:'Sr',type:'Odpoczynek',desc:'Dzien wolny',km:0,pace:'-',opt:false,rest:true,race:false},
  {dow:3,name:'Czw',type:'Interwaly',desc:'2 km WU + 3x2 km @ 5:00 (trucht 3:00) + 1.5 km CD',km:11.5,pace:'mieszane',opt:false,rest:false,race:false},
  {dow:4,name:'Pt',type:'Recovery Run',desc:'6 km @ 6:50-7:00',km:6,pace:'6:50-7:00',opt:false,rest:false,race:false},
  {dow:5,name:'Sob',type:'Odpoczynek',desc:'Dzien wolny',km:0,pace:'-',opt:false,rest:true,race:false},
  {dow:6,name:'Nd',type:'Long Run',desc:'17 km @ 6:20-6:30',km:17,pace:'6:20-6:30',opt:false,rest:false,race:false},
 ]},
 {weekNum:2,phase:'Baza',tag:'baza',start:'2026-06-15',km:44,days:[
  {dow:0,name:'Pon',type:'Odpoczynek',desc:'Dzien wolny / trening silowy',km:0,pace:'-',opt:false,rest:true,race:false},
  {dow:1,name:'Wt',type:'Easy + Rytmy',desc:'9 km @ 6:20-6:35 + 6x100m rytmy + 1.5 km CD',km:10.5,pace:'6:20-6:35',opt:false,rest:false,race:false},
  {dow:2,name:'Sr',type:'Odpoczynek',desc:'Dzien wolny',km:0,pace:'-',opt:false,rest:true,race:false},
  {dow:3,name:'Czw',type:'Interwaly',desc:'2 km WU + 5x1 km @ 4:55 (trucht 2:30) + 2 km CD',km:11,pace:'mieszane',opt:false,rest:false,race:false},
  {dow:4,name:'Pt',type:'Recovery Run',desc:'6 km @ 6:50-7:00',km:6,pace:'6:50-7:00',opt:false,rest:false,race:false},
  {dow:5,name:'Sob',type:'Odpoczynek',desc:'Dzien wolny',km:0,pace:'-',opt:false,rest:true,race:false},
  {dow:6,name:'Nd',type:'Long Run',desc:'18 km @ 6:20-6:30',km:18,pace:'6:20-6:30',opt:false,rest:false,race:false},
 ]},
 {weekNum:3,phase:'Baza',tag:'baza',start:'2026-06-22',km:47,days:[
  {dow:0,name:'Pon',type:'Odpoczynek',desc:'Dzien wolny / trening silowy',km:0,pace:'-',opt:false,rest:true,race:false},
  {dow:1,name:'Wt',type:'Easy + Rytmy',desc:'9 km @ 6:20-6:35 + 8x100m rytmy + 1.5 km CD',km:10.5,pace:'6:20-6:35',opt:false,rest:false,race:false},
  {dow:2,name:'Sr',type:'Odpoczynek',desc:'Dzien wolny',km:0,pace:'-',opt:false,rest:true,race:false},
  {dow:3,name:'Czw',type:'Interwaly',desc:'2 km WU + 4x1.5 km @ 4:55 (trucht 3:00) + 2 km CD',km:12,pace:'mieszane',opt:false,rest:false,race:false},
  {dow:4,name:'Pt',type:'Recovery Run',desc:'6 km @ 6:50-7:00',km:6,pace:'6:50-7:00',opt:false,rest:false,race:false},
  {dow:5,name:'Sob',type:'Odpoczynek',desc:'Dzien wolny',km:0,pace:'-',opt:false,rest:true,race:false},
  {dow:6,name:'Nd',type:'Long Run',desc:'19 km @ 6:15-6:30',km:19,pace:'6:15-6:30',opt:false,rest:false,race:false},
 ]},
 {weekNum:4,phase:'Deload',tag:'deload',start:'2026-06-29',km:35,days:[
  {dow:0,name:'Pon',type:'Odpoczynek',desc:'Dzien wolny',km:0,pace:'-',opt:false,rest:true,race:false},
  {dow:1,name:'Wt',type:'Easy + Rytmy',desc:'7 km @ 6:30-6:40 + 4x100m rytmy + 1 km CD',km:8.5,pace:'6:30-6:40',opt:false,rest:false,race:false},
  {dow:2,name:'Sr',type:'Odpoczynek',desc:'Dzien wolny',km:0,pace:'-',opt:false,rest:true,race:false},
  {dow:3,name:'Czw',type:'Lekkie interwaly',desc:'2 km WU + 3x1 km @ 5:00 (trucht 2:30) + 1.5 km CD',km:8.5,pace:'mieszane',opt:false,rest:false,race:false},
  {dow:4,name:'Pt',type:'Recovery Run',desc:'5 km @ 7:00',km:5,pace:'7:00',opt:false,rest:false,race:false},
  {dow:5,name:'Sob',type:'Odpoczynek',desc:'Dzien wolny',km:0,pace:'-',opt:false,rest:true,race:false},
  {dow:6,name:'Nd',type:'Long Run',desc:'14 km @ 6:30-6:40',km:14,pace:'6:30-6:40',opt:false,rest:false,race:false},
 ]},
 {weekNum:5,phase:'Budowa',tag:'budowa',start:'2026-07-06',km:47,days:[
  {dow:0,name:'Pon',type:'Easy (opcj.)',desc:'5 km @ 6:30-6:40',km:5,pace:'6:30-6:40',opt:true,rest:false,race:false},
  {dow:1,name:'Wt',type:'Tempo Run',desc:'2 km WU + 20 min @ 5:05-5:10 (~4 km) + 2 km CD',km:8,pace:'mieszane',opt:false,rest:false,race:false},
  {dow:2,name:'Sr',type:'Odpoczynek',desc:'Dzien wolny / trening silowy',km:0,pace:'-',opt:false,rest:true,race:false},
  {dow:3,name:'Czw',type:'Interwaly',desc:'2 km WU + 3x2 km @ 4:55 (trucht 3:00) + 2 km CD',km:12,pace:'mieszane',opt:false,rest:false,race:false},
  {dow:4,name:'Pt',type:'Recovery Run',desc:'6 km @ 6:50-7:00',km:6,pace:'6:50-7:00',opt:false,rest:false,race:false},
  {dow:5,name:'Sob',type:'Odpoczynek',desc:'Dzien wolny',km:0,pace:'-',opt:false,rest:true,race:false},
  {dow:6,name:'Nd',type:'Long Run progr.',desc:'19 km: 15 km @ 6:15 -> 4 km @ 5:40-5:50',km:19,pace:'6:15->5:40',opt:false,rest:false,race:false},
 ]},
 {weekNum:6,phase:'Budowa',tag:'budowa',start:'2026-07-13',km:49,days:[
  {dow:0,name:'Pon',type:'Easy (opcj.)',desc:'5 km @ 6:30',km:5,pace:'6:30',opt:true,rest:false,race:false},
  {dow:1,name:'Wt',type:'Fartlek',desc:'2 km WU + 6x(3min @ 4:50 / 2min trucht) + 2 km CD',km:10,pace:'mieszane',opt:false,rest:false,race:false},
  {dow:2,name:'Sr',type:'Odpoczynek',desc:'Dzien wolny / trening silowy',km:0,pace:'-',opt:false,rest:true,race:false},
  {dow:3,name:'Czw',type:'Interwaly VO2max',desc:'2 km WU + 6x1 km @ 4:40-4:45 (trucht 2:30) + 2 km CD',km:12,pace:'mieszane',opt:false,rest:false,race:false},
  {dow:4,name:'Pt',type:'Recovery Run',desc:'6 km @ 6:50-7:00',km:6,pace:'6:50-7:00',opt:false,rest:false,race:false},
  {dow:5,name:'Sob',type:'Odpoczynek',desc:'Dzien wolny',km:0,pace:'-',opt:false,rest:true,race:false},
  {dow:6,name:'Nd',type:'Long Run progr.',desc:'20 km: 15 km @ 6:15 -> 5 km @ 5:30-5:45',km:20,pace:'6:15->5:30',opt:false,rest:false,race:false},
 ]},
 {weekNum:7,phase:'Budowa',tag:'budowa',start:'2026-07-20',km:52,days:[
  {dow:0,name:'Pon',type:'Easy (opcj.)',desc:'5 km @ 6:30',km:5,pace:'6:30',opt:true,rest:false,race:false},
  {dow:1,name:'Wt',type:'Cruise Intervals',desc:'2 km WU + 4x1.5 km @ 5:00 (trucht 1:30) + 2 km CD',km:12,pace:'mieszane',opt:false,rest:false,race:false},
  {dow:2,name:'Sr',type:'Odpoczynek',desc:'Dzien wolny / trening silowy',km:0,pace:'-',opt:false,rest:true,race:false},
  {dow:3,name:'Czw',type:'Interwaly mieszane',desc:'2 km WU + 3x(1km@4:40+1km@5:00) trucht 2:00 + 2 km CD',km:12,pace:'mieszane',opt:false,rest:false,race:false},
  {dow:4,name:'Pt',type:'Recovery Run',desc:'6 km @ 6:50-7:00',km:6,pace:'6:50-7:00',opt:false,rest:false,race:false},
  {dow:5,name:'Sob',type:'Odpoczynek',desc:'Dzien wolny',km:0,pace:'-',opt:false,rest:true,race:false},
  {dow:6,name:'Nd',type:'Long Run',desc:'21 km @ 6:10-6:25 (steady)',km:21,pace:'6:10-6:25',opt:false,rest:false,race:false},
 ]},
 {weekNum:8,phase:'Deload',tag:'deload',start:'2026-07-27',km:37,days:[
  {dow:0,name:'Pon',type:'Odpoczynek',desc:'Dzien wolny',km:0,pace:'-',opt:false,rest:true,race:false},
  {dow:1,name:'Wt',type:'Easy + Rytmy',desc:'8 km @ 6:25-6:35 + 6x100m rytmy',km:8,pace:'6:25-6:35',opt:false,rest:false,race:false},
  {dow:2,name:'Sr',type:'Odpoczynek',desc:'Dzien wolny',km:0,pace:'-',opt:false,rest:true,race:false},
  {dow:3,name:'Czw',type:'Lekkie tempo',desc:'2 km WU + 15 min @ 5:05 + 2 km CD',km:7,pace:'mieszane',opt:false,rest:false,race:false},
  {dow:4,name:'Pt',type:'Recovery Run',desc:'5 km @ 7:00',km:5,pace:'7:00',opt:false,rest:false,race:false},
  {dow:5,name:'Sob',type:'Odpoczynek',desc:'Dzien wolny',km:0,pace:'-',opt:false,rest:true,race:false},
  {dow:6,name:'Nd',type:'Long Run',desc:'15 km @ 6:25-6:35',km:15,pace:'6:25-6:35',opt:false,rest:false,race:false},
 ]},
 {weekNum:9,phase:'Szczyt',tag:'szczyt',start:'2026-08-03',km:52,days:[
  {dow:0,name:'Pon',type:'Easy (opcj.)',desc:'6 km @ 6:30',km:6,pace:'6:30',opt:true,rest:false,race:false},
  {dow:1,name:'Wt',type:'Tempo HM pace',desc:'2 km WU + 25 min @ 4:58-5:03 (~5 km) + 2 km CD',km:9,pace:'mieszane',opt:false,rest:false,race:false},
  {dow:2,name:'Sr',type:'Odpoczynek',desc:'Dzien wolny / trening silowy',km:0,pace:'-',opt:false,rest:true,race:false},
  {dow:3,name:'Czw',type:'Interwaly ostre',desc:'2 km WU + 5x1 km @ 4:35-4:40 (trucht 2:30) + 2 km CD',km:11,pace:'mieszane',opt:false,rest:false,race:false},
  {dow:4,name:'Pt',type:'Recovery Run',desc:'6 km @ 6:50-7:00',km:6,pace:'6:50-7:00',opt:false,rest:false,race:false},
  {dow:5,name:'Sob',type:'Odpoczynek',desc:'Dzien wolny',km:0,pace:'-',opt:false,rest:true,race:false},
  {dow:6,name:'Nd',type:'Long Run z tempem',desc:'21 km: 10km easy -> 8km @ 5:00-5:05 -> 3km easy | KLUCZOWY!',km:21,pace:'6:15->5:00',opt:false,rest:false,race:false},
 ]},
 {weekNum:10,phase:'Peak',tag:'peak',start:'2026-08-10',km:54,days:[
  {dow:0,name:'Pon',type:'Easy (opcj.)',desc:'6 km @ 6:25',km:6,pace:'6:25',opt:true,rest:false,race:false},
  {dow:1,name:'Wt',type:'Tempo progresywny',desc:'2 km WU + 30min (10\'@5:10->10\'@5:00->10\'@4:50) + 2 km CD',km:10,pace:'5:10->4:50',opt:false,rest:false,race:false},
  {dow:2,name:'Sr',type:'Odpoczynek',desc:'Dzien wolny / trening silowy',km:0,pace:'-',opt:false,rest:true,race:false},
  {dow:3,name:'Czw',type:'Race pace intervals',desc:'2 km WU + 4x2 km @ 4:55-5:00 (trucht 2:30) + 2 km CD',km:14,pace:'mieszane',opt:false,rest:false,race:false},
  {dow:4,name:'Pt',type:'Recovery Run',desc:'6 km @ 6:50-7:00',km:6,pace:'6:50-7:00',opt:false,rest:false,race:false},
  {dow:5,name:'Sob',type:'Odpoczynek',desc:'Dzien wolny',km:0,pace:'-',opt:false,rest:true,race:false},
  {dow:6,name:'Nd',type:'Long Run z tempem',desc:'20 km: 12km easy @ 6:15 -> 8km @ 5:00',km:20,pace:'6:15->5:00',opt:false,rest:false,race:false},
 ]},
 {weekNum:11,phase:'Szczyt',tag:'szczyt',start:'2026-08-17',km:46,days:[
  {dow:0,name:'Pon',type:'Easy (opcj.)',desc:'5 km @ 6:30',km:5,pace:'6:30',opt:true,rest:false,race:false},
  {dow:1,name:'Wt',type:'Symulacja wyscigu',desc:'2 km WU + 5 km @ 4:58 (tempo docelowe!) + 2 km CD',km:9,pace:'mieszane',opt:false,rest:false,race:false},
  {dow:2,name:'Sr',type:'Odpoczynek',desc:'Dzien wolny',km:0,pace:'-',opt:false,rest:true,race:false},
  {dow:3,name:'Czw',type:'Ostre interwaly',desc:'2 km WU + 8x600m @ 4:25-4:30 (trucht 2:00) + 2 km CD',km:10,pace:'mieszane',opt:false,rest:false,race:false},
  {dow:4,name:'Pt',type:'Recovery Run',desc:'6 km @ 6:50-7:00',km:6,pace:'6:50-7:00',opt:false,rest:false,race:false},
  {dow:5,name:'Sob',type:'Odpoczynek',desc:'Dzien wolny',km:0,pace:'-',opt:false,rest:true,race:false},
  {dow:6,name:'Nd',type:'Long Run ostatni',desc:'18 km: 10km easy -> 6km @ 5:00 -> 2km easy',km:18,pace:'6:15->5:00',opt:false,rest:false,race:false},
 ]},
 {weekNum:12,phase:'Taper',tag:'taper',start:'2026-08-24',km:34,days:[
  {dow:0,name:'Pon',type:'Odpoczynek',desc:'Dzien wolny',km:0,pace:'-',opt:false,rest:true,race:false},
  {dow:1,name:'Wt',type:'Ostra piatka',desc:'2 km WU + 3x1 km @ 4:50 (trucht 2:30) + 2 km CD',km:8,pace:'mieszane',opt:false,rest:false,race:false},
  {dow:2,name:'Sr',type:'Odpoczynek',desc:'Dzien wolny',km:0,pace:'-',opt:false,rest:true,race:false},
  {dow:3,name:'Czw',type:'Mini tempo',desc:'2 km WU + 15 min @ 5:00 + 2 km CD',km:7,pace:'mieszane',opt:false,rest:false,race:false},
  {dow:4,name:'Pt',type:'Recovery Run',desc:'5 km @ 7:00',km:5,pace:'7:00',opt:false,rest:false,race:false},
  {dow:5,name:'Sob',type:'Odpoczynek',desc:'Dzien wolny',km:0,pace:'-',opt:false,rest:true,race:false},
  {dow:6,name:'Nd',type:'Long Run',desc:'13 km @ 6:20-6:30 + 4x100m rytmy',km:13,pace:'6:20-6:30',opt:false,rest:false,race:false},
 ]},
 {weekNum:13,phase:'Wyscig!',tag:'race',start:'2026-08-31',km:22,days:[
  {dow:0,name:'Pon',type:'Easy',desc:'5 km @ 6:30 + 4x100m rytmy',km:5,pace:'6:30',opt:false,rest:false,race:false},
  {dow:1,name:'Wt',type:'Odpoczynek',desc:'Dzien wolny',km:0,pace:'-',opt:false,rest:true,race:false},
  {dow:2,name:'Sr',type:'Activation Run',desc:'4 km easy + 3x200m @ tempo wyscigowe',km:5,pace:'mieszane',opt:false,rest:false,race:false},
  {dow:3,name:'Czw',type:'Odpoczynek',desc:'Hydratacja, odpoczynek',km:0,pace:'-',opt:false,rest:true,race:false},
  {dow:4,name:'Pt',type:'Odpoczynek',desc:'Przygotowanie sprzetu, pakiet startowy',km:0,pace:'-',opt:false,rest:true,race:false},
  {dow:5,name:'Sob',type:'WYSCIG!',desc:'Wizz Air Praski Night HM - CEL: SUB 1:45!',km:21.1,pace:'4:58',opt:false,rest:false,race:true},
  {dow:6,name:'Nd',type:'Regeneracja',desc:'Spacer / easy jog 3 km',km:3,pace:'dowolne',opt:false,rest:false,race:false},
 ]},
];

const NUTR={
training:[
 {time:'~2h przed',name:'Sniadanie przed',desc:'Lekkostrawne, bogate w weglowodany',macro:'60-80g W / ~10g B',examples:'Owsianka + banan + miod\n2 tosty z dzemem + sok\nRyz bialy + banan'},
 {time:'30 min po',name:'Po treningu',desc:'Weglowodany + bialko 3:1',macro:'~60g W / 30-40g B',examples:'Shake proteinowy + banan\n3 jajka + 2 tosty + sok\nJogurt grecki + granola + owoce'},
 {time:'~13:00',name:'Obiad',desc:'Pelnowartosciowy posilek',macro:'80-100g W / 35-40g B / 15-20g T',examples:'Kurczak + ryz + brokuly + oliwa\nLosos + makaron + salatka\nIndyk + bataty + warzywa'},
 {time:'~16:00',name:'Podwieczorek',desc:'Przekaska energetyczna',macro:'30-40g W / 15-20g B',examples:'Orzechy + banan\nHummus + marchewki + pita\nKoktajl: mleko + banan + maslo orzech.'},
 {time:'~19:00',name:'Kolacja',desc:'Posilek regeneracyjny z omega-3',macro:'40-60g W / 30-35g B / ~15g T',examples:'Losos + kasza + salatka\nTofu + ryz + warzywa\nOmlet + szpinak + chleb zytni'}
],
rest:[
 {time:'~08:00',name:'Sniadanie',desc:'Wiecej bialka i tluszczow',macro:'40-50g W / 25-30g B / ~15g T',examples:'Jajecznica (3j) + awokado + chleb zytni\nOmlet z warzywami + feta'},
 {time:'~13:00',name:'Obiad',desc:'Bialko + warzywa + zdrowe tluszcze',macro:'50-60g W / ~40g B / ~20g T',examples:'Salatka z quinoa + losos + awokado\nKurczak + warzywa pieczone'},
 {time:'~16:00',name:'Podwieczorek',desc:'Przekaska przeciwzapalna',macro:'20-30g W / ~15g B',examples:'Jogurt grecki + orzechy + jagody\nJablko + maslo migdalowe'},
 {time:'~19:00',name:'Kolacja',desc:'Lekkostrawna z omega-3',macro:'30-40g W / ~30g B / ~15g T',examples:'Indyk + warzywa na parze\nDorsz + salatka + kasza jaglana'}
],
hydration:[
 {type:'Easy Run (<1h)',before:'500 ml wody 1-2h przed',during:'150-200 ml co 20 min',after:'500 ml w ciagu 30 min'},
 {type:'Interwaly / Tempo',before:'500 ml wody 1-2h przed',during:'Izotonik co 15-20 min',after:'500 ml + elektrolity'},
 {type:'Long Run (>1.5h)',before:'500 ml + 200 ml izotonik',during:'150-250 ml izotonik co 15 min + zel co 45-60 min',after:'750 ml + elektrolity'},
 {type:'Recovery Run',before:'500 ml wody',during:'W razie potrzeby',after:'500 ml wody'}
],
supplements:[
 {name:'Magnez (cytrynian)',dose:'300-400 mg',when:'Wieczorem',why:'Skurcze, regeneracja, sen'},
 {name:'Witamina D3',dose:'2000-4000 IU',when:'Rano z posilkiem',why:'Kosci, odpornosc'},
 {name:'Omega-3 (EPA+DHA)',dose:'1-2g',when:'Z posilkiem',why:'Stany zapalne, regeneracja'},
 {name:'Kofeina',dose:'3-6 mg/kg',when:'30-45 min przed wyscigiem',why:'Wydolnosc +2-3%'},
 {name:'Elektrolity',dose:'Wg potrzeb',when:'Podczas/po treningu >1h',why:'Uzupelnienie sodu i potasu'}
],
carbLoading:[
 {day:'Pon 31.08',carbs:'5 g/kg',fiber:'~25g',notes:'Normalna dieta'},
 {day:'Wt 01.09',carbs:'5 g/kg',fiber:'~20g',notes:'Zacznij ograniczac blonnik'},
 {day:'Sr 02.09',carbs:'7 g/kg',fiber:'<15g',notes:'Biale pieczywo, ryz, makaron, banany'},
 {day:'Czw 03.09',carbs:'8-10 g/kg',fiber:'<10g',notes:'Pelne ladowanie! Zmniejsz bialko/tluszcze'},
 {day:'Pt 04.09',carbs:'8-10 g/kg',fiber:'<8g',notes:'Duze sniadanie + obiad, lekka kolacja'},
 {day:'Sob 05.09',carbs:'wg planu',fiber:'0g',notes:'DZIEN WYSCIGU'}
],
raceDay:[
 {time:'08:00-09:00',what:'Duze sniadanie',details:'Owsianka + banan + miod + tosty + sok (~100g W)'},
 {time:'12:00-13:00',what:'Obiad (OSTATNI DUZY)',details:'Makaron + sos pomidorowy + pieczywo biale (~80-100g W)'},
 {time:'16:00-17:00',what:'Lekka przekaska',details:'Pieczywo z dzemem / banan / baton (~40-50g W)'},
 {time:'18:30-19:00',what:'Mini przekaska',details:'Banan + izotonik (~20-30g W)'},
 {time:'20:00-20:15',what:'Zel + woda',details:'Zel energetyczny + 150ml wody'},
 {time:'20:30',what:'Rozgrzewka',details:'10-15 min trucht + 3-4 strides'},
 {time:'~21:00',what:'START!',details:'Tempo 5:02-5:05 - HAMUJ SIE!'},
 {time:'~km 7',what:'Zel #1',details:'Zel energetyczny + lyk wody'},
 {time:'~km 14',what:'Zel #2',details:'Zel energetyczny + lyk wody'},
 {time:'~22:44',what:'META!!!',details:'GRATULACJE! SUB 1:45!'}
],
checklist:['Numer startowy + agrafki','Buty startowe (przetestowane!)','Zegarek GPS naladowany','Zele energetyczne (2-3 szt.)','Pas biegowy','Ubranie na zmiane','Vaseline','Izotonik na rozgrzewke','Plan tempa na zegarku'],
rules:['NIGDY nie testuj nowego jedzenia/zelu w dniu wyscigu!','Trenuj zoladek na long runach.','Carb loading = NIE objadanie sie!','Bieg nocny = duze sniadanie/obiad, lekkie przekaski.','Unikaj alkoholu min. 3 dni przed wyscigiem.','Pij regularnie - bladozolty mocz = OK.','Dzien wyscigu: ZERO blonnika, malo tluszczu.','Kofeina: 3-6 mg/kg 30-45 min przed startem.','Zele bierz PRZY punkcie z woda.','Trzymaj sie planu! Nie zmieniaj strategii!']
};

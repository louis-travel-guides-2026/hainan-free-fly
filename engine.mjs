export const WEEK = ['一','二','三','四','五','六','日'];
export const AIRPORTS = {PEK:'首都',PKX:'大兴',TSN:'天津',SJW:'石家庄'};
export function todayLocal(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
export function minutes(s){const [h,m]=s.split(':').map(Number);return h*60+m;}
export function daysText(ds){return ds.length===7?'每天':ds.map(d=>'周'+WEEK[d-1]).join('、');}
export function arrivalText(f){return f.arrivalVaries?`${f.arrivalMin}–${f.arrivalNextDay&&!f.arrivalMinNextDay?'次日':''}${f.arrival}`:f.arrival||'待补充';}
export function shortDate(s){return s.slice(5).replace('-','.');}
export function readableDate(s){return s.replaceAll('-','.');}
export function addDays(s,n){const d=new Date(s+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
export function weekDay(s){return ((new Date(s+'T00:00:00Z').getUTCDay()+6)%7)+1;}
export function operates(f,s){return s>=f.start&&s<=f.end&&f.days.includes(weekDay(s))&&!(f.excludedDates||[]).includes(s);}
export function searchMatches(f,q){q=q.trim().toLowerCase();return !q||[f.place,f.origin,f.destination,f.number,f.base,f.airline].some(v=>v.toLowerCase().includes(q));}
export function baseFlights(flights,s,today=todayLocal()){
 return flights.filter(f=>s.airports.includes(f.base)&&(s.package==='2666'||f.eligible666)&&(s.includeUncertain||f.status!=='uncertain')&&(s.showExpired||f.end>=today));
}
const pairCache=new Map();
export function pairDates(out,back,outDays=[],inDays=[],today=todayLocal()){
 if(out.direction!=='out'||back.direction!=='in'||out.destination!==back.origin)return null;
 if(out.status==='uncertain'||back.status==='uncertain')return null;
 const key=[out.id,back.id,outDays.join(),inDays.join(),today].join('|');
 if(pairCache.has(key))return pairCache.get(key);
 const start=[out.start,today].sort().at(-1), end=out.end;
 let first=null,last=null,count=0;const examples=[];
 for(let go=start;go<=end;go=addDays(go,1)){
  if(!operates(out,go)||(outDays.length&&!outDays.includes(weekDay(go))))continue;
  let chosen=null;
  for(let offset=0;offset<=7;offset++){
   const ret=addDays(go,offset);
   if(!operates(back,ret)||(inDays.length&&!inDays.includes(weekDay(ret))))continue;
   const arrive=out.arrival?minutes(out.arrival)+(out.arrivalNextDay?1440:0):minutes(out.departure);
   if(offset*1440+minutes(back.departure)<arrive+120)continue;
   chosen={go,return:ret,arrival:back.arrivalNextDay?addDays(ret,1):ret};break;
  }
  if(!chosen)continue;
  first??=chosen;last=chosen;count++;if(examples.length<3)examples.push(chosen);
 }
 const result=first?{first,last,count,examples}:null;pairCache.set(key,result);return result;
}
export function discover(flights,s,today=todayLocal()){
 const grouped=new Map();
 for(const f of baseFlights(flights,s,today)){
  const ds=f.direction==='out'?s.outDays:s.inDays;
  if(ds.length&&!f.days.some(d=>ds.includes(d)))continue;
  if(!grouped.has(f.place))grouped.set(f.place,{place:f.place,out:[],in:[]});
  grouped.get(f.place)[f.direction].push(f);
 }
 const result=[];
 for(const g of grouped.values()){
  if(s.search&&!g.out.concat(g.in).some(f=>searchMatches(f,s.search)))continue;
  g.out.sort((a,b)=>a.departure.localeCompare(b.departure)||a.number.localeCompare(b.number));
  g.in.sort((a,b)=>a.departure.localeCompare(b.departure)||a.number.localeCompare(b.number));
  g.pairCount=0;
  for(const a of g.out)for(const b of g.in)if(pairDates(a,b,s.outDays,s.inDays,s.showExpired?'1900-01-01':today))g.pairCount++;
  g.coverage=g.out.length&&g.in.length?(g.pairCount?'both':'overlap'):g.out.length?'out':'in';
  if(s.coverage!=='all'&&g.coverage!==s.coverage)continue;
  result.push(g);
 }
 return result.sort((a,b)=>a.place.localeCompare(b.place,'zh-CN'));
}
export const TABLE_COLUMNS=[{key:'number',label:'航班号'},{key:'direction',label:'方向'},{key:'origin',label:'起飞机场'},{key:'destination',label:'到达机场'},{key:'departure',label:'起飞时间'},{key:'arrival',label:'到达时间'},{key:'days',label:'每周班期'},{key:'start',label:'生效开始'},{key:'end',label:'生效结束'},{key:'package',label:'适用套餐'}];
export function tableValues(f,key){
 if(key==='days')return f.days.map(n=>'周'+WEEK[n-1]);
 if(key==='direction')return [f.direction==='out'?'去程':'回程'];
 if(key==='package')return [f.eligible666?'666/2666':'仅2666'];
 if(key==='arrival')return [(f.arrivalNextDay&&(!f.arrivalVaries||f.arrivalMinNextDay)?'次日 ':'')+arrivalText(f)];
 return [f[key]??''];
}
function tableSortValue(f,key){if(key==='days')return Math.min(...f.days);if(key==='arrival')return minutes(f.arrival)+(f.arrivalNextDay?1440:0);return tableValues(f,key)[0];}
export function tableFlights(flights,s,today=todayLocal(),ignoreColumn=null){
 const list=baseFlights(flights,s,today).filter(f=>searchMatches(f,s.tableSearch||'')&&Object.entries(s.columnFilters||{}).every(([key,values])=>key===ignoreColumn||tableValues(f,key).some(value=>values.includes(value))));
 const sort=s.columnSort||{key:'departure',direction:'asc'};
 return list.sort((a,b)=>{const av=tableSortValue(a,sort.key),bv=tableSortValue(b,sort.key);const cmp=typeof av==='number'?av-bv:String(av).localeCompare(String(bv),'zh-CN');return cmp*(sort.direction==='desc'?-1:1)||a.number.localeCompare(b.number);});
}
export function getDefaultState(){return {tab:'discover',package:'666',airports:['PEK','PKX'],outDays:[5],inDays:[7],search:'',places:[],coverage:'all',includeUncertain:false,showExpired:false,columnFilters:{},columnSort:{key:'departure',direction:'asc'},tableSearch:''};}
export function validateState(raw){
 const s=getDefaultState();
 if(!raw||typeof raw!=='object')return s;
 if(['666','2666'].includes(raw.package))s.package=raw.package;
 if(['discover','table'].includes(raw.tab))s.tab=raw.tab;
 if(Array.isArray(raw.airports))s.airports=[...new Set(raw.airports.filter(v=>Object.hasOwn(AIRPORTS,v)))];
 for(const k of ['outDays','inDays'])if(Array.isArray(raw[k]))s[k]=[...new Set(raw[k].filter(n=>Number.isInteger(n)&&n>=1&&n<=7))].sort();
 if(['both','all','out','in','overlap'].includes(raw.coverage))s.coverage=raw.coverage;
 for(const k of ['search','tableSearch'])if(typeof raw[k]==='string')s[k]=raw[k].slice(0,80);
 if(Array.isArray(raw.places))s.places=[...new Set(raw.places.filter(p=>typeof p==='string'&&p.length>0&&p.length<=40))].slice(0,200);
 for(const k of ['includeUncertain','showExpired'])s[k]=raw[k]===true;
 const columns=TABLE_COLUMNS.map(c=>c.key);
 if(raw.columnFilters&&typeof raw.columnFilters==='object')for(const key of columns){const values=raw.columnFilters[key];if(Array.isArray(values))s.columnFilters[key]=[...new Set(values.filter(v=>typeof v==='string'&&v.length<=80))].slice(0,300);}
 if(raw.columnSort&&columns.includes(raw.columnSort.key)&&['asc','desc'].includes(raw.columnSort.direction))s.columnSort={key:raw.columnSort.key,direction:raw.columnSort.direction};
 return s;
}

import {installContentGuard} from './content-guard.mjs';
import {WEEK,AIRPORTS,daysText,arrivalText,shortDate,readableDate,discover,tableFlights,tableValues,TABLE_COLUMNS,pairDates,getDefaultState,validateState,todayLocal} from './engine.mjs?v=20261015-calendar';

const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let data,flights=[],byId=new Map(),state=getDefaultState(),expanded=new Set(),selected={out:null,in:null},toastTimer,columnDraft=null;
try{const hash=new URLSearchParams(location.hash.slice(1));const shared=hash.get('q');state=validateState(shared?JSON.parse(shared):JSON.parse(localStorage.getItem('away-filters')||'null'));}catch{}

function announce(s){$('#announcement').textContent=s;}
function toast(s){clearTimeout(toastTimer);$('#toast').textContent=s;$('#toast').classList.add('show');toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),4000);}
installContentGuard(toast);
function save(){try{localStorage.setItem('away-filters',JSON.stringify(state));}catch{}
 const hash=new URLSearchParams(location.hash.slice(1));if(hash.has('q')){hash.set('q',JSON.stringify(state));history.replaceState(null,'',location.pathname+location.search+'#'+hash.toString());}
}
function toggleValue(list,v){return list.includes(v)?list.filter(x=>x!==v):[...list,v].sort((a,b)=>typeof a==='number'?a-b:a.localeCompare(b));}
function daySelection(ds){return ds.length===0?'不限星期':ds.map(n=>'周'+WEEK[n-1]).join('、');}
function airportText(){return state.airports.length?state.airports.map(a=>AIRPORTS[a]).join(' / '):'未选择机场';}
function packageText(f){return f.eligible666?'666 / 2666':'仅2666';}
function nextDayBadge(f){return f.arrivalNextDay&&(!f.arrivalVaries||f.arrivalMinNextDay)?'<sup class="next-day">次日</sup>':'';}
function validity(f,full=true){return full?`${readableDate(f.start)}—${readableDate(f.end)}`:`${shortDate(f.start)}—${shortDate(f.end)}`;}
function controls(){
 for(const kind of ['out','in']){
  const group=$('#'+kind+'-days');
  if(!group.children.length)group.innerHTML=[`<button class="any-day" data-day-kind="${kind}" data-day="0" aria-label="${kind==='out'?'出发':'返回'}不限星期">不限</button>`,...WEEK.map((name,i)=>`<button data-day-kind="${kind}" data-day="${i+1}" aria-label="周${name}${kind==='out'?'出发':'返回'}">周${name}</button>`)].join('');
  group.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',Number(b.dataset.day)===0?state[kind+'Days'].length===0:state[kind+'Days'].includes(Number(b.dataset.day))));
 }
 $$('[data-package]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.package===state.package));
 $$('[data-airport]').forEach(b=>b.setAttribute('aria-pressed',state.airports.includes(b.dataset.airport)));
 $$('[data-coverage]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.coverage===state.coverage));
 $$('[data-tab]').forEach(b=>{const active=b.dataset.tab===state.tab;b.setAttribute('aria-selected',active);b.tabIndex=active?0:-1;});
 $('#week-filters').hidden=state.tab==='table';$('#discover-panel').hidden=state.tab!=='discover';$('#table-panel').hidden=state.tab!=='table';
 $('#include-uncertain').checked=state.includeUncertain;$('#show-expired').checked=state.showExpired;
 $('#destination-search').value=state.search;$('#table-search').value=state.tableSearch;
}
function flightRow(f){
 const picked=selected[f.direction]===f.id;
 return `<article class="flight" aria-label="${esc(f.number)} ${esc(f.origin)}到${esc(f.destination)} ${f.departure}起飞">
 <div class="flight-main"><div class="flight-times"><span class="departure-time">${f.departure}</span><span class="flight-route-arrow" aria-hidden="true">→</span><span class="arrival-time${f.arrivalVaries?' varies':''}">${arrivalText(f)}${nextDayBadge(f)}</span></div><button class="pick-flight" data-pick="${f.id}" aria-pressed="${picked}" aria-label="${picked?'取消选择':'选择'}${f.number}${f.direction==='out'?'去程':'回程'}" ${f.status==='uncertain'?'disabled title="班期待确认，暂不参与组合"':''}>${picked?'已选 ✓':f.direction==='out'?'选去程':'选回程'}</button></div>
 <div class="flight-airports"><span>${esc(f.origin)}</span><span>${esc(f.destination)}</span></div>
 <div class="flight-line"><button class="flight-number" data-detail="${f.id}" title="查看航班详情">${f.number} ↗</button><span class="package-note${!f.eligible666?' extra':''}">${packageText(f)}</span>${f.sourceType==='supplement'?'<span class="tag neutral">其他日期官方记录</span>':''}<span>${f.stops.length?'经停'+esc(f.stops.join('、')):'直飞'}</span></div>
 <div class="flight-validity"><b>${daysText(f.days)}</b><span>${f.sourceType==='supplement'?'核实范围':'有效'} ${validity(f)}</span></div>
 ${f.calendarNote?`<div class="uncertain-note">${f.excludedDates.map(readableDate).join('、')}查询未返回，暂不用于往返日期示例。<button data-detail="${f.id}">查看说明</button></div>`:''}
 ${f.status==='uncertain'?`<div class="uncertain-note">班期待确认 · <button data-detail="${f.id}">查看原因</button></div>`:''}
 </article>`;
}
function column(group,kind){
 const list=group[kind],open=expanded.has(group.place+'-'+kind),shown=open?list:list.slice(0,2);
 return `<div class="flight-column"><div class="column-label"><span class="arrow">${kind==='out'?'↗':'↙'}</span>${kind==='out'?'去程 · 前往'+esc(group.place):'回程 · 返回京津冀'}<span class="col-end">${list.length} 条计划</span></div>${list.length?shown.map(flightRow).join(''):`<div class="empty-direction">所选星期暂无已收录${kind==='out'?'去程':'回程'}</div>`}${list.length>2?`<button class="show-more" data-expand="${esc(group.place)}" data-kind="${kind}" aria-expanded="${open}" aria-label="${open?'收起':'展开'}${esc(group.place)}全部${kind==='out'?'去程':'回程'}">${open?'收起航班 −':`查看其余 ${list.length-2} 条${kind==='out'?'去程':'回程'} ＋`}</button>`:''}</div>`;
}
function empty(message='试试加入天津、石家庄，或放宽出发和返回星期。'){
 return `<div class="empty-state"><div class="empty-icon" aria-hidden="true">↗</div><h3>当前条件下暂无匹配记录</h3><p>${message}</p><button data-reset>重置筛选</button></div>`;
}
function renderDiscovery(){
 const available=discover(flights,state),availableNames=new Set(available.map(g=>g.place));
 state.places=state.places.filter(p=>availableNames.has(p));
 const groups=state.places.length?available.filter(g=>state.places.includes(g.place)):available;
 const visibleFlights=new Set(groups.flatMap(g=>[...g.out,...g.in]).map(f=>f.id));
 for(const dir of ['out','in'])if(selected[dir]&&!visibleFlights.has(selected[dir]))selected[dir]=null;
 $('#available-place-count').textContent=available.length;
 $('#destination-options').innerHTML=available.length?`<button class="destination-option destination-all" data-all-places aria-pressed="${state.places.length===0}" aria-label="显示全部目的地">全部</button>`+available.map(g=>`<button class="destination-option" data-place="${esc(g.place)}" aria-pressed="${state.places.includes(g.place)}" aria-label="筛选目的地：${esc(g.place)}">${esc(g.place)}</button>`).join(''):'<span class="destination-options-empty">当前条件下暂无可选目的地</span>';
 $('#results-title').textContent=state.places.length?`已选 ${groups.length} 个目的地 · 共 ${available.length} 个可选`:`${groups.length} 个目的地，等你出发`;
 $('#results-context').textContent=`${daySelection(state.outDays)}出发 · ${daySelection(state.inDays)}返回 · ${airportText()}`;
 $('#destinations').innerHTML=groups.length?groups.map((g,i)=>`<section class="destination-card"><header class="destination-head"><span class="place-index">${String(i+1).padStart(2,'0')}</span><h3>${esc(g.place)}</h3><div class="destination-tags"><span class="tag${g.coverage==='both'?'':' neutral'}">${({both:'往返都有',out:'仅去程',in:'仅回程',overlap:'双向有效期待匹配'})[g.coverage]}</span>${[...g.out,...g.in].some(f=>f.status==='uncertain')?'<span class="tag warn">含待确认</span>':''}<span class="destination-pair-count">${g.pairCount?g.pairCount+' 组计划可衔接':''}</span></div></header><div class="destination-flights">${column(g,'out')}${column(g,'in')}</div>${g.coverage==='overlap'?'<div class="coverage-warning">两个方向都有记录，但当前星期或有效期无法组成正常往返；待确认航班暂不参与组合。</div>':''}</section>`).join(''):empty(state.airports.length?'试试查看“全部”方向，加入其他机场，或放宽出发、返回星期。':'请至少选择一个可接受的机场。');
 announce(state.places.length?`已选择${groups.length}个目的地，共${available.length}个可选`:`找到${groups.length}个目的地`);
}
function renderTable(){
 const list=tableFlights(flights,state);
 $('#table-title').textContent=`${list.length} 条航班计划`;
 $('#table-context').textContent=`${airportText()} · ${state.package}套餐 · 表中“星期”为实际执行班期`;
 const filterCount=Object.keys(state.columnFilters).length;
 $('#column-filter-status').textContent=filterCount?`已筛选 ${filterCount} 列 · 可继续叠加其他列`:'点击列表头，可像 Excel 一样筛选';
 $('#clear-column-filters').disabled=!filterCount;
 $('#flight-table-head').innerHTML='<tr>'+TABLE_COLUMNS.map(c=>{const active=Object.hasOwn(state.columnFilters,c.key),sort=state.columnSort.key===c.key?state.columnSort.direction:null;return `<th${sort?` aria-sort="${sort==='asc'?'ascending':'descending'}"`:''}><button class="table-column-button${active?' filtered':''}" data-column="${c.key}" aria-label="筛选${c.label}" aria-haspopup="dialog" aria-expanded="false"><span>${c.label}</span>${sort?`<span class="column-sort-mark">${sort==='asc'?'↑':'↓'}</span>`:''}<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 3h12L9.5 8v4l-3 1V8z"/></svg></button></th>`;}).join('')+'<th><span class="sr-only">详情</span></th></tr>';
 $('#flight-table-body').innerHTML=list.length?list.map(f=>'<tr>'+TABLE_COLUMNS.map(c=>`<td>${tableCell(f,c.key)}</td>`).join('')+`<td><button data-detail="${f.id}" aria-label="查看${f.number}详情">↗</button></td></tr>`).join(''):'<tr><td class="table-no-results" colspan="11">暂无匹配记录，可调整表头筛选或清除列筛选。</td></tr>';
 $('#table-empty').innerHTML='';$('.flight-table-wrap').hidden=false;
 announce(`找到${list.length}条航班计划`);
}
function tableCell(f,key){
 if(key==='number')return `<b class="table-primary">${f.number}</b>${f.calendarNote?'<span class="table-sub" style="color:var(--amber)">含日期例外 · 查看详情</span>':''}${f.status==='uncertain'?'<span class="table-sub" style="color:var(--amber)">班期待确认</span>':f.sourceType==='supplement'?'<span class="table-sub">其他日期官方记录</span>':''}`;
 if(key==='departure')return `<span class="table-primary">${f.departure}</span>`;
 if(key==='arrival')return arrivalText(f)+nextDayBadge(f);
 if(key==='days')return daysText(f.days);
 if(key==='start'||key==='end')return `<span class="table-date">${readableDate(f[key])}</span>`;
 if(key==='package')return `<span class="package-note${f.eligible666?'':' extra'}">${packageText(f)}</span>`;
 return esc(tableValues(f,key)[0]);
}
function closeColumnFilter(restore=false){
 const key=columnDraft?.key;$('#column-filter').hidden=true;columnDraft=null;
 $$('[data-column]').forEach(b=>b.setAttribute('aria-expanded','false'));
 if(restore&&key)$(`[data-column="${key}"]`)?.focus({preventScroll:true});
}
function columnOptionLabel(value,key){return key==='start'||key==='end'?readableDate(value):value;}
function matchingColumnOptions(){const q=$('#column-option-search').value.trim().toLowerCase();return columnDraft.options.filter(v=>columnOptionLabel(v,columnDraft.key).toLowerCase().includes(q));}
function renderColumnOptions(){
 if(!columnDraft)return;
 const options=matchingColumnOptions();
 $('#column-options').innerHTML=options.length?options.map(v=>`<label class="column-choice"><input type="checkbox" data-column-choice value="${esc(v)}" ${columnDraft.selected.has(v)?'checked':''}><span>${esc(columnOptionLabel(v,columnDraft.key))}</span></label>`).join(''):'<p class="column-no-options">没有匹配选项</p>';
 $('#column-select-all').textContent=$('#column-option-search').value.trim()?'仅选搜索结果':'全选';
 $('#column-selected-count').textContent=`已选 ${columnDraft.selected.size} 项`;
}
function openColumnFilter(key,button){
 if(columnDraft?.key===key){closeColumnFilter();return;}
 closeColumnFilter();
 const col=TABLE_COLUMNS.find(c=>c.key===key);if(!col)return;
 const options=[...new Set(tableFlights(flights,state,todayLocal(),key).flatMap(f=>tableValues(f,key)))];
 options.sort((a,b)=>key==='days'?WEEK.indexOf(a.slice(1))-WEEK.indexOf(b.slice(1)):a.localeCompare(b,'zh-CN'));
 columnDraft={key,options,selected:new Set(state.columnFilters[key]??options)};
 $('#column-filter-title').textContent=col.label+(key==='days'?' · 任一所选星期执行':'');
 $('#column-option-search').value='';renderColumnOptions();
 $$('[data-column-sort]').forEach(b=>b.setAttribute('aria-pressed',state.columnSort.key===key&&state.columnSort.direction===b.dataset.columnSort));
 const popup=$('#column-filter');popup.hidden=false;button.setAttribute('aria-expanded','true');
 if(window.innerWidth<=600){Object.assign(popup.style,{left:'12px',right:'12px',top:'auto',bottom:'12px',width:'auto'});}
 else{const r=button.getBoundingClientRect();Object.assign(popup.style,{left:Math.max(12,Math.min(r.right-280,window.innerWidth-292))+'px',right:'auto',top:Math.max(12,Math.min(r.bottom+7,window.innerHeight-popup.offsetHeight-12))+'px',bottom:'auto',width:'280px'});}
 $('#column-option-search').focus({preventScroll:true});
}
function renderJourney(){
 const out=byId.get(selected.out),back=byId.get(selected.in),el=$('#journey');
 el.hidden=!out&&!back;document.body.classList.toggle('has-journey',!el.hidden);if(el.hidden)return;
 const chosen=(f,dir)=>f?`<div class="journey-flight"><span>${dir==='out'?'去程':'回程'} · ${f.number}</span><br><strong>${f.departure}</strong>${esc(f.origin)} → ${esc(f.destination)}<br><span>到达 ${arrivalText(f)}${nextDayBadge(f)}</span></div>`:`<div class="journey-placeholder">${dir==='out'?'↗ 再选一班去程':'↙ 再选一班回程'}，对照往返</div>`;
 let match='';
 if(out&&back){
  const pair=pairDates(out,back,state.outDays,state.inDays,state.showExpired?'1900-01-01':todayLocal());
  match=pair?`<strong>计划可衔接</strong> · 去程可匹配范围 ${readableDate(pair.first.go)}—${readableDate(pair.last.go)}<br>一组日期示例：${readableDate(pair.first.go)} 出发 → ${readableDate(pair.first.return)} 返回${pair.first.arrival!==pair.first.return?'，'+readableDate(pair.first.arrival)+'最晚落地':''}<small>按班期、有效期、已注明的日期例外与航班先后检查；示例仍需确认产品不可用日期及官方余票。</small>`:'<strong>这两班暂不能组合</strong> · 班期、有效期或起降顺序无法衔接，请换一班试试。';
 }else match='先选去程，再选同一目的地的回程；允许从不同京津冀机场出发与返回。';
 el.innerHTML=`<div class="journey-head"><b>我的往返对照${out?' · '+esc(out.place):back?' · '+esc(back.place):''}</b><button id="clear-journey" aria-label="清空往返选择">清空 ×</button></div><div class="journey-flights">${chosen(out,'out')}${chosen(back,'in')}</div><div class="journey-match">${match}</div>`;
}
function render(){if(!data)return;controls();if(state.tab==='discover')renderDiscovery();else renderTable();renderJourney();save();}
function change(key,v){closeColumnFilter();state[key]=v;selected={out:null,in:null};render();}
function reset(){closeColumnFilter();const tab=state.tab;state=getDefaultState();state.tab=tab;selected={out:null,in:null};expanded.clear();render();toast('已恢复默认筛选');}
function openDialog(title,html){$('#dialog-title').textContent=title;$('#dialog-body').innerHTML=html;$('#info-dialog').showModal();}
function about(){openDialog('数据与更新',`
 <div class="dialog-info-grid"><div><span>最近一次核对</span><b>${readableDate(data.meta.updated)}</b></div><div><span>当前覆盖</span><b>2026—2027 冬春航季</b></div><div><span>已收录</span><b>${flights.length} 条计划 · 4 个京津冀机场</b></div><div><span>待确认</span><b>${flights.filter(f=>f.status==='uncertain').length} 条，默认排除</b></div></div>
 <section class="dialog-section"><h3>不同机场的核对日期</h3><p>原表：北京首都、北京大兴 2026.10.14；天津滨海、石家庄正定 2026.10.15。<br>其他日期官方记录：2026.10.15核对留存；HU7179于同日再次实时核实。</p></section>
 <section class="dialog-section"><h3>班期与有效期，一起看</h3><p>数据来自官方权益卡适用航班查询，原表以2026年11月23—29日代表周覆盖星期一至星期日，保留查询返回的计划有效期；本次另纳入${data.meta.supplementalPlans}条其他日期官方记录，覆盖${data.meta.supplementalOperatingDates}个有对应日期官方留存命中的执行日。这些记录的“核实范围”按已确认日期整理，未扩大到未查询日期。其他月份独有或临时调整的计划仍可能未收录，不能视为全航季逐日全量。</p><p>“每天”仅表示在该班有效期内每天执行。筛选的“仅去程／仅回程”仅针对当前条件，不代表该目的地永远只有单向航班。</p></section>
 <section class="dialog-section"><h3>到达时间与往返对照</h3><p>到达时间来自留存的官方计划。相同起飞计划存在细微到达差异时，以区间展示；跨午夜显示“次日”。往返对照检查同一外地机场、班期、有效期与起降顺序，返程在去程当天至7天内，至少预留2小时；已注明的查询日期例外不参与示例。当地交通和产品不可用日期需自行核实。</p></section>
 <div class="dialog-note warn">JD5258 石家庄→丽江19:50：11月23日显示一三五日，但11月25、27、29日的适用及全部航班查询均无结果。保留原计划并标为待确认，暂不参与推荐组合。</div>
 <section class="dialog-section"><h3>爱婴撕毯 · 独立整理</h3><p>网站提供计划查询参考，不代表航空公司，也不查询或保证可用舱位。正式出行前，请到官方核实具体日期与余票。</p><a class="dialog-link" href="${data.meta.source}" target="_blank" rel="noopener noreferrer">前往官方查询 ↗</a></section>`);}
function rules(){openDialog('666 / 2666 时段规则',`
 <div class="rules-grid"><div class="rule-card"><h3>666</h3><p>起飞不晚于 <b>08:00</b><br>或不早于 <b>20:00</b></p><small>含08:00与20:00</small></div><div class="rule-card"><h3>2666</h3><p>起飞不晚于 <b>09:00</b><br>或不早于 <b>19:00</b></p><small>含09:00与19:00</small></div></div>
 <section class="dialog-section"><h3>网站如何判断套餐</h3><p>根据计划起飞时间标注“666 / 2666”或“仅2666”。选择2666时，也包含两种套餐都适用的计划。显示计划不代表还有可订舱位。</p><h3>注意产品不可用日期</h3><p>两档均不适用于春运及暑运；666还不适用于五一、十一及规则约定的前后日期。本站按星期展示计划，不会替代具体日期的权益与舱位核验，请以官方当前产品规则为准。</p></section><a class="dialog-link" href="${data.meta.rules}" target="_blank" rel="noopener noreferrer">查看官方完整规则 ↗</a>`);}
function detail(id){const f=byId.get(id);if(!f)return;openDialog(`${f.origin} → ${f.destination}`,`
 <div class="dialog-info-grid"><div><span>航班</span><b>${f.number} · ${esc(f.airline)}</b></div><div><span>适用套餐</span><b>${packageText(f)}</b></div><div><span>起飞</span><b>${f.departure}</b></div><div><span>到达${f.arrivalNextDay?(f.arrivalVaries&&!f.arrivalMinNextDay?' · 可能跨日':' · 次日'):''}</span><b>${arrivalText(f)}</b></div><div><span>每周班期</span><b>${daysText(f.days)}</b></div><div><span>经停</span><b>${f.stops.length?esc(f.stops.join('、')):'无 / 直飞'}</b></div></div>
 <section class="dialog-section"><h3>${f.sourceType==='supplement'?'其他日期官方记录 · 核实范围':'航班有效期'}</h3><p>${validity(f)}</p>${f.sourceType==='supplement'?`<p class="dialog-note">本条仅纳入有对应日期官方查询留存支持的执行日，配合上述班期使用。官方原始计划曾标注：${f.officialValidities.map(v=>v.map(readableDate).join('—')).join('；')}；原始范围以外及未留存命中的日期未据此外推。</p>`:''}<h3>数据核对日期</h3><p>${readableDate(f.verifiedAt)}</p></section>
 ${f.status==='uncertain'?`<div class="dialog-note warn"><b>班期待确认</b><br>${esc(f.issue)}三、五、日暂不作为已确认可用，也不能推断整个航季仅周一。</div>`:''}
 ${f.calendarNote?`<div class="dialog-note warn"><b>计划日期与单日查询有差异</b><br>${esc(f.calendarNote)}<br>核对日期：${readableDate(f.calendarCheckedAt)}</div>`:''}
 ${f.arrivalVaries?'<p class="dialog-note">相同起飞计划的到达时间有细微差异，已按官方记录展示范围。</p>':''}<section class="dialog-section"><p>出行日期必须同时满足每周班期、有效期及产品规则。实时舱位以官方查询为准。</p><a class="dialog-link" href="${data.meta.source}" target="_blank" rel="noopener noreferrer">去官方核实这班 ↗</a></section>`);}

document.addEventListener('click',async e=>{
 const b=e.target.closest('button');if(!b||b.disabled)return;
 if(b.dataset.column)openColumnFilter(b.dataset.column,b);
 else if(b.id==='close-column-filter'||b.id==='cancel-column-filter')closeColumnFilter(true);
 else if(b.id==='column-select-all'||b.id==='column-select-none'){columnDraft.selected=new Set(b.id==='column-select-all'?matchingColumnOptions():[]);renderColumnOptions();}
 else if(b.id==='apply-column-filter'){
  const {key,options,selected:values}=columnDraft;
  if(values.size===options.length&&options.every(v=>values.has(v)))delete state.columnFilters[key];else state.columnFilters[key]=[...values];
  closeColumnFilter();renderTable();save();$(`[data-column="${key}"]`)?.focus({preventScroll:true});
 }
 else if(b.id==='clear-this-column'){const key=columnDraft.key;delete state.columnFilters[key];closeColumnFilter();renderTable();save();$(`[data-column="${key}"]`)?.focus({preventScroll:true});}
 else if(b.dataset.columnSort){state.columnSort={key:columnDraft.key,direction:b.dataset.columnSort};closeColumnFilter();renderTable();save();}
 else if(b.id==='clear-column-filters'){state.columnFilters={};closeColumnFilter();renderTable();save();}
 else if(b.dataset.tab){closeColumnFilter();state.tab=b.dataset.tab;render();}
 else if(b.dataset.package)change('package',b.dataset.package);
 else if(b.dataset.airport)change('airports',toggleValue(state.airports,b.dataset.airport));
 else if(b.dataset.dayKind){const k=b.dataset.dayKind+'Days',v=Number(b.dataset.day);change(k,v?toggleValue(state[k],v):[]);}
 else if(b.dataset.coverage)change('coverage',b.dataset.coverage);
 else if(b.hasAttribute('data-all-places')||b.dataset.place){
  const place=b.dataset.place;
  state.places=place?toggleValue(state.places,place):[];
  for(const dir of ['out','in'])if(selected[dir]&&state.places.length&&!state.places.includes(byId.get(selected[dir]).place))selected[dir]=null;
  render();
  const target=place?$$('[data-place]').find(el=>el.dataset.place===place):$('[data-all-places]');target?.focus({preventScroll:true});
 }
 else if(b.dataset.expand){const key=b.dataset.expand+'-'+b.dataset.kind;expanded.has(key)?expanded.delete(key):expanded.add(key);renderDiscovery();}
 else if(b.dataset.pick){const f=byId.get(b.dataset.pick),other=f.direction==='out'?'in':'out';if(selected[f.direction]===f.id)selected[f.direction]=null;else{if(selected[other]&&byId.get(selected[other]).place!==f.place)selected[other]=null;selected[f.direction]=f.id;}renderDiscovery();renderJourney();}
 else if(b.dataset.detail)detail(b.dataset.detail);
 else if(b.dataset.dialog==='about')about();else if(b.dataset.dialog==='rules')rules();
 else if(b.hasAttribute('data-reset')||b.id==='reset')reset();
 else if(b.id==='dialog-close')$('#info-dialog').close();
 else if(b.id==='clear-journey'){selected={out:null,in:null};render();}
 else if(b.id==='share'||b.id==='table-share'){
  const url=new URL(location.href);url.hash=new URLSearchParams({q:JSON.stringify(state)}).toString();
  try{await navigator.clipboard.writeText(url.toString());toast(['localhost','127.0.0.1','::1'].includes(location.hostname)?'筛选链接已复制。本地预览仅本机可访问，发布后可分享给朋友。':'已复制筛选链接，朋友打开即可看到相同条件');}catch{openDialog('分享当前查询',`<p class="dialog-note">复制下面链接，即可保留当前筛选条件。本地预览地址仅本机可访问。</p><label class="dialog-section"><span class="sr-only">查询链接</span><input class="share-url" value="${esc(url.toString())}" readonly style="width:100%;padding:12px;font-size:11px;border:1px solid var(--line);border-radius:6px;background:white"></label>`);}
 }
});
$('#include-uncertain').addEventListener('change',e=>change('includeUncertain',e.target.checked));
$('#show-expired').addEventListener('change',e=>change('showExpired',e.target.checked));
$('#destination-search').addEventListener('input',e=>{state.search=e.target.value;renderDiscovery();renderJourney();save();});
$('#table-search').addEventListener('input',e=>{state.tableSearch=e.target.value;renderTable();save();});
$('#column-option-search').addEventListener('input',renderColumnOptions);
$('#column-options').addEventListener('change',e=>{if(!e.target.matches('[data-column-choice]')||!columnDraft)return;const v=e.target.value;e.target.checked?columnDraft.selected.add(v):columnDraft.selected.delete(v);$('#column-selected-count').textContent=`已选 ${columnDraft.selected.size} 项`;});
document.addEventListener('pointerdown',e=>{if(columnDraft&&!$('#column-filter').contains(e.target)&&!e.target.closest('[data-column]'))closeColumnFilter();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&columnDraft){e.preventDefault();closeColumnFilter(true);}});
window.addEventListener('hashchange',()=>{try{const q=new URLSearchParams(location.hash.slice(1)).get('q');if(!q)return;state=validateState(JSON.parse(q));selected={out:null,in:null};closeColumnFilter();render();}catch{toast('分享链接中的筛选条件无法读取，请重置筛选。');}});
window.addEventListener('resize',()=>{if(columnDraft)closeColumnFilter();});
$('.tabs').addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();state.tab=e.key==='Home'?'discover':e.key==='End'?'table':state.tab==='discover'?'table':'discover';render();$('#tab-'+state.tab).focus();});
$('#info-dialog').addEventListener('click',e=>{if(e.target!==$('#info-dialog'))return;const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();});
try{const response=await fetch('./flights.json');if(!response.ok)throw Error('Data unavailable');data=await response.json();flights=data.flights;byId=new Map(flights.map(f=>[f.id,f]));render();}catch{$('#destinations').innerHTML='<div class="empty-state"><h3>航班数据暂未载入</h3><p>请检查网络后刷新页面重试。</p><button onclick="location.reload()">重新载入</button></div>';announce('航班数据载入失败');}

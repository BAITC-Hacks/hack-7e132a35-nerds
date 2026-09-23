const $ = s => document.querySelector(s);
const escapeHTML = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let data, decisions = [], result = null, busy = false;
const fmt = n => Number(n).toLocaleString('ru-RU', {maximumFractionDigits:2});
async function api(path, body) {
  const response = await fetch(path, body === undefined ? {} : {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)});
  const json = await response.json();
  if (!response.ok) throw new Error(json.error || 'Ошибка сервера');
  return json;
}
function error(message='') { $('#error').textContent=message; $('#error').hidden=!message; }
function view(name) {
  ['plan','data','results'].forEach(v => $('#'+v).hidden=v!==name);
  document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view===name));
  window.scrollTo({top:0, behavior:'instant'});
}
function renderCards() {
  const symbols = ['↔','♧','⌂','◇','▦'];
  $('#decisions').innerHTML = data.categories.map((name,c) => {
    const d=decisions.find(d => data.actions[d.action].category===c), a=d && data.actions[d.action];
    return `<article class="decision"><div class="decision-top"><span class="category-icon" aria-hidden="true">${symbols[c]}</span><h3>${name}</h3><span class="step">${d?'ПРИНЯТО ✓':`РЕШЕНИЕ 0${c+1}`}</span></div><div class="controls">
    <label>МЕРОПРИЯТИЕ<select data-category="${c}" data-field="action" aria-label="${name}: мероприятие"><option value="">Выберите инициативу</option>${data.actions.filter(a=>a.category===c).map(a=>`<option value="${a.id}" ${d?.action===a.id?'selected':''}>${a.name} · ${a.cost} ед.</option>`).join('')}</select></label>
    <label>РАЙОН<select data-category="${c}" data-field="district" aria-label="${name}: район" ${!d?'disabled':''}>${data.districts.map((r,i)=>`<option value="${i}" ${(d?.district??0)===i?'selected':''}>${r.name}</option>`).join('')}</select></label>
    <label>МАСШТАБ<select data-category="${c}" data-field="scale" aria-label="${name}: масштаб" ${!d?'disabled':''}>${[1,2,3].map(i=>`<option value="${i}" ${(d?.scale??1)===i?'selected':''}>Объём ×${i}</option>`).join('')}</select></label></div>
    <div class="effect"><span>${a?a.effects.map((v,i)=>v?`${data.categories[i]} ${v>0?'+':''}${v*d.scale}`:'').filter(Boolean).join(' · '):'Эффекты появятся после выбора мероприятия'}</span>${a?`<b>${a.cost*d.scale} усл. ед.</b>`:''}</div>${a?`<div class="risk">${a.risk}</div>`:''}</article>`;
  }).join('');
  $('#analyze').disabled=busy||decisions.length!==5;
  $('#analyze').textContent=busy?'Анализируем сценарий…':'Оценить сценарий ↗';
  $('#hint').textContent=decisions.length===5?'Все пять решений приняты. Сценарий готов к оценке.':`Осталось принять решений: ${5-decisions.length}.`;
  $('#reset').disabled=busy;
  if (busy) document.querySelectorAll('#decisions select').forEach(s=>s.disabled=true);
}
function stats(r) {
  $('#spent').textContent=r.spent; $('#remaining').textContent=r.remaining;
  $('#budgetbar').style.width=r.spent+'%'; $('#score').textContent=fmt(r.score);
  $('#baseline').textContent=fmt(r.baseline); $('#delta').textContent=`${r.delta>=0?'+':''}${fmt(r.delta)}`;
  $('#count').textContent=decisions.length;
  $('#dots').innerHTML=data.categories.map((_,c)=>`<i class="${decisions.some(d=>data.actions[d.action].category===c)?'filled':''}"></i>`).join('');
}
$('#decisions').addEventListener('change', async e => {
  const el=e.target, c=Number(el.dataset.category), field=el.dataset.field;
  const next=decisions.map(d=>({...d})); let idx=next.findIndex(d=>data.actions[d.action].category===c);
  if(field==='action'&&el.value==='') { if(idx>=0) next.splice(idx,1); }
  else { if(idx<0){ next.push({action:Number(el.value),district:0,scale:1}); idx=next.length-1; } next[idx][field]=Number(el.value); }
  const spent=next.reduce((s,d)=>s+data.actions[d.action].cost*d.scale,0);
  if(spent>data.budget){error(`Недостаточно бюджета: план стоит ${spent} из ${data.budget} усл. ед. Изменение не применено.`);renderCards();return;}
  busy=true;renderCards();
  try {const r=await api('/api/preview',{decisions:next});decisions=next;result=null;$('#report').hidden=true;$('#empty-result').hidden=false;stats(r);error();}
  catch(e){error(e.message);}
  finally{busy=false;renderCards();}
});
function bars(names, before, after) {
  return names.map((n,i)=>`<div class="bar-row"><div class="bar-label"><span>${escapeHTML(n)}</span><b>${fmt(before[i])} → ${fmt(after[i])}</b></div><div class="bar-before" style="width:${before[i]}%"></div><div class="bar-after" style="width:${after[i]}%"></div></div>`).join('');
}
$('#analyze').onclick=async()=>{
  busy=true;error();renderCards();
  try{
    result=await api('/api/analyze',{decisions});stats(result);
    $('#final-score').textContent=fmt(result.score);
    $('#result-summary').textContent=`${result.delta>=0?'+':''}${fmt(result.delta)} балла к старту · потрачено ${result.spent} из 100 усл. ед.`;
    $('#metric-bars').innerHTML=bars(data.categories,result.before_metrics,result.after_metrics);
    const mean=r=>r.metrics.reduce((s,v)=>s+v,0)/5;
    $('#district-bars').innerHTML=bars(data.districts.map(r=>r.name),result.before.map(mean),result.after.map(mean));
    $('#insights').innerHTML=[['Сильные стороны',result.strengths],['Риски и последствия',result.risks],['Что улучшить',result.recommendation]].map(([h,p])=>`<article><h3>${h}</h3><p>${escapeHTML(p)}</p></article>`).join('');
    $('#analysis-mode').textContent=result.analysis.mode==='ai'?'AI-анализ':'Расчетный разбор · без AI';
    $('#analysis-text').textContent=result.analysis.text+(result.analysis.mode==='local'?'\n\n'+result.decisions.map(d=>`${d.name} · ${data.districts[d.district].name} · ${d.cost} ед.\n${d.risk}`).join('\n\n'):'');
    $('#report').hidden=false;$('#empty-result').hidden=true;view('results');
  }catch(e){error(e.message);}finally{busy=false;renderCards();}
};
$('#reset').onclick=async()=>{busy=true;renderCards();try{const r=await api('/api/preview',{decisions:[]});decisions=[];result=null;stats(r);$('#report').hidden=true;$('#empty-result').hidden=false;error();}catch(e){error(e.message);}finally{busy=false;renderCards();}};
$('#export').onclick=()=>{if(!result)return;const url=URL.createObjectURL(new Blob([JSON.stringify(result,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='astana-scenario.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('#edit').onclick=()=>view('plan');$('#method').onclick=()=>view('data');
$('nav').onclick=e=>{const b=e.target.closest('[data-view]');if(b)view(b.dataset.view);};
(async()=>{try{data=await api('/api/data');const r=await api('/api/preview',{decisions:[]});
  $('#mode').textContent=data.ai_configured?'AI подключён. Советник объяснит результаты после оценки.':'Расчетный режим. Для AI-анализа нужен API-ключ на сервере.';
  $('#district-table').innerHTML=data.districts.map(r=>`<tr><td><b>${r.name}</b><small>${fmt(r.population)} жителей</small></td>${r.metrics.map(v=>`<td><span class="metric-value ${v<45?'low':''}">${v}</span></td>`).join('')}</tr>`).join('');
  renderCards();stats(r);$('#loading').hidden=true;$('#app').hidden=false;
}catch(e){$('#loading').textContent='Не удалось загрузить город. Проверьте сервер и обновите страницу.';error(e.message);}})();

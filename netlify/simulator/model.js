/* Deterministic case simulator. All indicators use a 0–100 scale; higher is better. */
(function (host) {
  'use strict';
  const keys = ['T1','T2','E1','E2','S1','S2','B1','B2','C1','C2'];
  const weights = [.10,.10,.09,.11,.11,.11,.09,.09,.10,.10];
  const labels = [
    'Разгрузка дорог', 'Доступность общественного транспорта',
    'Озеленение', 'Качество воздуха',
    'Школы и детсады', 'Поликлиники и первичная медпомощь',
    'Безопасность улиц', 'Безопасность дорожного движения',
    'Надёжность ЖКХ', 'Скорость решения обращений жителей'
  ];
  const categories = ['Транспорт','Озеленение и экология','Социальная сфера','Безопасность','Сервисы'];
  const headers = {
    Районы: ['Район','Доля населения',...keys],
    Мероприятия: ['Код','Мероприятие','Направление','Стоимость','Лаг','Охват'],
    Эффекты: ['Мероприятие','Район',...keys],
    Синергии: ['Мера 1','Мера 2','Район',...keys],
    Ограничения: ['Мера 1','Мера 2','Правило'],
    Настройки: ['Название набора','Бюджет','Число решений']
  };
  const num = x => typeof x === 'number' ? x : Number(String(x).trim().replace(',','.'));
  const clip = x => Math.min(100,Math.max(0,x));
  const clone = x => JSON.parse(JSON.stringify(x));

  function validate(s) {
    const errors=[];
    if(!s || typeof s!=='object') return ['Ожидается объект с листами данных.'];
    for(const [name,cols] of Object.entries(headers)) {
      if(!Array.isArray(s[name])) {errors.push('Нет листа «'+name+'».');continue;}
      if(!['Синергии','Ограничения'].includes(name) && !s[name].length) errors.push('Лист «'+name+'» пуст.');
      if(s[name].length>2000) errors.push('На листе «'+name+'» больше 2000 строк.');
      s[name].forEach((r,i)=>{
        if(!r || typeof r!=='object') {errors.push(name+': неверная строка '+(i+2));return;}
        cols.forEach(k=>{if(r[k]===undefined || r[k]===null || String(r[k]).trim()==='') errors.push(name+', строка '+(i+2)+': не заполнено «'+k+'».');});
      });
    }
    if(errors.length) return errors;
    const ds=s.Районы, ms=s.Мероприятия;
    if(ds.length>20 || ms.length>50) errors.push('Допустимо до 20 районов и 50 мероприятий.');
    function numeric(r,k,min,max,where,integer=false){const n=num(r[k]);if(!Number.isFinite(n)||n<min||n>max||(integer&&!Number.isInteger(n)))errors.push(where+': «'+k+'» должно быть '+(integer?'целым ':'')+'числом от '+min+' до '+max+'.');}
    function unique(rows,k){const seen=new Set();rows.forEach(r=>{const n=String(r[k]).trim().toLowerCase();if(seen.has(n)) errors.push('Повтор: '+r[k]);seen.add(n);if(String(r[k]).length>100||r[k]==='*') errors.push('Недопустимое значение: '+r[k]);});}
    unique(ds,'Район');unique(ms,'Мероприятие');unique(ms,'Код');
    ds.forEach(r=>{numeric(r,'Доля населения',0.000001,1,r.Район);keys.forEach(k=>numeric(r,k,0,100,r.Район));});
    const shareTotal=ds.reduce((sum,r)=>sum+num(r['Доля населения']),0);
    if(Math.abs(shareTotal-1)>0.000001)errors.push('Доли населения районов должны в сумме равняться 1.');
    ms.forEach(r=>{numeric(r,'Стоимость',1,1e6,r.Мероприятие);numeric(r,'Лаг',0,8,r.Мероприятие,true);if(!/^M\d+$/.test(String(r.Код)))errors.push('Код мероприятия должен иметь вид M1, M2 и т. п.');if(!categories.includes(r.Направление))errors.push('Неизвестное направление: '+r.Направление);if(!['Район','Город'].includes(r.Охват))errors.push('Охват должен быть «Район» или «Город».');});
    const dn=new Set(ds.map(r=>r.Район)), mn=new Set(ms.map(r=>r.Мероприятие)), codes=new Set(ms.map(r=>r.Код)), pairs=new Set();
    s.Эффекты.forEach(r=>{if(!mn.has(r.Мероприятие)||!dn.has(r.Район))errors.push('Эффекты: неизвестное мероприятие или район.');const pair=JSON.stringify([r.Мероприятие,r.Район]);if(pairs.has(pair))errors.push('Повтор эффекта: '+r.Мероприятие+' / '+r.Район);pairs.add(pair);keys.forEach(k=>numeric(r,k,-100,100,'Эффекты'));});
    ms.forEach(m=>ds.forEach(d=>{if(!pairs.has(JSON.stringify([m.Мероприятие,d.Район])))errors.push('Нет эффекта: '+m.Мероприятие+' / '+d.Район);}));
    const sy=new Set();s.Синергии.forEach(r=>{if(!codes.has(r['Мера 1'])||!codes.has(r['Мера 2'])||r['Мера 1']===r['Мера 2']||(!dn.has(r.Район)&&r.Район!=='*'))errors.push('Синергии: неверная пара мер или район.');keys.forEach(k=>numeric(r,k,-100,100,'Синергии'));const pair=JSON.stringify([[r['Мера 1'],r['Мера 2']].sort(),r.Район]);if(sy.has(pair))errors.push('Повтор синергии.');sy.add(pair);});
    const incompatible=new Set();s.Ограничения.forEach(r=>{const a=r['Мера 1'],b=r['Мера 2'];if(!codes.has(a)||!codes.has(b)||a===b||!['везде','в одном районе'].includes(r.Правило))errors.push('Ограничения: укажите две разные существующие меры и правило «везде» или «в одном районе».');const pair=JSON.stringify([[a,b].sort(),r.Правило]);if(incompatible.has(pair))errors.push('Повтор ограничения для пары мер.');incompatible.add(pair);});
    if(s.Настройки.length!==1)errors.push('В настройках нужна ровно одна строка.');
    s.Настройки.forEach(r=>{numeric(r,'Бюджет',1,1e6,'Настройки');numeric(r,'Число решений',1,50,'Настройки',true);});
    return errors;
  }

  function aggregate(values,shares) {
    const district=values.map(row=>row.reduce((sum,v,k)=>sum+v*weights[k],0));
    const average=district.reduce((sum,v,d)=>sum+v*shares[d],0), worst=Math.min(...district);
    const critical=values.flat().filter(v=>v<40).length;
    const raw=.7*average+.3*worst-critical;
    return {district,shares,average,worst,critical,raw,score:clip(raw)};
  }

  function evaluate(s,plan=[]) {
    const errors=validate(s);if(errors.length)throw new Error(errors.join('\n'));
    const districts=s.Районы.map(r=>r.Район), shares=s.Районы.map(r=>num(r['Доля населения']));
    const base=s.Районы.map(r=>keys.map(k=>num(r[k]))), values=clone(base);
    const actionsByName=new Map(s.Мероприятия.map(m=>[m.Мероприятие,m]));
    const actionsByCode=new Map(s.Мероприятия.map(m=>[m.Код,m]));
    const selectedByCode=new Map(), contributions=[], activeSynergies=[], violations=[];let spent=0;
    const coverage=new Set(), directionCounts=new Map();
    if(!Array.isArray(plan))plan=[];
    if(plan.length>0 && plan.length>num(s.Настройки[0]['Число решений']))violations.push('Можно выбрать не более '+s.Настройки[0]['Число решений']+' мероприятий.');
    for(const choice of plan) {
      if(!choice||typeof choice.measure!=='string'||typeof choice.district!=='string'){violations.push('В плане есть неверное решение.');continue;}
      const m=actionsByName.get(choice.measure);
      if(!m){violations.push('Неизвестное мероприятие в плане.');continue;}
      spent+=num(m.Стоимость);
      directionCounts.set(m.Направление,(directionCounts.get(m.Направление)||0)+1);
      if(selectedByCode.has(m.Код)){violations.push('Каждое мероприятие можно выбрать только один раз: '+m.Код+'.');continue;}
      if(m.Охват==='Город'&&choice.district!=='*'){violations.push(m.Код+' действует на весь город; выберите городскую ячейку.');continue;}
      if(m.Охват==='Район'&&!districts.includes(choice.district)){violations.push('Для меры '+m.Код+' укажите существующий район.');continue;}
      selectedByCode.set(m.Код,choice);
      const factor=(8-num(m.Лаг))/8;
      districts.forEach((name,d)=>{if(m.Охват==='Город'||choice.district===name){coverage.add(d);const e=s.Эффекты.find(r=>r.Мероприятие===choice.measure&&r.Район===name);const delta=keys.map(k=>num(e[k])*factor);delta.forEach((v,k)=>values[d][k]+=v);contributions.push({measure:choice.measure,code:m.Код,district:name,delta,factor});}});
    }
    for(const [direction,count] of directionCounts)if(count>2)violations.push('Не более двух мероприятий направления «'+direction+'».');
    const budget=num(s.Настройки[0].Бюджет);if(spent>budget)violations.push('Стоимость плана превышает бюджет на '+(spent-budget).toLocaleString('ru-RU')+' усл. ед.');
    s.Ограничения.forEach(r=>{
      const first=selectedByCode.get(r['Мера 1']),second=selectedByCode.get(r['Мера 2']);
      if(first&&second&&(r.Правило==='везде'||first.district===second.district)){
        const a=actionsByCode.get(r['Мера 1']),b=actionsByCode.get(r['Мера 2']);
        violations.push('Несовместимые мероприятия: '+a.Код+' и '+b.Код+(r.Правило==='везде'?' нельзя выбирать одновременно.':' нельзя размещать в одном районе.'));
      }
    });
    const applies=(code,d)=>{const choice=selectedByCode.get(code),m=actionsByCode.get(code);return Boolean(choice&&m&&(m.Охват==='Город'||choice.district===d));};
    s.Синергии.forEach((r,index)=>districts.forEach((d,di)=>{if((r.Район==='*'||r.Район===d)&&applies(r['Мера 1'],d)&&applies(r['Мера 2'],d)){const delta=keys.map(k=>num(r[k]));delta.forEach((v,k)=>values[di][k]+=v);activeSynergies.push({index,district:d,first:r['Мера 1'],second:r['Мера 2'],delta});}}));
    const clipped=values.map(row=>row.map(clip)), before=aggregate(base,shares), after=aggregate(clipped,shares);
    const required=num(s.Настройки[0]['Число решений']);
    return {base,values:clipped,before,after,spent,budget,required,count:plan.length,coverage:[...coverage],contributions,activeSynergies,violations,valid:violations.length===0&&plan.length===required,withinLimits:violations.length===0&&plan.length<=required};
  }

  function seed() {
    const districts=[
      ['Есиль',.27,[45,62,68,72,48,55,78,60,75,70]],
      ['Алматы',.24,[40,75,50,55,60,65,62,52,50,60]],
      ['Сарыарка',.20,[50,70,42,40,62,68,58,55,45,55]],
      ['Байконур',.13,[52,68,55,50,58,60,52,58,55,58]],
      ['Нура',.16,[55,40,45,65,38,35,55,50,60,50]]
    ];
    const specs=[
      ['M1','Выделенные полосы для автобусов',categories[0],18,2,'Район',{T1:6,T2:9}],
      ['M2','Умные светофоры (адаптивное управление)',categories[0],22,2,'Город',{T1:4,B2:3}],
      ['M3','Линия ЛРТ / расширение',categories[0],30,4,'Район',{T1:16,T2:20,E2:4}],
      ['M4','Парк / сквер',categories[1],15,2,'Район',{E1:12,E2:3,B1:2}],
      ['M5','Перевод частного сектора на чистое топливо',categories[1],25,3,'Район',{E2:14,C1:4}],
      ['M6','Городская программа озеленения и ветрозащитных полос',categories[1],20,4,'Город',{E1:5,E2:3}],
      ['M7','Школа + детсад (модульное строительство)',categories[2],24,3,'Район',{S1:16}],
      ['M8','Центр семейного здоровья / поликлиника',categories[2],20,3,'Район',{S2:14}],
      ['M9','Дворовые спорт-хабы',categories[2],10,1,'Район',{S1:3,S2:3,B1:3}],
      ['M10','Освещение и камеры (расширение Safe City)',categories[3],12,1,'Район',{B1:12,B2:2}],
      ['M11','Безопасные переходы и школьные зоны',categories[3],10,1,'Район',{B2:12,T1:-2}],
      ['M12','Единая цифровая платформа обращений',categories[4],14,1,'Город',{C2:5}],
      ['M13','Модернизация тепло- и водосетей',categories[4],28,4,'Район',{C1:18,E2:2}],
      ['M14','Аварийные бригады ЖКХ + раннее оповещение',categories[4],16,1,'Город',{C1:5,C2:2}]
    ];
    const vector=e=>Object.fromEntries(keys.map(k=>[k,e[k]||0]));
    return {
      Районы:districts.map(([name,share,row])=>({'Район':name,'Доля населения':share,...Object.fromEntries(keys.map((k,i)=>[k,row[i]]))})),
      Мероприятия:specs.map(([code,name,category,cost,lag,scope])=>({'Код':code,'Мероприятие':name,'Направление':category,'Стоимость':cost,'Лаг':lag,'Охват':scope})),
      Эффекты:specs.flatMap(([,name,,,,,effect])=>districts.map(([district])=>({'Мероприятие':name,'Район':district,...vector(effect)}))),
      Синергии:[
        {'Мера 1':'M1','Мера 2':'M2','Район':'*',...vector({T1:2})},
        {'Мера 1':'M10','Мера 2':'M12','Район':'*',...vector({B1:2})},
        {'Мера 1':'M5','Мера 2':'M6','Район':'*',...vector({E2:2})}
      ],
      Ограничения:[
        {'Мера 1':'M1','Мера 2':'M3','Правило':'везде'},
        {'Мера 1':'M4','Мера 2':'M7','Правило':'в одном районе'},
        {'Мера 1':'M5','Мера 2':'M13','Правило':'в одном районе'}
      ],
      Настройки:[{'Название набора':'Астана · датасет HackAlem','Бюджет':100,'Число решений':5}]
    };
  }
  const api={keys,weights,labels,categories,headers,num,clip,clone,validate,aggregate,evaluate,seed};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else host.AkimModel=api;
})(typeof globalThis!=='undefined'?globalThis:this);

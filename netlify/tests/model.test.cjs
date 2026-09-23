const assert = require('node:assert/strict');
const M = require('../simulator/model.js');

const data = M.seed();
assert.deepEqual(M.validate(data), []);
assert.equal(data.Районы.length, 5);
assert.equal(data.Мероприятия.length, 14);
assert.equal(data.Эффекты.length, 70);
assert.equal(data.Ограничения.length, 3);
assert.ok(Math.abs(M.evaluate(data, []).after.score - 52.55768) < 1e-8);

const casePlan = [
  { measure: 'Школа + детсад (модульное строительство)', district: 'Нура' },
  { measure: 'Центр семейного здоровья / поликлиника', district: 'Нура' },
  { measure: 'Освещение и камеры (расширение Safe City)', district: 'Нура' },
  { measure: 'Единая цифровая платформа обращений', district: '*' },
  { measure: 'Перевод частного сектора на чистое топливо', district: 'Сарыарка' }
];
const sample = M.evaluate(data, casePlan);
assert.equal(sample.valid, true);
assert.equal(sample.spent, 95);
assert.ok(Math.abs(sample.after.score - 56.54) < 0.02);

const invalidPlans = [
  [...casePlan, casePlan[0]],
  [
    { measure: 'Выделенные полосы для автобусов', district: 'Есиль' },
    { measure: 'Линия ЛРТ / расширение', district: 'Нура' }
  ],
  [
    { measure: 'Парк / сквер', district: 'Нура' },
    { measure: 'Школа + детсад (модульное строительство)', district: 'Нура' }
  ]
];
for (const plan of invalidPlans) assert.equal(M.evaluate(data, plan).withinLimits, false);

console.log('OK: baseline, case example, budget and decision constraints');

// Additional regression checks for the actual rules of this package.
const choice=(code,district)=>({measure:data.Мероприятия.find(m=>m.Код===code).Мероприятие,district});
assert.equal(M.evaluate(data,[choice('M7','Нура'),choice('M8','Нура'),choice('M9','Алматы')]).withinLimits,false);
assert.equal(M.evaluate(data,[choice('M4','Есиль'),choice('M4','Нура')]).withinLimits,false);
assert.equal(M.evaluate(data,[choice('M5','Нура'),choice('M13','Нура')]).withinLimits,false);
assert.equal(M.evaluate(data,[choice('M5','Нура'),choice('M13','Алматы')]).withinLimits,true);
assert.equal(M.evaluate(data,[choice('M2','Есиль')]).withinLimits,false);
assert.equal(M.evaluate(data,[choice('M7','Нет района')]).withinLimits,false);
assert.equal(M.evaluate(data,[choice('M3','Нура'),choice('M5','Сарыарка'),choice('M7','Нура'),choice('M13','Алматы')]).withinLimits,false);
assert.deepEqual(M.evaluate(data,[...casePlan].reverse()).after,sample.after);
const synergy=M.evaluate(data,[choice('M1','Есиль'),choice('M2','*')]);
assert.equal(synergy.activeSynergies.length,1);
assert.equal(synergy.values[0][0],45+6*.75+4*.75+2);
assert.equal(M.aggregate([Array(10).fill(40)],[1]).critical,0);
assert.equal(M.aggregate([[39,...Array(9).fill(40)]],[1]).critical,1);
const badShares=M.clone(data);badShares.Районы[0]['Доля населения']=.9;
assert.ok(M.validate(badShares).length>0);
// This is a documented limitation, not a five-direction guarantee.
assert.equal(new Set(casePlan.map(p=>data.Мероприятия.find(m=>m.Мероприятие===p.measure).Направление)).size,4);
console.log('OK: per-direction cap, uniqueness, invalid scopes, incompatibilities, overspend, order, synergy, threshold and population shares');

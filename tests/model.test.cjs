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

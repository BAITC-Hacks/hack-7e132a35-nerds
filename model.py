"""Deterministic, synthetic city model shared by preview and final evaluation."""
from copy import deepcopy

BUDGET = 100
CATEGORIES = ['Транспорт', 'Озеленение', 'Социальная инфраструктура', 'Безопасность', 'Городской сервис']
DISTRICTS = [
    {'name': 'Северный', 'population': 50000, 'metrics': [38, 48, 43, 52, 46]},
    {'name': 'Центральный', 'population': 70000, 'metrics': [65, 34, 61, 57, 55]},
    {'name': 'Восточный', 'population': 45000, 'metrics': [42, 45, 38, 47, 43]},
    {'name': 'Южный', 'population': 55000, 'metrics': [49, 55, 41, 39, 48]},
]
_ACTIONS = [
    ('Автобусные полосы', 0, 12, [16, -2, 0, 2, 0], 'Перераспределение дорожного пространства может вызвать недовольство автомобилистов.'),
    ('Умные остановки', 0, 7, [9, 0, 0, 1, 2], 'Остановки удобнее, но пропускная способность дорог не меняется.'),
    ('Новые скверы', 1, 10, [0, 17, 2, 0, 0], 'Зеленым зонам потребуется регулярный полив и уход.'),
    ('Посадка деревьев', 1, 6, [0, 10, 0, 0, 0], 'Полный эффект озеленения проявится после роста деревьев.'),
    ('Общественные центры', 2, 15, [0, 0, 21, 1, -1], 'Потребуются сотрудники и постоянное финансирование эксплуатации.'),
    ('Спортивные площадки', 2, 8, [0, 1, 11, 2, 0], 'Площадки не заменяют школы и медицинские учреждения.'),
    ('Освещение улиц', 3, 8, [0, 0, 0, 14, -1], 'Расходы на электричество и обслуживание увеличатся.'),
    ('Безопасные переходы', 3, 6, [2, 0, 0, 10, 0], 'Эффект ограничен выбранными пешеходными маршрутами.'),
    ('Вывоз отходов', 4, 9, [-1, 2, 0, 0, 15], 'Дополнительные рейсы мусоровозов повышают нагрузку на дороги.'),
    ('Ремонт дворов', 4, 7, [0, -1, 1, 2, 11], 'Во время ремонта доступ во дворы будет ограничен.'),
]
ACTIONS = [dict(id=i, name=a[0], category=a[1], cost=a[2], effects=a[3], risk=a[4]) for i, a in enumerate(_ACTIONS)]

def dataset():
    return dict(version='astana-synthetic-v1', budget=BUDGET, categories=CATEGORIES, districts=DISTRICTS, actions=ACTIONS)

def evaluate(decisions, complete=False):
    if not isinstance(decisions, list) or len(decisions) > 5:
        raise ValueError('Нужно не более пяти решений.')
    seen, spent, selected = set(), 0, []
    for d in decisions:
        if not isinstance(d, dict) or any(type(d.get(k)) is not int for k in ('action', 'district', 'scale')):
            raise ValueError('Некорректный формат решения.')
        a, district, scale = d['action'], d['district'], d['scale']
        if not 0 <= a < len(ACTIONS) or not 0 <= district < len(DISTRICTS) or scale not in (1, 2, 3):
            raise ValueError('Неизвестное мероприятие, район или масштаб.')
        action = ACTIONS[a]
        if action['category'] in seen:
            raise ValueError('Допускается только одно решение на направление.')
        seen.add(action['category'])
        spent += action['cost'] * scale
        selected.append(dict(**d, name=action['name'], cost=action['cost'] * scale, risk=action['risk']))
    if spent > BUDGET:
        raise ValueError('Превышен бюджет 100 усл. ед. Уменьшите масштаб или выберите другое мероприятие.')
    if complete and len(seen) != 5:
        raise ValueError('Выберите по одному решению во всех пяти направлениях.')
    after = deepcopy(DISTRICTS)
    for d in selected:
        values = after[d['district']]['metrics']
        for c, effect in enumerate(ACTIONS[d['action']]['effects']):
            values[c] += effect * d['scale']
    for row in after:
        row['metrics'] = [max(0, min(100, v)) for v in row['metrics']]
    def averages(rows):
        total = sum(r['population'] for r in rows)
        return [sum(r['metrics'][c] * r['population'] for r in rows) / total for c in range(5)]
    before_metrics, after_metrics = averages(DISTRICTS), averages(after)
    base, score = sum(before_metrics) / 5, sum(after_metrics) / 5
    gains = [b - a for a, b in zip(before_metrics, after_metrics)]
    best, weakest = max(range(5), key=lambda c: gains[c]), min(range(5), key=lambda c: after_metrics[c])
    untouched = [r['name'] for i, r in enumerate(DISTRICTS) if i not in {d['district'] for d in selected}]
    return dict(version='astana-synthetic-v1', budget=BUDGET, spent=spent, remaining=BUDGET-spent,
                decisions=selected, before=DISTRICTS, after=after, before_metrics=before_metrics,
                after_metrics=after_metrics, baseline=round(base, 2), score=round(score, 2), delta=round(score-base, 2),
                strengths=f'Наибольший прирост: {CATEGORIES[best]} (+{gains[best]:.2f} балла по городу).',
                risks=('Без прямых инвестиций: ' + ', '.join(untouched) + '. ' if untouched else 'Все районы получили инвестиции. ') + 'Эффекты условные; сроки и эксплуатационные затраты не включены в бюджет.',
                recommendation=f'Самое слабое направление: {CATEGORIES[weakest]} ({after_metrics[weakest]:.2f}/100). Проверьте перераспределение инвестиций в пользу районов с низкими показателями.')

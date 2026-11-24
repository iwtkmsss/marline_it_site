# Діорама вашого бізнесу — нова анімація блоку «Як ми працюємо»

Створено: 2026-11-23. Замінює стару анімацію процесу (героїня + пікселі + екран), яку користувач попросив повністю видалити. Попередні плани з `BRIEF.md` для цього блоку більше не актуальні.

Розподіл роботи: **Codex малює кадри** за промптами нижче. **Claude робить увесь код**, коли кадри будуть у `assets/story/raw/diorama/`.

## Стан

- 2026-11-24: D1–D4 отримано й підключено. Лишилися необов’язкові цикли L1 і L4 (у коді ще немає).

## Ідея

Героїня лишається зіркою першого екрана. У блоці «Як ми працюємо» головне — **бізнес клієнта**. Тут показуємо невелику піксельну ізометричну діораму компанії: прийомна, склад, бухгалтерія, двері для доставки й 6–8 маленьких людей. Ракурс один і той самий, а бізнес проходить чотири стани, по одному на кожен крок процесу:

| Стан | Крок | Що бачимо | Світло |
|---|---|---|---|
| D1 | Занурюємося | хаос: маршрути людей перетинаються й плутаються, стоси паперів, черга біля дверей, червоні сигнали проблем | ранок |
| D2 | Проєктуємо | та сама діорама як синій кресленик: світлі лінії на темно-синьому, чисті заплановані маршрути жирними лініями | «креслярське» |
| D3 | Розробляємо | будуємо: між кімнатами прокладають конвеєри й кабелі, на стіни ставлять екрани, видно риштування | вечір |
| D4 | Розвиваємо | усе працює: маршрути чисті, конвеєри їдуть, на екранах графіки, у вікнах світло, праворуч добудовано нове крило | ніч |

**Як це рухається на сайті (код).** Блок закріплюється на весь екран. Поки відвідувач крутить, текст кроків змінюється ліворуч, а праворуч вертикальний «промінь-сканер» проходить діораму зліва направо й показує наступний стан. Ліворуч від променя видно новий стан, праворуч — старий. Нічого не «відкривається» й не складається з квадратиків. Маленькі люди рухаються лише разом із прокруткою (цикли кадрів L1 і L4). Без підтримки браузера чи зі зменшеним рухом показуються чотири статичні картинки поруч із кроками.

## Вимоги до всіх кадрів

- **Формат:** PNG, рівно **1600 × 1200**, непрозоре тло (сцена разом із підлогою й тлом довкола; кути можна залити суцільним кольором стану).
- **Ракурс:** ізометрія 2:1, **однакова в усіх кадрах**. Стіни, меблі й люди стоять на тих самих місцях, змінюється лише те, що описано для стану.
- **Стиль:** піксель-арт на видимій сітці, «піксель» ≈ 6 px, обмежена палітра, без згладжування й розмиття. Деталізовано, але читається: 6–8 людей по ~40–60 px заввишки.
- **Без тексту.** Жодних літер, цифр чи логотипів. Графіки на екранах — лише стовпчики й лінії, сигнали проблем — червоні піктограми зі знаком оклику.
- **Палітра сайту:** теплий беж і персик `#ddc5ab`, `#c79c81` (D1); темно-синій `#1d2a3a` з кремовими лініями `#f7e4cf` (D2); бурштиновий вечір (D3); ніч `#1a0e14` з теплим світлом `#ffd9a0` (D4). Акцент — бордовий `#771d37`.
- **Метод (найважливіше):** спершу намалювати D1. Кожен наступний стан робити **редагуванням попереднього** (image edit / inpaint), а не з нуля. Потім накласти його на попередній на 50 % прозорості й перевірити, що стіни й меблі не зсунулися.
- **Куди класти:** `assets/story/raw/diorama/D1.png` … `D4.png`, цикли — `L1-01.png` … `L1-04.png`, `L4-01.png` … `L4-04.png`.

## Що потрібно

| id | Що | Кадрів | Пріоритет |
|---|---|---|---|
| D1–D4 | чотири стани діорами | 4 | обов'язково |
| L1 | цикл хаосу на основі D1: люди метушаться, папери розлітаються | 4 | бажано |
| L4 | цикл роботи на основі D4: люди йдуть чистими маршрутами, конвеєр їде | 4 | бажано |

Разом 4 обов'язкові кадри + 8 бажаних. Почати з D1: Claude одразу підключить його й покаже, як діорама виглядає на сайті, перш ніж малювати решту.

## Промпти для Codex

Вставляйте спільний блок + блок кадру.

### Спільний блок

```text
Isometric pixel-art diorama for a website animation. Exactly 1600×1200 PNG, opaque.
A small company seen from above in 2:1 isometric projection, cut-away walls so we see
inside: a reception/sales desk, a warehouse with shelves and boxes, an accounting office
with desks and papers, and a delivery door with a small van outside. 6–8 small generic
office workers (about 40–60 px tall), neutral simple clothes, no recognizable people.
Crisp pixel art on a visible grid of ~6 px pixels, limited palette, no anti-aliasing,
no blur. Absolutely no text, letters, digits or logos anywhere.
The camera, the building, walls and furniture stay in exactly the same place in every
frame of this series; only what the frame describes changes.
```

### D1 — хаос (ранок; малювати першим)

```text
FRAME D1, morning light, warm beige and peach palette (#ddc5ab, #c79c81), burgundy accents
(#771d37). The business is in chaos: workers' paths drawn as tangled dotted lines crossing
each other, people rushing in different directions carrying papers, tall piles of paper
on desks, sticky notes on walls, a queue of customers at the reception, a box dropped in
the warehouse aisle, three small red warning icons with an exclamation mark floating
above problem spots.
```

### D2 — кресленик (редагувати D1)

```text
FRAME D2, edit the previous image (D1). Same scene and geometry, redrawn as a blueprint:
dark navy background (#1d2a3a), all objects as light cream line art (#f7e4cf) with a
subtle grid. The tangled paths are replaced by a few clean planned routes drawn as bold
lines with small circle nodes connecting reception, warehouse, accounting and the door.
No people, no papers, no warning icons. Nothing moves from its place.
```

### D3 — будуємо (вечір; редагувати D2 за геометрією D1)

```text
FRAME D3, evening amber light. Same geometry as D1, back in full colour. Construction
in progress along the planned routes from D2: conveyor belts and cable trays being
installed between the rooms, a few wall screens being mounted (one still on a ladder),
light scaffolding on one wall, workers with tools. Paper piles are smaller, no queue,
no warning icons.
```

### D4 — працює (ніч; редагувати D3)

```text
FRAME D4, night: deep plum surroundings (#1a0e14), warm light (#ffd9a0) in every window.
Same geometry. Everything works: conveyors carry boxes, wall screens glow with simple bar
and line charts (no text), workers walk calmly along the clean routes, desks are tidy,
the van at the door is being loaded. On the right a new small extension wing has been
added to the building, also lit. No scaffolding, no warning icons.
```

### L1 і L4 — цикли (бажано)

```text
LOOP: four frames based on [D1 | D4], identical except for small motion of the people and
papers [D1] / people and conveyor boxes [D4]. Each frame moves every person 1–2 steps
along their path; frame 4 must flow back into frame 1. Background, building and furniture
pixel-identical to the base frame.
```

## План коду (Claude, після кадрів)

1. Обробка: кадри → WebP (ffmpeg, разово), ≤ 250 КБ на кадр, файли в `assets/story/diorama/` і в `publicFiles`.
2. Розмітка: блок `#process` стає закріпленою сценою (як було: `.scene-pin` + sticky `.scene`, діапазон `contain`), ліворуч чотири кроки, праворуч діорама з чотирма шарами-станами.
3. Перехід між станами — `clip-path: inset(0 X 0 0)` на верхньому шарі за scroll-таймлайном, плюс тонка світла лінія променя на межі.
4. Цикли L1 і L4 — кроки `background-position` або заміна кадрів, прив'язані до прокрутки, а не до часу.
5. Без підтримки, у reduced motion або на низьких екранах — без закріплення: біля кожного кроку статична мініатюра його стану.

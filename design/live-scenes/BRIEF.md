# Живі сцени — ТЗ на матеріали та реалізацію

> **Застаріло (2026-11-23):** анімацію процесу з героїнею й пікселями видалено на прохання користувача. Актуальний план анімації блоку «Як ми працюємо» — [DIORAMA.md](DIORAMA.md).

Створено: 2026-11-23. Основа — сюжет «один знімальний день» (5 сцен), погоджений користувачем того ж дня.

Розподіл роботи (рішення користувача 2026-11-23): **Codex лише малює картинки й кадри анімації** за промптами з розділу 4. **Увесь код робить Claude**: обробка кадрів, нарізка, розмітка, CSS, JS, збірка й перевірка (розділ 5). Розділи 1–4 — що й скільки намалювати.

---

## Актуально з 2026-11-23: логіка «кадр + пікселі бізнесу» (уже на сайті)

Користувач уточнив: міняємо **анімації**, а не вигляд героїні. Сцени нижче першого екрана перероблено, і вони вже працюють на теперішньому листі поз `assets/mascot/marilyn-scenes.webp`:

- У сценах 2–4 поруч із текстом стоїть **великий кадр-видошукач**: на десктопі він липкий, на телефоні йде в потоці. Героїня в ньому на повний зріст.
- У кожен кадр вона **заходить кроком зліва**, потім змінює пози, і все це керується прокруткою.
- **Пікселі бізнесу** (люди, дії, обмеження, цілі, по 6 кожного) переходять зі сцени в сцену. Занурюємося: хаос → групи. Проєктуємо: групи → креслення зі зв'язками. Розробляємо: креслення → робочий екран, який вмикається.
- Прем'єра: прохід в арку, як і раніше.

Код: `.stage` у `index.html`, стилі в `src/story.css` (розділ Stage), розкладки пікселів у `src/story.js` (`buildStages`).

**Що саме покращать нові кадри.** Зараз хода — це лише 3 кадри, а між позами йде різкий перескок. Потрібні такі листи, кожен з референсом `marilyn-scenes.webp` і спільним блоком із розділу 4:

| id | Що | Кадрів | Замінює |
|---|---|---|---|
| 5a | цикл ходи збоку вправо (промпт 5a) | 8 | 3-кадрову ходу на вході в кожен кадр |
| G1 | плавний перехід «стоїть → піднімає руку й показує вправо» | 5 | стрибок поз у «Занурюємося» |
| G2 | «показує вправо → широкий жест обома руками, ніби розставляє щось у ряди» | 5 | стрибок поз у «Проєктуємо» |
| G3 | «тягне невидимий важіль униз → показує на екран праворуч» | 5 | стрибок поз у «Розробляємо» |
| 5b | біля арки обертається й надсилає поцілунок (промпт 5b) | 5 | кінець прем'єри |

Разом 28 кадрів у 5 листах. Розділи нижче (сцени й список матеріалів) — попередня версія плану. З неї досі актуальні загальні вимоги до листів (розділ 2) і спільний блок промпту (4.0).

## 0. Ідея: прокрутка — це плівка

Зараз героїня «живе» лише на першому екрані, а далі стоїть статичними позами. Ідея: **у кожній сцені вона робить одну дію, і цю дію відвідувач сам «перемотує» прокруткою.** Прокрутив униз — кадри йдуть уперед, назад — героїня теж іде назад, як плівка на монтажному столі. Крім того, сцена реагує на дії відвідувача: відкрив запитання — вона підвела очі, відкрив послугу — змінила позу.

Три правила, щоб це читалося як історія, а не як набір гифок:

1. **Одна дія на сцену.** Читає → малює розкадровку → грає дубль → іде доріжкою на прем'єру.
2. **Прокрутка керує кадром, а не таймер.** Нічого не крутиться саме по собі нескінченно; немає «зайвого» руху, коли людина просто читає.
3. **Вона переходить зі сцени в сцену.** У кінці однієї дії вона виходить із кадру в той бік, звідки з'явиться в наступній сцені.

| Сцена | Дія героїні (прокрутка) | Реакція на відвідувача | Кодом, без нових малюнків |
|---|---|---|---|
| 1. Гримерка | вже є: складання з пікселя, погляд, вітер | опускає погляд на стрілку «Як ми працюємо» | лампи навколо дзеркала загоряються по черзі |
| 2. Читка сценарію | сидить за столом і гортає сценарій | відкрили запитання — підводить очі й усміхається | олівцеві позначки «малюються» на сторінці |
| 3. Розкадровка | іде вздовж трьох кадрів і показує на кожен | — | кадри проявляються з олівцевого ескізу в кольоровий макет |
| 4. Знімальний майданчик | клацає хлопавкою: «Мотор!» | відкрили послугу — поза-«дубль» під цю послугу | вмикається прожектор, лічильник дублів |
| 5. Прем'єра | іде червоною доріжкою до арки | у кінці обертається й надсилає повітряний поцілунок | спалахи фотографів (обмежено, див. 5.6) |

---

## 1. Героїня

Рішення користувача 2026-11-23: **лишаємо теперішню героїню й теперішній стиль**. Спроба з новою героїнею (`raw/0a-reference.png`, `raw/0b-hero.png`, `raw/5a-walk.png`) відхилена й не використовується.

- Перший екран (портрет і його анімації) лишається без змін.
- Усі нові кадри малюються з референсом `assets/mascot/marilyn-scenes.webp`: той самий персонаж, ті самі пропорції, палітра й піксель-арт стиль. Нічого не «переосмислювати» й не спрощувати.

## 2. Технічні вимоги до всіх кадрів

**Як генерувати, щоб кадри були схожі між собою (найважливіше):**

- Генеруйте **всю послідовність однією картинкою, як лист кадрів (sprite sheet)**, а не кожен кадр окремо. В одній генерації модель тримає однакове обличчя, масштаб і світло. Окремі генерації завжди «пливуть».
- До кожної генерації прикріплюйте референс `assets/mascot/marilyn-scenes.webp` (8 поз героїні в повний зріст).
- Якщо один кадр у листі невдалий, не генеруйте лист наново, а відредагуйте лише цю клітинку (edit/inpaint).
- Інструмент — той самий генератор, яким робили попередні кадри (ChatGPT/Codex image generation).

**Формат листа:**

| Параметр | Значення |
|---|---|
| Клітинка | 640 × 640 px, усі однакові, без відступів між клітинками |
| Сітка | 4 колонки; 8 кадрів = 2560 × 1280, 4–5 кадрів = 2560 × 640 або 2560 × 1280 |
| Порядок | зліва направо, згори вниз |
| Фон | суцільний **маджента `#FF00FF`**, без тіней на фоні (Codex сам прибере фон; «прозорий» фон генераторів дає брудні краї, як у теперішньому листі поз) |
| Масштаб | героїня в повний зріст ≈ 560 px заввишки в кожній клітинці, **ступні на одній лінії** (≈ 24 px від низу клітинки) |
| Стиль | піксель-арт, видимий квадратний «піксель» ≈ 4 px у клітинці 640, без згладжування й розмиття |
| Палітра | як у референсі; червоний — лише губи й доріжка, акцент `#771d37` |
| Предмети | лише ті, що в описі, без тексту й літер |

**Куди класти:** `assets/story/raw/<id>.png` (наприклад `assets/story/raw/5a-walk.png`). Жодної обробки не треба: нарізку, вирівнювання, прибирання фону й стискання у WebP робить Claude.

---

## 3. Перелік матеріалів

P1 — потрібне для повноцінного результату, P2 — підсилення, якщо лишиться сили.

| id | Сцена | Що | Кадрів | Формат | Пріоритет |
|---|---|---|---|---|---|
| 2a | Читка | сидить за столом і гортає сценарій | 8 | лист 4×2, клітинка 640 | P1 |
| 2b | Читка | підводить очі від сценарію, усміхається, повертається до читання | 4 | лист 4×1 | P1 |
| 3a | Розкадровка | показує на кадр 1 → крок → на кадр 2 → крок → на кадр 3 | 7 | лист 4×2 (8-ма клітинка порожня) | P1 |
| 3b | Розкадровка | олівцеві ескізи трьох кадрів макета | 3 | окремі PNG 1200 × 900 | P1 |
| 4a | Майданчик | клацає хлопавкою | 4 | лист 4×1 | P1 |
| 4b | Майданчик | 4 пози-«дублі» (по одній на послугу) + нейтральна | 5 | лист 4×2 | P1 |
| 5a | Прем'єра | цикл ходи збоку (крок лівою + крок правою) | 8 | лист 4×2 | P1 |
| 5b | Прем'єра | біля арки обертається до глядача й надсилає поцілунок | 5 | лист 4×2 | P1 |
| 1a | Гримерка | портрет: погляд униз на стрілку → назад | 3 | окремі PNG 1254 × 1254, як `anim/01–04` | P2 |
| 4c | Майданчик | піксельна кінокамера на штативі; бобіни обертаються | 4 | лист 4×1 | P2 |
| 5c | Прем'єра | тло: доріжка, канати, силуети натовпу | 1 | PNG 2400 × 1000 на мадженті | P2 |
| px | усі | шари паралаксу (далекий + ближній план) для сцен 2–5 | 8 | PNG 2400 × 1400 на мадженті | P2 |

**Разом:** P1 — 44 кадри з 8 генерацій листів і 3 ескізів. P2 — ще 16 зображень.

**Порядок:** почніть із **5a (хода)**. Хода — пілот: на ній Claude перевірить увесь конвеєр (вирізання, вирівнювання, прокрутка), і ви побачите результат на сайті, перш ніж малювати решту. Далі 5b → 2a → 2b → 3a → 3b → 4a → 4b.

---

## 4. Промпти

Кожен промпт складається зі спільного блоку й опису послідовності. Вставляйте **спільний блок + блок послідовності**, прикріпивши референс.

### 4.0 Спільний блок

```text
Pixel-art sprite sheet for a website animation. Attached image = character reference.

CHARACTER (identical in every cell): the woman from the attached reference sheet.
Copy her EXACTLY: same face, same hairstyle and curls, same white satin gown and long
gloves, same proportions, same palette, same pixel-art style and pixel size.
Do not redesign, simplify, cartoonify or "improve" her.

SHEET RULES:
- Grid of 640×640 cells, 4 columns, no gaps, no borders, no numbers, no text.
- Solid flat magenta (#FF00FF) background in every cell, no shadows on the background.
- Same camera, same scale, same lighting in every cell; full-body figure about 560 px tall;
  feet always on the same baseline 24 px above the bottom of the cell.
- Crisp pixel art on a visible grid of ~4 px squares, limited palette, no anti-aliasing,
  no blur, no gradients except hand-placed dithering.
- Consecutive cells are consecutive frames of ONE smooth animation: small gradual changes,
  nothing else changes between frames.
```

### 2a — гортає сценарій (8 кадрів)

```text
SEQUENCE: seated at a small wooden table, side three-quarter view facing right, reading a
thick screenplay held open on the table. The chair and table are identical in every cell.
1 reading, eyes on the page. 2 right hand lifts the corner of the page. 3 page lifted halfway.
4 page upright. 5 page passing over. 6 page lands on the left stack. 7 hand smooths the new
page. 8 reading again (same as 1 but the left stack is one page thicker).
```

### 2b — підводить очі (4 кадри)

```text
SEQUENCE: same seated pose, table and screenplay as frame 1 of the previous sheet.
1 reading. 2 eyes lift from the page toward the viewer. 3 looks at the viewer with a small
warm smile, eyebrows slightly raised. 4 eyes back on the page, smile fading.
Only the eyes, eyebrows and mouth change.
```

### 3a — показує на кадри (7 кадрів)

```text
SEQUENCE: standing, side view facing right, holding a pencil in the left hand, presenting
storyboard panels that are off-frame to her right.
1 points with the right arm forward and slightly UP. 2 lowers the arm, takes a step right.
3 mid-step. 4 points forward at chest height. 5 lowers the arm, steps right. 6 mid-step.
7 points forward and slightly DOWN. Leave cell 8 empty magenta.
```

### 3b — олівцеві ескізи (3 окремі зображення)

Три вихідні кадри (верх, середина, низ макета, як зараз у розкадровці) Claude виріже з `design/previews/a-desktop.png` у `assets/story/raw/3b-source-1..3.png`. Кожен прикріпіть до генерації з промптом:

```text
Redraw the attached website screenshot as a quick storyboard pencil sketch on white paper:
graphite lines, loose hatching for dark areas, the same layout, blocks and proportions,
text shown only as scribbled lines (no readable letters). 1200×900, no frame, no border.
```

### 4a — хлопавка (4 кадри)

```text
SEQUENCE: standing, facing the viewer, holding a classic black-and-white film clapperboard
in front of her at chest height, no text on the board.
1 clapper stick wide open, she looks at the viewer. 2 stick halfway down. 3 stick closed with
a snap (tiny pixel spark at the hinge). 4 she lowers the board slightly and smiles.
```

### 4b — дублі під послуги (5 кадрів)

```text
SEQUENCE: five separate poses of the same character on the same baseline (not a smooth
sequence; each pose must read clearly as a silhouette).
1 neutral: standing, hands relaxed, looking at the viewer.
2 holds up a large empty rectangular picture frame in front of her like a screen (websites).
3 carries a neat stack of folders and files, organising them (internal systems).
4 pulls a big lever / presses a large round button, other hand on the hip (automation).
5 shades her eyes with one hand, looking far to the right (developing what already works).
Leave cells 6–8 empty magenta.
```

### 5a — хода (8 кадрів)

```text
SEQUENCE: a seamless WALK CYCLE, strict side view walking to the right, elegant runway walk
in the gown. 8 frames: contact (left foot forward), down, passing, up, contact (right foot
forward), down, passing, up. Frame 8 must flow naturally back into frame 1. The head height
moves by at most 8 px; the figure does not travel inside the cell.
```

### 5b — поцілунок біля арки (5 кадрів)

```text
SEQUENCE: continues from the end of a walk to the right.
1 standing side view facing right (as a walk frame). 2 turns three-quarter toward the viewer.
3 faces the viewer, right hand rises to the lips. 4 blows a kiss: hand moves forward, palm
up, a tiny pixel heart leaves the palm. 5 stands facing the viewer, smiling, hand lowered.
```

### 1a, 4c, 5c, px (P2)

- **1a:** за тією самою схемою, кожен кадр редагує попередній. 1 — зіниці опущені вниз-вліво (на стрілку). 2 — повіки трохи прикриті. 3 — погляд повертається, як в оригіналі.
- **4c:** «pixel-art 1950s film camera on a tripod, side view, two film reels on top; 4 frames: the reels rotate 1/8 turn per frame, nothing else changes».
- **5c, px:** «pixel-art background plate, wide 2400×1400, [опис], muted colours, no characters in focus, magenta #FF00FF where the layer must be transparent». Шари: Читка — вікно з ранковим світлом / край столу; Розкадровка — кутова лампа / дошка з кнопками; Майданчик — софіти й кабелі / край декорації; Прем'єра — натовп за канатами / край доріжки.

---

## 5. Реалізація (робить Claude, не Codex)

План для Claude: що зробити в коді, коли кадри будуть у `assets/story/raw/`. Обов'язкові правила проєкту: без сторонніх пакетів і поліфілів, `modern-web-guidance` перед HTML/CSS/JS, кожен новий публічний файл — у `publicFiles` у `scripts/build.mjs`. Hero-сцену і `design/wow-study/wow.js` не змінювати.

### 5.1 Обробка кадрів (скрипт у `scripts/`, без runtime-залежностей)

Вхід: `assets/story/raw/*.png`. Для кожного листа:

1. Нарізати клітинки 640 × 640, пропустити порожні (суцільна маджента).
2. Прибрати фон: пікселі, близькі до `#FF00FF` (з допуском), стають прозорими; рожеву облямівку на краях фігури прибрати (despill).
3. Вирівняти кадри: однакова лінія ступнів для повнозрістних послідовностей; для 2a/2b — за столом (стіл не має стрибати між кадрами).
4. Привести до піксельної сітки (квадрати ≈ 4 px) і до спільної палітри, щоб кадри не «мерехтіли».
5. Зібрати горизонтальну смугу `assets/story/<id>.webp` (кадри підряд), lossless або q≈90. Кожна смуга ≤ 300 KB, усі нові матеріали разом ≤ 2.5 MB.
6. Записати розміри й кількість кадрів у `assets/story/README.md`.

Декодувати PNG і кодувати WebP вбудованими API Node не вийде, тому обробку зробити разово в браузері (canvas + `toBlob('image/webp')`) або локальним інструментом. Комітити лише результат, runtime-залежностей це не додає.

### 5.2 Компонент кадру

Один універсальний елемент: `<span class="reel" style="--frames: 8" aria-hidden="true">` з фоном-смугою `background-size: calc(var(--frames) * 100%) 100%`, `image-rendering: pixelated`, `aspect-ratio: 1`. Кадр перемикається анімацією `background-position` від `0%` до `100%` з `steps(var(--frames) - 1, jump-none)` (якщо `calc` у `steps()` не підтримується, задати число в кожному класі).

### 5.3 Прокрутка керує кадром

- Дії 2a, 3a, 4a, 5a — `animation-timeline: view()` (або іменований таймлайн сцени), `animation-range` підібрати так, щоб дія займала прокрутку, поки сцена в центрі екрана.
- Хода 5a повторюється 2–3 цикли за прохід доріжкою (`animation-iteration-count` разом із scroll-таймлайном). Паралельно сама героїня рухається вздовж доріжки через `translate` на тому самому таймлайні, а в кінці її змінює 5b.
- 3b: кольоровий кадр макета лежить над ескізом і відкривається `clip-path: inset(...)` на таймлайні кадру. Кадри відкриваються по черзі, синхронно з тим, як героїня показує на кожен (3a).
- Переходи між сценами: героїня виходить за край кадру в кінці дії (`translate` на `exit`-діапазоні) і з'являється з того ж боку в наступній сцені.
- Без підтримки scroll-driven animations — статичний ключовий кадр (останній кадр дії). Це декоративний рух, тож за гайдом `scrollytelling` JS-fallback не потрібен.

### 5.4 Реакції на відвідувача

- 2b: `toggle` на `details` у сценарії → `story.js` ставить `data-react` на героїню → CSS грає 4 кадри за часом (~700 мс, `steps`) і повертає читання. Повторно не частіше разу на 3 с.
- 4b: відкритий `details.service` визначає позу (індекс послуги +1). Жоден не відкритий — нейтральна. Перехід між позами — миттєва зміна кадру + короткий `scale`-«стрибок» 120 мс (лише без reduced motion).
- 1a: через 4 с після завершення вітру, якщо відвідувач ще не прокручував, — один раз погляд на стрілку. Лише у `wow.js`-сумісний спосіб: окремий шар поверх портрета, `wow.js` не змінювати.

### 5.5 Продуктивність

- Смуги кадрів підвантажувати лише тоді, коли сцена близько: `story.js` (IntersectionObserver, `rootMargin: 100% 0px`) додає клас, і лише цей клас задає `background-image`. Не підвантажувати всі сцени на старті.
- Анімувати лише `background-position`, `translate`, `opacity`, `clip-path`. Для `background-position` перевірити плавність на 4× CPU throttling. Якщо кадри губляться, перейти на `translate` всередині `overflow: clip`-вікна.
- Не більше однієї «живої» дії в полі зору одночасно.

### 5.6 Доступність і рух

- Усі анімації героїні — у `@media (prefers-reduced-motion: no-preference)` і `html:not([data-reduced-motion="true"])`. Зі зменшеним рухом — ключові кадри: 2 — читає, 3 — показує на кадр 2, усі три кадри макета кольорові, 4 — нейтральна поза, 5 — стоїть біля арки обличчям до глядача.
- Спалахи фотографів: малі (до 10 % екрана), не частіше 2 на секунду, лише під час прокрутки сцени 5, вимкнені у зменшеному русі (WCAG 2.3.1 — не більше 3 спалахів за секунду).
- Елементи героїні `aria-hidden="true"`; текст і структура сторінки не змінюються.
- Нічого не має рухатися без дії відвідувача довше 5 с (WCAG 2.2.2); виняток — уже наявна hero-сцена з кнопками керування.

### 5.7 Перевірка

`npm run check`, `npm run build` (нові файли є в `dist/`), ширини 320/390/768/1440 без горизонтального переповнення, прокрутка вперед і назад (кадри йдуть назад), відкриття запитань і послуг, ручний і системний reduced motion, відсутність помилок у console. Для пілота (5a) — показати користувачу запис або скриншоти кількох кадрів до переходу до інших сцен.

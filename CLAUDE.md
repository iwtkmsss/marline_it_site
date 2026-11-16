# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Спершу прочитай

- [AGENTS.md](AGENTS.md) — правила розподілу роботи між моделями (мозок / `haiku-scout` / `sonnet-worker` / `opus-builder`) і обмеження проєкту. Вони обов'язкові.
- [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) — підтверджені рішення користувача, історія й відкриті питання. [HANDOFF.md](HANDOFF.md) — коротка передача контексту між сесіями. Після суттєвих змін онови ці файли (дати в абсолютному форматі).

## Про проєкт

Сайт ІТ-компанії **Marline**, усі тексти українською. Користувач обрав світлий напрям **A**. Зараз його розвивають в основну статичну сторінку. Демо A/B у `design/motion-study/` треба зберегти для порівняння. Спершу дизайн погоджують з користувачем, і лише потім роблять production-реалізацію. Хостинг, домен і production-стек ще не обрано.

Незмінні вимоги користувача:
- Контактний блок поки лише заглушка. Не вигадуй контакти чи кейси й не імітуй надсилання заявки.
- Для HTML/CSS і клієнтського JS спершу застосуй скіл `modern-web-guidance` (цільовий search/retrieve), потім реалізуй.
- Використовуй сучасні веб-API з невеликими локальними fallback. Сторонні пакети, поліфіли й runtime-залежності не додавай. Перевіряй підтримку API, а без неї сторінка має лишатися працездатною у статичному чи нативному вигляді.
- Тести для дрібних візуальних правок не додавай.
- Зміни в коді не синхронізуються з Figma автоматично ([файл](https://www.figma.com/design/xJeIYybQAQ2NyIu0Qhplnr?node-id=3-2), локальна копія `design/marline-concept-01.fig`).

## Команди

npm-пакети не потрібні. Для серверів потрібен Python, для перевірки й збирання потрібен Node.

```bash
npm run dev       # статичний сервер з кореня: http://127.0.0.1:8473/ (motion study: /design/motion-study/?version=a|b)
npm run check     # node --check для src/site.js, src/motion.js, scripts/build.mjs
npm run build     # копіює фіксований перелік публічних файлів у dist/
npm run preview   # сервер лише для dist/: http://127.0.0.1:8474/
```

Автотестів немає. Перевірка складається з `npm run check`, `npm run build` і візуальної перевірки в браузері. Зазвичай перевіряють ширини 320/390/768/1440 px без горизонтального переповнення, меню, Escape і фокус, клавіатуру у вкладках, deep links, reduced motion та відсутність помилок у console. Синтаксис motion study перевіряй так: `node --check design/motion-study/motion.js`.

## Архітектура

Основна сторінка складається з `index.html`, `src/site.css`, `src/site.js` і `src/motion.js`. Скрипти підключено з `defer`, кожен працює як самостійний IIFE без модулів. Шрифти Unbounded (заголовки) і Golos Text (текст) лежать локально в `assets/fonts/` разом з OFL-ліцензіями. Motion study натомість бере шрифти з Google Fonts.

Сторінка спирається на нативні можливості, а JS лише покращує поведінку:
- **Меню** — це `popover="auto"` з `popovertarget`. `site.js` синхронізує `aria-expanded`, закриває меню на Escape чи кліку поза ним і перемірює навігацію при resize. Для браузерів без `:popover-open` є fallback (`@supports selector(:popover-open)` у CSS).
- **Акордеони** (`details[data-accordion]`) розкриваються нативно. Плавне розкриття ввімкнене лише під `@supports selector(details::details-content) and (interpolate-size: allow-keywords)`.
- **Етапи процесу** (`#process`): без JS усі панелі показано як звичайний послідовний контент. JS показує `#process-tabs` (атрибут `hidden` знімається), керує `aria-selected`, індикатором, клавіатурною навігацією (для браузерів без focusgroup), `hashchange` і `beforematch` для deep links.
- **Рух** (`motion.js`): при першій появі піксельний портрет складається на `<canvas>` поверх `<img>`. Після цього canvas ховається, а loop зупиняється. Декоративні пікселі в `.motion-trail` летять від портрета до етапів процесу. Там, де є CSS scroll timelines (`html[data-scroll-motion="native"]`, `animation-timeline: scroll(root block)`), їх рухає CSS. Без цієї підтримки рух залишається статичним, а прокрутка ніколи не перехоплюється. Вступ стає на паузу, коли вкладку приховано.
- **Reduced motion**: системний `prefers-reduced-motion` має пріоритет. Ручний перемикач «Менше руху» (`#motion-toggle`) виставляє `data-reduced-motion="true"` на `<html>`. Тоді лишається завершений портрет і кольоровий зворотний зв'язок.
- **Зв'язок між скриптами** відбувається через кастомні події на `document`. `site.js` надсилає `marline:layoutchange` при зміні висоти, наприклад коли розкривається акордеон, і `motion.js` перемірює траєкторію. `marline:motionchange` змушує `site.js` завершити поточні переходи станів. Додаючи елементи, які змінюють висоту, надсилай `marline:layoutchange`.

`scripts/build.mjs` використовує лише вбудовані API Node. Він копіює явний список `publicFiles` у `dist/`, тож **новий публічний файл (asset, скрипт, шрифт) треба додати в цей список**, інакше його не буде в збірці. Скрипт спершу перевіряє й читає всі джерела, а вже потім очищає `dist/`. Він відмовляється чистити шлях, якщо той відрізняється від `<root>/dist` або містить symlink чи junction. Цих запобіжників не послаблюй. `design/`, документація і промпти до збірки потрапляти не мають.

Інше:
- `design/BRIEF.md` — початкове ТЗ концепції.
- `design/previews/` — PNG-прев'ю з Figma.
- `assets/mascot/` — PNG персонажа (ще не оптимізований і не затверджений як фінальний бренд-актив) і промпт його генерації.

## Git

Віддалений репозиторій: `https://github.com/iwtkmsss/marline_it_site.git`, гілка `main`. Перед будь-якою Git-дією перевір branch, status і remote. Комітити й пушити можна лише на прохання користувача.

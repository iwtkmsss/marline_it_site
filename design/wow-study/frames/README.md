# Кадри очей для вау-сцени

Демо працює й без цих файлів: тоді кліпання малюється процедурно з оригінального PNG. Згенеровані кадри додають головний момент: «вона дивиться на вас».

Покладіть файли сюди з такими іменами (усі необов'язкові):

| Файл | Що на ньому | Навіщо |
|---|---|---|
| `eyes-viewer.png` | дивиться **прямо на глядача** | початок сцени: «вона мене помітила» |
| `eyes-closed.png` | очі **закриті** (кліпання) | кліпання в стилі згенерованого кадру |
| `eyes-half.png` | очі **напівзакриті** | проміжний кадр кліпання; без нього береться `closed` |

Скрипт бере з кадру **лише ділянки очей** і вклеює їх у портрет із м'яким краєм. Решта зображення може трохи відрізнятися, на результат це не вплине. Важливо одне: обличчя має стояти **на тому самому місці й у тому самому масштабі**, що й в оригіналі.

## Як генерувати

Найнадійніше редагувати оригінал (image edit / inpainting), а не генерувати з нуля:

1. Завантажте в генератор `assets/mascot/marilyn-pixel-v1.png`.
2. Якщо інструмент дає виділити область (inpainting), виділіть **лише обидва ока разом із повіками**, без брів.
3. Вставте промпт нижче. Збережіть результат як PNG із прозорим тлом. Розмір бажано квадратний (1254×1254 або 1024×1024: масштаб скрипт підлаштує сам).

### eyes-viewer.png

```
Edit this exact pixel-art portrait. Change ONLY the eyes: both irises and pupils now look straight at the viewer (centered in the eye openings), relaxed and friendly, eyelids in the same position as now. Keep everything else pixel-identical: same face position and scale, same head angle, same pixel size and pixel-art style, same eyeliner, lashes, eyeshadow, eyebrows, skin, hair, earrings, lips, colors and lighting. Transparent background, same square canvas and framing. No new details, no smoothing, no repainting outside the eyes.
```

### eyes-closed.png

```
Edit this exact pixel-art portrait. Change ONLY the eyes: both eyes are gently closed in a natural blink, upper eyelids fully down, the lash line becomes a soft curved dark line where the eye opening was, eyeliner wings stay in place. Keep everything else pixel-identical: same face position and scale, same head angle, same pixel size and pixel-art style, same eyeshadow color on the lids, eyebrows, skin, hair, earrings, lips, colors and lighting. Transparent background, same square canvas and framing. No smoothing, no repainting outside the eyes.
```

### eyes-half.png

```
Edit this exact pixel-art portrait. Change ONLY the eyes: both eyes are half closed mid-blink, upper eyelids cover the top half of the irises, irises still looking to the side as in the original. Keep everything else pixel-identical: same face position and scale, same head angle, same pixel size and pixel-art style, same eyeliner, lashes, eyeshadow, eyebrows, skin, hair, earrings, lips, colors and lighting. Transparent background, same square canvas and framing. No smoothing, no repainting outside the eyes.
```

## Кадри вітру (волосся)

Є: `hair-breeze.png`, `hair-gust.png`, `hair-rebound.png`. Необов'язкові проміжні кадри роблять порив плавнішим, а відсутні просто пропускаються:

| Файл | Між якими кадрами | Що на ньому |
|---|---|---|
| `hair-rising.png` | breeze → gust | локони наполовину розкрутилися й тягнуться ліворуч |
| `hair-gust-2.png` | gust ↔ gust | той самий сильний порив, але пасма в інших положеннях (тріпотіння) |
| `hair-falling.png` | gust → breeze | хвилі опадають і знову закручуються в локони |

Найкраще редагувати `hair-gust.png` (для `gust-2`) або `hair-breeze.png` (для `rising`, `falling`) і виділяти **лише волосся**.

### hair-rising.png (вихідний кадр: hair-breeze.png)

```
Edit this exact pixel-art portrait. Change ONLY the hair: the wind from the right is getting stronger, the curls are half unwound and stretch toward the left (viewer's left), halfway between soft curls and long windswept waves, curls on the right side start to press toward the head. Keep the face, eyes, eyebrows, lips, skin, earrings, neck and dress pixel-identical, same face position and scale, same pixel size and pixel-art style, same hair colors and lighting. Transparent background, same square canvas and framing. No smoothing.
```

### hair-gust-2.png (вихідний кадр: hair-gust.png)

```
Edit this exact pixel-art portrait. Change ONLY the hair: the same strong gust from the right, the hair keeps the same overall windswept shape to the left, but the wave crests and the loose strand tips at the left edge are in slightly different positions, as the next moment of fluttering in the wind. Keep the face, eyes, eyebrows, lips, skin, earrings, neck and dress pixel-identical, same face position and scale, same pixel size and pixel-art style, same hair colors and lighting. Transparent background, same square canvas and framing. No smoothing.
```

### hair-falling.png (вихідний кадр: hair-breeze.png)

```
Edit this exact pixel-art portrait. Change ONLY the hair: the gust is fading, the long waves fall back toward the head and start curling into soft curls again, still leaning a little to the left (viewer's left), halfway between windswept waves and the original curls. Keep the face, eyes, eyebrows, lips, skin, earrings, neck and dress pixel-identical, same face position and scale, same pixel size and pixel-art style, same hair colors and lighting. Transparent background, same square canvas and framing. No smoothing.
```

## Якщо обличчя зсунулось

Генератори часто трохи зміщують або масштабують зображення. Тоді на місці очей видно «шов» або подвійні вії. Що можна зробити:

- Спробувати ще раз з inpainting лише ділянки очей: це найкраще зберігає положення.
- Невеликий зсув виправляється в `design/wow-study/wow.js` константою `FRAME_ALIGN = { dx, dy }` (у пікселях оригіналу 1254×1254). Наприклад, `{ dx: 4, dy: -2 }`, якщо очі на кадрі на 4 px правіше й на 2 px вище.

Довідка про місце очей: на оригіналі ліве (від глядача) око лежить приблизно в межах x 378–508, y 398–458, праве — x 590–736, y 358–414.

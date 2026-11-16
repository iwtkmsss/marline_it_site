# Промпт для Codex: покадрова анімація сцени

Вставте текст нижче в Codex цілком. Складання з пікселів лишається в коді, а Codex малює лише те, що відбувається після нього: погляд і кліпання, а потім порив вітру.

Демо підхоплює кадри автоматично. Кожен кадр вирівнюється за обличчям оригіналу: зсув до 10 px код компенсує сам, а поточний стан показує статус у панелі демо. Поки бракує хоча б одного кадру з групи (`01–04` або `w01–w13`), ця група не грає.

---

```
Task: draw a short frame-by-frame animation of an existing pixel-art portrait.
Do not change any code in this repository. Only create PNG files.

Source image: assets/mascot/marilyn-pixel-v1.png (1254×1254, transparent background).
Output folder: design/wow-study/frames/anim/
Every output file: PNG, exactly 1254×1254, transparent background, same framing.

HOW TO WORK (this matters more than anything else):
- This is ONE continuous animation, not a set of separate pictures. Consecutive
  frames must look like neighbouring frames of a cartoon: small, gradual changes.
- Make every frame by EDITING THE PREVIOUS FRAME (image edit / inpainting), never
  from scratch and never from the original again (except where stated).
- Change only what the frame description says. The face, head angle, neck,
  shoulders, dress, earrings, lips, skin and colours stay pixel-identical to the
  source. The face must not move or rescale by even a few pixels.
- Keep the exact pixel-art style: same pixel size, same palette, no smoothing,
  no new details, no change of lighting.
- The hair must stay the SAME hairstyle with the SAME curls: wind bends, stretches
  and lifts the existing curls; it never turns them into a different haircut.
  The silhouette changes gradually from frame to frame.
- After each frame, overlay it on the previous one (50% opacity) and check that
  nothing except the described area changed and the face did not shift. Redo the
  frame if it did.

PART 1 — eyes (start from the source image)
01.png  Eyes look straight at the viewer (irises centred), relaxed and friendly.
        Only the irises move; eyelids as in the source.
02.png  From 01: upper eyelids half closed (blink starts), irises still at the viewer.
03.png  From 02: eyes fully closed, soft curved lash line, eyeliner wings in place.
04.png  From 03: eyelids half open again, irises now looking to the side exactly
        as in the source image (she turns her gaze away). After 04 the animation
        returns to the source image itself.

PART 2 — gust of wind from the right side of the picture, blowing to the left
(start from the source image; eyes stay as in the source unless stated)
w01.png  First breath of wind: the outer curls on the right side flatten slightly
         toward the head, the tips of the left-side curls start to lift to the left.
w02.png  From w01: wind stronger; left-side curls loosen and stretch a little to the left.
w03.png  From w02: curls on the left are visibly pulled out to the left, the top of
         the hair starts to flow left, a few strand tips lift.
w04.png  From w03: peak of the gust: the hair on the left streams out to the left
         (curls stretched into long waves), the right side is pressed to the head.
w05.png  From w04: still the peak; the streaming strand tips on the left flutter
         into slightly different positions (small change only).
w06.png  From w05: still the peak; the tips flutter back, roughly like w04.
w07.png  From w06: the gust weakens slightly; the streaming hair drops a little.
w08.png  From w07: same hair, a bit lower; she starts to blink: upper eyelids half closed.
w09.png  From w08: hair a bit lower again; eyes fully closed.
w10.png  From w09: hair keeps falling back; eyelids half open, irises to the side as in the source.
w11.png  From w10: the wind is gone: the long waves fall back toward the head and
         start to curl again.
w12.png  From w11: curls almost back in their original shape, slightly fuller on the left.
w13.png  From w12: nearly identical to the source hair, last tiny settling of the curls.
         (After w13 the animation returns to the source image.)

Deliver: 01.png 02.png 03.png 04.png w01.png … w13.png (17 files) in
design/wow-study/frames/anim/. Then list any frame where you could not keep the
face fixed or where the change from the previous frame is bigger than intended.
```

---

## Як кадри грають у демо

Час відраховується від завершення складання, темп близько 12 кадрів на секунду. Таймінги задано в `ANIM_INTRO` і `ANIM_GUST` на початку `../../wow.js`.

| Кадри | Час | Що відбувається |
|---|---|---|
| 01 | 0–0,85 с | дивиться на вас |
| 02–04 | 0,85–1,09 с | кліпає й відводить погляд |
| оригінал | далі | стрибає неслухняний тайл |
| w01–w13 | 2,55–4,15 с | порив вітру, усередині друге кліпання (w08–w10) |
| оригінал | після w13 | спокій |

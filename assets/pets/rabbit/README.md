# Rabbit Pet Assets

Rabbit pet animation assets. Each animation is a horizontal 4-frame PNG spritesheet. Play at 500ms per frame.

Frames are normalized to 128 x 128 so they match the other pet asset formats. Source frames larger than 128 x 128, including the 242 x 242 adult frames, were proportionally scaled down and centered in the 128 x 128 cell.

Forms:
- `baby`
- `adult`
- `magic`

States:
- `normal`: 正常
- `happy`: 开心
- `eat`: 吃饭
- `sleep`: 睡觉
- `sad`: 伤心

Source notes:
- `adult/row_03` now uses all four source frames. 242 x 242 frames were proportionally scaled down and centered.
- `magic/row_*` source frames have been added and packed into animated 4-frame spritesheets.
- `extra-preview.png` preserves the additional square preview image from the source folder.

Use `manifest.json` for frame size and source paths.

Quick CSS usage:

```html
<link rel="stylesheet" href="assets/pets/rabbit/rabbit.css">
<div class="wb-rabbit baby normal"></div>
```

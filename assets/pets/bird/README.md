# Bird Pet Assets

Bird pet animation assets. Each animation is a horizontal 4-frame PNG spritesheet. Play at 500ms per frame.

Frames are normalized to 128 x 128 so they match the other pet asset formats. Source frames larger than 128 x 128, including the 260 x 260 magic frames, were proportionally scaled down and centered in the 128 x 128 cell.

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

Use `manifest.json` for frame size and source paths.

Quick CSS usage:

```html
<link rel="stylesheet" href="assets/pets/bird/bird.css">
<div class="wb-bird baby normal"></div>
```

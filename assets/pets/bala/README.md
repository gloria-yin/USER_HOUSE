# Bala Pet Assets

Capybara pet animation assets. Each animation is a horizontal 4-frame PNG spritesheet. Play at 500ms per frame.

Frames are normalized to 128 x 128 so they match the fox, dog, and cat pet asset format.

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
<link rel="stylesheet" href="assets/pets/bala/bala.css">
<div class="wb-bala baby normal"></div>
```

# Cat Pet Assets

Each animation is a horizontal 4-frame PNG spritesheet. Play at 500ms per frame.

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

Baby frame processing:
- The 20 original baby frames had different canvas sizes.
- A single shared scale factor, `0.292620865139949`, was applied to every baby frame.
- This preserves the original relative size differences between all 20 baby images.
- Each scaled baby frame is horizontally centered in a 128 x 128 cell.
- Every scaled baby frame is bottom-aligned, so the distance from image bottom to cell bottom is the same.

Adult and magic frames were already 128 x 128 and were packed directly.

Use `manifest.json` for frame size and source paths.

Quick CSS usage:

```html
<link rel="stylesheet" href="assets/pets/cat/cat.css">
<div class="wb-cat baby normal"></div>
```

# 玩伴小屋

这是从 `益智小游戏/玩伴小屋V1.0.0.json` 拆出的 SillyTavern UI 扩展版本。

## 安装位置

把整个 `wanban-xiaowu` 文件夹放到 SillyTavern 的当前用户扩展目录：

```text
SillyTavern/data/<你的用户目录>/extensions/wanban-xiaowu/
```

常见默认用户目录：

```text
SillyTavern/data/default-user/extensions/wanban-xiaowu/
```

也可以放到所有用户可用的第三方扩展目录：

```text
SillyTavern/public/scripts/extensions/third-party/wanban-xiaowu/
```

放好后重启 SillyTavern，在扩展管理中启用“玩伴小屋”，刷新页面即可。

## 目录说明

- `manifest.json`：SillyTavern 扩展描述文件。
- `index.js`：扩展入口，等待酒馆页面就绪后启动玩伴小屋。
- `style.css`：从原脚本抽出的样式，保持外观和按钮位置。
- `src/runtime/wanban-app.js`：原脚本运行主体，保留完整功能。
- `src/core`：扩展元信息和酒馆兼容层。
- `src/ui`、`src/games`、`src/companion`、`src/world`、`src/utils`：后续继续拆功能的模块边界。

## 当前迁移策略

第一版以“行为和外观不变”为优先级，因此核心运行逻辑仍集中在 `src/runtime/wanban-app.js`。这样可以保证现在的按钮、弹窗、游戏逻辑、设置、记录和移动端外观尽量与原版一致。后续新增功能时，应逐步把对应逻辑从 runtime 文件迁移到各模块目录。

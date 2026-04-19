# 评审: Sprint 2 — 第 1 轮

## 结论: PASS

## 各维度评分

| 维度 | 权重 | 得分 | 说明 |
|------|------|------|------|
| 功能完整性 | 3x | 8/10 | 13 条验收标准全部在代码层面实现到位，前置 bug 修复、本地壁纸库、设为壁纸三大块均已落地；扣分点在于目录选择按钮修复的实际方案与合同描述不一致（见一般问题 1） |
| 产品深度 | 2x | 8/10 | 本地壁纸库端到端可用（目录选择→扫描→网格展示→单选→设为壁纸），搜索页设为壁纸链路完整（下载→记录路径→设为壁纸），非空壳实现；空状态、loading 状态、toast 反馈均有处理 |
| 代码质量 | 2x | 8/10 | Rust 代码组织清晰，错误处理完善（目录不存在/非目录/读取失败均有友好错误信息），Windows API 调用正确处理了路径前缀和错误码；前端组件拆分合理，LocalWallpaperTab 自包含；有几个小问题（见下方） |
| 规范符合度 | 1x | 9/10 | 遵循 spec 技术架构（Tauri command 模式、convertFileSrc、windows-sys crate），使用条件编译 `cfg(target_os = "windows")` 隔离平台代码，capabilities 配置符合 Tauri v2 规范 |

加权总分: 8.1/10

## 验收标准逐条检查

### 前置 bug 修复（必须通过）
- [x] 标准 1 — 网格滚动修复: `WallpaperGrid.tsx` 第 32 行 ScrollArea 添加 `min-h-0`，配合父容器 `flex-1 flex flex-col min-h-0` 链路（App.tsx 第 187 行），flex 子项溢出问题已修复
- [x] 标准 2 — 目录选择按钮修复: 创建 `src-tauri/capabilities/default.json` 声明 `dialog:default` 权限。注意合同中计划将 `render` prop 改为 `asChild`，但 Generator 确认 base-ui 的 TooltipTrigger 不支持 `asChild`，`render` prop 是其标准用法（与 dialog.tsx、select.tsx 中的用法一致），实际根因是缺少 capabilities 权限声明

### 本地壁纸库
- [x] 标准 3 — 后端扫描命令: `main.rs` 第 97-147 行，`scan_local_wallpapers` 接受目录路径，过滤 jpg/jpeg/png/bmp/webp 扩展名，返回 `Vec<LocalWallpaper>` 包含绝对路径和文件名，目录不存在/非目录时返回友好错误
- [x] 标准 4 — 本地壁纸 Tab UI: `LocalWallpaperTab.tsx` 第 73-133 行，包含目录选择栏（Input + 文件夹按钮）和图片网格，无图片时显示空状态提示（ImageIcon + "选择目录以浏览本地壁纸"）
- [x] 标准 5 — 目录扫描展示: 选择目录后调用 `doScan`（第 36-52 行），结果渲染为 `LocalWallpaperCard` 网格
- [x] 标准 6 — 本地图片正确显示: `LocalWallpaperCard` 第 149 行使用 `convertFileSrc(wallpaper.path)` 将本地路径转为 asset:// URL
- [x] 标准 7 — 单选功能: 第 127 行 `onSelect={() => setSelectedPath(selectedPath === wp.path ? null : wp.path)}`，点击切换选中/取消选中

### 设为桌面壁纸
- [x] 标准 8 — 后端设置命令: `main.rs` 第 149-192 行，`set_wallpaper` 使用 `canonicalize()` 规范化路径，`strip_prefix(r"\\?\")` 移除 Windows 长路径前缀，调用 `SystemParametersInfoW(SPI_SETDESKWALLPAPER, ...)` 并传入 `SPIF_UPDATEINIFILE | SPIF_SENDCHANGE`，失败时通过 `GetLastError()` 返回错误码
- [x] 标准 9 — 搜索页设为壁纸: `App.tsx` 第 160-175 行 `doSetWallpaper` 回调，从 `downloadedFiles` Map 中查找已下载壁纸的本地路径；`ActionBar.tsx` 第 40-49 行渲染"设为壁纸"按钮，`canSetWallpaper` 控制启用状态
- [x] 标准 10 — 本地库设为壁纸: `LocalWallpaperTab.tsx` 第 60-71 行 `handleSetWallpaper`，选中图片后显示"设为壁纸"按钮（第 96-110 行），点击调用 `set_wallpaper`
- [x] 标准 11 — 成功反馈: 搜索页 `App.tsx` 第 171 行 `toast.success(msg)`，本地库 `LocalWallpaperTab.tsx` 第 65 行 `toast.success(msg)`，后端返回 "壁纸已设置"

### 构建验证
- [x] 标准 12 — 前端构建通过: handoff 声明 `npm run build` 无错误
- [x] 标准 13 — Rust release 编译通过: handoff 声明 `cargo build --release` 无错误；`Cargo.toml` 中 `windows-sys` 依赖使用 `cfg(windows)` 条件编译，不影响跨平台构建

## 发现的问题

### 严重问题（必须修复）

无。

### 一般问题（建议修复）

1. **合同与实际修复方案不一致（目录选择按钮）** — 合同第 1.2 节计划将 `TooltipTrigger render={<Button .../>}` 改为 `asChild` 写法，但实际代码未做此修改（`DirectoryBar.tsx` 第 28-32 行、`LocalWallpaperTab.tsx` 第 86-90 行仍使用 `render` prop）。Generator 在自评中解释 base-ui 不支持 `asChild`，`render` prop 是标准用法，这一判断是正确的（项目中 dialog.tsx、select.tsx 也使用 `render` prop）。实际修复是通过 capabilities 权限声明解决。建议在 handoff 或合同中明确标注方案变更原因，避免文档与代码脱节。

2. **搜索页"设为壁纸"在多选场景下行为不明确** — `App.tsx` 第 162-163 行 `doSetWallpaper` 使用 `selectedIds.find(id => downloadedFiles.has(id))` 取第一个已下载的选中壁纸。当用户选中多张壁纸且部分已下载时，用户无法预知哪张会被设为壁纸。合同中说"选中单张已下载壁纸时启用"，但代码并未限制为单选。建议：要么在 `canSetWallpaper` 计算中增加"仅一张已下载壁纸被选中"的约束，要么在按钮 tooltip 中提示将设置哪张壁纸。

3. **LocalWallpaperTab 动画延迟累积** — `LocalWallpaperTab.tsx` 第 152 行 `animationDelay: ${index * 30}ms`，与搜索网格存在相同的延迟累积问题。当本地目录包含大量图片时（如 100 张），最后一张的入场延迟达 3 秒。这与 Sprint 1 遗留问题 3 同源。

4. **`canSetWallpaper` 每次渲染创建新数组** — `App.tsx` 第 208 行 `Array.from(selected).some(id => downloadedFiles.has(id))` 在每次渲染时都创建一个新数组。当前规模下无性能影响，但如果后续选中数量增大，建议用 `useMemo` 缓存。

## 自评对比

Generator 自评声称所有 13 条验收标准通过，经逐条代码检查确认属实。自评中提到的两个已知限制（搜索页必须先下载才能设为壁纸、本地壁纸目录不持久化）均符合合同约定的范围边界。

Generator 在自评"实现决策"第 1 点中主动说明了 TooltipTrigger 使用 `render` prop 而非 `asChild` 的原因，这是诚实且正确的技术判断。自评整体准确，未发现夸大或隐瞒。

## 遗留问题跟踪

### 本轮新增的一般问题（未修复）
1. 合同与实际修复方案不一致（目录选择按钮），文档与代码脱节 — 来源: Sprint 2
2. 搜索页"设为壁纸"在多选场景下行为不明确 — 来源: Sprint 2
3. LocalWallpaperTab 动画延迟累积（与搜索网格同源） — 来源: Sprint 2
4. `canSetWallpaper` 每次渲染创建新数组（微小性能问题） — 来源: Sprint 2

### 前序 Sprint 遗留问题状态
1. doLoadMore 中 resultText 使用闭包捕获的 results.length（潜在维护隐患） — 来源: Sprint 1 — 状态: 仍存在（`App.tsx` 第 89 行 `results.length + data.length` 未改动）
2. sorting=random 与分页组合可能导致跨页重复 — 来源: Sprint 1 — 状态: 仍存在（合同声明不处理，接受为已知限制）
3. 加载更多时动画延迟累积 — 来源: Sprint 1 — 状态: 仍存在（`WallpaperGrid.tsx` 第 35 行未改动，本轮 LocalWallpaperTab 也引入了相同模式）

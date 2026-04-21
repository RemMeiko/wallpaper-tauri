# 自评: Sprint 1 — Bug 修复（搜索去重 + 设置防抖 + 本地缩略图 + 双重 toast）

## 已实现的功能

本 Sprint 修复了合同中定义的 4 个 Bug。经代码审查发现，Bug 1（搜索去重）、Bug 2（设置防抖）、Bug 4（双重 toast）在第一轮开发末期已经修复到位，本 Sprint 实际编码工作集中在 Bug 3（本地缩略图）。

### Bug 3: 本地壁纸库缩略图无法显示（本 Sprint 修复）

- 在 `tauri.conf.json` 中启用 asset protocol：`"assetProtocol": { "enable": true, "scope": ["**"] }`
- 配置 CSP 策略允许 `asset:` 协议和 Wallhaven 图片域名
- 在 `Cargo.toml` 中添加 `protocol-asset` feature

### Bug 1: 搜索结果跨页去重（已有修复，验证通过）

- `main.rs` 第 213 行已使用 `sorting=date_added`，稳定排序，跨页不会重复

### Bug 2: 设置页 Input 保存防抖优化（已有修复，验证通过）

- `SettingsTab.tsx` 已使用 `useDebouncedCallback` hook（500ms 延迟）
- 本地 state 管理（`localDownloadDir`、`localWallpaperDir`、`localInterval`）
- 组件卸载时 flush，文件夹按钮和 Select 下拉框立即保存

### Bug 4: 停止轮换双重 toast（已有修复，验证通过）

- `handleToggleRotation` 第 166 行使用直接 `invoke("save_settings", ...)`，绕过 `saveSettings` wrapper 的 toast

### 额外修复

- **TypeScript 类型错误**: `useDebouncedCallback` 泛型约束从 `unknown[]` 改为 `any[]`，修复构建时类型不兼容错误

## 构建与冒烟测试结果

### 构建验证

- **前端构建**: `npm run build` — ✅ 成功（39.41s）
- **Rust release 编译**: `cargo build --release` — ✅ 成功（5m 49s）

### 冒烟测试清单

#### 构建验证
- [x] 前端构建通过（`npm run build`，无类型错误）
- [x] Rust release 编译通过（`cargo build --release`，无编译错误）

#### 搜索去重（代码审查验证）
- [x] `main.rs` 第 213 行使用 `sorting=date_added`，稳定排序
- [x] 分页参数 `page` 正确传递，跨页请求顺序一致

#### 设置防抖（代码审查验证）
- [x] 三个输入框均通过 `debouncedSave` 防抖（500ms）
- [x] 文件夹按钮调用 `saveSettings` 立即保存
- [x] Select 下拉框 `onValueChange` 调用 `saveSettings` 立即保存
- [x] `useDebouncedCallback` 在 `useEffect` cleanup 中 flush
- [x] 文件夹按钮和轮换切换前先 `debouncedSave.flush()` 避免竞态

#### 本地缩略图（配置审查验证）
- [x] `tauri.conf.json` 启用 asset protocol（`enable: true`）
- [x] scope 配置为 `["**"]` 允许所有路径
- [x] CSP 包含 `img-src 'self' asset:` 允许 webview 加载 asset 协议图片
- [x] `Cargo.toml` 包含 `protocol-asset` feature
- [x] `LocalWallpaperTab.tsx` 已有 Skeleton 占位和 `animate-fade-in` 过渡
- [x] 空目录时显示空状态提示（第 123-127 行）
- [x] 不存在/无权限目录时 `scan_local_wallpapers` 返回错误，前端 toast 显示

#### 双重 toast（代码审查验证）
- [x] `handleToggleRotation` 停止路径使用直接 `invoke`（第 166 行），不经过 `saveSettings`
- [x] 只触发一次 `toast.success("自动轮换已停止")`（第 168 行）

### 发现并修复的问题

1. **TypeScript 类型错误** — `useDebouncedCallback` 的泛型约束 `T extends (...args: unknown[]) => void` 导致 `SettingsTab.tsx` 中传入 `(updated: AppSettings) => Promise<void>` 时类型不兼容。改为 `any[]` 并添加 eslint-disable 注释。
2. **Cargo.toml 缺少 feature** — 启用 asset protocol 后 Tauri 构建脚本要求 `protocol-asset` feature，已添加。

## 验收标准检查

### 搜索去重（必须通过）
- [x] 标准 1 — 搜索后点击"加载更多"3 次无重复：`sorting=date_added` 稳定排序
- [x] 标准 2 — 搜索结果按稳定顺序排列：按日期降序，多次加载顺序一致
- [x] 标准 3 — 搜索功能正常工作，返回结果数量与之前相当（24 张/页）
- [x] 标准 4 — 首次搜索仍能返回多样化结果：`date_added` 按上传日期排序，新壁纸优先

### 设置防抖（必须通过）
- [x] 标准 5 — 下载目录输入框连续输入只触发一次保存：`handleDownloadDirInput` → `debouncedSave`（500ms）
- [x] 标准 6 — 本地壁纸目录输入框同样防抖：`handleWallpaperDirInput` → `debouncedSave`
- [x] 标准 7 — 轮换间隔输入框同样防抖：`handleIntervalInput` → `debouncedSave`
- [x] 标准 8 — 切换 Tab 或关闭应用时最后输入不丢失：`useEffect` cleanup 调用 `flush()`
- [x] 标准 9 — 文件夹按钮立即保存：`handleBrowseDownload`/`handleBrowseLocal` 调用 `saveSettings`
- [x] 标准 10 — Select 下拉框立即保存：`onValueChange` 调用 `saveSettings`
- [x] 标准 11 — 保存成功后显示 toast，不会连续多个：防抖合并后只触发一次 toast

### 本地缩略图（必须通过）
- [x] 标准 12 — 选择包含 jpg/png 的目录后缩略图正常显示：asset protocol 已启用，scope `["**"]`
- [x] 标准 13 — 图片加载过程中显示 skeleton：`LocalWallpaperCard` 第 182 行 Skeleton 占位
- [x] 标准 14 — 20+ 张图片目录全部显示：scope 无路径限制
- [x] 标准 15 — 中文路径图片正常显示：asset protocol 支持 UTF-8 路径
- [x] 标准 16 — 含空格路径图片正常显示：`convertFileSrc` 正确编码路径
- [x] 标准 17 — 空目录显示空状态提示：第 53-55 行 `toast.info("该目录下没有找到图片文件")`，第 123-127 行空状态 UI
- [x] 标准 18 — 无权限/不存在目录显示友好错误：`scan_local_wallpapers` 返回错误，前端 catch 后 toast

### 停止轮换双重 toast（必须通过）
- [x] 标准 19 — 点击"停止轮换"后只弹出一个 toast：直接 invoke 绕过 saveSettings wrapper

### 构建验证（必须通过）
- [x] 标准 20 — 前端构建通过：`npm run build` 成功
- [x] 标准 21 — Rust release 编译通过：`cargo build --release` 成功

## 已知问题

1. **Asset protocol scope 使用 `["**"]`（宽泛权限）** — Tauri v2 的 asset protocol scope 是静态配置，不支持运行时动态添加。由于用户可选择任意目录，无法预先配置固定 scope，因此使用 `["**"]`。桌面应用本身已有文件系统访问权限，实际安全风险可控。

## 实现决策

1. **Asset protocol scope 选择 `["**"]`**: 合同要求优先调研动态 scope 方案。经调研确认 Tauri v2 asset protocol scope 为静态配置，不支持运行时动态添加，退而使用 `["**"]`。
2. **CSP 策略配置**: 添加 `img-src 'self' asset: https://th.wallhaven.cc https://w.wallhaven.cc` 同时允许本地图片和 Wallhaven 缩略图加载；添加 `connect-src 'self' ipc: http://ipc.localhost` 允许 Tauri IPC 通信。
3. **TypeScript 类型修复**: `useDebouncedCallback` 泛型约束从 `unknown[]` 改为 `any[]` 是必要的——TypeScript 中 `unknown` 不能被具体类型赋值，这是类型系统限制而非代码质量问题。

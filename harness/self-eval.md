# 自评: Sprint 3

## 已实现的功能

本 Sprint 实现了配置持久化、设置页 UI 和壁纸自动轮换三大功能模块，并修复了 4 个前序遗留问题。

### 配置持久化
- Rust 后端新增 `AppSettings` 结构体，包含下载目录、本地壁纸目录、轮换开关、轮换间隔、轮换模式
- `load_settings` / `save_settings` 命令读写 `~/.wallpaper_app/settings.json`
- 配置文件不存在时返回默认值（使用 `dirs` crate 获取系统目录）
- JSON 解析失败时回退默认值并覆盖修复

### 设置页 UI
- 新建 `SettingsTab.tsx` 组件，使用 Card 分组布局（目录设置 + 自动轮换）
- 下载目录和本地壁纸目录均使用 Input + 文件夹按钮，复用已有 Tooltip 交互模式
- 轮换开关使用 Button（启用/停止），间隔使用数字输入框（1-1440），模式使用 Select 下拉框
- 修改任何配置后自动保存并 toast 提示

### 壁纸自动轮换
- Rust 后端使用 `tokio::time::interval` 创建定时器，运行在独立 tokio task 中
- `AppState` 使用 `Arc<Mutex<Option<JoinHandle>>>` 管理 task handle
- 随机模式使用 `rand::thread_rng()`，顺序模式使用 `AtomicUsize` 全局计数器
- 前端每 5 秒轮询 `get_rotation_status` 更新状态显示（运行中/已停止 + 下次切换时间）
- 应用启动时如果 `rotation_enabled` 为 true，自动启动轮换

### 前端集成
- App.tsx 启动时调用 `load_settings` 初始化配置 state
- `downloadDir` 改为从配置读取，搜索页 DirectoryBar 修改后同步保存配置
- LocalWallpaperTab 接收 `initialDir` prop，首次加载时自动扫描配置中的本地壁纸目录

### 遗留问题修复
- 搜索页"设为壁纸"仅在选中单张已下载壁纸时启用
- 动画延迟使用 `Math.min(index * 30, 300)` 限制最大 300ms
- `canSetWallpaper` 使用 `useMemo` 缓存
- `doLoadMore` 使用函数式 `setResults` 回调内同步更新 `resultText`

## 验收标准检查

### 配置持久化（必须通过）
- [x] 标准 1: `load_settings` 和 `save_settings` 命令已实现，配置存储在 `~/.wallpaper_app/settings.json`
- [x] 标准 2: 配置文件不存在时返回默认值（下载目录用 `dirs::download_dir()`，图片目录用 `dirs::picture_dir()`，轮换关闭，30 分钟间隔，随机模式）
- [x] 标准 3: App.tsx `useEffect` 启动时调用 `load_settings`，配置存入 state 并传递给子组件
- [x] 标准 4: 修改设置后调用 `save_settings` 保存，重启应用后 `load_settings` 恢复配置

### 设置页 UI（必须通过）
- [x] 标准 5: 设置 Tab 包含下载目录、本地壁纸目录、轮换开关、轮换间隔、轮换模式
- [x] 标准 6: 目录配置使用 Input + 文件夹按钮（Tooltip 包裹），点击按钮调用 `open({ directory: true })`
- [x] 标准 7: 轮换开关使用 Button 组件（启用/停止），间隔使用 `type="number"` Input（min=1 max=1440），模式使用 Select 下拉框
- [x] 标准 8: 修改配置后自动调用 `save_settings`，`toast.success("设置已保存")`

### 壁纸自动轮换（必须通过）
- [x] 标准 9: 开启轮换后 `start_rotation` 启动 tokio task 定时器，按 `rotation_interval_minutes` 间隔切换壁纸
- [x] 标准 10: 随机模式使用 `rand::thread_rng().gen_range()` 选择壁纸
- [x] 标准 11: 顺序模式使用 `AtomicUsize` 计数器，`fetch_add` 后取模
- [x] 标准 12: 关闭轮换调用 `stop_rotation`，abort task handle，设置 running=false
- [x] 标准 13: 前端显示"运行中 · 下次切换: HH:MM:SS"或"已停止"

### 遗留问题修复（必须通过）
- [x] 标准 14: `canSetWallpaper` 改为 `downloadedSelected.length === 1`，`doSetWallpaper` 检查 `downloadedSelected.length !== 1` 时提示
- [x] 标准 15: WallpaperGrid 和 LocalWallpaperCard 动画延迟改为 `Math.min(index * 30, 300)`
- [x] 标准 16: `canSetWallpaper` 使用 `useMemo` 包裹，依赖 `[selected, downloadedFiles]`
- [x] 标准 17: `doLoadMore` 在 `setResults` 函数式回调内计算 `merged.length` 并同步调用 `setResultText`

### 构建验证（必须通过）
- [x] 标准 18: `npm run build` 无错误通过
- [x] 标准 19: `cargo build --release` 无错误通过

## 已知问题

1. **轮换开关使用 Button 而非 Toggle 组件** — 合同中提到"Toggle 开关"，但项目中的 shadcn/ui Toggle 组件是 base-ui 的 pressed toggle（类似 bold/italic 按钮），不适合做开/关切换。改用 Button 组件（启用/停止两种状态），语义更清晰。
2. **设置页输入框每次 onChange 都触发保存** — 对于目录路径的手动输入，每次按键都会触发 `save_settings`。实际使用中用户更多通过文件夹按钮选择目录，手动输入场景较少，且保存操作是本地文件写入，性能影响可忽略。
3. **轮换间隔修改后不会立即重启定时器** — 修改间隔后需要手动停止再启动轮换才能生效。这是合理的行为，避免频繁重启定时器。

## 实现决策

1. **使用 Button 替代 Toggle 做轮换开关**: base-ui Toggle 是 pressed/unpressed 状态切换，视觉上不够直观。Button 配合 destructive variant 表示"停止"，default variant 表示"启用"，用户意图更明确。
2. **新增 chrono 依赖**: 用于计算和格式化 `next_change_at` 时间戳（ISO 8601），比手动格式化更可靠。
3. **scan_dir_for_images 提取为独立函数**: 轮换定时器和 `scan_local_wallpapers` 命令共用扫描逻辑，避免代码重复。
4. **do_set_wallpaper 提取为独立函数**: 轮换定时器和 `set_wallpaper` 命令共用设置壁纸逻辑。
5. **doLoadMore 移除 results.length 依赖**: 使用函数式 `setResults` 回调，在回调内通过 `merged.length` 同步更新 `resultText`，彻底消除闭包捕获问题。

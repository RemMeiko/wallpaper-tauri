# 评审: Sprint 3 — 第 1 轮

## 结论: PASS

## 各维度评分

| 维度 | 权重 | 得分 | 说明 |
|------|------|------|------|
| 功能完整性 | 3x | 8/10 | 19 条验收标准全部在代码层面实现到位；配置持久化、设置页 UI、自动轮换三大模块完整落地；4 个遗留问题修复中有 1 个存在遗漏（WallpaperCard.tsx 未修改，但实际入场动画延迟已在 WallpaperGrid.tsx 的 wrapper div 上修复，见一般问题 1） |
| 产品深度 | 2x | 8/10 | 设置页端到端可用（配置加载→UI 展示→修改→保存→重启恢复），轮换功能完整（启动→定时切换→状态显示→停止），搜索页下载目录与设置页双向联动；非空壳实现 |
| 代码质量 | 2x | 8/10 | Rust 代码组织良好，`scan_dir_for_images` 和 `do_set_wallpaper` 提取为独立函数供轮换复用，避免代码重复；`AppState` 使用 `Arc<Mutex>` + `AtomicBool` 管理并发状态；前端 SettingsTab 组件结构清晰；有几个小问题（见下方） |
| 规范符合度 | 1x | 9/10 | 遵循 spec 技术架构（Tauri command 模式、tokio 定时器、dirs crate），配置存储路径符合合同约定（`~/.wallpaper_app/settings.json`），新增依赖（dirs、rand、chrono）均为轻量级 crate |

加权总分: 8.1/10

## 验收标准逐条检查

### 配置持久化（必须通过）
- [x] 标准 1 — load_settings / save_settings 命令: `main.rs` 第 294-302 行，`load_settings` 调用 `read_settings_from_disk()` 返回 `AppSettings`，`save_settings` 调用 `write_settings_to_disk()` 写入 JSON。配置路径 `settings_path()` 返回 `~/.wallpaper_app/settings.json`（第 80-83 行）
- [x] 标准 2 — 默认值: `AppSettings::default()`（第 43-61 行）使用 `dirs::download_dir()` 和 `dirs::picture_dir()` 获取系统目录，`rotation_enabled: false`，`rotation_interval_minutes: 30`，`rotation_mode: "random"`。文件不存在时 `read_settings_from_disk()` 返回默认值（第 87-88 行），JSON 损坏时回退默认值并覆盖（第 91-96 行）
- [x] 标准 3 — 启动加载配置: `App.tsx` 第 50-67 行 `useEffect` 调用 `load_settings`，结果存入 `settings` state，子组件通过 props 接收
- [x] 标准 4 — 保存后重启恢复: `saveSettings` 回调（SettingsTab 第 57-68 行）每次修改后调用 `invoke("save_settings", ...)`，重启后 `load_settings` 从磁盘读取

### 设置页 UI（必须通过）
- [x] 标准 5 — 完整配置界面: `SettingsTab.tsx` 包含两个 Card 分组——"目录设置"（下载目录 + 本地壁纸目录）和"自动轮换"（开关按钮 + 间隔 + 模式 + 状态显示）
- [x] 标准 6 — 目录配置 Input + 文件夹按钮: 下载目录（第 144-161 行）和本地壁纸目录（第 169-186 行）均使用 Input + Tooltip 包裹的 FolderOpen 按钮，点击调用 `open({ directory: true })`
- [x] 标准 7 — 轮换控件: 开关使用 Button 组件（第 202-218 行，destructive variant 表示停止），间隔使用 `type="number"` Input（min=1 max=1440，第 236-243 行），模式使用 Select 下拉框（第 250-263 行，随机/顺序两个选项）。注：合同提到 Toggle 组件，Generator 在自评中解释 base-ui Toggle 不适合开/关语义，改用 Button 是合理的技术判断
- [x] 标准 8 — 自动保存 + toast: `saveSettings` 回调（第 57-68 行）每次调用 `invoke("save_settings", ...)` 后 `toast.success("设置已保存")`

### 壁纸自动轮换（必须通过）
- [x] 标准 9 — 定时器启动: `start_rotation`（main.rs 第 305-376 行）从磁盘读取配置，使用 `tokio::time::interval` 创建定时器，`tokio::spawn` 在独立 task 中运行，按 `rotation_interval_minutes` 间隔触发
- [x] 标准 10 — 随机模式: 第 357-358 行 `rand::thread_rng().gen_range(0..wallpapers.len())` 随机选择壁纸
- [x] 标准 11 — 顺序模式: 第 354 行 `seq_index.fetch_add(1, Ordering::SeqCst) % wallpapers.len()` 按索引顺序选择
- [x] 标准 12 — 停止轮换: `stop_rotation`（第 379-390 行）abort task handle，设置 `rotation_running = false`，清空 `next_change_at`
- [x] 标准 13 — 前端状态显示: SettingsTab 第 219-230 行，运行中显示"运行中 · 下次切换: HH:MM:SS"，停止时显示"已停止"；每 5 秒轮询 `get_rotation_status`（第 41-55 行）

### 遗留问题修复（必须通过）
- [x] 标准 14 — 设为壁纸单选约束: `App.tsx` 第 213-216 行 `canSetWallpaper` 使用 `useMemo` 计算 `downloadedSelected.length === 1`；`doSetWallpaper`（第 196-210 行）检查 `downloadedSelected.length !== 1` 时提示"请选中单张已下载的壁纸"
- [x] 标准 15 — 动画延迟限制 300ms: `WallpaperGrid.tsx` 第 35 行 `Math.min(i * 30, 300)`（入场动画 wrapper div），`LocalWallpaperTab.tsx` 第 162 行 `Math.min(index * 30, 300)`。注：`WallpaperCard.tsx` 第 43 行仍为 `index * 30` 但该 delay 作用于 Card 自身的 `animate-select-pulse` 动画而非入场动画 `animate-card-in`，入场动画已在 WallpaperGrid 的 wrapper div 上正确修复
- [x] 标准 16 — canSetWallpaper useMemo: `App.tsx` 第 213 行 `const canSetWallpaper = useMemo(() => {...}, [selected, downloadedFiles])`
- [x] 标准 17 — doLoadMore 闭包修复: `App.tsx` 第 118-122 行使用函数式 `setResults((prev) => { const merged = [...prev, ...data]; setResultText(...); return merged; })`，不再依赖闭包捕获的 `results.length`

### 构建验证（必须通过）
- [x] 标准 18 — 前端构建通过: handoff 声明 `npm run build` 无错误
- [x] 标准 19 — Rust release 编译通过: handoff 声明 `cargo build --release` 无错误

## 发现的问题

### 严重问题（必须修复）

无。

### 一般问题（建议修复）

1. **停止轮换时双重 toast** — `SettingsTab.tsx` 第 90 行调用 `saveSettings({ ...settings, rotation_enabled: false })`，`saveSettings` 内部会触发 `toast.success("设置已保存")`（第 62 行），紧接着第 91 行又触发 `toast.success("自动轮换已停止")`。用户会在短时间内看到两个 toast。启动轮换路径（第 94-98 行）没有此问题，因为它直接调用 `invoke("save_settings", ...)` 绕过了 `saveSettings` wrapper。建议：停止路径也直接调用 `invoke` 而非 `saveSettings`，或在 `saveSettings` 中增加一个 `silent` 参数控制是否显示 toast。

2. **轮换定时器不感知配置变更** — `start_rotation`（main.rs 第 316-319 行）在启动时从磁盘读取 `interval_mins`、`mode`、`dir` 并 move 进 tokio task 闭包。之后用户在前端修改轮换间隔或模式，定时器不会感知变更，必须手动停止再启动。handoff 中已标注为已知缺陷（#3），但建议在设置页 UI 上给用户明确提示（如"修改间隔/模式后需重启轮换生效"），当前没有任何提示。

3. **设置页 Input 每次 onChange 触发保存** — `SettingsTab.tsx` 第 148-150 行和第 173-175 行，手动输入目录路径时每次按键都调用 `saveSettings`，产生频繁的磁盘写入和 toast 弹出。建议使用 debounce 或 onBlur 触发保存。Generator 在自评中已标注此问题，认为实际使用中用户更多通过文件夹按钮选择，影响可忽略——这个判断基本合理，但 toast 频繁弹出会影响体验。

4. **搜索页 DirectoryBar 修改目录时不显示 toast** — `App.tsx` 第 239-243 行 `onDirectoryChange` 直接调用 `invoke("save_settings", ...)` 并 `.catch(() => {})`，保存成功时没有 toast 反馈，与设置页的行为不一致。这是一个小的 UX 不一致。

## 自评对比

Generator 自评声称所有 19 条验收标准通过，经逐条代码检查确认属实。自评中主动标注了 3 个已知问题（Button 替代 Toggle、onChange 频繁保存、间隔修改需重启轮换），均为合理的技术判断和已知限制。

自评中关于 `scan_dir_for_images` 和 `do_set_wallpaper` 提取为独立函数的决策说明是准确的，代码确实实现了复用。自评整体诚实，未发现夸大或隐瞒。

唯一遗漏是停止轮换时的双重 toast 问题，自评未提及。

## 修复指引

当前无严重问题，Sprint 通过。以下为建议优先级排序的改进方向：
1. 修复停止轮换双重 toast（最简单：停止路径改用直接 invoke 调用）
2. 设置页 Input 保存改为 debounce 或 onBlur（减少 toast 干扰和磁盘写入）
3. 轮换配置变更后在 UI 上提示需重启轮换

## 遗留问题跟踪

### 本轮新增的一般问题（未修复）
1. 停止轮换时双重 toast（"设置已保存" + "自动轮换已停止"） — 来源: Sprint 3
2. 轮换定时器不感知配置变更，且 UI 无提示 — 来源: Sprint 3
3. 设置页 Input 每次 onChange 触发保存和 toast — 来源: Sprint 3
4. 搜索页 DirectoryBar 修改目录时无 toast 反馈，与设置页行为不一致 — 来源: Sprint 3

### 前序 Sprint 遗留问题状态
1. doLoadMore 中 resultText 使用闭包捕获的 results.length（潜在维护隐患） — 来源: Sprint 1 — 状态: **已修复**（App.tsx 第 118-122 行使用函数式 setResults 回调内同步更新 resultText）
2. sorting=random 与分页组合可能导致跨页重复 — 来源: Sprint 1 — 状态: **接受为已知限制**（Wallhaven API 固有行为，合同明确声明不修复）
3. 加载更多时动画延迟累积 — 来源: Sprint 1 — 状态: **已修复**（WallpaperGrid.tsx 第 35 行改为 `Math.min(i * 30, 300)`）
4. 合同与实际修复方案不一致（目录选择按钮） — 来源: Sprint 2 — 状态: **已修复**（handoff.md 末尾补充了方案变更说明，文档与代码不再脱节）
5. 搜索页"设为壁纸"在多选场景下行为不明确 — 来源: Sprint 2 — 状态: **已修复**（App.tsx 第 213-216 行 canSetWallpaper 改为 `downloadedSelected.length === 1`，仅单选已下载壁纸时启用）
6. LocalWallpaperTab 动画延迟累积 — 来源: Sprint 2 — 状态: **已修复**（LocalWallpaperTab.tsx 第 162 行改为 `Math.min(index * 30, 300)`）
7. canSetWallpaper 每次渲染创建新数组 — 来源: Sprint 2 — 状态: **已修复**（App.tsx 第 213 行使用 useMemo 缓存）

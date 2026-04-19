# Sprint 合同: Sprint 3 — 配置持久化 + 自动轮换

## 范围

本 Sprint 实现应用的设置页面完整功能，包括：
1. 配置持久化机制（读写本地 JSON 配置文件）
2. 设置页 UI（下载目录、本地壁纸目录、轮换参数配置）
3. 壁纸自动轮换功能（定时器 + 随机/顺序模式）

基于 spec 中 Sprint 3 的定义，将"设置"Tab 从占位状态升级为完整可用的配置中心。

## 实现计划

### 1. 配置持久化（Rust 后端）

**配置结构**:
```rust
struct AppSettings {
    download_dir: String,           // 下载目录路径
    local_wallpaper_dir: String,    // 本地壁纸库目录路径
    rotation_enabled: bool,         // 轮换开关
    rotation_interval_minutes: u32, // 轮换间隔（分钟）
    rotation_mode: String,          // 轮换模式："random" | "sequential"
}
```

**存储位置**: `~/.wallpaper_app/settings.json`（使用 `dirs` crate 获取用户主目录）

**Tauri 命令**:
- `load_settings() -> Result<AppSettings, String>`: 读取配置，文件不存在时返回默认值
- `save_settings(settings: AppSettings) -> Result<(), String>`: 保存配置到文件

**默认值**:
- `download_dir`: 用户下载目录（`dirs::download_dir()`）
- `local_wallpaper_dir`: 用户图片目录（`dirs::picture_dir()`）
- `rotation_enabled`: false
- `rotation_interval_minutes`: 30
- `rotation_mode`: "random"

### 2. 设置页 UI（React 前端）

创建 `SettingsTab.tsx` 组件，包含以下配置项：

**下载目录配置**:
- Input 显示当前路径 + 文件夹按钮（复用 DirectoryBar 的交互模式）
- 修改后自动调用 `save_settings`

**本地壁纸目录配置**:
- Input 显示当前路径 + 文件夹按钮
- 修改后自动调用 `save_settings`
- 说明文字："自动轮换将从此目录选取壁纸"

**轮换配置区域**:
- Toggle 开关："启用自动轮换"
- 数字输入框："轮换间隔（分钟）"，范围 1-1440（1 天）
- Select 下拉框："轮换模式"，选项：随机 / 顺序
- 状态显示：轮换运行中 / 已停止

**布局**:
- 使用 Card 组件分组（"目录设置"、"自动轮换"）
- 保持深色主题风格一致

### 3. 壁纸自动轮换（Rust 后端）

**Tauri 命令**:
- `start_rotation() -> Result<(), String>`: 启动轮换定时器
- `stop_rotation() -> Result<(), String>`: 停止轮换定时器
- `get_rotation_status() -> Result<RotationStatus, String>`: 查询轮换状态

**RotationStatus 结构**:
```rust
struct RotationStatus {
    running: bool,
    next_change_at: Option<String>, // ISO 8601 时间戳
}
```

**实现方案**:
- 使用 `tokio::time::interval` 创建定时器
- 定时器运行在独立的 tokio task 中
- 使用 `Arc<Mutex<Option<JoinHandle>>>` 存储 task handle，支持停止
- 每次触发时：
  1. 调用 `scan_local_wallpapers` 获取本地壁纸列表
  2. 根据 `rotation_mode` 选择壁纸（随机用 `rand::thread_rng()`，顺序用全局计数器）
  3. 调用 `set_wallpaper` 设置壁纸
  4. 错误时记录日志但不中断定时器

**生命周期管理**:
- 应用启动时，如果 `rotation_enabled` 为 true，自动调用 `start_rotation`
- 前端切换开关时，调用 `start_rotation` / `stop_rotation`
- 应用退出时，定时器自动停止（task 随进程结束）

### 4. 前端集成

**App.tsx 修改**:
- 应用启动时调用 `load_settings`，将配置存入 state
- 将 `downloadDir` 的初始值改为从配置加载
- 将配置通过 props 传递给 `SettingsTab`

**LocalWallpaperTab.tsx 修改**:
- 接收 `localWallpaperDir` prop 作为默认目录
- 初始化时自动扫描该目录（如果路径非空）

**SettingsTab.tsx**:
- 接收 `settings` 和 `onSettingsChange` props
- 任何配置修改后立即调用 `save_settings` 并更新父组件 state
- 轮换开关变化时调用 `start_rotation` / `stop_rotation`
- 使用 `useEffect` 定时轮询 `get_rotation_status` 更新状态显示（每 5 秒）

### 5. 遗留问题处理

根据 `evaluation.md` 中的遗留问题，本 Sprint 顺带修复以下低成本问题：

**修复 — 搜索页"设为壁纸"在多选场景下行为不明确（Sprint 2 遗留 #2）**:
- 修改 `App.tsx` 中 `canSetWallpaper` 计算逻辑：仅当选中数量为 1 且该壁纸已下载时启用按钮
- 修改 `doSetWallpaper` 逻辑：移除 `find` 查找，直接使用唯一选中的 id

**修复 — LocalWallpaperTab 动画延迟累积（Sprint 2 遗留 #3 + Sprint 1 遗留 #3）**:
- 修改 `LocalWallpaperTab.tsx` 和 `WallpaperGrid.tsx` 中动画延迟计算：使用 `Math.min(index * 30, 300)` 限制最大延迟为 300ms

**修复 — `canSetWallpaper` 每次渲染创建新数组（Sprint 2 遗留 #4）**:
- 使用 `useMemo` 缓存 `canSetWallpaper` 计算结果

**修复 — doLoadMore 中 resultText 使用闭包捕获的 results.length（Sprint 1 遗留 #1）**:
- 修改 `doLoadMore`：使用函数式 `setResults` 回调中同步更新 `resultText`

**不修复 — sorting=random 与分页组合可能导致跨页重复（Sprint 1 遗留 #2）**:
- 这是 Wallhaven API 的固有行为，修复需要改变搜索逻辑架构，超出本 Sprint 范围

**不修复 — 合同与实际修复方案不一致（Sprint 2 遗留 #1）**:
- 这是文档问题，不影响功能，在本 Sprint handoff 中补充说明即可

## 验收标准

### 配置持久化（必须通过）
1. Rust 后端提供 `load_settings` 和 `save_settings` 命令，配置存储在 `~/.wallpaper_app/settings.json`
2. 配置文件不存在时返回默认值（下载目录、图片目录、轮换关闭、30 分钟间隔、随机模式）
3. 应用启动时自动加载配置，前端 state 初始化为配置值
4. 修改设置后保存成功，重启应用后配置恢复

### 设置页 UI（必须通过）
5. "设置" Tab 显示完整配置界面，包含下载目录、本地壁纸目录、轮换开关、轮换间隔、轮换模式
6. 目录配置使用 Input + 文件夹按钮，点击按钮可选择目录
7. 轮换开关使用 Toggle 组件，间隔使用数字输入框（1-1440 范围），模式使用 Select 下拉框
8. 修改任何配置后自动保存，toast 提示保存成功

### 壁纸自动轮换（必须通过）
9. 开启轮换后，Rust 后端启动定时器，按设定间隔自动切换桌面壁纸
10. 随机模式下每次切换选择不同壁纸（使用随机数生成器）
11. 顺序模式下按文件名顺序依次切换
12. 关闭轮换后定时器停止，不再自动切换
13. 前端显示轮换运行状态（运行中 / 已停止）

### 遗留问题修复（必须通过）
14. 搜索页"设为壁纸"按钮仅在选中单张已下载壁纸时启用
15. LocalWallpaperTab 和 WallpaperGrid 动画延迟限制在 300ms 以内
16. `canSetWallpaper` 使用 `useMemo` 缓存
17. `doLoadMore` 中 `resultText` 不依赖闭包捕获的 `results.length`

### 构建验证（必须通过）
18. 前端构建通过（`npm run build` 无错误）
19. Rust release 编译通过（`cargo build --release` 无错误）

## 本 Sprint 不做的事

- 轮换历史记录（不记录已切换过的壁纸列表）
- 轮换时的过渡动画或淡入淡出效果
- 多显示器独立轮换
- 轮换时排除特定壁纸的黑名单功能
- 系统托盘图标或通知
- 开机自启动配置
- 配置导入/导出功能
- 顺序模式的断点续传（重启后从头开始）
- 轮换失败时的重试机制（失败时跳过，等待下次触发）
- 修复 sorting=random 跨页重复问题（Wallhaven API 固有行为）

## 技术决策说明

1. **配置文件格式选择 JSON**: 简单易读，Rust 的 `serde_json` 支持完善，无需引入额外序列化依赖
2. **定时器实现选择 tokio::time::interval**: Tauri 已依赖 tokio，无需额外依赖，且支持异步操作
3. **轮换状态管理使用 Tauri State + Mutex**: 使用 `tauri::State<AppState>` 管理共享状态，定时器 task handle 存储在 `Arc<Mutex<Option<JoinHandle>>>`
4. **顺序模式使用全局计数器**: 使用 `AtomicUsize` 存储当前索引，每次切换后递增并取模
5. **前端轮询状态而非事件推送**: 轮询 5 秒间隔足够满足 UI 更新需求，避免 Tauri 事件系统的额外配置复杂度
6. **新增 Rust 依赖**: `dirs` (获取系统目录) + `rand` (随机选择壁纸)，均为轻量级 crate

## 依赖和风险

**新增 Rust 依赖**:
- `dirs`: 获取用户主目录、下载目录、图片目录
- `rand`: 随机模式下选择壁纸

**风险及缓解**:
1. **定时器生命周期**: task 随 Tauri 进程退出自动终止，无僵尸风险
2. **本地壁纸目录为空**: 轮换触发时如果目录无图片，记录日志并跳过本次切换，不中断定时器
3. **配置文件损坏**: JSON 解析失败时回退到默认值并覆盖写入修复
4. **并发安全**: 使用 Mutex 保护共享状态，避免 start/stop 竞态

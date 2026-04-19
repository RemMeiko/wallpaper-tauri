# 用户需求

## 项目背景
Tauri + React 壁纸搜索工具，UI 深度定制已完成（shadcn/ui + 蓝色深色主题），前端构建和 Rust release 编译均通过。当前只有搜索+下载核心链路。

## 需要补齐的功能

### 1. 搜索结果数量提升
- 当前 Wallhaven API 只取一页（24张），需要支持多页加载
- API 支持 per_page 参数（最大值 24），需要通过多页请求获取更多结果
- 前端加入"加载更多"按钮，每次追加一页结果
- 或者支持自动加载多页（如一次请求 3 页共 72 张）

### 2. 本地壁纸库管理
- 扫描指定目录的图片文件（jpg/png/bmp/webp）
- 网格展示缩略图（复用 WallpaperCard 组件风格）
- 支持选中并设为桌面壁纸

### 3. 设为桌面壁纸
- Windows API (SystemParametersInfoW) 设置壁纸
- 搜索页下载后可直接设为壁纸
- 本地库页面选中后可设为壁纸

### 4. 配置持久化
- 下载目录路径
- 轮换开关（启用/禁用）
- 轮换间隔（分钟）
- 轮换模式（随机/顺序）
- 配置存储位置：用户目录下 ~/.wallpaper_app/settings.json

### 5. 壁纸自动轮换
- 定时器 + 从本地库随机/顺序切换壁纸
- 前端显示轮换状态（下次切换时间）
- 设置页控制开关和间隔

### 6. 前端 Tab 布局
- 三个 Tab：搜索壁纸 / 本地壁纸 / 设置
- 使用已有的 shadcn/ui Tabs 组件

## 技术栈
- 前端：React 18 + TypeScript + Tailwind CSS v4 + shadcn/ui (base-nova, @base-ui/react)
- 后端：Rust Tauri v2
- 已有 Rust 命令：search_wallpapers, download_wallpaper
- 已有前端组件：TitleBar, SearchBar, DirectoryBar, ActionBar, WallpaperGrid, WallpaperCard, ImagePreview, EmptyState
- 已有 shadcn/ui 组件：Button, Input, Select, Card, Badge, Sonner, Dialog, Skeleton, Progress, Tooltip, Toggle, Checkbox, Separator, ScrollArea, Tabs

## 约束
- 不要破坏已有的 UI 深度定制（蓝色深色主题、动画、组件风格）
- 保持代码风格一致（TypeScript strict, shadcn/ui 组件模式）
- Rust 后端新增命令需要注册到 tauri::generate_handler!
- 本地图片在前端展示需要用 Tauri 的 convertFileSrc() 或 asset protocol

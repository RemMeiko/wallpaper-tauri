---
status: completed
agent: harness
last_updated: 2026-04-20T23:22:00+08:00
---

# 用户需求（第二轮开发）

## 背景
这是 wallpaper-tauri 项目的第二轮 Harness 开发。第一轮已完成 3 个 Sprint（Tab 布局 + 搜索多页加载、本地壁纸库 + 设为桌面壁纸、配置持久化 + 自动轮换），详见 harness/final-summary.md。

当前技术栈：Tauri v2 + React 18 + TypeScript + Tailwind CSS v4 + shadcn/ui，后端 Rust。

## 本轮需求

### Bug 修复（优先）

1. **搜索结果跨页去重**
   - 问题：当前使用 sorting=random 参数导致跨页可能出现重复壁纸
   - 方案：改用非 random 排序（如 date_added 或 relevance）从根源避免重复
   - 位置：App.tsx 中的 searchWallpapers 命令调用，main.rs 中的 search_wallpapers

2. **设置页 Input 保存防抖优化**
   - 问题：当前每次 onChange 触发保存，每次按键都触发磁盘写入
   - 方案：添加防抖（debounce），用户停止输入后再保存
   - 位置：SettingsTab.tsx 中的下载目录、本地壁纸目录、轮换间隔输入框

3. **本地壁纸库缩略图无法显示**
   - 问题：所有本地图片都不显示
   - 当前实现：使用 convertFileSrc(wallpaper.path) 转为 asset:// 协议
   - 需要排查：asset protocol 配置、文件路径格式、Tauri 权限配置
   - 位置：LocalWallpaperTab.tsx 中的 LocalWallpaperCard 组件

### 新功能

4. **壁纸收藏**
   - 范围：仅收藏功能（心形图标 + 收藏列表页），不含标签和分组
   - 收藏来源：搜索结果和本地壁纸都能收藏（未下载的存 URL + 元数据）
   - 数据存储：本地 JSON 文件（~/.wallpaper_app/favorites.json）
   - UI：卡片上心形图标、新增"收藏"Tab、收藏页支持取消收藏和设为壁纸

5. **以图搜图**
   - 交互：用户从本地选择一张图片，提取主色调后去 Wallhaven 搜索
   - 技术：Wallhaven API 不支持直接以图搜图，采用提取主色调 → colors 参数的近似方案
   - UI：搜索页添加"以图搜图"按钮，点击后打开文件选择对话框
   - 后端：新增 extract_image_colors 命令，使用 image crate 提取主色调

## 澄清记录

| 问题 | 用户回答 |
|------|---------|
| 搜索去重策略 | 改用非 random 排序从根源避免 |
| 本地缩略图 bug 表现 | 所有本地图片都不显示 |
| 收藏功能范围 | 仅收藏（心形 + 列表页），存本地 JSON |
| 以图搜图方案 | 接受提取颜色转关键词的近似方案 |
| 收藏来源 | 搜索结果和本地壁纸都能收藏 |
| 优先级 | Bug 优先，再做新功能 |

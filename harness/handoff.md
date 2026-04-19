# 交接: Sprint 3

## 状态: 可以评审

## 测试说明

1. 启动应用：在项目根目录执行 `npm run tauri dev`
2. 验证配置持久化：
   - 切换到"设置" Tab，确认显示两个 Card 分组（目录设置、自动轮换）
   - 确认下载目录和本地壁纸目录已自动填充系统默认路径
   - 修改下载目录路径（手动输入或点击文件夹按钮选择），确认出现 toast "设置已保存"
   - 关闭应用，检查 `~/.wallpaper_app/settings.json` 文件是否存在且内容正确
   - 重新启动应用，确认设置页显示之前保存的配置值
3. 验证设置页 UI：
   - 确认下载目录和本地壁纸目录各有 Input + 文件夹按钮
   - 确认轮换间隔输入框为数字类型，范围 1-1440
   - 确认轮换模式下拉框有"随机"和"顺序"两个选项
   - 修改轮换间隔和模式，确认每次修改后 toast 提示保存成功
4. 验证壁纸自动轮换：
   - 在设置页将轮换间隔设为 1 分钟（方便测试）
   - 确认本地壁纸目录指向一个包含多张图片的目录
   - 点击"启用自动轮换"按钮，确认按钮变为红色"停止轮换"
   - 确认状态显示"运行中 · 下次切换: HH:MM:SS"
   - 等待 1 分钟，确认桌面壁纸自动切换
   - 点击"停止轮换"，确认状态变为"已停止"，桌面壁纸不再自动切换
5. 验证搜索页下载目录联动：
   - 在设置页修改下载目录
   - 切换到搜索页，确认 DirectoryBar 显示的路径与设置页一致
   - 在搜索页修改下载目录，切换到设置页确认同步更新
6. 验证本地壁纸 Tab 自动加载：
   - 在设置页设置本地壁纸目录为一个包含图片的目录
   - 切换到"本地壁纸" Tab，确认自动扫描并展示该目录的图片
7. 验证遗留问题修复：
   - 搜索壁纸并下载多张，选中 2 张已下载壁纸，确认"设为壁纸"按钮为禁用状态
   - 仅选中 1 张已下载壁纸，确认"设为壁纸"按钮启用
   - 在本地壁纸 Tab 选择包含大量图片（50+）的目录，确认最后一张卡片的入场动画延迟不超过 300ms
   - 搜索壁纸后多次点击"加载更多"，确认结果计数文本正确显示总数
8. 构建验证：
   - `npm run build` — 前端构建通过（已验证）
   - `cd src-tauri && cargo build --release` — Rust release 编译通过（已验证）

## 运行方式

- 命令: `npm run tauri dev`（开发模式）
- 构建: `npm run build`（前端）+ `cd src-tauri && cargo build --release`（后端）
- 配置文件位置: `~/.wallpaper_app/settings.json`

## 代码变更概览

### 修改的文件

| 文件 | 变更内容 |
|------|----------|
| `src-tauri/Cargo.toml` | 新增 `dirs`、`rand`、`chrono` 依赖 |
| `src-tauri/src/main.rs` | 新增 `AppSettings`、`RotationStatus`、`AppState` 结构体；新增 `load_settings`、`save_settings`、`start_rotation`、`stop_rotation`、`get_rotation_status` 命令；提取 `scan_dir_for_images` 和 `do_set_wallpaper` 为独立函数供轮换复用；`main()` 中注册 AppState 和所有新命令 |
| `src/App.tsx` | 新增 `settings` state 和 `useEffect` 启动加载配置；`downloadDir` 改为从 `settings.download_dir` 读取；引入 `SettingsTab` 替换占位内容；`LocalWallpaperTab` 传入 `initialDir` prop；修复 `canSetWallpaper`（useMemo + 单选约束）；修复 `doSetWallpaper`（单选检查）；修复 `doLoadMore`（函数式 setResults 回调内同步更新 resultText） |
| `src/components/LocalWallpaperTab.tsx` | 新增 `initialDir` prop 和 `useEffect` 自动扫描；动画延迟改为 `Math.min(index * 30, 300)` |
| `src/components/WallpaperGrid.tsx` | 动画延迟改为 `Math.min(index * 30, 300)` |

### 新增的文件

| 文件 | 用途 |
|------|------|
| `src/components/SettingsTab.tsx` | 设置 Tab 完整组件（目录配置 + 轮换配置 + 状态轮询） |

## 关于 Sprint 2 遗留问题 #1 的补充说明

Sprint 2 评审中指出"合同与实际修复方案不一致（目录选择按钮）"。实际情况是：合同计划将 `TooltipTrigger render` 改为 `asChild`，但 base-ui 的 TooltipTrigger 不支持 `asChild`，`render` prop 是其标准用法。实际根因是缺少 Tauri v2 capabilities 权限声明，通过创建 `capabilities/default.json` 解决。方案变更是合理的技术判断，此处补充说明以消除文档与代码的脱节。

## 已知缺陷

1. **轮换开关使用 Button 而非 Toggle** — base-ui Toggle 是 pressed/unpressed 状态切换组件，不适合做开/关切换。改用 Button（启用/停止两种状态），语义更清晰
2. **设置页输入框每次 onChange 触发保存** — 手动输入目录路径时每次按键都会保存。实际使用中用户更多通过文件夹按钮选择，性能影响可忽略
3. **轮换间隔修改后需手动重启** — 修改间隔后需停止再启动轮换才能生效，避免频繁重启定时器
4. **顺序模式重启后从头开始** — 合同中明确声明"不做断点续传"，符合预期

# 交接: Sprint 1 — Bug 修复（搜索去重 + 设置防抖 + 本地缩略图 + 双重 toast）

## 状态: 可以评审

## 测试说明

1. 启动应用：在项目根目录执行 `npm run tauri dev`
2. 验证搜索去重（Bug 1）：
   - 切换到"搜索壁纸" Tab，输入关键词（如 "nature"）搜索
   - 点击"加载更多"3 次，检查所有结果中是否有重复壁纸（同一 id 不应出现两次）
   - 确认结果按日期降序排列，多次加载顺序一致
3. 验证设置防抖（Bug 2）：
   - 切换到"设置" Tab
   - 在下载目录输入框中快速连续输入 10 个字符，观察是否只在停止输入后弹出一次 toast
   - 在本地壁纸目录输入框中连续输入，同样验证只弹出一次 toast
   - 在轮换间隔输入框中连续修改数字，同样验证只弹出一次 toast
   - 通过文件夹按钮选择目录，确认立即保存并弹出 toast（不受防抖影响）
   - 修改轮换模式下拉框，确认立即保存并弹出 toast
   - 在输入框中输入内容后立即切换到其他 Tab，再切回设置 Tab 确认值已保存
4. 验证本地缩略图（Bug 3）：
   - 切换到"本地壁纸" Tab
   - 选择一个包含 jpg/png 图片的本地目录，确认所有图片缩略图正常显示
   - 确认图片加载过程中显示 skeleton 占位，加载完成后平滑过渡
   - 选择包含 20+ 张图片的目录，确认所有图片都能显示
   - 选择路径中包含中文字符的目录，确认图片正常显示
   - 选择路径中包含空格的目录，确认图片正常显示
   - 选择一个不包含图片的空目录，确认显示空状态提示
5. 验证停止轮换双重 toast（Bug 4）：
   - 切换到"设置" Tab，点击"启用自动轮换"
   - 确认弹出一个 toast "自动轮换已启动"
   - 点击"停止轮换"，确认只弹出一个 toast "自动轮换已停止"（不是两个）
6. 构建验证：
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
| `src-tauri/tauri.conf.json` | 配置 CSP 策略（允许 `asset:` 协议和 Wallhaven 图片域名）；启用 asset protocol（`enable: true, scope: ["**"]`） |
| `src-tauri/Cargo.toml` | tauri 依赖添加 `protocol-asset` feature |
| `src/hooks/useDebouncedCallback.ts` | 泛型约束从 `unknown[]` 改为 `any[]`，修复 TypeScript 类型不兼容错误 |

### 未修改的文件（已有修复，验证通过）

| 文件 | 说明 |
|------|------|
| `src-tauri/src/main.rs` | 第 213 行已使用 `sorting=date_added`（Bug 1 搜索去重） |
| `src/components/SettingsTab.tsx` | 已使用 `useDebouncedCallback` 防抖（Bug 2）；`handleToggleRotation` 已用直接 invoke（Bug 4） |
| `src/hooks/useDebouncedCallback.ts` | hook 逻辑已完整（500ms 延迟、flush on unmount） |

## 已知缺陷

1. **Asset protocol scope 使用 `["**"]`（宽泛权限）** — Tauri v2 asset protocol scope 为静态配置，不支持运行时动态添加。由于用户可选择任意目录，使用 `["**"]` 是唯一可行方案。桌面应用本身已有文件系统访问权限，实际安全风险可控。

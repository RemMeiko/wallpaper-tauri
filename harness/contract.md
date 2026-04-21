# Sprint 合同: Sprint 1 — Bug 修复（搜索去重 + 设置防抖 + 本地缩略图 + 双重 toast）

## 范围

本 Sprint 修复第一轮开发遗留的 4 个 Bug：

1. **搜索结果跨页去重** — 修改 `search_wallpapers` 命令的排序方式，从 `sorting=random` 改为稳定排序（如 `sorting=date_added` 或 `sorting=relevance`），避免跨页重复
2. **设置页 Input 保存防抖优化** — 为 `SettingsTab.tsx` 中的 Input 组件添加防抖逻辑，停止输入后才触发保存，减少频繁的磁盘写入和 toast 弹出
3. **本地壁纸库缩略图无法显示** — 配置 Tauri v2 的 asset protocol 权限，使 `convertFileSrc` 转换的 `asset://` 协议 URL 能正常加载本地图片
4. **停止轮换时双重 toast** — 修复停止轮换时同时弹出两个 toast 的问题（修复成本低，顺带修复）

## 实现计划

### 1. 搜索去重

**技术方案**：修改 `src-tauri/src/main.rs` 中的 `search_wallpapers` 命令，将 Wallhaven API 的 `sorting` 参数从 `random` 改为 `date_added`（按上传日期降序）。

**理由**：
- `date_added` 是稳定排序，同一关键词的多次请求返回顺序一致，跨页不会重复
- 相比 `relevance`（相关度），`date_added` 能保证新壁纸优先展示，用户体验更好
- 不影响搜索结果的多样性，因为 Wallhaven 的壁纸库本身足够大

**影响范围**：`main.rs` 第 213 行 URL 构造逻辑

### 2. 设置防抖

**技术方案**：在 `SettingsTab.tsx` 中实现防抖逻辑：

- 为下载目录、本地壁纸目录、轮换间隔三个 Input 组件的 `onChange` 添加防抖（500ms）
- 使用 `useRef` 存储防抖 timer，在组件卸载时 flush（立即触发保存）
- 文件夹选择按钮、轮换模式 Select 下拉框仍然立即保存（不受防抖影响）

**实现细节**：
- 创建 `useDebouncedCallback` 自定义 hook，封装防抖逻辑
- 在 `useEffect` cleanup 中调用 flush，确保组件卸载时最后一次输入不丢失
- 防抖期间不显示 toast，只在实际保存时显示

**影响范围**：`SettingsTab.tsx` 第 148-150、173-175、242 行的 `onChange` 处理

### 3. 本地缩略图修复

**技术方案**：配置 Tauri v2 的 asset protocol 权限

**根因分析**：
- `LocalWallpaperTab.tsx` 使用 `convertFileSrc(path)` 将本地路径转换为 `asset://localhost/{path}` 协议 URL
- Tauri v2 的 asset protocol 需要在 `capabilities/default.json` 中显式配置权限和 scope
- 当前 `capabilities/default.json` 只有 `core:default`、`dialog:default`、`fs:default`，缺少 asset protocol 相关权限

**修复步骤**：
1. 在 `src-tauri/capabilities/default.json` 的 `permissions` 数组中添加 `"asset:default"`
2. 配置 asset protocol 的 scope，允许访问用户选择的本地壁纸目录

**Scope 配置策略**：
- 由于用户可以选择任意目录，无法预先配置固定 scope
- **优先调研 Tauri v2 动态 scope 方案**：查阅 Tauri v2 文档，确认是否支持运行时动态添加 scope（如通过 `asset_protocol_scope().allow_directory()` 在用户选择目录后动态授权）
- 如果支持动态 scope：实现运行时按需授权，仅允许用户实际选择的目录
- 如果不支持动态 scope：退而使用 `scope: ["**"]`，并在 handoff.md 中标注为已知安全限制
- 在 `src-tauri/capabilities/default.json` 中添加 `"asset:default"` 权限

**影响范围**：
- `src-tauri/capabilities/default.json`
- `src-tauri/tauri.conf.json`

### 4. 停止轮换双重 toast 修复

**技术方案**：修改停止轮换的调用路径，避免同时触发两个 toast。

**根因分析**：
- 停止轮换时，前端同时调用了停止命令和状态更新，两个路径各自弹出一个 toast
- 修复方式：将停止路径改为直接 invoke 调用，移除多余的 toast 触发点，确保停止操作只弹出一个 toast

**影响范围**：轮换相关的前端组件（约 1 行代码变更）

## 验收标准

### 搜索去重（必须通过）
1. 用户搜索关键词"nature"后，点击"加载更多"3 次，所有结果中无重复壁纸（同一 id 不出现两次）
2. 搜索结果按稳定顺序排列（按日期降序），多次加载更多后顺序一致
3. 修改排序方式后，搜索功能正常工作，返回结果数量与之前相当（24 张/页）
4. 首次搜索仍能返回多样化的结果（不会因为固定排序导致每次搜索结果完全相同）

### 设置防抖（必须通过）
5. 用户在下载目录输入框中连续输入 10 个字符，只触发一次保存（停止输入后约 500ms 触发）
6. 用户在本地壁纸目录输入框中连续输入，同样只在停止输入后触发一次保存
7. 用户在轮换间隔输入框中连续修改数字，同样只在停止输入后触发一次保存
8. 防抖期间如果用户切换 Tab 或关闭应用，最后一次输入的值不会丢失（组件卸载时 flush）
9. 通过文件夹选择按钮选择目录时，仍然立即保存（不受防抖影响）
10. 轮换模式 Select 下拉选择仍然立即保存（不受防抖影响）
11. 保存成功后仍显示 toast 提示，但不会出现连续多个 toast 弹出

### 本地缩略图（必须通过）
12. 用户选择一个包含 jpg/png 图片的本地目录后，所有图片缩略图正常显示
13. 图片加载过程中显示 skeleton 占位，加载完成后平滑过渡显示
14. 包含 20+ 张图片的目录，所有图片都能正常显示（不是只有部分能显示）
15. 路径中包含中文字符的图片也能正常显示
16. 路径中包含空格的图片也能正常显示
17. 选择一个不包含任何图片的空目录时，显示空状态提示（如"此目录没有图片"），不是空白页面
18. 选择一个无读取权限或不存在的目录时，显示友好错误提示，应用不崩溃

### 停止轮换双重 toast（必须通过）
19. 用户点击"停止轮换"按钮后，只弹出一个 toast 提示（不是两个）

### 构建验证（必须通过）
20. 前端构建通过：`npm run build` 无错误
21. Rust release 编译通过：`cargo build --release` 无错误

## 本 Sprint 不做的事

- 不修复"轮换定时器不感知配置变更"问题（evaluation.md 一般问题 #2）— 需要重构定时器架构，超出本 Sprint 范围
- 不修复"搜索页 DirectoryBar 修改目录时无 toast 反馈"问题（evaluation.md 一般问题 #4）— 影响较小，留待后续优化
- 不实现新功能（壁纸收藏、以图搜图）— 这些是 Sprint 2 和 Sprint 3 的范围

## 遗留问题处理说明

根据 `evaluation.md`，第一轮开发遗留 4 个一般问题：

1. **停止轮换时双重 toast** — **本 Sprint 修复**（修复成本低，属于正常使用路径上的 bug，顺带修复）
2. **轮换定时器不感知配置变更** — 本 Sprint 不修复（需要重构定时器架构，超出范围）
3. **设置页 Input 每次 onChange 触发保存** — **本 Sprint 修复**（这是合同中的 Bug #2）
4. **搜索页 DirectoryBar 修改目录时无 toast 反馈** — 本 Sprint 不修复（影响较小，不在合同范围内）

本 Sprint 修复 spec.md 中明确定义的 3 个 Bug，并顺带修复修复成本极低的双重 toast 问题。

## 技术决策说明

1. **排序方式选择 date_added**: 相比 `relevance`，`date_added` 更稳定且能保证新壁纸优先，用户体验更好
2. **防抖延迟 500ms**: 平衡用户输入流畅性和保存频率，500ms 是常见的防抖延迟值
3. **Asset protocol scope 配置策略**: 优先调研 Tauri v2 动态 scope 方案（运行时按需授权用户选择的目录）。如果 Tauri v2 不支持动态 scope，再退而使用 `["**"]` 并在 handoff 中标注为已知安全限制
4. **防抖实现使用自定义 hook**: 封装防抖逻辑，避免在组件中重复代码，提高可维护性

## 依赖和风险

**新增依赖**：无（防抖逻辑手写，不引入额外库）

**风险及缓解**：
1. **Asset protocol scope 安全性**: 优先使用动态 scope 方案缩小权限范围；如果不可行，使用 `["**"]` 并在 handoff 中标注为已知安全限制（桌面应用本身已有文件系统访问权限，实际风险可控）
2. **防抖 flush 时机**: 组件卸载时必须 flush，否则最后一次输入会丢失。使用 `useEffect` cleanup 确保 flush 执行
3. **排序方式变更影响搜索结果**: `date_added` 排序可能导致搜索结果与之前不同，但这是修复跨页重复的必要代价，且新壁纸优先展示是合理的产品决策

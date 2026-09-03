# 刷吧 · AI Agent 通用工作契约

> 任何 AI Agent（Codex / Claude Code / Cursor / WorkBuddy 等）在本仓库工作时，
> 以本文件为**唯一入口**。本文件只放**红线 + 铁律 + 路由表**，具体规格一律走分册。
>
> 版本：v2.0 · 更新：2026-09-02
> **本文件必须保持 ≤6KB**——超过就会被上下文注入截断，红线反而丢失。

## 一、项目是什么

刷吧是**独立、数一专用、纸笔优先**的本地刷题桌面 App
（Tauri v2 + React + TypeScript + rusqlite）。

用户同时是**开发者**和**学员**：既迭代这个 App，也用它备战 27 考研数学一。

## 二、红线（违反即事故）

1. 题库源目录 `E:\考研资料\题库-大观园` **只读**，禁止修改其中任何 JSON 与图片
2. 刷吧**不连接** Obsidian 或拾遗录
3. 签名私钥 `%USERPROFILE%\.tauri\shuaba_updater.key`
   **永不出仓库、不进 git、不展示内容**——丢了它所有旧版本收不到更新
4. `tauri.conf.json` 的 `createUpdaterArtifacts: true` **必须保持开启**
   （v1.4.0 曾被误关导致无签名产物）
5. `releases/` 已 gitignore（历史教训：260MB 便携版进 git 导致 push 被拒）
6. 改段位表需**两处同步**：
   `src-tauri/src/services/rating.rs rank_band_index` + `src/utils.ts WANMEI_RANKS`

## 三、三条铁律

1. **写库守门**——分析只跑 SELECT；直写仅限既有列数据，须走 `.agent/05` 守门流程
   （备份+关 App+单事务+核验+记日志）；schema 变更只走 App `migrate_schema`。
2. **不做奇怪的接入**——批改与写入以「和 agent 沟通」为主通道。
   提任何自动化方案前**先读 `.agent/06-AI闭环通道.md`**（闭环已经存在且在跑）。
3. **不造题号**——只能从题库里选题，回传前必须验证题号存在。

## 四、★ 路由表（按任务读对应的分册，不要全读）

| 你要做的事 | 读这个 |
|---|---|
| **任何查库分析** | `.agent/05-数据库与查询纪律.md` |
| **检阅题库挑题 / 排备考计划 / 评定外部方案** | `.agent/07-取样与备考.md` → `考研规划/取样策略-pro-v5.md` |
| **向 App 回传 JSON**（推题/批改/作战计划） | `.agent/01-回传格式.md` |
| **批改草稿** | `.agent/02-批改与诊断.md` + `01-回传格式.md` |
| **调评分参数 / 评分相关开发** | `.agent/03-评分与ELO.md` |
| **发版 / 打 tag / 传 Release** | `.agent/04-发版流程.md` |
| **任何"AI 接入 / 自动化闭环"提案** | `.agent/06-AI闭环通道.md`（先确认不是重复建设） |
| **改学习引擎 / 选题逻辑 / 错误处理** | `.agent/08-产品约束摘录.md` |
| **了解学员当前战力** | `characteristic-core.md`（≤5KB，冷启动摘要） |
| **深度查学员证据链** | `characteristic.md`（69KB，按需查，不要全读） |

## 五、环境与命令

```bash
npm install          # 装依赖
npm run app          # 桌面端开发（热重载）
npm run dev          # 仅浏览器预览（mock 数据）
npm test             # 完整测试门禁（26 前端 + 88 Rust）
cd src-tauri && cargo test --locked   # Rust 门禁（当前 88 个）
```

**提交前门禁：`cargo test --locked` 全绿 + 构建成功。**

⚠️ 本机 `npm run build` 会失败（环境问题，非项目问题）：vite 清空 `dist/` 会触发
safe-delete 守卫。**不要为此改 vite 配置**，改用：

```bash
npx tsc -b                              # 类型检查
npx vite build --emptyOutDir false      # 构建
```

⚠️ **改版本号后必须** `cd src-tauri && cargo update -p shuaba --offline`，
否则 `cargo test --locked` 失败。

## 六、代码架构速览

```
src-tauri/src/lib.rs              # 后端核心（~1.3万行）：79 个 tauri::command、ELO 结算、学习中心双引擎、WebDAV 同步
src-tauri/src/services/rating.rs  # 评分内核：HLTV 合成、特征曲线、段位表（纯函数+测试）
src/views/                        # TodayView InsightsView ReviewView LibraryView SettingsView LearningCenterView
src/components/                   # GradingReportModal FriendsLadderView FriendVsRadarModal 等
src/api.ts / types.ts             # 前端 API 封装（与 lib.rs serde camelCase 对应）
scripts/release.mjs               # 发版脚本
src-tauri/capabilities/default.json  # Tauri 权限（加插件必须在此注册）
```

数据库 `%APPDATA%\com.shuaba.math\shuaba.db`，收件箱 `.../codex-inbox/`。
**草稿图片默认位置 `E:\刷吧\photo`**，按题目顺序读取；图片不足时只批改能对应的题，
不得猜测缺失草稿。

## 七、工作方式约定

- **改 UI 前先看现状**：大改先出方案确认再动手；改完必须构建 + `cargo test` 验证
- **不要凭文档猜代码状态**：动手前用 `git status` / `git log -3` / 搜索核对实际实现
- 大文件永不进 git；构建产物放 `releases/`（已忽略）
- 每个功能独立 commit（中文 conventional 风格），随时可回滚
- **不要根据历史结论推断当前状态**——9/1 曾因沿用旧判断而误判硬伤，见 `.agent/07`

## 八、学员画像维护契约

`characteristic.md`（69KB）是学员微观战力画像，**不要全量重写，只增量更新**。

1. **推题 / 批改前**：读 `characteristic-core.md`（≤5KB 摘要）；
   需要证据链时才查 `characteristic.md`
2. **批改后**：同步更新画像并写入 core 摘要
   - 新增断点归入 Level 1 致命 / Level 2 战术 / Level 3 精度，注入「⚡ 神经反射补丁」
   - 变式中纠偏 → `[🟡 观察中]` + 48~72h 抽检排期；连续 2 次独立避坑 → `[🟢 已固化]`
3. **严禁虚假封盘**：章节掌握度必须基于真实作答证据分级
   （🟢 已固化 / 🟡 不稳定 / 🔴 高危 / ⬜ 未实测），
   严禁凭几道题的正确声称全章 100% 掌握
4. **学员亲笔自省**是最高维度证据，收到后原样记入画像并在后续推题中采纳

## 九、用户的沟通偏好

- 中文，偏好结构化输出：**表格、分批、时间估算、明确优先级标记**
- 会**主动纠正 AI 的认知偏差**，并要求把纠正内容沉淀为项目规则——
  被纠正后请立刻写入对应分册或 `characteristic-core.md`，不要只在对话里回应
- 要求数据证据支撑决策，不接受"看起来像"

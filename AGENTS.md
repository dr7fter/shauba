# 刷吧 · AI Agent 通用工作契约

> 任何 AI Agent（Codex / Claude Code / Cursor / ZCode 等）在本仓库工作时，以本文件为唯一权威入口。
> 版本：v1.6.3 · 更新：2026-08-26

## 一、项目是什么

刷吧是**独立、数一专用、纸笔优先**的本地刷题桌面 App（Tauri v2 + React + TypeScript + rusqlite）。

**红线（违反即事故）：**
1. 题库源目录 `E:\考研资料\题库-大观园` **只读**，禁止修改其中任何 JSON 与图片
2. 刷吧**不连接** Obsidian 或拾遗录
3. 签名私钥 `%USERPROFILE%\.tauri\shuaba_updater.key` **永不出仓库、不进 git、不展示内容**——丢了它所有旧版本收不到更新
4. `tauri.conf.json` 的 `createUpdaterArtifacts: true` **必须保持开启**（v1.4.0 曾被误关导致无签名产物）
5. `releases/` 已 gitignore（发布产物只存 GitHub Releases，历史教训：260MB 便携版进 git 导致 push 被拒）
6. 改段位表需**两处同步**：`src-tauri/src/services/rating.rs rank_band_index` + `src/utils.ts WANMEI_RANKS`

## 二、环境与命令

```bash
# 环境：Node 18+ / Rust 1.77.2+ / npm
npm install          # 装依赖
npm run app          # 桌面端开发（热重载）
npm run dev          # 仅浏览器预览（用 mock 数据）
npm run build        # 前端构建门禁（tsc + vite）
npm run app:build    # 桌面打包（注意：不带签名环境变量，发布必须用下面的 release.mjs）
npm test             # 完整测试门禁（26个前端测试 + 88个 Rust 门禁测试）
cd src-tauri && cargo test --locked   # Rust 测试门禁（当前 88 个）
```

**提交前门禁：`cargo test --locked` 全绿 + `npm run build` 成功。**

## 三、代码架构速览

```
src-tauri/src/lib.rs        # 后端核心（~1.1万行）：Tauri command、ELO 结算、学习中心双引擎、WebDAV 同步
src-tauri/src/services/rating.rs  # 评分内核：HLTV 合成、特征曲线、段位表（纯函数+测试）
src/views/                  # TodayView(训练) InsightsView(数据) ReviewView(复盘) LibraryView(题库) SettingsView(设置) LearningCenterView(学习中心)
src/components/             # GradingReportModal(模考报告) FriendsLadderView(好友天梯) FriendVsRadarModal(1v1对决) FriendShareCardModal(战力名片) UpdateModal(应用内更新) MathText(KaTeX) 等
src/api.ts / types.ts       # 前端 API 封装与类型（与 lib.rs serde camelCase 对应）
src/data/friendsService.ts  # 好友战绩卡与 WebDAV 同步服务（v1.4.0+ / v1.5.0+ 增强）
src/data/friendPublicData.ts # 好友公开主页、Presence 心跳计算与脱敏战报
scripts/release.mjs         # 发版脚本（构建+签名+latest.json，见第六节）
src-tauri/capabilities/default.json  # Tauri 权限（加插件必须在此注册）
```

数据库：`%APPDATA%\com.shuaba.math\shuaba.db`（SQLite，含 questions / attempts / progress / elo_events / codex_inbox / codex_analysis_signals / pressure_* 等表）。收件箱：`%APPDATA%\com.shuaba.math\codex-inbox\`。

草稿图片默认位置：`E:\刷吧\photo`。用户未在消息中单独提供草稿图片时，批改任务应按题目顺序读取该目录中的图片；若目录不存在或图片数量不足，只批改实际收到且能对应的题目，不得猜测缺失草稿。

## 四、评分与天梯体系（权威参数）

**分工原则：AI 打证据分，内核当裁判。** Codex 通过提示词锚点给六维分与 rating；跨时间记账（聚合、ELO、段位）全部由确定性内核处理。

**评分回退链**（前后端一致）：`六维 HLTV 合成 > Codex rating > 特征曲线`。

**HLTV 3.0 合成**（`rating.rs`，HLTV3_* 常量区 + `hltv_rating`）：

输入为六维证据 `DimensionEvidence`（rigor/computation/modeling/method_use/speed/strategy_insight，0–100）+ `technique_level`（1–5 整数技巧等级），任一维非空即走此链：

```
Cast     = 结果产出：correct=100 / partial=38+0.12×computation / uncertain=30 / wrong=10
Impact   = 0.60×strategy_insight + 0.40×method_use；technique_level≥4 加 6；难度系数≥1.06 且非 wrong 触发 Clutch 残局加成 +6
KAST     = 0.50×rigor + 0.30×computation + 0.20×modeling（防白给稳定性）
Pacing   = 优先取 speed 维；否则 (基准耗时/实际耗时)×100，clamp [45, 115]
EcoDrag  = 做错且超时>1.2×基准：((耗时/基准)−1)×24，clamp 后封顶 36；做错未严重超时固定 8；做对为 0

P = 0.38×Cast + 0.22×Impact + 0.20×KAST + 0.20×Pacing − EcoDrag
rating = clamp(0.26 + 0.0125×P) × 难度系数(0.94–1.10)
```

缺失维度按 outcome 给保守默认值（不是猜 75）。**Donk 爆发条款**：correct 且 base>1.40 且 technique_level≥4 且 Pacing≥125 时，允许突破 2.00 上限达 2.05–2.45。

**ELO 天梯**（`lib.rs` 常量区 + `settle_elo`）：

| 参数 | 值 |
|---|---|
| 起点 ELO_START | 1400（C 段） |
| K 值 | 定级期 30（前 10 次结算）→ 常态 10（每题 ±1-3 分） |
| 期望公式 | `anchor + 0.04×(mastery−2) − 2.50×(难度系数−1)`，clamp [0.20, 0.80]，review 模式 +0.06；`anchor` = 近 30 次 `performance/2` 的中位数 ×0.70 + 0.50×0.30，样本 <10 时取 0.50 |
| 连胜动量 | 近 5 次结算连续≥3 同向 → K×1.15（`ELO_MOMENTUM_*`） |
| 晋级保护 | 升段后 3 次结算免负分 |
| 段位 | D<1000 … C+1401 … S≥2401 九段（完美平台刻度） |
| 赛季软重置 | 向 1400 收敛，保留与起点差距的 75%（`SEASON_RESET_PULL`） |
| 分数换算 | score = clamp(performance/2, 0, 1.25)，delta = round(K×(score−expected)) |

**历史修正记录**：旧版期望公式（基线 0.70、mastery 反向、难度步长 2.5）已重构为上表现行版本——基线降至 0.50 对齐 rating 锚点 1.00，mastery 方向修正为熟题期望更高，难度惩罚降至 0.25 避免双重计入。`elo_events` 存有每次 performance/expected，如需再调参先写回放验证。

**v1.6.8 天梯可信度修复（基于 246 次真实作答回放）**：

回放发现 ELO 已退化为**单向棘轮**——94 次结算中做对 44 次**全部涨分、零次扣分**（均 +4.95），做错 50 次中仍有 24 次（48%）在涨分；同期正确率从 75% 跌到 37.5%，天梯分反而从 1455 涨到 1612。两处修复：

1. **结果闸门**（`ELO_WRONG_DELTA_FLOOR = -1.0` / `ELO_CORRECT_DELTA_FLOOR = 0.5`）：在 `settle_elo` 中对 delta 的**符号**设下界——做错至少扣 1 分、做对至少加 0.5 分。晋级保护在其后生效，仍可把扣分归零（刻意保留）。partial / uncertain 不设闸门，由公式自由裁定。
2. **难度杠杆放大 10 倍**（`ELO_EXPECTED_DIFFICULTY_STEP` 0.25 → 2.50）：原步长下难度系数实际只落在 0.94~1.10，对期望的影响仅 ±0.04，「攻克难题收益最大」完全失效（实测最难题与最易题的期望差仅 0.073）。放大后同样区间产生 ±0.40 的真实差距：简单题做对几乎不涨、做错重罚；难题做对大涨、做错轻罚。

**v1.6.9 自适应期望锚点（离线回放验证后上线）**：

期望基线不再是固定 0.50，改为**近 30 次 performance 折算 score 后的中位数**（混合 30% 固定基线，防止锚点自身跟着分布漂走），样本不足 10 次时退回 0.50，保证冷启动行为不变。取**中位数**而非均值：表现分中约 21% 落在崩盘区（<0.8），均值会被极端值拉偏。

回放验证结论（94 次真实结算离线复现三套参数）：

| 参数 | 做对均变动 | 做错均变动 | 做错仍涨分占比 | 崩塌期（正确率 35%）总变动 |
|---|---|---|---|---|
| v1.6.7 原始 | +2.75 | −0.06 | 49% | +14 |
| v1.6.8（结果闸门 + 难度杠杆） | +3.58 | −1.04 | 0% | +14 |
| v1.6.9（+ 自适应锚点） | +2.76 | −1.22 | 0% | **−10** |

**一处必须更正的表述**：初版报告称 ELO「与实际水平完全脱钩」是**不准确**的。三套参数下，每日 ELO 增量与当日正确率的相关系数都在 +0.70 左右——方向一直是对的。真正的问题是**期望基线偏低导致绝对分数单调膨胀**。准确表述应为「方向对，但基线偏了」。

**历史 ELO 不重算**：从上线之日起按新规则演化，避免分数突变冲击用户。若日后需要校准，应单独提供入口。

**出题科目均衡（v1.6.8 新增）**：`recommendations()` 的打分函数加入**按考研数一分值占比计算的覆盖缺口权重**（高数 56% / 线代 22% / 概率 22%，`SUBJECT_GAP_WEIGHT = 45.0`）。缺口 = `max(0, 分值占比 − 该科在已做题目中的占比)`，只奖励缺口、不惩罚超额，随覆盖推进自动收敛。背景：实测概率统计 317 道题零覆盖，而原实现靠 `ORDER BY RANDOM()` 抽新题，结构性失衡会被不断固化。注意「历年真题」不参与加权（它是三科混合）。

**提示词锚点**在 `lib.rs` 搜 `HLTV Rating 3.0 定位`（约 7265/7368 行两处：单题任务与整组任务）：rating 锚 0.50/0.80/1.00/1.15–1.25/1.30–1.45/1.50–1.65/2.00–2.45；硬约束：incorrect 时 rating ≤0.65（大量正确步骤的笔误最高 0.80），超时 1.5 倍且做错触发经济拖累；整组无区分度视为批改失效。

## 五、批改与诊断核心原则（单题与整组通用）

无论高压演练还是日常刷题，用户要求"批改草稿并发送给刷吧"时：

1. **LaTeX 数学公式规范（极其重要）**：summary / earliestError / advice / betterSolution 及所有分析文本中的数学符号、变量、公式、计算式、递推式、极限与矩阵必须用 `$...$`（行内）或 `$$...$$`（块级）包裹。禁止裸文本数学式（禁 `x^2`、`int 0 to pi`，必须 `$x^2$`、`$\int_0^\pi$`）。JSON 字符串中反斜杠为合法单个 LaTeX 反斜杠（`\frac`、`\sin`、`\int`）。
2. **深度步骤与断点定位**：结合草稿图逐行核对推理逻辑，定位**最早错误断点**（精确到行号与具体公式），而非只判最终答案。errorTags 三类战术标签：
   - 🔴 **瞄准失误**（计算笔误/符号写反）：思路完全正确，在通分/变上限求导/矩阵变换处算错 → verdict `partial`，保留步骤分
   - 🟡 **概念盲区**（定理前提遗漏/混淆边界）：未验证极限存在拆分/连续可导混淆 → verdict `incorrect`
   - 🔵 **战术绕路**（方法机械蛮干/超时严重）：硬算超时，指出计算黑洞 → speed ≤ 60
   - 无法确定时明确用 `uncertain`，不要猜测步骤或知识点
3. **HLTV Rating（0.00-2.50）**：综合实际耗时与基准时间（单选3分/多选4分/填空5分/解答10分）评估流畅度与经济效率。0.50=核心断裂；0.80=笨拙硬算且有笔误；1.00=常规达标；1.15-1.25=规范严密；1.30-1.45=巧解秒杀；1.50-1.65=压轴题突破；2.00-2.45=Donk-tier 超神秒杀（极罕见）。**严禁打中庸安全分，整组题必须拉开区分度**。做错题 rating 严禁超过 0.65（有大量正确步骤的笔误最高 0.80）；超时严重且做错触发经济拖累惩罚。
4. **考场极速秒杀思路（betterSolution）**：严禁搬教科书式繁琐长证明！必须提供待定系数法、二重积分交换次序、King 变换、特征多项式秒杀等极简技巧。当前解法已足够精炼则填 `null`。
5. **可执行修复动作（advice）**：一条精准、直接、明天即可落地刻意练习的专项修复动作。

## 六、版本发布与 GitHub 上传（完整流程）

仓库：`https://github.com/dr7fter/shauba`（公开），分支 `master`。

### 6.1 发版三步

```bash
# ① 升版本号（三处必须一致）：package.json / src-tauri/tauri.conf.json / src-tauri/Cargo.toml
#    同时更新 RELEASE_NOTES.md（它的内容会成为 latest.json 的 notes 和 Release 正文）

# ② 构建（自动带签名、生成三件套并归档 releases/vX.Y.Z/）
node scripts/release.mjs
#    产出：src-tauri/target/release/bundle/nsis/ 下的
#    刷吧_X.Y.Z_x64-setup.exe + .sig + latest.json + SHA256SUMS.txt

# ③ 推送代码与 tag，然后创建 Release 并上传资产（见 6.2/6.3）
```

### 6.2 git 推送

```bash
git push origin master
git tag -a vX.Y.Z -m "刷吧 vX.Y.Z" && git push origin vX.Y.Z   # 新 tag 时
```

### 6.3 创建 Release + 上传资产（本机没装 gh CLI，用 API）

```bash
# 取 token（凭据管理器里已有，GCM 授权过一次就持久保存）
export GCM_INTERACTIVE=never
TOKEN=$(printf "protocol=https\nhost=github.com\n\n" | git credential fill | grep '^password=' | cut -d= -f2-)

# 建 Release（body 建议 JSON 写文件再 -d @file，避免 shell 弄坏中文；make_latest 确保端点指向它）
curl -s -X POST -H "Authorization: Bearer $TOKEN" https://api.github.com/repos/dr7fter/shauba/releases -d @payload.json
# payload.json: {"tag_name":"vX.Y.Z","name":"刷吧 vX.Y.Z","make_latest":"true","body":"更新说明"}

# 上传资产（关键：exe 必须用 ASCII 名，GitHub 会剥掉中文字符导致 latest.json URL 404）
NSIS=src-tauri/target/release/bundle/nsis
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/octet-stream" \
  --data-binary "@$NSIS/刷吧_X.Y.Z_x64-setup.exe" \
  "https://uploads.github.com/repos/dr7fter/shauba/releases/{RELEASE_ID}/assets?name=shuaba_X.Y.Z_x64-setup.exe"
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  --data-binary "@$NSIS/latest.json" \
  "https://uploads.github.com/repos/dr7fter/shauba/releases/{RELEASE_ID}/assets?name=latest.json"
```

latest.json 由脚本自动生成（内含 ASCII 下载 URL 和 minisign 签名），**文件名不能改**——updater 端点固定读 `releases/latest/download/latest.json`。

### 6.4 网络坑（本机环境）

本机 `github.com` 直连受 DNS 污染/Fake-IP 劫持影响，已做三层保障：
- hosts 已固定 `140.82.112.3 github.com`（失效时换 20.205.243.166 / 140.82.113.4 实测可用 IP）
- app 内 updater 自动跟随系统代理、失败降级直连（勿删此逻辑）
- api.github.com / uploads.github.com / objects.githubusercontent.com 通常直连可用，API 发布流程不依赖 github.com 主域

### 6.5 发布后验证

```bash
curl -sL https://github.com/dr7fter/shauba/releases/latest/download/latest.json   # 应返回新版本号
```
然后在旧版本 app 里实测：设置 → 检查新版本 → 下载 → 重启。

## 七、向刷吧回传数据格式

只写一个 UTF-8 JSON 文件。未指定路径时写入 `%APPDATA%\com.shuaba.math\codex-inbox\{taskId}.json`。**不修改题库源文件或刷吧数据库。**

### 1. 单题批改（`kind: "analysis"`）

```json
{
  "schemaVersion": 1, "kind": "analysis", "taskId": "SB-YYYYMMDD-questionId-random",
  "questionId": 155,
  "summary": "简要诊断（含 $LaTeX$）", "verdict": "correct|partial|incorrect|uncertain",
  "earliestError": "最早错误步骤（含 $LaTeX$）或 null",
  "errorTags": ["概念边界"], "weaknessTags": ["幂零矩阵"],
  "advice": "一条可执行修复动作（含 $LaTeX$）", "betterSolution": "秒杀思路或 null",
  "confidence": 0.95, "recommendedQuestionIds": [], "recommendationReason": null
}
```

### 2. 整组批改（`kind: "batch"`，taskId 形如 `SB-BATCH-YYYYMMDD-random`）

草稿张数少于题目数时只批改上传了草稿的题，未收到草稿的题不出现在 batchAttempts 中：

```json
{
  "schemaVersion": 1, "kind": "batch", "taskId": "SB-BATCH-YYYYMMDD-random",
  "summary": "整组摘要（含 $LaTeX$）", "errorTags": ["方法未掌握"],
  "weaknessTags": ["定积分对称性与King变换"], "confidence": 0.95,
  "recommendedQuestionIds": [],
  "batchAttempts": [
    { "questionId": 155, "result": "correct|wrong|uncertain", "selfRating": 2,
      "durationSeconds": 120, "summary": "（含 $LaTeX$）",
      "verdict": "correct|partial|incorrect|uncertain", "earliestError": "…或 null",
      "errorTags": ["方法绕路"], "weaknessTags": ["待定系数法"],
      "advice": "（含 $LaTeX$）", "betterSolution": "…或 null", "confidence": 0.95 }
  ]
}
```

`result` 只能 `correct/wrong/uncertain`；`selfRating` 1-4；`uncertain` 不写作答记录仅留诊断。

### 3. 推荐题目（`kind: "recommendation"`，taskId 形如 `SB-REC-YYYYMMDD-random`）

```json
{
  "schemaVersion": 1, "kind": "recommendation", "taskId": "SB-REC-YYYYMMDD-random",
  "questionId": null, "summary": "本次荐题策略", "verdict": null, "earliestError": null,
  "errorTags": [], "weaknessTags": ["薄弱知识"], "advice": null, "betterSolution": null,
  "confidence": 0.9, "recommendedQuestionIds": [155, 156], "recommendationReason": "推荐理由"
}
```

`recommendedQuestionIds` **必须先在 app 库验证存在**（`sqlite3 "$APPDATA/com.shuaba.math/shuaba.db" "SELECT id FROM questions WHERE id IN (...)"`），无法验证就不要回传。荐题后用户在 app：Codex 收件箱 → 确认 → 题组进入今日训练。

## 八、工作方式约定

- **改 UI 前先看现状**：大改先出方案确认再动手；改完必须 `npm run build` + `cargo test` 验证，视觉改动要看截图/实测
- **DB 探索只读**：`sqlite3` 只跑 SELECT；所有对 DB 的写操作只通过 app 自身命令
- 大文件（安装包/便携版）永不进 git；构建产物放 `releases/`（已忽略）
- 敏捷交付：每个功能独立 commit（中文 conventional 风格），随时可回滚

## 九、学员微观战力画像维护契约 (characteristic.md)

1. **输入阶段（推荐与批改前）**：
   - 每次生成自适应题组、推送题目或深度批改草稿前，**优先读取仓库根目录 `characteristic.md`**：
     - **正反双向感知**：不仅读取弱项，更要感知学员的 **「五大实战王牌武器库」** 与 **「真实章节细粒度掌握度大盘」**，充分调动学员优势并识别真实短板；
     - **严禁虚假 100% 封盘**：大纲各章节必须严格基于 SQLite 真实作答证据拆解细粒度考法（🟢 已固化 / 🟡 曾翻车不稳定 / 🔴 高危断点 / ⬜ 未实测），严禁凭几道题的正确盲目声称全章 100% 封盘；
     - **排期抽检优先**：出题时优先参考 **「48~72 小时间隔复习排期表」** 调取变式题，其次覆盖 **Level 1 致命考法断点**（E-003, E-004, E-010 等），严禁重复推送同构低价值题。
2. **输出阶段（批改完成后）**：
   - 批改生成 JSON 战报写入收件箱后，**必须实时同步更新 `characteristic.md`**：
     - **三级断点分流归类**：新增断点必须精准归入 **Level 1 致命考法断点**、**Level 2 战术展开效率** 或 **Level 3 代数执行精度**，并注入精准的「⚡ 神经反射补丁」；
     - **推进生命周期与复习排期**：若历史弱项在变式中成功纠偏，升级为 `[🟡 观察中]` 并写入 48~72 小时抽检排期；连续 2 次独立避坑成功后方可升级为 `[🟢 已固化]`；
     - **节奏基准对齐**：对比学员题型实战耗时与考研基准耗时，客观诊断熟练度。
   - **对话报告显式反馈**：在文字总结中，专门列出 **【🌟 本轮战力突破 / 成功改正】** 与 **【⚠️ 本轮新增微观断点与补丁】**。
3. **学员亲笔自省小结沉淀契约**：
   - 学员在做题订正后写下的个人反思小结，是最高维度的第一手认知证据。
   - Agent 收到学员小结后，必须将其原汁原味同步记录到 `characteristic.md` 第六节「学员亲笔实战反思与自省真言」，并在后续推题中深度采纳学员自省结论。



# 刷吧 Codex 协作约定

刷吧是独立的数一桌面刷题 App。题库源目录 `E:\考研资料\题库-大观园` 只读，禁止修改其中的 JSON 与图片。刷吧不连接 Obsidian 或拾遗录。

## 🎯 批改与诊断核心原则（单题与整组通用）

无论在**高压演练（模考）**还是**日常正常刷题**，当用户要求“批改草稿并发送给刷吧”时，均遵循以下最高标准：

1. **LaTeX 数学公式规范（极其重要）**：
   - 摘要 (`summary`)、最早错误步骤 (`earliestError`)、修复动作 (`advice`)、更优解法 (`betterSolution`) 以及分析文本中的**所有数学符号、变量名、公式、计算式、递推式、极限与矩阵**，必须严格使用标准 LaTeX 格式包裹（行内公式使用 `$...$`，独立块级公式使用 `$$...$$`）。
   - 严禁在数学式中使用未经 LaTeX 包裹的裸文本（例如禁止写 `x^2`, `int 0 to pi`, `1/(x+2)`，必须写 `$x^2$`, `$\int_0^\pi$`, `$\frac{1}{x+2}$`）。
   - JSON 字符串中反斜杠使用合法单个 LaTeX 反斜杠（如 `\frac`, `\sin`, `\int`）。
2. **深度步骤与断点定位**：
   - 结合草稿图片逐行精细核对推理逻辑，定位**最早出现的错误断点**，而非仅判断最终答案。
   - 深入剖析题意理解、方法选择、条件遗漏、符号计算、循环论证、推理跳步等根因；无法确定时明确使用 `uncertain`，不要猜测步骤或知识点。
3. **熟练度与节奏诊断**：
   - 综合题目的「实际作答耗时」与题目基准时间（单选3分、多选4分、填空5分、解答10分）评估流畅度。
   - 若耗时偏长，深度分析是否存在方法严重绕路、繁琐硬算或多余代换；若做错且耗时极短，指出是否属于粗心抢快；并在 `selfRating` 给出 Codex 流畅度评估（1-4分）。
4. **更优解法与秒杀建议 (`betterSolution`)**：
   - 为做错或方法绕路的题目提供考场极速秒杀思路、待定系数法、二重积分交换次序、King 变换、导数和拆项等极简技巧。若当前解法已足够精炼则填写 `null`。
5. **可执行修复动作 (`advice`)**：
   - 提供一条精准、直接、可落地执行的专项修复动作。

---

## 📥 向刷吧回传数据格式

- 只写一个 UTF-8 JSON 文件到任务指定路径。若未提供路径，写入 `%APPDATA%\com.shuaba.math\codex-inbox\{taskId}.json`。
- 不修改题库源文件或刷吧数据库。

### 1. 单题批改结果格式（`kind: "analysis"`）

```json
{
  "schemaVersion": 1,
  "kind": "analysis",
  "taskId": "SB-YYYYMMDD-questionId-random",
  "questionId": 155,
  "summary": "简要诊断（含 $LaTeX$ 公式）",
  "verdict": "correct|partial|incorrect|uncertain",
  "earliestError": "最早错误步骤（含 $LaTeX$ 公式）或 null",
  "errorTags": ["概念边界"],
  "weaknessTags": ["幂零矩阵"],
  "advice": "一条可执行的修复动作（含 $LaTeX$ 公式）",
  "betterSolution": "更优解法或更简洁秒杀思路（含 $LaTeX$ 公式）或 null",
  "confidence": 0.95,
  "recommendedQuestionIds": [],
  "recommendationReason": null
}
```

### 2. 整组批改回传格式（`kind: "batch"`）

批量任务编号形如 `SB-BATCH-YYYYMMDD-random`。草稿张数少于题目数时只批改上传了草稿的题，未收到草稿的题不要出现在 `batchAttempts` 中：

```json
{
  "schemaVersion": 1,
  "kind": "batch",
  "taskId": "SB-BATCH-YYYYMMDD-random",
  "summary": "整组批改摘要（含 $LaTeX$ 公式）",
  "errorTags": ["方法未掌握"],
  "weaknessTags": ["定积分对称性与King变换"],
  "confidence": 0.95,
  "recommendedQuestionIds": [],
  "batchAttempts": [
    {
      "questionId": 155,
      "result": "correct|wrong|uncertain",
      "selfRating": 2,
      "durationSeconds": 120,
      "summary": "简要诊断（含 $LaTeX$ 公式）",
      "verdict": "correct|partial|incorrect|uncertain",
      "earliestError": "最早错误步骤（含 $LaTeX$ 公式）或 null",
      "errorTags": ["方法绕路"],
      "weaknessTags": ["待定系数法"],
      "advice": "一条可执行的修复动作（含 $LaTeX$ 公式）",
      "betterSolution": "更优解法或更简洁秒杀思路（含 $LaTeX$ 公式）或 null",
      "confidence": 0.95
    }
  ]
}
```

`result` 只能取 `correct`、`wrong` 或 `uncertain`；`selfRating` 为 1-4。`uncertain` 的题不会写入作答记录，仅保留诊断信息。

### 3. 推荐结果格式（`kind: "recommendation"`）

```json
{
  "schemaVersion": 1,
  "kind": "recommendation",
  "taskId": "SB-REC-YYYYMMDD-random",
  "questionId": null,
  "summary": "本次荐题策略",
  "verdict": null,
  "earliestError": null,
  "errorTags": [],
  "weaknessTags": ["薄弱知识"],
  "advice": null,
  "betterSolution": null,
  "confidence": 0.9,
  "recommendedQuestionIds": [155, 156],
  "recommendationReason": "推荐理由"
}
```

`recommendedQuestionIds` 必须来自刷吧题库中的真实 ID。若无法验证 ID，不要生成推荐回传。

---

## 🛠️ 工程验证与构建

- 前端：`npm run build`
- 桌面打包：`npm run app:build`
- Rust 测试：在 `src-tauri` 中运行 `cargo test --locked`

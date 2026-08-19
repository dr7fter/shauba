# 刷吧 Codex 协作约定

刷吧是独立的数一桌面刷题 App。题库源目录 `E:\考研资料\题库-大观园` 只读，禁止修改其中的 JSON 与图片。刷吧不连接 Obsidian 或拾遗录。

## 向刷吧回传数据

当用户要求“批改草稿并发送给刷吧”或“给刷吧推荐题目”时：

1. 优先使用用户或 App 给出的任务编号、题目 ID 和输出路径。
2. 结合题目与草稿图片分析。无法确定时明确使用 `uncertain`，不要猜测步骤或知识点。
3. 只写一个 UTF-8 JSON 文件到任务指定路径。若未提供路径，先读取 `%APPDATA%\com.shuaba.math\codex-inbox` 是否存在；不存在则要求用户先运行一次刷吧。
4. 不修改题库源文件或刷吧数据库。

批改结果格式：

```json
{
  "schemaVersion": 1,
  "kind": "analysis",
  "taskId": "SB-YYYYMMDD-questionId-random",
  "questionId": 155,
  "summary": "简要诊断",
  "verdict": "correct|partial|incorrect|uncertain",
  "earliestError": "最早错误步骤或 null",
  "errorTags": ["概念边界"],
  "weaknessTags": ["幂零矩阵"],
  "advice": "一条可执行的修复动作",
  "confidence": 0.9,
  "recommendedQuestionIds": [],
  "recommendationReason": null
}
```

推荐结果格式：

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
  "confidence": 0.9,
  "recommendedQuestionIds": [155, 156],
  "recommendationReason": "推荐理由"
}
```

`recommendedQuestionIds` 必须来自刷吧题库中的真实 ID。若无法验证 ID，不要生成推荐回传。

整组批改回传格式（批量任务编号形如 `SB-BATCH-YYYYMMDD-random`，草稿张数少于题目数时只批改上传了草稿的题，未收到草稿的题不要出现在 `batchAttempts` 中）：

```json
{
  "schemaVersion": 1,
  "kind": "batch",
  "taskId": "SB-BATCH-20260815-0001",
  "summary": "整组批改摘要",
  "batchAttempts": [
    {
      "questionId": 155,
      "result": "correct|wrong|uncertain",
      "selfRating": 2,
      "summary": "简要诊断",
      "verdict": "correct|partial|incorrect|uncertain",
      "earliestError": "最早错误步骤或 null",
      "errorTags": ["概念边界"],
      "weaknessTags": ["幂零矩阵"],
      "advice": "一条可执行的修复动作",
      "confidence": 0.9
    }
  ]
}
```

`result` 只能取 `correct`、`wrong` 或 `uncertain`；`selfRating` 为 1-4。`uncertain` 的题不会写入作答记录，仅保留诊断信息。

## 验证

- 前端：`npm run build`
- Rust：在 `src-tauri` 中运行 `cargo test --locked`
- 桌面开发：`npm run app`

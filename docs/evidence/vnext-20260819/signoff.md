# 刷吧 v0.7.0 RC 验收签字与证据索引

- 验收执行日期：2026-08-19
- 验收执行人：Codex
- 源码基线：`45170a3`（vNext 前基线）至 `v0.7.0-rc.1`（本次 RC 标签）
- 数据库：`data/isolated-fixture/` 下的隔离夹具；未对用户生产数据库执行迁移或恢复试验
- 题库源：`E:\考研资料\题库-大观园`，全程只读
- 结论：**v0.7.0 RC 有条件通过；不等同于最终公开版全部完成**

## 1. 门槛结论

| 门槛 | 结论 | 说明 |
|---|---|---|
| P0 恢复信任 | PASS | 证据模型、奖励账本、异常时长、迁移回退、恢复前保护和题库哈希均有自动化或原始数据证据 |
| P1 主流程成立 | PASS | 今日任务、SQLite 会话恢复、AI 确认到修复、复盘状态链、行动建议和掌握证据均已落地 |
| P2 计划内品质 | PASS | 四档窗口、键盘、ARIA、主题/字号/动效/音效、构建拆分均通过 |
| P2 扩展能力 | DEFERRED | 完整真模考、公式间隔复习、考试阶段自适应未进入 v0.7.0 RC；不得宣传为已完成 |
| 产品签字 | PENDING | 产品负责人姓名与放行决定必须由用户本人确认，Codex 不代签 |

## 2. 自动化与构建

| 检查 | 结果 | 原始证据 |
|---|---|---|
| `npm run lint` | PASS，0 warning | `build/lint.txt` |
| `npm run test` | PASS，前端共享逻辑 5/5，Rust 27/27 | `build/frontend-test.txt` |
| `npm run build` | PASS，最大 JS chunk 327.87 kB | `build/build.txt` |
| `cargo test --locked` | PASS，27/27 | `build/cargo-test.txt` |
| `cargo fmt --check` / `git diff --check` | PASS | 验收终端复核，无格式或空白错误 |
| `npm run app:build` | PASS，MSI 与 NSIS 均生成 | `build/installer-manifest.json` |

Rust 仅输出 Windows MSVC 链接器生成 `.lib/.exp` 的信息性 warning；没有测试、代码或打包 warning。

## 3. P0 证据

| 用例 | 结论 | 证据 |
|---|---|---|
| AC-P0-UI-01 / UI-02 | PASS | `visual/visual-regression-report.json` 与四档截图 |
| AC-P0-EVID-01 | PASS | `tests/evidence_model.test.js`；未选屏幕答案得到 `uncertain/self_report`，不会自动记错 |
| AC-P0-EVID-02 | PASS | 共享证据逻辑测试证明人工结果覆盖屏幕建议 |
| AC-P0-EVID-03 | PASS | Rust 测试证明 `uncertain + fluency 4` 不创建掌握进度 |
| AC-P0-DATA-01 / DATA-02 | PASS | SQLite 目标单一来源；时长夹紧与会话恢复测试 |
| AC-P0-REWARD-01 / REWARD-02 | PASS | `data/reward-events.json`；重复事件写入 0 行，空纪录显示空状态 |
| AC-P0-EXAM-01 | PASS | 未配置显示“未设置”；配置、清空均由设置入口控制 |
| AC-P0-DURATION-01 | PASS | `data/duration-exclusion.json`；原始异常行保留，聚合排除 2 行 |
| AC-P0-SOURCE-01 | PASS | `source/hash-verification.log`；1,308/1,308 文件一致，0 差异 |
| AC-P0-ENG-01 | PASS | `data/migration-after.json` 与 `data/backup-restore.log`；失败回滚且损坏备份切换前拒绝 |

## 4. P1 / P2 证据

- 复盘首屏用“AI 待确认 -> 修复排期 -> 到期重测 -> 已攻克”串联状态，并可直接进入对应动作。
- 已确认的单题 Codex 诊断提供“现在修复”，一键进入三道同考点变式题。
- 掌握详情显示证据等级、可评分样本数、来源和间隔重测次数；`uncertain` 明示不计入正确率与掌握进度。
- 洞察首屏不超过三条行动建议，每条含依据、置信度、预计耗时和可执行按钮。
- 四档共 20 张主页面截图均为 0 横向溢出、0 裁切按钮、0 可见纯图标 ARIA 缺失、0 低于 36 px 的主按钮。
- 840x620 全键盘流程按 Space、3、Enter、Enter 完成，题目从 `#155` 前进至 `#1284`；见 `visual/keyboard-flow-report.json`。
- 深色与暖纸主题、减少动效、关闭音效均在 reload 后保持；见 `visual/visual-interaction-report.json`。

## 5. 数据与恢复证据

- 迁移前后均为 2 条作答且 `integrity_check=ok`；旧记录回填为 `legacy`，没有伪造数字或 Codex 来源。
- 注入迁移语法错误后事务回滚，`outcome` 列不存在，原 2 条作答仍可读。
- 恢复夹具先创建 pre-restore 快照，再切换到校验通过的备份；损坏备份被预检拒绝，当前数据库哈希不变。
- 启动滚动备份保留策略由 Rust 测试验证为“最近 7 份 + 4 个周锚点”。

## 6. 安装包

| 文件 | SHA-256 |
|---|---|
| `刷吧_0.7.0_x64_zh-CN.msi` | `2DDE84B531660CFC36097978325A1ACC74C9B5A6DF5C94D809B5E81A88B89580` |
| `刷吧_0.7.0_x64-setup.exe` | `53F0F82A08F769615E5A93A830D8F3B3F437D72F4E4386F2F6F46D8CAAC6CE61` |

版本 `0.7.0` 已在 `package.json`、`tauri.conf.json`、`Cargo.toml`、`Cargo.lock` 与安装包文件名中保持一致。

## 7. 遗留与放行限制

| 用例/范围 | 级别 | 状态 | 风险与补偿 | 责任人 / 目标 |
|---|---|---|---|---|
| 完整真模考会话 | P2 | DEFERRED | 当前只有 15 分钟真题闪击战；不得称为完整模考 | 产品负责人确认优先级后排入 v0.8.0 |
| 公式间隔复习 | P2 | DEFERRED | 当前只有公式速查，不会提升题目掌握度 | 产品负责人确认优先级后排入 v0.8.0 |
| 考试阶段自适应 | P2 | DEFERRED | 当前阶段仅用于提示，不自动改变任务配比 | 产品负责人确认优先级后排入 v0.8.0 |
| 产品负责人签字 | 发布门槛 | PENDING | 未签字前只能作为 RC，不宣布正式公开版 | 用户本人，2026-08-19 后确认 |

这些遗留项不影响当前正确率、数据安全或题库源只读，但阻止将 v0.7.0 宣传为“全部 vNext 扩展能力已完成”。

## 8. 签字

| 角色 | 姓名 | P0 | P1 | P2 计划内品质 | 日期 | 备注 |
|---|---|---|---|---|---|---|
| 产品负责人 | 待用户签字 | 待确认 | 待确认 | 待确认 |  | 不由 Codex 代签 |
| 开发负责人 | Codex | PASS | PASS | PASS | 2026-08-19 | v0.7.0 RC |
| 验收执行人 | Codex | PASS | PASS | PASS | 2026-08-19 | 扩展项按第 7 节延期 |

# scripts/ 使用说明

> 本目录由多个 AI Agent 长期协作累积而成，**大部分是一次性脚本**。
> 动这里之前请先看下面两节，尤其是「常驻工具」——删错会导致发版或测试链路断裂。

---

## 一、常驻工具（12 个，路径被硬引用，不要移动或删除）

| 文件 | 引用方 | 用途 |
|---|---|---|
| `release.mjs` | `package.json`、`AGENTS.md` 第六节 | 发版：构建 + 签名 + 生成 `latest.json` |
| `check-design-system.cjs` | `package.json` → `npm run check:ui` | 设计 token 合规检查 |
| `visual_regression.cjs` | `package.json` → `npm run screenshots` | UI 视觉回归截图 |
| `generate_acceptance_evidence.cjs` | 验收流程 | 生成验收证据包 |
| `analyze_progress.py` | 每周体检 | 刷题数据体检（正确率、错题回头率、技能点证据数） |
| `replay_elo_params.py` | 改 ELO 参数前必跑 | ELO 参数离线回放对比 |
| `replay_rating_params.py` | 改 rating 参数前必跑 | Rating 3.0 新旧参数离线回放对比（数据源：`.workbuddy/tmp/rating_probe.db` 只读副本，跑之前先用 sqlite3 `.backup` 刷新副本） |
| `probe_six_dims.py` | 六维证据区分度诊断 | 同上数据源 |
| `replay_v150_learning.py` | v1.5.0 学习闭环回放 | 原引用文档 `docs/v1.5.0-*.md` 已于 2026-09-02 删除，约束摘录见 `.agent/08-产品约束摘录.md` |
| `verify_bank.cjs` | 题库校验 | 题库完整性校验 |
| `select_bundle.cjs` | 组卷 | 题组挑选 |
| `analyze_rational.cjs` | 分析 | 推导链分析 |

> 原引用文档 `docs/v1.5.0-双引擎学习闭环执行说明书.md` 已于 2026-09-02 删除
> （备份在 `.workbuddy/backup-20260902/docs/`）。脚本路径硬编码风险已解除，
> 但移动 `replay_v150_learning.py` 前仍建议全局搜一遍引用。

---

## 二、一次性脚本（约 141 个）

> **2026-09-02 归档**：已把 32 个明确的一次性排查脚本移入 `scripts/archive/`
> （`_tmp_*` / `check_q<题号>.py` / `inspect_*` / `render_*` / `find_answer_pages.py`）。
> **2026-09-04 全部归档**：其余 143 个一次性脚本已全部移入 `archive/`（移动非删除）。
> 根目录从此**只住上表 12 个常驻工具 + README.md**。
> 新的一次性脚本请直接放 `prototype/`（沙盒）或建日期目录，**不要再往 `scripts/` 根写**。

被归档脚本的前缀分布（`2026-08-29` 统计，供在 `archive/` 里找东西用）：

| 前缀 | 数量 | 含义 |
|---|---|---|
| `check_` | 23 | 只读校验 / 探查 |
| `verify_` | 21 | 写入后的结果验证 |
| `search_` | 20 | 候选题检索 |
| `inspect_` | 17 | 单条数据细看 |
| `write_` | 14 | 生成题组 JSON |
| `list_` | 10 | 枚举 |
| `push_` | 8 | 推送到 App 收件箱 |
| `update_` | 6 | 回写 `characteristic.md` |
| `prep_` / `append_` / `rotate_` / `analyze_` | 各 3–4 | 照片处理 / 画像追加 / 旋转 / 分析 |

**历史痕迹**：31 个脚本带 4 位随机数字后缀（`write_batch_6191.py` 等），
是不同 Agent 临时生成时随手编号留下的。**数字本身没有含义**，不代表批次号或日期。

**典型链路**（组一次卷的完整流程）：
```
search_<主题>.py      # 从题库检索候选
  → write_batch_<id>.py   # 生成题组 JSON
  → push_<主题>.py        # 推送到 codex-inbox
  → verify_batch_<id>.py  # 校验入库结果
  → update_char_<id>.py   # 回写学员画像
```

---

## 三、命名规范（新脚本请遵守）

| 类别 | 格式 | 示例 |
|---|---|---|
| 常驻工具 | `<动作>-<对象>.<ext>` | `check-design-system.cjs` |
| 常驻工具（Python） | `<动作>_<对象>.py` | `analyze_progress.py` |
| 一次性脚本 | `<动作>_<对象>_<YYYYMMDD>.py` | `write_batch_20260829.py` |

**禁止**：4 位随机数字后缀；以下划线开头的长期文件。

---

## 四、删除前的自检

删任何脚本前确认三件事：

1. 不在上表「常驻工具」里
2. `grep -r "<脚本名>" scripts/ package.json AGENTS.md docs/` 无引用
3. 它指向的外部路径还存在（历史教训：`E:\考研资料\题库-信号` 被清理后，
   14 个指向它的脚本全部失效，已于 2026-08-29 删除，备份在
   `.workbuddy/tmp/backup-20260829/`）

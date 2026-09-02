# 03 · 评分与 ELO 参数

> 从 `AGENTS.md` 第四节拆出。只在**调参 / 做评分相关开发**时读这份。

## ⚠️ ELO 的定位（用户 2026-08-30 明确纠正，勿再搞错）

**ELO 是游戏化段位，作用是增加做题动力，不是用来评价真实水平的。**

- 难度杠杆（难度越高 → 期望越低 → 攻克难题收益更大）是**刻意设计，不是 bug**
- 「做错题反而涨分」「秒杀题只涨 1 分」**不要当成问题写进复盘**
- **诊断分析一律不引用 ELO**：不拿 delta 大小、不拿段位涨跌说事
- 评价真实水平用 `ai_rating` + 首次作答正确率 + 断点修复情况

---

## 分工原则

**AI 打证据分，内核当裁判。** Codex 通过提示词锚点给六维分与 rating；
跨时间记账（聚合、ELO、段位）全部由确定性内核处理。

**评分回退链**（前后端一致）：`六维 HLTV 合成 > Codex rating > 特征曲线`。

> ⚠️ 若批改输出缺六维，会回退到「特征曲线」，等于 v1.6.8 / v1.6.9 两轮评分重构作废。
> 回传批改 JSON 时必须带 `dimensions`（见 `02-批改与诊断.md`）。

## HLTV 3.0 合成（`rating.rs` HLTV3_* 常量区 + `hltv_rating`）

输入为六维证据 `DimensionEvidence`（rigor / computation / modeling / method_use /
speed / strategy_insight，0–100）+ `technique_level`（1–5 整数），任一维非空即走此链：

```
Cast     = correct=100 / partial=38+0.12×computation / uncertain=30 / wrong=10
Impact   = 0.60×strategy_insight + 0.40×method_use
           technique_level≥4 加 6
           难度系数≥1.06 且非 wrong 触发 Clutch 残局加成 +6
KAST     = 0.50×rigor + 0.30×computation + 0.20×modeling
Pacing   = 优先取 speed 维；否则 (基准耗时/实际耗时)×100，clamp [45, 115]
EcoDrag  = 做错且超时>1.2×基准：((耗时/基准)−1)×24，clamp 后封顶 36
           做错未严重超时固定 8；做对为 0

P = 0.38×Cast + 0.22×Impact + 0.20×KAST + 0.20×Pacing − EcoDrag
rating = clamp(0.26 + 0.0125×P) × 难度系数(0.94–1.10)
```

- 缺失维度按 outcome 给**保守默认值**（不是猜 75）
- **Donk 爆发条款**：correct 且 base>1.40 且 technique_level≥4 且 Pacing≥125 时，
  允许突破 2.00 上限达 2.05–2.45

## ELO 天梯（`lib.rs` 常量区 + `settle_elo`）

| 参数 | 值 |
|---|---|
| 起点 ELO_START | 1400（C 段） |
| K 值 | 定级期 30（前 10 次结算）→ 常态 10 |
| 期望公式 | `anchor + 0.04×(mastery−2) − 2.50×(难度系数−1)`，clamp [0.20, 0.80]，review 模式 +0.06；`anchor` = 近 30 次 `performance/2` 的中位数 ×0.70 + 0.50×0.30，样本 <10 时取 0.50 |
| 连胜动量 | 近 5 次连续≥3 同向 → K×1.15（`ELO_MOMENTUM_*`） |
| 晋级保护 | 升段后 3 次结算免负分 |
| 段位 | D<1000 … C+1401 … S≥2401 九段 |
| 赛季软重置 | 向 1400 收敛，保留与起点差距的 75%（`SEASON_RESET_PULL`） |
| 分数换算 | score = clamp(performance/2, 0, 1.25)，delta = round(K×(score−expected)) |

**历史 ELO 不重算**：从上线之日起按新规则演化。需要校准应单独提供入口。

### 历史修正记录

v1.6.8 修复 ELO 退化为**单向棘轮**的问题（94 次结算中做对 44 次全部涨分、做错 50 次中 24 次仍在涨分）：

1. **结果闸门**（`ELO_WRONG_DELTA_FLOOR = -1.0` / `ELO_CORRECT_DELTA_FLOOR = 0.5`）：
   对 delta 的**符号**设下界——做错至少扣 1 分、做对至少加 0.5 分。
   partial / uncertain 不设闸门。
2. **难度杠杆放大 10 倍**（`ELO_EXPECTED_DIFFICULTY_STEP` 0.25 → 2.50）：
   原步长下最难题与最易题期望差仅 0.073，放大后达 ±0.40。

v1.6.9 新增**自适应期望锚点**：近 30 次 performance 折算 score 后的**中位数**
（混合 30% 固定基线防漂移），样本 <10 退回 0.50。取中位数而非均值：
表现分约 21% 落在崩盘区（<0.8），均值会被拉偏。

| 参数 | 做对均变动 | 做错均变动 | 做错仍涨分 | 崩塌期总变动 |
|---|---|---|---|---|
| v1.6.7 原始 | +2.75 | −0.06 | 49% | +14 |
| v1.6.8 | +3.58 | −1.04 | 0% | +14 |
| v1.6.9 | +2.76 | −1.22 | 0% | **−10** |

**一处必须更正的表述**：初版报告称 ELO「与实际水平完全脱钩」是**不准确**的。
三套参数下每日 ELO 增量与当日正确率相关系数都在 +0.70 左右——方向一直是对的。
准确表述是「**方向对，但基线偏了**」。

**出题科目均衡（v1.6.8）**：`recommendations()` 加入按数一分值占比的覆盖缺口权重
（高数 56% / 线代 22% / 概率 22%，`SUBJECT_GAP_WEIGHT = 45.0`）。
缺口 = `max(0, 分值占比 − 该科在已做题目中的占比)`，只奖励缺口不惩罚超额。
「历年真题」不参与加权（三科混合）。

**提示词锚点位置**：`lib.rs` 搜 `HLTV Rating 3.0 定位`（约 7265 / 7368 行两处：单题与整组）。
rating 锚 0.50 / 0.80 / 1.00 / 1.15–1.25 / 1.30–1.45 / 1.50–1.65 / 2.00–2.45。

---

## 改参数前必须先回放

```bash
python scripts/replay_elo_params.py                  # 自动复制线上库后回放
python scripts/replay_elo_params.py path/to/copy.db  # 指定副本
```

用 `elo_events` 的真实 performance / expected 离线复现 `settle_elo`，
先校验公式复现误差，再对比多套参数。评估新参数时扩展脚本里的 `configs` 列表。

**看结果的正确姿势**：别只看累计 ELO 曲线形状（平均 delta 为正就必然单调上涨，
不等于脱钩）。要拆成**每日增量 vs 当日正确率**看相关性，
重点看**水平下滑期分数有没有跟着掉**。

**已知近似误差**：脚本用 `progress.mastery` 当前值近似历史值（mastery 时变，无法还原），
v1.6.7 口径平均绝对误差约 0.04（最大 0.23）。**相对比较可信，绝对值有偏差。**

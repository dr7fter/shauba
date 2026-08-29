# -*- coding: utf-8 -*-
"""
ELO 参数离线回放验证

用途：在真正改动 settle_elo 参数前，用 elo_events 里已有的真实结算数据
离线复现三套参数，对比哪一套让天梯分真正跟随水平。

校验顺序：
  ① 先复现 v1.6.7 的 expected，与数据库中实存的 expected 比对，确认公式复现可信；
  ② 再用同一套复现逻辑跑 v1.6.8（结果闸门 + 难度杠杆 ×10）与 +自适应锚点；
  ③ 核心指标：每日 ELO 增量 vs 当日正确率 的相关系数。

只读，不写任何数据库。

用法：
    python scripts/replay_elo_params.py                  # 自动复制线上库到临时目录后回放
    python scripts/replay_elo_params.py path/to/copy.db  # 指定已复制好的数据库副本

注意：WAL 模式下只复制主库会丢最新数据；直接读线上库也有风险。因此默认会
先把 shuaba.db 与 shuaba.db-wal 一起复制到临时目录再分析。
"""
import os
import shutil
import sqlite3
import statistics
import sys
import tempfile

APPDATA_DB = os.path.join(os.environ.get("APPDATA", ""), "com.shuaba.math", "shuaba.db")


def prepare_db(path: str) -> str:
    """指向线上库时先复制一份（含 -wal）到临时目录，绝不直接读原库。"""
    if os.path.abspath(path) != os.path.abspath(APPDATA_DB):
        return path
    tmpdir = tempfile.mkdtemp(prefix="shuaba_replay_")
    dst = os.path.join(tmpdir, "a.db")
    shutil.copy2(path, dst)
    wal = path + "-wal"
    if os.path.exists(wal):
        shutil.copy2(wal, dst + "-wal")
    print(f"已复制线上库到临时目录：{dst}\n")
    return dst


DB = prepare_db(sys.argv[1] if len(sys.argv) > 1 else APPDATA_DB)

ELO_START = 1400.0
ELO_K_CALIBRATION = 30.0
ELO_CALIBRATION_SETTLEMENTS = 10
ELO_K = 10.0
ELO_EXPECTED_BASE = 0.50
ELO_EXPECTED_MASTERY_STEP = 0.04
ELO_EXPECTED_MIN, ELO_EXPECTED_MAX = 0.20, 0.80
ELO_MOMENTUM_MULTIPLIER = 1.15
ELO_MOMENTUM_MIN_STREAK = 3
ELO_PROMOTION_PROTECTION = 3
ELO_WRONG_DELTA_FLOOR = -1.0
ELO_CORRECT_DELTA_FLOOR = 0.5

BANDS = [1000.0, 1201.0, 1401.0, 1601.0, 1801.0, 2001.0, 2201.0, 2401.0]

# 自适应锚点参数（待评估）
ANCHOR_WINDOW = 30
ANCHOR_MIN_SAMPLES = 10
ANCHOR_BLEND = 0.70  # 自适应锚点权重，其余给固定基线，防止锚点自身漂走


def band_index(rating: float) -> int:
    idx = 0
    for i, b in enumerate(BANDS):
        if rating >= b:
            idx = i + 1
    return idx


def load_rows():
    conn = sqlite3.connect(DB)
    rows = conn.execute(
        """
        SELECT e.id, e.attempt_id, e.question_id, e.delta, e.rating_after,
               e.performance, e.expected, e.created_at,
               a.result, a.difficulty_multiplier, a.attempted_at
        FROM elo_events e
        LEFT JOIN attempts a ON a.id = e.attempt_id
        ORDER BY e.id ASC
        """
    ).fetchall()
    mastery = {
        qid: (m if m is not None else 2)
        for qid, m in conn.execute("SELECT question_id, mastery FROM progress")
    }
    # 每日正确率（用于相关性计算）
    daily = {}
    for d, res in conn.execute("SELECT attempted_at, result FROM attempts"):
        day = (d or "")[:10]
        if not day:
            continue
        acc = daily.setdefault(day, [0, 0])
        acc[0] += 1
        if res == "correct":
            acc[1] += 1
    conn.close()
    return rows, mastery, {d: (v[1] / v[0] if v[0] else 0.0) for d, v in daily.items()}


def replay(rows, mastery, *, diff_step, gate, adaptive):
    """复现 settle_elo。返回 (history, expected_samples)
    history: [(date, elo_after, performance, result), ...]
    """
    elo = ELO_START
    history = []
    expected_samples = []  # (重算值, 实存值) 仅 diff_step=0.25 且非自适应时有意义
    deltas = []
    recent_perf = []
    protection_left = 0

    for i, r in enumerate(rows):
        (_eid, _aid, qid, _delta_db, _rating_db, perf, exp_db, created_at,
         result, dm, attempted_at) = r

        # K 值：定级期
        k = ELO_K_CALIBRATION if i < ELO_CALIBRATION_SETTLEMENTS else ELO_K
        # 连胜/连败动量
        if deltas:
            head = deltas[-1]
            if head != 0:
                streak = 0
                for d in reversed(deltas[-5:]):
                    if (d > 0) == (head > 0):
                        streak += 1
                    else:
                        break
                if streak >= ELO_MOMENTUM_MIN_STREAK:
                    k *= ELO_MOMENTUM_MULTIPLIER

        score = max(0.0, min(1.25, perf / 2.0))
        m = mastery.get(qid, 2)
        dm = dm if dm else 1.0

        if adaptive and len(recent_perf) >= ANCHOR_MIN_SAMPLES:
            median_score = statistics.median(
                [p / 2.0 for p in recent_perf[-ANCHOR_WINDOW:]]
            )
            base = ANCHOR_BLEND * median_score + (1 - ANCHOR_BLEND) * ELO_EXPECTED_BASE
        else:
            base = ELO_EXPECTED_BASE

        expected = base + ELO_EXPECTED_MASTERY_STEP * (m - 2) - diff_step * (dm - 1)
        expected = max(ELO_EXPECTED_MIN, min(ELO_EXPECTED_MAX, expected))

        # 采集 v1.6.7 口径下的复现误差
        if not adaptive and abs(diff_step - 0.25) < 1e-9:
            expected_samples.append((expected, exp_db))

        delta = round(k * (score - expected))

        if gate:
            if result in ("wrong", "incorrect"):
                delta = min(delta, ELO_WRONG_DELTA_FLOOR)
            elif result == "correct":
                delta = max(delta, ELO_CORRECT_DELTA_FLOOR)

        band_before = band_index(elo)
        band_after = band_index(elo + delta)
        if band_after > band_before:
            protection_left = ELO_PROMOTION_PROTECTION
        elif delta < 0 and protection_left > 0:
            delta = 0.0
            protection_left -= 1

        elo = max(0.0, elo + delta)
        deltas.append(delta)
        recent_perf.append(perf)
        day = (attempted_at or created_at or "")[:10]
        history.append((day, elo, perf, result))

    return history, expected_samples


def daily_series(history):
    """按日聚合：返回 [(day, 当日ELO增量之和, 当日正确率), ...]"""
    by_day = {}
    for day, elo, perf, result in history:
        slot = by_day.setdefault(day, {"delta": 0.0, "n": 0, "correct": 0, "elo": elo})
        slot["delta"] += 0  # 增量在下面统一算
        slot["n"] += 1
        if result == "correct":
            slot["correct"] += 1
        slot["elo"] = elo
    days = sorted(by_day)
    out = []
    prev = ELO_START
    for d in days:
        s = by_day[d]
        out.append((d, s["elo"] - prev, (s["correct"] / s["n"] if s["n"] else 0.0) * 100, s["elo"]))
        prev = s["elo"]
    return out


def pearson(xs, ys):
    n = len(xs)
    if n < 3:
        return float("nan")
    mx, my = sum(xs) / n, sum(ys) / n
    num = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    dx = (sum((x - mx) ** 2 for x in xs)) ** 0.5
    dy = (sum((y - my) ** 2 for y in ys)) ** 0.5
    return num / (dx * dy) if dx and dy else float("nan")


def main():
    rows, mastery, _daily = load_rows()
    print(f"回放样本：{len(rows)} 次结算\n")

    # ① 公式复现校验
    _, samples = replay(rows, mastery, diff_step=0.25, gate=False, adaptive=False)
    if samples:
        errs = [abs(a - b) for a, b in samples]
        print("=== ① 公式复现校验（v1.6.7 口径）===")
        print(f"  样本数 {len(samples)}，平均绝对误差 {sum(errs)/len(errs):.4f}，"
              f"最大 {max(errs):.4f}")
        print("  （误差应接近 0；若偏大说明 mastery 用当前值近似历史值带来偏差）\n")

    configs = [
        ("v1.6.7 原始", dict(diff_step=0.25, gate=False, adaptive=False)),
        ("v1.6.8 闸门+杠杆", dict(diff_step=2.50, gate=True, adaptive=False)),
        ("+自适应锚点", dict(diff_step=2.50, gate=True, adaptive=True)),
    ]

    results = {}
    for name, cfg in configs:
        history, _ = replay(rows, mastery, **cfg)
        series = daily_series(history)
        xs = [s[2] for s in series]  # 当日正确率
        ys = [s[1] for s in series]  # 当日 ELO 增量
        r = pearson(xs, ys)
        results[name] = (history, series, r)

    print("=== ② 三套参数对比 ===")
    print(f"{'参数':<18}{'最终ELO':>10}{'总涨跌':>10}{'涨/跌/零':>16}{'与正确率相关性':>16}")
    for name, _ in configs:
        history, series, r = results[name]
        final = history[-1][1]
        deltas = []
        prev = ELO_START
        for _, elo, _, _ in history:
            deltas.append(elo - prev)
            prev = elo
        up = sum(1 for d in deltas if d > 0)
        down = sum(1 for d in deltas if d < 0)
        zero = sum(1 for d in deltas if d == 0)
        print(f"{name:<18}{final:>10.0f}{final-ELO_START:>+10.0f}"
              f"{f'{up}/{down}/{zero}':>16}{r:>+16.3f}")

    print("\n（相关性：ELO 增量与当日正确率的相关系数。"
          "理想为显著正值——水平好就涨分，差就跌分。"
          "负值代表分数与水平脱钩）\n")

    # ③ 逐日曲线对比
    print("=== ③ 逐日 ELO 曲线（对齐到同一批日期）===")
    base_series = results["v1.6.7 原始"][1]
    days = [s[0] for s in base_series]
    lines = {name: {s[0]: s[3] for s in results[name][1]} for name, _ in configs}
    accs = {s[0]: s[2] for s in base_series}
    print(f"{'日期':<12}{'正确率':>8}{'v1.6.7':>10}{'v1.6.8':>10}{'+自适应':>10}")
    for d in days:
        print(f"{d:<12}{accs[d]:>7.0f}%"
              f"{lines['v1.6.7 原始'].get(d, 0):>10.0f}"
              f"{lines['v1.6.8 闸门+杠杆'].get(d, 0):>10.0f}"
              f"{lines['+自适应锚点'].get(d, 0):>10.0f}")

    # ④ 做错题的代价
    print("\n=== ④ 做对 / 做错 的平均 ELO 变动 ===")
    print(f"{'参数':<18}{'做对':>12}{'做错':>12}{'做错仍涨分占比':>18}")
    for name, _ in configs:
        history = results[name][0]
        prev = ELO_START
        correct_ds, wrong_ds = [], []
        wrong_up = 0
        for _, elo, _, result in history:
            d = elo - prev
            prev = elo
            if result == "correct":
                correct_ds.append(d)
            elif result in ("wrong", "incorrect"):
                wrong_ds.append(d)
                if d > 0:
                    wrong_up += 1
        ca = sum(correct_ds) / len(correct_ds) if correct_ds else 0
        wa = sum(wrong_ds) / len(wrong_ds) if wrong_ds else 0
        ratio = (wrong_up / len(wrong_ds) * 100) if wrong_ds else 0
        print(f"{name:<18}{ca:>+12.2f}{wa:>+12.2f}{ratio:>17.0f}%")


if __name__ == "__main__":
    main()

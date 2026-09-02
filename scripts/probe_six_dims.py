"""六维证据区分度诊断：做对是否全高、做错是否全低、维度之间是否失去信息量。只读。"""
import sqlite3, statistics, json

conn = sqlite3.connect("file:E:/刷吧/.workbuddy/tmp/rating_probe.db?mode=ro", uri=True)

DIMS = ["dim_rigor", "dim_computation", "dim_modeling",
        "dim_method_use", "dim_speed", "dim_strategy_insight"]

rows = conn.execute(f"""
SELECT COALESCE(a.outcome,a.result), {', '.join(DIMS)}, a.technique_level,
       a.ai_rating, a.duration_seconds, q.question_type, a.question_id
FROM attempts a LEFT JOIN questions q ON q.id=a.question_id
WHERE COALESCE(a.outcome,a.result) IN ('correct','wrong','partial')
""").fetchall()

BENCH = {"single_choice": 180, "multiple_choice": 240, "fill_in": 300}

samples = []
for (outcome, *dimvals, tech, ai, dur, qtype, qid) in rows:
    dims = dict(zip(DIMS, dimvals))
    present = {k: v for k, v in dims.items() if v is not None}
    if present:
        samples.append({"outcome": outcome, "dims": present, "qid": qid,
                        "dur": dur, "bench": BENCH.get(qtype, 600)})

print(f"=== 样本: {len(samples)} 条作答带六维证据 (全库 {len(rows)} 条) ===\n")

# 1. 按结果分组的每维均值 + 组内标准差
print("=== 1. 每维 x 结果: 均值 / 组内标准差 / n ===")
print(f"{'维度':<20} {'correct':<16} {'partial':<16} {'wrong':<16}")
for d in DIMS:
    line = f"{d:<20}"
    for outcome in ("correct", "partial", "wrong"):
        vals = [s["dims"][d] for s in samples if s["outcome"] == outcome and d in s["dims"]]
        if vals:
            line += f"{statistics.mean(vals):>6.1f}±{statistics.pstdev(vals):<5.1f}(n={len(vals):<3})"
        else:
            line += f"{'—':<16}"
    print(line)

# 2. 同一条作答内部的维度极差（max-min）：区分度是否活着
print("\n=== 2. 单条作答的六维极差 (max-min) ===")
spreads = {}
for outcome in ("correct", "partial", "wrong"):
    sp = [max(s["dims"].values()) - min(s["dims"].values())
          for s in samples if s["outcome"] == outcome and len(s["dims"]) >= 4]
    if sp:
        spreads[outcome] = sp
        print(f"  {outcome:<8} median={statistics.median(sp):.0f}  "
              f"P25={statistics.quantiles(sp, n=4)[0]:.0f}  "
              f"P75={statistics.quantiles(sp, n=4)[2]:.0f}  "
              f"极差<15分占比: {sum(1 for x in sp if x < 15)/len(sp)*100:.0f}%")

# 3. 结果内能不能用六维预测表现好坏? 用 ai_rating 在同结果内的方差做参照
print("\n=== 3. 同结果内, rating 的方差 vs 单个六维的方差 (信息量对比) ===")
for outcome in ("correct", "wrong"):
    ai = [s for s in samples if s["outcome"] == outcome]
    # 同结果内 ai_rating 分布: 从 codex_inbox 取真实 rating 更准, 这里用 dim 合成近似
    for d in DIMS:
        vals = [s["dims"][d] for s in ai if d in s["dims"]]
        if len(vals) >= 5:
            print(f"  {outcome:<8} {d:<22} 组内极差 [{min(vals):.0f}, {max(vals):.0f}]  "
                  f"stdev={statistics.pstdev(vals):.1f}")

# 4. 典型样本: 做对与做错的六维画像各抽 3 条
print("\n=== 4. 典型画像 ===")
for outcome in ("correct", "wrong"):
    picked = [s for s in samples if s["outcome"] == outcome and len(s["dims"]) >= 5][:3]
    for s in picked:
        profile = " ".join(f"{k.split('_',1)[1][:4]}={v:.0f}" for k, v in sorted(s["dims"].items()))
        print(f"  [{outcome:<7}] q={s['qid']:<6} {profile}")

# 5. 维度间相关性（做对的样本内）: 如果全都在 0.9+, 说明维度没独立信息
print("\n=== 5. 做对样本内的维度间 Pearson 相关 (>=0.9 视为冗余) ===")
corr_pairs = []
by_q = {}
for s in samples:
    if s["outcome"] == "correct" and len(s["dims"]) == 6:
        by_q[s["qid"]] = s["dims"]
def pearson(xs, ys):
    n = len(xs); mx = sum(xs)/n; my = sum(ys)/n
    num = sum((x-mx)*(y-my) for x, y in zip(xs, ys))
    den = (sum((x-mx)**2 for x in xs) * sum((y-my)**2 for y in ys)) ** 0.5
    return num/den if den else 0
keys = DIMS
matrix = []
for i, a in enumerate(keys):
    row = []
    for b in keys:
        xs = [v[a] for v in by_q.values()]
        ys = [v[b] for v in by_q.values()]
        row.append(pearson(xs, ys))
    matrix.append(row)
print(f"{'':<16}" + "".join(f"{k.split('_',1)[1][:6]:>8}" for k in keys))
for i, a in enumerate(keys):
    print(f"{a.split('_',1)[1]:<16}" + "".join(f"{matrix[i][j]:>8.2f}" for j in range(len(keys))))
n_full = len(by_q)
print(f"  (n={n_full} 条六维齐全的做对作答)")

conn.close()

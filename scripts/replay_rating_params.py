"""Rating 3.0 候选参数离线回放：用 336 条真实作答对比新旧分布。只读。"""
import sqlite3, statistics
from collections import Counter

conn = sqlite3.connect("file:E:/刷吧/.workbuddy/tmp/rating_probe.db?mode=ro", uri=True)
BENCH = {"single_choice": 180, "multiple_choice": 240, "fill_in": 300}


def clamp(v, lo, hi):
    return max(lo, min(hi, v))


DEF = {"correct": (65.0, 75.0), "partial": (45.0, 48.0),
       "uncertain": (30.0, 35.0)}
DEF_OTHER = (18.0, 25.0)


def rating_v2(outcome, rig, comp, mod, met, spd, strat, tech, dur, bench, diff):
    """现行：线性加权 + 硬 clamp，Donk 门槛 125（不可达）"""
    d = clamp(diff if diff is not None else 1.0, 0.94, 1.10)
    sd, rd = DEF.get(outcome, DEF_OTHER)
    cast = 100.0 if outcome == "correct" else (
        38.0 + (comp or 50.0) / 100 * 12 if outcome == "partial" else
        30.0 if outcome == "uncertain" else 10.0)
    impact = 0.6 * (strat if strat is not None else sd) + 0.4 * (met if met is not None else sd)
    if (tech or 0) >= 4: impact += 6
    if d >= 1.06 and outcome != "wrong": impact += 6
    impact = clamp(impact, 0, 100)
    kast = clamp(0.5 * (rig if rig is not None else rd)
                 + 0.3 * (comp if comp is not None else rd)
                 + 0.2 * (mod if mod is not None else rd), 0, 100)
    dur = max(dur or bench, 1); bench = max(bench, 1)
    plausible = 5.0 <= dur <= 1800.0
    pacing = spd if spd is not None else (
        clamp((bench / dur) * 100, 45, 115) if plausible else 100.0)
    eco = (clamp(dur / bench - 1, 0, 1.5) * 24 if (plausible and dur > bench * 1.2) else 8.0) \
        if outcome in ("wrong", "incorrect") else 0.0
    compo = 0.38 * cast + 0.22 * impact + 0.20 * kast + 0.20 * pacing - eco
    base = 0.26 + 0.0125 * compo
    if outcome == "correct" and base > 1.40 and (tech or 0) >= 4 and pacing >= 125:
        r = (1.40 + (base - 1.40) ** 0.82 * 1.55) * d
    else:
        r = base * d
    return round(clamp(r, 0, 2.5) * 100) / 100, pacing


def soft_diff(diff, lo=0.92, hi=1.10, cap=1.24):
    """软压缩：区间内原样，超出部分按 45% 折算，最高 cap。取代硬 clamp。"""
    d = diff if diff is not None else 1.0
    if d < lo: return lo + (d - lo) * 0.45
    if d > hi: return min(cap, hi + (d - hi) * 0.45)
    return d


def rating_v3(outcome, rig, comp, mod, met, spd, strat, tech, dur, bench, diff,
              repaired=False, streak=0):
    """Rating 3.0：pacing 重标定 + 软压缩难度 + 可达 Donk + 情境乘子"""
    d = soft_diff(diff)
    sd, rd = DEF.get(outcome, DEF_OTHER)
    cast = 100.0 if outcome == "correct" else (
        38.0 + (comp or 50.0) / 100 * 12 if outcome == "partial" else
        30.0 if outcome == "uncertain" else 10.0)
    impact = 0.6 * (strat if strat is not None else sd) + 0.4 * (met if met is not None else sd)
    if (tech or 0) >= 4: impact += 6
    if d >= 1.06 and outcome != "wrong": impact += 6
    impact = clamp(impact, 0, 100)
    kast = clamp(0.5 * (rig if rig is not None else rd)
                 + 0.3 * (comp if comp is not None else rd)
                 + 0.2 * (mod if mod is not None else rd), 0, 100)
    dur = max(dur or bench, 1); bench = max(bench, 1)
    plausible = 5.0 <= dur <= 1800.0
    # ① pacing 重标定 + 主客观融合
    #    客观：实际耗时比，中性 85（原为 100，与满分速度同值导致快慢无差别）
    #    主观：AI 的 speed(0-100) 映射到 [45,135]
    #    融合：客观略占优（0.55），避免「AI 说快就是快、实际磨了 20 分钟」的虚高
    if plausible:
        p_time = clamp((bench / dur) * 85.0, 45.0, 135.0)
    else:
        p_time = 85.0
    if spd is not None:
        p_ai = 45.0 + (clamp(spd, 0, 100) / 100.0) * 90.0
        pacing = 0.45 * p_ai + 0.55 * p_time
    else:
        pacing = p_time
    # ② 护栏：做错时「快」是草率不是效率，节奏分封顶在中性值 85
    if outcome in ("wrong", "incorrect"):
        pacing = min(pacing, 85.0)
    eco = (clamp(dur / bench - 1, 0, 1.5) * 24 if (plausible and dur > bench * 1.2) else 8.0) \
        if outcome in ("wrong", "incorrect") else 0.0
    compo = 0.38 * cast + 0.22 * impact + 0.20 * kast + 0.20 * pacing - eco
    base = 0.26 + 0.0125 * compo
    # ② Donk 门槛 125 → 118（对应约 0.7 倍基准耗时），且不再要求 tech>=4
    if outcome == "correct" and base > 1.40 and pacing >= 118.0:
        r = (1.40 + (base - 1.40) ** 0.82 * 1.55) * d
    else:
        r = base * d
    # ③ 情境乘子：修复旧错 +4%，连对 momentum（每多一连 +1.5%，封顶 +6%）
    if repaired:
        r *= 1.04
    r *= 1.0 + min(0.06, max(0, streak - 2) * 0.015)
    return round(clamp(r, 0, 2.5) * 100) / 100, pacing


rows = conn.execute("""
SELECT a.question_id, COALESCE(a.outcome,a.result),
       a.dim_rigor, a.dim_computation, a.dim_modeling, a.dim_method_use,
       a.dim_speed, a.dim_strategy_insight, a.technique_level,
       a.difficulty_multiplier, a.duration_seconds, q.question_type, a.id,
       substr(a.attempted_at,1,10)
FROM attempts a LEFT JOIN questions q ON q.id=a.question_id
WHERE COALESCE(a.outcome,a.result) IS NOT NULL
  AND COALESCE(a.outcome,a.result) <> 'uncertain'
ORDER BY a.question_id, a.id""").fetchall()

# 预计算：每题历史是否错过（用于「修复」乘子）+ 当日连对
prev_wrong = set()
seen = {}
for (qid, oc, *_rest) in rows:
    if oc in ("wrong", "incorrect"):
        prev_wrong.add(qid)
streak_by_day = Counter()
results_v2, results_v3, pacings = [], [], []
for (qid, oc, rig, comp, mod, met, spd, strat, tech, dm, dur, qtype, aid, day) in rows:
    bench = BENCH.get(qtype, 600)
    r2, _ = rating_v2(oc, rig, comp, mod, met, spd, strat, tech, dur, bench, dm)
    repaired = qid in prev_wrong and oc == "correct"
    st = streak_by_day[day] if oc == "correct" else 0
    r3, p = rating_v3(oc, rig, comp, mod, met, spd, strat, tech, dur, bench, dm,
                      repaired, st)
    streak_by_day[day] = st + 1 if oc == "correct" else 0
    results_v2.append(r2); results_v3.append(r3); pacings.append(p)


def report(name, rs):
    print(f"\n=== {name} ===")
    print(f"  min={min(rs):.2f} max={max(rs):.2f} median={statistics.median(rs):.2f} "
          f"mean={statistics.mean(rs):.2f} stdev={statistics.stdev(rs):.3f}")
    q = statistics.quantiles(rs, n=20)
    print(f"  P5={q[0]:.2f} P25={q[4]:.2f} P50={q[9]:.2f} P75={q[14]:.2f} P95={q[18]:.2f}")
    b = Counter()
    for r in rs:
        k = ("D(<0.60)" if r < .6 else "C(.60-.89)" if r < .9 else "B(.90-1.29)"
             if r < 1.3 else "A(1.30-1.59)" if r < 1.6 else "S(1.60-1.99)"
             if r < 2.0 else "DONK(>=2.00)")
        b[k] += 1
    order = ["D(<0.60)", "C(.60-.89)", "B(.90-1.29)", "A(1.30-1.59)", "S(1.60-1.99)", "DONK(>=2.00)"]
    for k in order:
        n = b.get(k, 0)
        bar = "#" * int(n / len(rs) * 50)
        print(f"  {k:<13} {n:>4} {n/len(rs)*100:>5.1f}%  {bar}")
    tight = sum(1 for r in rs if 1.30 <= r < 1.60)
    print(f"  >> 挤在 1.30-1.60 的占比: {tight/len(rs)*100:.1f}%")
    return b


print(f"样本 {len(rows)} 条")
b2 = report("现行 Rating 2.0（线上）", results_v2)
b3 = report("候选 Rating 3.0（回放）", results_v3)

print("\n=== 关键对比 ===")
print(f"  标准差（区分度）: {statistics.stdev(results_v2):.3f} -> "
      f"{statistics.stdev(results_v3):.3f}  "
      f"({(statistics.stdev(results_v3)/statistics.stdev(results_v2)-1)*100:+.0f}%)")
print(f"  最高分: {max(results_v2):.2f} -> {max(results_v3):.2f}")
print(f"  1.60+ 占比: {sum(v for k,v in b2.items() if k.startswith(('S','DONK')))/len(rows)*100:.1f}%"
      f" -> {sum(v for k,v in b3.items() if k.startswith(('S','DONK')))/len(rows)*100:.1f}%")
print(f"  2.00+ 次数: {b2.get('DONK(>=2.00)',0)} -> {b3.get('DONK(>=2.00)',0)}")

print("\n=== 高光案例 q=4618（31s 秒杀 vs 慢速做对）===")
r = conn.execute("""SELECT dim_rigor,dim_computation,dim_modeling,dim_method_use,
    dim_speed,dim_strategy_insight,technique_level,difficulty_multiplier,
    duration_seconds,q.question_type FROM attempts a LEFT JOIN questions q ON q.id=a.question_id
    WHERE a.question_id=4618 AND COALESCE(a.outcome,a.result)='correct'""").fetchone()
bench = BENCH.get(r[9], 600)
for label, dd in [("31s 秒杀（真实）", r[8]), ("600s 磨出（对照）", bench), ("1200s 苦战", 1200)]:
    v2, _ = rating_v2("correct", *r[:7], dd, bench, r[7])
    v3, p = rating_v3("correct", *r[:7], dd, bench, r[7])
    print(f"  {label:<18} v2={v2:.2f}  v3={v3:.2f}  (pacing={p:.0f})  Δv3={v3-v2:+.2f}")
conn.close()

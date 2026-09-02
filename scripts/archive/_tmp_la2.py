import sqlite3, json, re, collections
con = sqlite3.connect(r"E:\刷吧\.workbuddy\tmp\snap.db")
con.row_factory = sqlite3.Row
c = con.cursor()

def q(sql, args=()):
    return c.execute(sql, args).fetchall()

out = []
def p(s=""):
    out.append(str(s))

# ---------- 0. 已做题号全集 ----------
done = set(r[0] for r in q("select distinct question_id from attempts"))
p("已做不同题号数: %d" % len(done))

# ---------- 1. 线代叶子全景 ----------
p("\n===== 线代叶子全景（category_path 以 线性代数 开头）=====")
rows = q("""
select q.category_path, count(*) n,
       sum(case when q.question_type='single_choice' then 1 else 0 end) sc,
       sum(case when q.difficulty=1 then 1 else 0 end) d1,
       sum(case when q.difficulty=2 then 1 else 0 end) d2,
       sum(case when q.difficulty=3 then 1 else 0 end) d3
from questions q
where q.category_path like '线性代数%'
group by q.category_path
order by n desc
""")
LA = []
for r in rows:
    cp = r["category_path"]
    LA.append((cp, r["n"], r["sc"], r["d1"], r["d2"], r["d3"]))
p("线代叶子数: %d" % len(LA))

# 已覆盖叶子
cov = {}
for r in q("""
select q.category_path cp, q.id, count(*) k
from attempts a join questions q on q.id=a.question_id
where q.category_path like '线性代数%'
group by q.category_path, q.id
"""):
    cov.setdefault(r["cp"], []).append((r["id"], r["k"]))

p("\n--- 已覆盖叶子（%d 个）---" % len(cov))
for cp, items in sorted(cov.items(), key=lambda x: -len(x[1])):
    p("  [覆盖] %-58s 已做不同题 %d: %s" % (cp, len(items), ",".join(str(i) for i,_ in items[:8])))

p("\n--- 零覆盖叶子（按题量降序）---")
zero = [(cp,n,sc,d1,d2,d3) for cp,n,sc,d1,d2,d3 in LA if cp not in cov]
p("零覆盖叶子数: %d" % len(zero))
for cp,n,sc,d1,d2,d3 in zero:
    p("  %-58s n=%-4d 单选=%-4d d1=%-4d d2=%-4d d3=%-4d" % (cp,n,sc,d1,d2,d3))

# ---------- 2. 抽象逆 / 矩阵代数式候选池 ----------
p("\n\n===== 抽象矩阵代数式候选池（关键词粗筛）=====")
kws = ["逆", "矩阵方程", "伴随", "幂零", "A^2", "A^{2}", "多项式"]
seen = set()
cand = []
for kw in kws:
    for r in q("""
    select q.id, q.category_path, q.question_type, q.difficulty,
           substr(q.stem,1,150) s, length(q.explanation) el, q.correct_answer
    from questions q
    where q.category_path like '线性代数%' and q.stem like ?
    """, ("%"+kw+"%",)):
        if r["id"] in seen: continue
        seen.add(r["id"])
        cand.append(r)

p("候选数: %d" % len(cand))
for r in cand:
    flag = "★已做" if r["id"] in done else ""
    p("#%-6d %-9s %-6s d%d expl=%-5d %-46s %s" % (
        r["id"], r["question_type"], "", r["difficulty"], r["el"],
        r["category_path"][:46], flag))

# ---------- 3. 已做抽象逆相关题的明细 ----------
p("\n===== 已做线代题明细（最近 60 条）=====")
for r in q("""
select a.question_id, q.category_path, q.question_type, q.difficulty,
       a.outcome, a.duration_seconds, a.attempted_at, a.ai_rating
from attempts a join questions q on q.id=a.question_id
where q.category_path like '线性代数%'
order by a.attempted_at desc limit 60
"""):
    p("#%-6d %-9s d%d %-9s %5ss %s r=%s | %s" % (
        r["question_id"], r["question_type"], r["difficulty"],
        r["outcome"], r["duration_seconds"], str(r["attempted_at"])[:16],
        r["ai_rating"], r["category_path"][:50]))

# ---------- 4. 今天(9/1)做了什么 ----------
p("\n===== 2026-09-01 作答 ====='")
for r in q("""
select a.question_id, q.category_path, a.outcome, a.duration_seconds, a.attempted_at
from attempts a join questions q on q.id=a.question_id
where date(a.attempted_at)='2026-09-01' order by a.attempted_at
"""):
    p("#%-6d %-9s %5ss %s | %s" % (r["question_id"], r["outcome"],
        r["duration_seconds"], str(r["attempted_at"])[:16], r["category_path"][:50]))
p("9/1 总题次: %d" % len(q("select 1 from attempts where date(attempted_at)='2026-09-01'")))

# ---------- 5. 到期复习里的线代题 ----------
p("\n===== 线代到期复习（progress.next_review <= now）=====")
for r in q("""
select p.question_id, q.category_path, p.mastery, p.review_count, p.next_review
from progress p join questions q on q.id=p.question_id
where q.category_path like '线性代数%'
  and p.next_review is not null and p.next_review <= datetime('now','localtime')
order by p.mastery
"""):
    p("#%-6d m=%-4s rc=%-3s next=%s | %s" % (r["question_id"], r["mastery"],
        r["review_count"], r["next_review"], r["category_path"][:50]))

open(r"E:\刷吧\.workbuddy\tmp\_la.txt","w",encoding="utf-8").write("\n".join(out))
print("done", len(out))

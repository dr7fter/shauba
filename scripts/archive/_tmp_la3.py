import sqlite3, re, os
con = sqlite3.connect(r"E:\刷吧\.workbuddy\tmp\snap.db")
con.row_factory = sqlite3.Row
c = con.cursor()
out=[]
def p(s=""): out.append(str(s))

done = set(r[0] for r in c.execute("select distinct question_id from attempts"))

def dump(title, sql, args=()):
    p("\n\n########## %s ##########" % title)
    rows = c.execute(sql, args).fetchall()
    p("共 %d 题" % len(rows))
    for r in rows:
        stem = re.sub(r"\s+", " ", r["stem"] or "")
        flag = "★已做" if r["id"] in done else ""
        p("--- #%s | %s | d%s | expl=%d %s" % (r["id"], r["question_type"], r["difficulty"], len(r["explanation"] or ""), flag))
        p("    %s" % stem[:420])

dump("抽象逆相关（全池）", """
select id, question_type, difficulty, stem, explanation from questions
where category_path = '线性代数 / 矩阵 / 逆 / 抽象逆相关'
order by id
""")

dump("矩阵 / 逆 / (不)可逆的判定与证明（全池 15）", """
select id, question_type, difficulty, stem, explanation from questions
where category_path = '线性代数 / 矩阵 / 逆 / (不)可逆的判定与证明'
order by id
""")

dump("矩阵 / 高次幂（前 10）", """
select id, question_type, difficulty, stem, explanation from questions
where category_path = '线性代数 / 矩阵 / 高次幂'
order by difficulty, id limit 10
""")

# 组2 侦察候选
LEAVES = [
 "线性代数 / 特征值与特征向量 / 相似对角化 / 求相似对角化的可逆阵 P 及对角阵 Λ",
 "线性代数 / 特征值与特征向量 / 相似对角化 / 判断是否可以相似对角化",
 "线性代数 / 特征值与特征向量 / 相似对角化 / 可相似对角化相关讨论及证明",
 "线性代数 / 特征值与特征向量 / 特征值与特征向量 / 求特征值特征向量 / 抽象矩阵",
 "线性代数 / 特征值与特征向量 / 实对称矩阵 / 求实对称矩阵 A",
 "线性代数 / 特征值与特征向量 / 实对称矩阵 / 求正交矩阵 Q / 常规三阶题",
 "线性代数 / 二次型 / 合同",
 "线性代数 / 二次型 / 正负惯性指数 / 求正负惯性指数",
 "线性代数 / 二次型 / 正定 / 已知正定反求参数",
 "线性代数 / 特征值与特征向量 / 相似对角化 / 相似对角化充要条件",
 "线性代数 / 二次型 / 二次型的秩或矩阵",
 "线性代数 / 特征值与特征向量 / 实对称矩阵 / 实对称矩阵相关推理",
]
for lv in LEAVES:
    dump(lv, """
    select id, question_type, difficulty, stem, explanation from questions
    where category_path = ? order by difficulty, id limit 6
    """, (lv,))

# 三道到期复习题的 stem
dump("到期复习候选（395/533/514/664/687/5615）", """
select id, question_type, difficulty, stem, explanation from questions
where id in (395,533,514,664,687,5615) order by id
""")

open(r"E:\刷吧\.workbuddy\tmp\_la_stems.txt","w",encoding="utf-8").write("\n".join(out))
print("ok", len(out))

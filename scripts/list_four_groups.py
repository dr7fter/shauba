import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

cursor.execute('''
    SELECT id, category_path, question_type, stem, correct_answer, explanation
    FROM questions
    WHERE category_path LIKE "高等数学 / 一元积分 / 积分计算%"
    ORDER BY id
''')
rows = cursor.fetchall()
print(f"Total questions in 积分计算: {len(rows)}")

groups = {
    "两函数相乘 (分部/递推/反三角/对数/指数)": [],
    "三角相关 (三角有理式/高次/线性组合)": [],
    "分段函数/绝对值/取整": [],
    "定积分特殊题型 (区间再现/奇偶/变限/周期)": []
}

for r in rows:
    path = r['category_path']
    stem = r['stem'] or ''
    if '两函数相乘' in path or '分部' in path:
        groups["两函数相乘 (分部/递推/反三角/对数/指数)"].append(r)
    elif '三角相关' in path:
        groups["三角相关 (三角有理式/高次/线性组合)"].append(r)
    elif '分段函数' in path or '绝对值' in path or '取整' in path:
        groups["分段函数/绝对值/取整"].append(r)
    elif '定积分特殊题型' in path:
        groups["定积分特殊题型 (区间再现/奇偶/变限/周期)"].append(r)

for name, qlist in groups.items():
    print(f"\n=======================================================")
    print(f"=== {name} (Total: {len(qlist)}) ===")
    print(f"=======================================================")
    for q in qlist:
        stem = (q['stem'] or '').replace('\n', ' ')
        ans = (q['correct_answer'] or '').replace('\n', ' ')
        if not stem.startswith('![原始题图]'):
            print(f"  #{q['id']:5d} [{q['question_type']:12s}]: {stem[:90]} | Ans: {ans[:30]}")

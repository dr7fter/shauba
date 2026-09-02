import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

branches = [
    ("1. 两函数相乘", "category_path LIKE '%两函数相乘%'"),
    ("2. 三角相关", "category_path LIKE '%三角相关%'"),
    ("3. 分段函数与绝对值/取整", "category_path LIKE '%分段函数%' OR category_path LIKE '%取整%' OR category_path LIKE '%绝对值%'"),
    ("4. 定积分特殊题型(区间再现/奇偶/周期/抵消)", "category_path LIKE '%定积分特殊题型%'")
]

for title, cond in branches:
    print(f"\n=======================================================")
    print(f"=== {title} ===")
    print(f"=======================================================")
    cursor.execute(f'''
        SELECT id, category_path, question_type, stem, correct_answer, explanation
        FROM questions
        WHERE {cond}
        ORDER BY id
    ''')
    rows = cursor.fetchall()
    print(f"Total matching: {len(rows)}")
    for r in rows:
        stem = (r['stem'] or '').replace('\n', ' ')
        ans = (r['correct_answer'] or '').replace('\n', ' ')
        exp = (r['explanation'] or '').replace('\n', ' ')
        print(f"\nID #{r['id']} [{r['question_type']}] ({r['category_path']}):")
        print(f"  Stem: {stem[:120]}")
        print(f"  Ans:  {ans[:80]}")
        print(f"  Exp:  {exp[:120]}...")

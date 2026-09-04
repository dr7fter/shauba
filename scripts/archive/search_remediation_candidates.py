import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

# Search for candidates in one-variable integrals and multivariable calculus
queries = [
    ("切平面", "category_path LIKE '高等数学 / 多元微分%' AND stem LIKE '%切平面%'", 3),
    ("拉格朗日条件极值", "category_path LIKE '高等数学 / 多元微分 / 多元微分应用 / 条件极值%'", 4),
    ("闭区域最值", "category_path LIKE '高等数学 / 多元微分 / 多元微分应用 / 闭区域最值%'", 4),
    ("隐函数极值", "category_path LIKE '高等数学 / 多元微分 / 多元微分应用 / 无条件极值 / 多元隐函数极值%'", 3),
    ("旋转体绕斜线", "category_path LIKE '高等数学 / 一元积分 / 积分应用 / 几何应用 / 旋转体体积%'", 4),
    ("反常积分特殊", "category_path LIKE '高等数学 / 一元积分 / 反常积分%'", 4),
    ("弧长与面积分", "category_path LIKE '高等数学 / 一元积分 / 积分应用 / 几何应用 / 表（侧）面积%' OR category_path LIKE '高等数学 / 一元积分 / 积分应用 / 几何应用 / 弧长%'", 4),
]

for name, sql, limit in queries:
    print(f"=== {name} ===")
    cursor.execute(f"SELECT id, stem, correct_answer, category_path, question_type, difficulty FROM questions WHERE {sql} ORDER BY id ASC LIMIT {limit}")
    for r in cursor.fetchall():
        print(f"ID {r['id']} ({r['question_type']}, diff {r['difficulty']}) | {r['category_path']}")
        print(f"  Stem: {r['stem'][:90]}...")
        print(f"  Ans: {str(r['correct_answer'])[:50]}\n")

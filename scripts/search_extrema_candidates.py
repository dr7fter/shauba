import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

cursor.execute("""
    SELECT id, stem, correct_answer, category_path, question_type, difficulty 
    FROM questions 
    WHERE category_path LIKE '高等数学 / 多元微分 / 多元微分应用 / 条件极值%'
       OR category_path LIKE '高等数学 / 多元微分 / 多元微分应用 / 闭区域最值%'
       OR category_path LIKE '高等数学 / 多元微分 / 多元微分应用 / 无条件极值 / 多元隐函数极值%'
    ORDER BY id ASC
""")
rows = cursor.fetchall()
print(f"Found {len(rows)} matching questions:")
for r in rows:
    print(f"ID {r['id']} ({r['question_type']}, diff {r['difficulty']}) | {r['category_path']}")
    print(f"  Stem: {r['stem'][:100]}...")
    print(f"  Ans: {r['correct_answer']}\n")

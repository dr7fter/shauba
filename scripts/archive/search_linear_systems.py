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
    WHERE category_path LIKE '线性代数 / 线性方程组 / 方程组求解%'
    ORDER BY difficulty DESC, id ASC
    LIMIT 6
""")
for r in cursor.fetchall():
    print(f"ID {r['id']} ({r['question_type']}, diff {r['difficulty']}) | {r['category_path']}")
    print(f"  Stem: {r['stem'][:90]}...")
    print(f"  Ans: {str(r['correct_answer'])[:60]}\n")

import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

print("=== SEARCHING '两函数相乘' ===")
cursor.execute("SELECT id, category_path, question_type, stem, correct_answer FROM questions WHERE category_path LIKE '%两函数相乘%' OR category_path LIKE '%分部%'")
for r in cursor.fetchall():
    stem = (r['stem'] or '').replace('\n', ' ')
    print(f"#{r['id']} [{r['question_type']}] ({r['category_path']}): {stem[:90]}")

print("\n=== SEARCHING '三角相关' ===")
cursor.execute("SELECT id, category_path, question_type, stem, correct_answer FROM questions WHERE category_path LIKE '%三角相关%' OR category_path LIKE '%三角%'")
for r in cursor.fetchall():
    stem = (r['stem'] or '').replace('\n', ' ')
    print(f"#{r['id']} [{r['question_type']}] ({r['category_path']}): {stem[:90]}")

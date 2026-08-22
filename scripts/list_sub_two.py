import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

print("=== 1. 两函数相乘 ===")
cursor.execute("SELECT id, stem, correct_answer, explanation FROM questions WHERE category_path LIKE '%两函数相乘%'")
for r in cursor.fetchall():
    stem = (r['stem'] or '').replace('\n', ' ')
    print(f"#{r['id']}: {stem}")

print("\n=== 2. 三角相关 ===")
cursor.execute("SELECT id, stem, correct_answer, explanation FROM questions WHERE category_path LIKE '%三角相关%'")
for r in cursor.fetchall():
    stem = (r['stem'] or '').replace('\n', ' ')
    print(f"#{r['id']}: {stem}")

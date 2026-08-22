import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

print("=== 1. SEARCHING 平均值 ===")
cursor.execute('''
    SELECT id, category_path, question_type, stem, correct_answer, explanation
    FROM questions
    WHERE category_path LIKE "%平均值%"
    ORDER BY id
''')
for r in cursor.fetchall():
    stem = (r['stem'] or '').replace('\n', ' ')
    ans = (r['correct_answer'] or '').replace('\n', ' ')
    print(f"#{r['id']:5d} [{r['question_type']:12s}] ({r['category_path'].split(' / ')[-2:]}): {stem[:90]} | {ans[:30]}")

print("\n=== 2. SEARCHING 直角坐标/参数方程面积综合 ===")
cursor.execute('''
    SELECT id, category_path, question_type, stem, correct_answer, explanation
    FROM questions
    WHERE category_path LIKE "%积分应用 / 几何应用 / 面积 / 直角坐标%" OR category_path LIKE "%积分应用 / 几何应用 / 面积 / 参数方程%"
    ORDER BY id
''')
for r in cursor.fetchall():
    stem = (r['stem'] or '').replace('\n', ' ')
    ans = (r['correct_answer'] or '').replace('\n', ' ')
    print(f"#{r['id']:5d} [{r['question_type']:12s}] ({r['category_path'].split(' / ')[-2:]}): {stem[:90]} | {ans[:30]}")

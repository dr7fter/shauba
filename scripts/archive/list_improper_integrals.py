import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

print("=== ALL QUESTIONS IN 反常积分 ===")
cursor.execute('''
    SELECT id, category_path, question_type, stem, correct_answer, explanation
    FROM questions
    WHERE category_path LIKE "%反常积分%"
    ORDER BY id
''')
rows = cursor.fetchall()
print(f"Total count: {len(rows)}")
for r in rows:
    stem = (r['stem'] or '').replace('\n', ' ')
    ans = (r['correct_answer'] or '').replace('\n', ' ')
    print(f"#{r['id']:5d} [{r['question_type']:12s}] ({r['category_path'].split(' / ')[-2:]}): {stem[:90]} | {ans[:30]}")

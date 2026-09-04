import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

cursor.execute('''
    SELECT id, category_path, question_type, stem, correct_answer
    FROM questions
    WHERE category_path LIKE "高等数学 / 一元积分 / 积分应用 / 几何应用%"
    ORDER BY id
''')
for r in cursor.fetchall():
    stem = (r['stem'] or '').replace('\n', ' ')
    ans = (r['correct_answer'] or '').replace('\n', ' ')
    if not stem.startswith('![原始题图]'):
        print(f"#{r['id']:5d} [{r['question_type']:12s}] ({r['category_path'].split(' / ')[-2:]}): {stem[:90]} | {ans[:30]}")

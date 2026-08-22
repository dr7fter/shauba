import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

cursor.execute('''
    SELECT id, question_type, category_path, stem, correct_answer, explanation
    FROM questions
    WHERE category_path LIKE "%平均值%"
''')
for r in cursor.fetchall():
    stem = (r['stem'] or '').replace('\n', ' ')
    ans = (r['correct_answer'] or '').replace('\n', ' ')
    exp = (r['explanation'] or '').replace('\n', ' ')
    print(f"\nID #{r['id']} [{r['question_type']}] ({r['category_path']}):")
    print(f"  Stem: {stem[:120]}")
    print(f"  Ans:  {ans[:80]}")
    print(f"  Exp:  {exp[:120]}...")

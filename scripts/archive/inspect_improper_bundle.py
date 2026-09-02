import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

ids = [1245, 2157, 2153, 2164, 2160, 2169, 10566, 4618]

print("=== INSPECTING 8 QUESTIONS IN IMPROPER INTEGRALS ===")
for qid in ids:
    cursor.execute("SELECT id, question_type, category_path, stem, correct_answer, explanation FROM questions WHERE id = ?", (qid,))
    r = cursor.fetchone()
    if r:
        stem = (r['stem'] or '').replace('\n', ' ')
        ans = (r['correct_answer'] or '').replace('\n', ' ')
        exp = (r['explanation'] or '').replace('\n', ' ')
        print(f"\nID #{r['id']} [{r['question_type']}] ({r['category_path']}):")
        print(f"  Stem: {stem}")
        print(f"  Ans:  {ans}")
        print(f"  Exp:  {exp[:160]}...")

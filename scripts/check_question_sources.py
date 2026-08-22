import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

ids = [10633, 2288, 2340, 7264, 10655, 10649, 10644, 7732]

print("=== INSPECTING QUESTION SOURCES AND ORIGINS ===")
for qid in ids:
    cursor.execute("SELECT id, stem, correct_answer, explanation, category_path FROM questions WHERE id = ?", (qid,))
    r = cursor.fetchone()
    if r:
        stem = (r['stem'] or '').replace('\n', ' ')
        exp = (r['explanation'] or '').replace('\n', ' ')
        print(f"\nID #{r['id']} ({r['category_path']}):")
        print(f"  Stem: {stem}")
        print(f"  Exp:  {exp[:140]}...")

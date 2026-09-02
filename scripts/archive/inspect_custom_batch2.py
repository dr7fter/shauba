import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

candidate_ids = [2172, 2188, 2553, 2593, 2600, 2535, 2537, 2695, 2721]
cursor.execute(f"SELECT id, stem, correct_answer, options_json, explanation, question_type, difficulty FROM questions WHERE id IN ({','.join(map(str, candidate_ids))})")
for r in cursor.fetchall():
    print("==================================================")
    print(f"ID: {r['id']} ({r['question_type']}, diff {r['difficulty']})")
    print(f"Stem: {r['stem']}")
    print(f"Options: {r['options_json']}")
    print(f"Answer: {r['correct_answer']}")

import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

qids = [148, 149, 145, 135, 278]
for qid in qids:
    cursor.execute("SELECT id, stem, correct_answer FROM questions WHERE id=?", (qid,))
    r = cursor.fetchone()
    print(f"=== ID {r['id']} ===")
    print(f"Stem: {r['stem']}")
    print(f"Correct: {r['correct_answer']}")
    print()

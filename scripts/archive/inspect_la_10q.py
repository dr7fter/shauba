import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

qids = [209, 143, 204, 262, 274, 144, 211, 147, 265, 254]
for qid in qids:
    cursor.execute("SELECT id, stem, correct_answer, options_json FROM questions WHERE id=?", (qid,))
    r = cursor.fetchone()
    print(f"=== ID {r['id']} ===")
    print(f"Stem: {r['stem'][:150]}")
    print(f"Correct: {r['correct_answer']}")
    if r['options_json'] and len(r['options_json']) > 2:
        print(f"Options: {r['options_json']}")
    print()

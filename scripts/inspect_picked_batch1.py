import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

ids = [2171, 2187, 2214, 2476, 2481, 2487, 2488, 2529, 10713]
cursor.execute(f"SELECT id, stem, correct_answer, options_json, explanation, question_type FROM questions WHERE id IN ({','.join(map(str, ids))})")
for r in cursor.fetchall():
    print("--------------------------------------------------")
    print(f"ID: {r['id']} ({r['question_type']})")
    print(f"Stem: {r['stem']}")
    print(f"Options: {r['options_json']}")
    print(f"Answer: {r['correct_answer']}")

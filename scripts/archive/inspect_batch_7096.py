import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

ids = [2593, 2600, 2554, 2566, 2565, 2569, 2185, 2205, 2445, 2491, 2522, 2534, 2643, 2649, 2695, 2721]

print(f"Total IDs: {len(ids)}")
for i, qid in enumerate(ids):
    cursor.execute("SELECT id, stem, correct_answer, category_path, question_type, difficulty FROM questions WHERE id=?", (qid,))
    r = cursor.fetchone()
    if r:
        print(f"{i+1}. ID: {r['id']} ({r['question_type']}, diff {r['difficulty']}) | {r['category_path']}")
        print(f"   Stem: {r['stem'][:100]}...")
        print(f"   Ans: {r['correct_answer']}\n")
    else:
        print(f"{i+1}. ID: {qid} NOT FOUND!\n")

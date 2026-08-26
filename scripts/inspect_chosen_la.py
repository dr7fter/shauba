import json
import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

ids = [141, 155, 159, 168, 192, 244, 264, 272]
cursor.execute(f"SELECT id, stem, correct_answer, category_path, question_type FROM questions WHERE id IN ({','.join(map(str, ids))})")
for r in cursor.fetchall():
    print(f"[{r['id']}] ({r['question_type']}) {r['category_path']}")
    print(f"Stem: {r['stem']}")
    print(f"Ans: {r['correct_answer']}\n")

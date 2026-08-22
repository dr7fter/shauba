import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

batches = {
    "Batch 1: 几何应用 (6题)": [10655, 10654, 10644, 10649, 10634, 7732],
    "Batch 2: 物理应用 (5题)": [10666, 10667, 10672, 10670, 7782],
    "Batch 3: 反常积分 (5题)": [1245, 2157, 2160, 2164, 2169]
}

for bname, qids in batches.items():
    print(f"\n=======================================================")
    print(f"=== {bname} ===")
    print(f"=======================================================")
    for qid in qids:
        cursor.execute("SELECT id, question_type, category_path, stem, correct_answer, explanation FROM questions WHERE id = ?", (qid,))
        r = cursor.fetchone()
        if not r:
            print(f"[ERROR] Q #{qid} not found!")
        else:
            stem = (r['stem'] or '').replace('\n', ' ')
            ans = (r['correct_answer'] or '').replace('\n', ' ')
            exp = (r['explanation'] or '').replace('\n', ' ')
            print(f"\nID #{r['id']} [{r['question_type']}] ({r['category_path']}):")
            print(f"  Stem: {stem[:120]}")
            print(f"  Ans:  {ans[:80]}")
            print(f"  Exp:  {exp[:120]}...")

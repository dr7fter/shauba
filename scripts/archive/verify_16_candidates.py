import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

candidate_ids = [
    # 1. 两函数相乘 (分部积分)
    7093, 10622, 7098, 7103,
    # 2. 三角函数
    7065, 7068, 7073, 7061,
    # 3. 分段函数与绝对值/取整
    7173, 7179, 10563, 7218,
    # 4. 定积分特殊题型
    7206, 2002, 7209, 7219
]

for qid in candidate_ids:
    cursor.execute("SELECT id, question_type, category_path, stem, correct_answer, explanation FROM questions WHERE id = ?", (qid,))
    r = cursor.fetchone()
    if r:
        print(f"\n=======================================================")
        print(f"ID #{r['id']} [{r['question_type']}]")
        print(f"Path: {r['category_path']}")
        print(f"Stem: {r['stem']}")
        print(f"Ans:  {r['correct_answer']}")
        print(f"Exp:  {r['explanation']}")
    else:
        print(f"\n[ERROR] ID #{qid} not found!")

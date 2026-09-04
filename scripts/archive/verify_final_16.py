import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

selected_16 = [
    # 1. 两函数相乘 (分部积分与递推)
    1041, 1157, 7114, 10553,
    # 2. 三角函数 (有理化/降幂/线性组合/凑微分)
    1008, 7160, 1005, 7168,
    # 3. 分段函数与绝对值/取整
    7173, 7179, 10563, 7218,
    # 4. 定积分特殊性质 (区间再现/奇偶/抵消/变限)
    7206, 2002, 7209, 7219
]

print("=== CHECKING ALL 16 SELECTED QUESTIONS ===")
for idx, qid in enumerate(selected_16, 1):
    cursor.execute("SELECT id, question_type, category_path, stem, correct_answer, explanation FROM questions WHERE id = ?", (qid,))
    r = cursor.fetchone()
    if not r:
        print(f"[{idx}] ERROR: #{qid} not found!")
    else:
        stem = (r['stem'] or '').replace('\n', ' ')
        ans = (r['correct_answer'] or '').replace('\n', ' ')
        exp = (r['explanation'] or '').replace('\n', ' ')
        print(f"[{idx:2d}] #{r['id']:5d} [{r['question_type']:15s}] ({r['category_path']})")
        print(f"     Stem: {stem[:110]}")
        print(f"     Ans:  {ans[:80]}")
        print(f"     Exp:  {exp[:120]}...\n")

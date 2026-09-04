import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

def get_q(ids):
    for qid in ids:
        cursor.execute("SELECT id, question_type, category_path, stem, correct_answer, explanation FROM questions WHERE id = ?", (qid,))
        r = cursor.fetchone()
        if r:
            stem = (r['stem'] or '').replace('\n', ' ')
            ans = (r['correct_answer'] or '').replace('\n', ' ')
            exp = (r['explanation'] or '').replace('\n', ' ')
            print(f"\nID #{r['id']} [{r['question_type']}] ({r['category_path']}):")
            print(f"  Stem: {stem}")
            print(f"  Ans:  {ans}")
            print(f"  Exp:  {exp[:160]}...")

print("--- PART 1: 两函数相乘 CANDIDATES ---")
cursor.execute("SELECT id, stem FROM questions WHERE category_path LIKE '%两函数相乘%' ORDER BY id")
for r in cursor.fetchall():
    print(f"#{r['id']}: {(r['stem'] or '')[:80].replace(chr(10), ' ')}")

print("\n--- PART 2: 三角相关 CANDIDATES ---")
cursor.execute("SELECT id, stem FROM questions WHERE category_path LIKE '%三角相关%' ORDER BY id")
for r in cursor.fetchall():
    print(f"#{r['id']}: {(r['stem'] or '')[:80].replace(chr(10), ' ')}")

print("\n--- PART 3: 分段/绝对值/取整 CANDIDATES ---")
cursor.execute("SELECT id, stem FROM questions WHERE category_path LIKE '%分段函数%' OR category_path LIKE '%取整%' OR category_path LIKE '%根号下绝对值%' ORDER BY id")
for r in cursor.fetchall():
    print(f"#{r['id']}: {(r['stem'] or '')[:80].replace(chr(10), ' ')}")

print("\n--- PART 4: 定积分特殊 CANDIDATES ---")
cursor.execute("SELECT id, stem FROM questions WHERE category_path LIKE '%定积分特殊题型%' ORDER BY id")
for r in cursor.fetchall():
    print(f"#{r['id']}: {(r['stem'] or '')[:80].replace(chr(10), ' ')}")

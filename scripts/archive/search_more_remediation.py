import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

# Check surface area and closed region
cursor.execute("SELECT id, stem, correct_answer, category_path FROM questions WHERE category_path LIKE '%侧面积%' LIMIT 3")
for r in cursor.fetchall():
    print(f"ID {r['id']} | {r['category_path']}\n  {r['stem'][:80]}...\n  {str(r['correct_answer'])[:40]}\n")

cursor.execute("SELECT id, stem, correct_answer, category_path FROM questions WHERE category_path LIKE '高等数学 / 多元微分 / 多元微分应用 / 闭区域最值%' AND question_type='subjective' LIMIT 3")
for r in cursor.fetchall():
    print(f"ID {r['id']} | {r['category_path']}\n  {r['stem'][:80]}...\n  {str(r['correct_answer'])[:40]}\n")

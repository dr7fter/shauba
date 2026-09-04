import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

cursor.execute("""
    SELECT id, stem, category_path, question_type, difficulty FROM questions 
    WHERE category_path LIKE '%方向导数%' OR category_path LIKE '%梯度%' OR category_path LIKE '%几何应用%' OR stem LIKE '%切平面%' OR stem LIKE '%方向导数%' OR stem LIKE '%梯度%'
    LIMIT 30
""")
rows = cursor.fetchall()
print(f"Found {len(rows)} geometric/directional questions:")
for r in rows:
    print(f"ID {r['id']} ({r['question_type']}, diff {r['difficulty']}) | {r['category_path']}")
    print(f"  Stem: {r['stem'][:90]}...\n")

import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

cursor.execute('''
    SELECT DISTINCT category_path, COUNT(*) as cnt 
    FROM questions 
    WHERE category_path LIKE "高等数学 / 一元积分%"
    GROUP BY category_path
    ORDER BY cnt DESC
''')
rows = cursor.fetchall()
print(f"Total category paths under 一元积分: {len(rows)}")
for r in rows:
    print(f"{r['cnt']:3d} | {r['category_path']}")

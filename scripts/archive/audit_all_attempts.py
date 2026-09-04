import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

cursor.execute("""
    SELECT q.id, q.category_path, q.question_type, a.outcome, a.duration_seconds, a.attempted_at
    FROM attempts a
    JOIN questions q ON q.id = a.question_id
    ORDER BY a.attempted_at ASC
""")
rows = cursor.fetchall()
print(f"Total attempts recorded in DB: {len(rows)}")
for r in rows:
    print(f"Q{r['id']}: {r['outcome']} ({r['duration_seconds']}s) | {r['category_path']}")

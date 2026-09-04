import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

cursor.execute("SELECT id, question_id, result, self_rating, duration_seconds FROM attempts WHERE session_id = 'SB-BATCH-20260822-1972' OR session_id LIKE '%1972%'")
rows = cursor.fetchall()
print("Ingested attempts count:", len(rows))
for r in rows:
    print(r)

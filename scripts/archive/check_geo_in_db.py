import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

cursor.execute("SELECT * FROM codex_inbox WHERE task_id LIKE '%geo%'")
rows = cursor.fetchall()
print("codex_inbox matches for geo:", len(rows))
for r in rows:
    print(dict(r))

cursor.execute("SELECT * FROM recommendation_batches WHERE task_id LIKE '%geo%'")
rows2 = cursor.fetchall()
print("recommendation_batches matches for geo:", len(rows2))
for r in rows2:
    print(dict(r))

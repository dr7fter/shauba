import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

cursor.execute("SELECT id, task_id, kind, status, created_at FROM codex_inbox ORDER BY id DESC LIMIT 5")
for r in cursor.fetchall():
    print(dict(r))

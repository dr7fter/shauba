import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

cursor.execute("SELECT id, task_id, kind, status, created_at FROM codex_inbox WHERE task_id='SB-BATCH-20260825-8622'")
row = cursor.fetchone()
if row:
    print(f"Found in codex_inbox: id={row['id']}, task_id={row['task_id']}, status={row['status']}, created_at={row['created_at']}")
else:
    print("Not found in codex_inbox")

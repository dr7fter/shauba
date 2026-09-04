import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

cursor.execute("SELECT id, task_id, kind, status FROM codex_inbox WHERE task_id='SB-REC-20260827-9910'")
r = cursor.fetchone()
if r:
    print(f"Verified in DB: id={r['id']}, task_id={r['task_id']}, kind={r['kind']}, status={r['status']}")
else:
    print("In codex-inbox folder, ready for App scan!")

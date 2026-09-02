import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

cursor.execute("PRAGMA table_info(recommendation_batch_items)")
print([r['name'] for r in cursor.fetchall()])

cursor.execute("SELECT * FROM recommendation_batch_items WHERE task_id='SB-REC-20260826-7096'")
for r in cursor.fetchall():
    print(dict(r))

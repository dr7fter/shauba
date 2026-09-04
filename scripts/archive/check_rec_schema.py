import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

cursor.execute("PRAGMA table_info(recommendation_batches)")
print("recommendation_batches cols:", [r['name'] for r in cursor.fetchall()])
cursor.execute("SELECT * FROM recommendation_batches ORDER BY created_at DESC LIMIT 5")
for r in cursor.fetchall():
    print(dict(r))

cursor.execute("PRAGMA table_info(codex_inbox)")
print("\ncodex_inbox cols:", [r['name'] for r in cursor.fetchall()])
cursor.execute("SELECT * FROM codex_inbox ORDER BY created_at DESC LIMIT 5")
for r in cursor.fetchall():
    print(dict(r))

import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
print("Tables in DB:", [r['name'] for r in cursor.fetchall()])

cursor.execute("SELECT * FROM recommendation_batches ORDER BY id DESC LIMIT 5")
for r in cursor.fetchall():
    print(dict(r))

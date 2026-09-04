import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

cursor.execute("PRAGMA table_info(categories)")
print("categories cols:", [r['name'] for r in cursor.fetchall()])

cursor.execute("SELECT * FROM categories LIMIT 10")
for r in cursor.fetchall():
    print(dict(r))

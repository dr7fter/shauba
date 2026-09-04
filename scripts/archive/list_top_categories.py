import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

cursor.execute("SELECT id, name, path FROM categories WHERE parent_id IS NULL OR path NOT LIKE '%/%/%'")
for r in cursor.fetchall():
    print(f"[{r['id']}] {r['path']}")

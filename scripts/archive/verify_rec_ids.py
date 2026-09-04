import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

ids = [7656, 4426, 4659]
cursor.execute(f"SELECT id, stem, correct_answer FROM questions WHERE id IN ({','.join(map(str, ids))})")
rows = cursor.fetchall()
print(f"Found {len(rows)} questions:")
for r in rows:
    print(dict(r))

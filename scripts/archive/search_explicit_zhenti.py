import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

cursor.execute('''
    SELECT id, category_path, stem
    FROM questions
    WHERE stem LIKE "%真题%" OR stem LIKE "%年考研%" OR stem LIKE "%年数%" OR stem LIKE "%数一%"
    LIMIT 20
''')
rows = cursor.fetchall()
print(f"Total labeled as explicit year zhenti: {len(rows)}")
for r in rows[:10]:
    print(f"#{r['id']}: {(r['stem'] or '')[:80].replace(chr(10), ' ')}")

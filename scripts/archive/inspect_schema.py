import sqlite3
import os

db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

cursor.execute("PRAGMA table_info(attempts)")
print('attempts columns:', [r[1] for r in cursor.fetchall()])

cursor.execute("PRAGMA table_info(progress)")
print('progress columns:', [r[1] for r in cursor.fetchall()])

cursor.execute("SELECT * FROM attempts ORDER BY id DESC LIMIT 20")
rows = cursor.fetchall()
cursor.execute("PRAGMA table_info(attempts)")
cols = [r[1] for r in cursor.fetchall()]
print(f'\nLatest 20 attempts ({cols}):')
for r in rows:
    print(dict(zip(cols, r)))

import sqlite3
import os

db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
cursor = conn.cursor()
cursor.execute("SELECT DISTINCT category_path, count(*) FROM questions GROUP BY category_path")
for r in cursor.fetchall():
    print(r)

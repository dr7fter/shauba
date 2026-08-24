import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

cursor.execute("""
    SELECT id, stem, correct_answer, explanation FROM questions 
    WHERE stem LIKE '%yy''''%' OR stem LIKE '%y y''''%' OR (stem LIKE '%y''''%' AND stem LIKE '%y''%' AND stem NOT LIKE '%x%')
    LIMIT 10
""")
for r in cursor.fetchall():
    print(dict(r))

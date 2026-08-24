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
    WHERE (stem LIKE '%若%' OR stem LIKE '%已知%')
      AND (stem LIKE '%是%' AND stem LIKE '%微分方程%' AND stem LIKE '%的解%')
      AND (stem LIKE '%y''%' OR stem LIKE '%y"%')
      AND id NOT IN (7654, 7655, 7647, 7597, 7629, 7639, 7660, 4437, 4491, 4451, 4464, 4520, 4518, 4519, 7603, 4524)
    LIMIT 10
""")
for r in cursor.fetchall():
    print(dict(r))

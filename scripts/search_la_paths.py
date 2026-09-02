import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

cursor.execute("""
    SELECT DISTINCT category_path FROM questions 
    WHERE category_path LIKE '线性代数%'
    ORDER BY category_path ASC
""")
paths = [r[0] for r in cursor.fetchall()]
print(f"Total Linear Algebra category paths: {len(paths)}")
for p in paths:
    print(" -", p)

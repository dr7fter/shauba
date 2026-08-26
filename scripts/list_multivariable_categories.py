import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

cursor.execute("""
    SELECT category_path, count(*) as cnt 
    FROM questions 
    WHERE category_path LIKE '%多元微分%' OR category_path LIKE '%多元函数微分%'
    GROUP BY category_path
    ORDER BY category_path
""")
for r in cursor.fetchall():
    print(f"{r['category_path']}: {r['cnt']}")

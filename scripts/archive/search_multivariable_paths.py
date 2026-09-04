import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

# Search for relevant category paths
cursor.execute("""
    SELECT DISTINCT category_path FROM questions 
    WHERE category_path LIKE '%多元微分%'
""")
paths = [r[0] for r in cursor.fetchall()]
print("Available multivariable category paths:")
for p in sorted(paths):
    print(" -", p)

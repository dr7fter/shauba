import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

print("=== Categories query ===")
cursor.execute("SELECT id, name, path, depth, math1 FROM categories WHERE name LIKE '%微分%' OR path LIKE '%微分方程%' OR path LIKE '%方程%'")
for r in cursor.fetchall():
    print(dict(r))

print("\n=== Distinct category_paths in questions ===")
cursor.execute("SELECT category_path, count(*) as cnt FROM questions WHERE category_path LIKE '%微分%' OR category_path LIKE '%方程%' GROUP BY category_path")
for r in cursor.fetchall():
    print(dict(r))

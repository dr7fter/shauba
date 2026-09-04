import sqlite3
import os
import sys
import json

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

# Check categories
print("=== Categories related to 微分方程 ===")
cursor.execute("SELECT id, name, parent_id, sort_order FROM categories WHERE name LIKE '%微分方程%' OR name LIKE '%方程%'")
for r in cursor.fetchall():
    print(dict(r))

# Check questions count in these categories or with tags
print("\n=== Questions categorized by 微分方程 ===")
cursor.execute("""
SELECT c.id, c.name, COUNT(q.id) as q_count 
FROM categories c 
LEFT JOIN questions q ON q.category_id = c.id 
WHERE c.name LIKE '%微分方程%' OR c.name LIKE '%方程%'
GROUP BY c.id, c.name
""")
for r in cursor.fetchall():
    print(dict(r))

# Also search questions with tags/stem related to differential equations
cursor.execute("""
SELECT COUNT(*) as total_de_questions
FROM questions
WHERE stem LIKE '%微分方程%' OR stem LIKE '%y''%' OR stem LIKE '%y''''%' OR stem LIKE '%dy%' OR stem LIKE '%特征方程%'
""")
print("\nTotal DE-like questions in DB:", cursor.fetchone()['total_de_questions'])


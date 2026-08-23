import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

cursor.execute("""
SELECT 
    category_path, 
    COUNT(*) as cnt, 
    AVG(difficulty) as avg_diff
FROM questions 
WHERE category_path LIKE '%高等数学 / 微分方程%'
GROUP BY category_path
ORDER BY cnt DESC
""")
for r in cursor.fetchall():
    print(f"{r['cnt']:3d} 题 (难度 {r['avg_diff']:.2f}) | {r['category_path']}")

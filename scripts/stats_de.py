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
    COUNT(*) as total_count,
    SUM(CASE WHEN is_core = 1 THEN 1 ELSE 0 END) as core_count,
    SUM(CASE WHEN question_type = 'choice' THEN 1 ELSE 0 END) as choice_count,
    SUM(CASE WHEN question_type = 'fill' THEN 1 ELSE 0 END) as fill_count,
    SUM(CASE WHEN question_type = 'solution' THEN 1 ELSE 0 END) as solution_count
FROM questions 
WHERE category_path LIKE '%高等数学 / 微分方程%'
""")
r = cursor.fetchone()
print(dict(r))

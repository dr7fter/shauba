import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

cursor.execute("SELECT DISTINCT question_type FROM questions")
print([r[0] for r in cursor.fetchall()])

cursor.execute("""
SELECT 
    COUNT(*) as total_count,
    difficulty,
    question_type
FROM questions 
WHERE category_path LIKE '%高等数学 / 微分方程%'
GROUP BY difficulty, question_type
""")
for r in cursor.fetchall():
    print(dict(r))

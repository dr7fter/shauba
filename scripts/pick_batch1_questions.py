import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

# Search for concept questions (四大金刚 / 可微判定 / 偏导存在)
print("=== Concept Questions ===")
cursor.execute("""
    SELECT id, stem, correct_answer, category_path, question_type 
    FROM questions 
    WHERE category_path LIKE '%高等数学 / 多元微分 / 概念题%'
       OR id IN (2170, 2171, 2172, 2173, 2174, 2175, 2176, 2177, 2178, 2179, 2180)
    LIMIT 15
""")
for r in cursor.fetchall():
    print(dict(r))

# Search for Differentiability definition / piecewise function at (0,0)
print("\n=== Differentiability & Definition Questions ===")
cursor.execute("""
    SELECT id, stem, correct_answer, category_path, question_type 
    FROM questions 
    WHERE stem LIKE '%可微%' AND (stem LIKE '%(0,0)%' OR stem LIKE '%(0, 0)%')
    LIMIT 10
""")
for r in cursor.fetchall():
    print(dict(r))

# Search for Composite function Chain Rule 1st and 2nd order
print("\n=== Composite Chain Rule Questions ===")
cursor.execute("""
    SELECT id, stem, correct_answer, category_path, question_type 
    FROM questions 
    WHERE category_path LIKE '%多元复合函数求偏导%'
      AND (category_path LIKE '%常规一阶%' OR category_path LIKE '%常规二阶%')
    LIMIT 15
""")
for r in cursor.fetchall():
    print(dict(r))

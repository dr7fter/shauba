import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

# Let's inspect 7656
cursor.execute("SELECT id, stem, correct_answer, explanation, options_json FROM questions WHERE id = 7656")
print("=== 7656 ===")
print(dict(cursor.fetchone()))

# Let's search for "已知特解" or "y_1, y_2" or "通解" in questions
cursor.execute("""
    SELECT id, stem, correct_answer, explanation FROM questions 
    WHERE stem LIKE '%y_1%' AND stem LIKE '%y_2%' AND stem LIKE '%微分方程%'
    LIMIT 5
""")
print("\n=== y_1 y_2 questions ===")
for r in cursor.fetchall():
    print(dict(r))

# Let's search for inverse ODE questions (已知...是微分方程的解，求微分方程或待定参数)
cursor.execute("""
    SELECT id, stem, correct_answer, explanation FROM questions 
    WHERE (stem LIKE '%是微分方程%' OR stem LIKE '%是方程%') 
      AND (stem LIKE '%特解%' OR stem LIKE '%的解%')
      AND (stem LIKE '%求%' OR stem LIKE '%则%')
      AND id NOT IN (7654, 7655, 7647, 7597, 7629, 7639, 7660, 4437, 4491, 4451, 4464, 4520, 4518, 4519, 7603, 4524)
    LIMIT 10
""")
print("\n=== Inverse/Structure ODE questions ===")
for r in cursor.fetchall():
    print(dict(r))

# Check 4652, 4659, 4648 (Geometry application)
cursor.execute("SELECT id, stem, correct_answer, explanation FROM questions WHERE id IN (4652, 4659, 4648)")
print("\n=== Geometry ODE questions ===")
for r in cursor.fetchall():
    print(dict(r))

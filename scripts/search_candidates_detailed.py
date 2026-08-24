import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

# Check Target 1 candidate: 7656, 7657, 7658
print("=== Target 1 Candidates ===")
cursor.execute("SELECT id, stem, correct_answer, options_json FROM questions WHERE id IN (7656, 7657, 7658, 7659, 7649, 7650)")
for r in cursor.fetchall():
    print(dict(r))

# Search Target 2: 解的结构 / 逆向待定 (e.g. y_1, y_2, y_3 是方程的解)
print("\n=== Target 2 Candidates ===")
cursor.execute("""
    SELECT id, stem, correct_answer FROM questions 
    WHERE (stem LIKE '%y_1%' OR stem LIKE '%y_2%' OR stem LIKE '%y_3%' OR stem LIKE '%线性无关%' OR stem LIKE '%非齐次线性微分方程%')
      AND (stem LIKE '%特解%' OR stem LIKE '%通解%')
    LIMIT 10
""")
for r in cursor.fetchall():
    print(dict(r))

# Search Target 3: 几何应用 / 物理应用 (列微分方程求曲线)
print("\n=== Target 3 Candidates ===")
cursor.execute("""
    SELECT id, stem, correct_answer FROM questions 
    WHERE (stem LIKE '%曲线上任一点%' OR stem LIKE '%曲线上任意一点%' OR stem LIKE '%切线%' OR stem LIKE '%法线%' OR stem LIKE '%截距%' OR stem LIKE '%围成%')
      AND (stem LIKE '%求该曲线%' OR stem LIKE '%求曲线方程%' OR stem LIKE '%求曲线%' OR stem LIKE '%求 $y=y(x)$%' OR stem LIKE '%求 $f(x)$%')
    LIMIT 10
""")
for r in cursor.fetchall():
    print(dict(r))

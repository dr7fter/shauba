import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

cursor.execute("""
    SELECT id, stem, correct_answer, category_path, question_type, difficulty 
    FROM questions 
    WHERE (category_path LIKE '%多元%' OR category_path LIKE '%偏导%' OR category_path LIKE '%全微分%' OR category_path LIKE '%隐函数%' OR category_path LIKE '%方向导数%')
       OR (id BETWEEN 2170 AND 2300)
       OR (id BETWEEN 2700 AND 2850)
       OR (id BETWEEN 4660 AND 4750)
       OR (stem LIKE '%z = f(%' OR stem LIKE '%u = f(%' OR stem LIKE '%\frac{\partial z}{\partial x}%' OR stem LIKE '%f_x^\prime%' OR stem LIKE '%f_{xx}%')
    ORDER BY id
""")
rows = cursor.fetchall()
print(f"Total multivariable questions found: {len(rows)}")

# Let's group by category or topic
for r in rows:
    print(f"[{r['id']}] ({r['question_type']}, diff {r['difficulty']}) {r['category_path']} -> {r['stem'][:70]}...")

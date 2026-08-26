import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

# Search questions containing multivariable calculus keywords
keywords = ['偏导', '全微分', '多元', '隐函数', '极值', '方向导数', '梯度', '切平面', '法线', '拉格朗日', '链式']
print("=== Search for Multivariable Calculus Questions in shuaba.db ===")

cursor.execute("""
    SELECT id, stem, correct_answer, category_path, question_type, difficulty 
    FROM questions 
    WHERE stem LIKE '%\frac{\partial%' 
       OR stem LIKE '%\partial%' 
       OR stem LIKE '%全微分%' 
       OR stem LIKE '%偏导数%' 
       OR stem LIKE '%偏导%' 
       OR stem LIKE '%二元函数%' 
       OR stem LIKE '%多元函数%' 
       OR stem LIKE '%隐函数%' 
       OR stem LIKE '%方向导数%' 
       OR stem LIKE '%切平面%' 
       OR stem LIKE '%极值%' 
    ORDER BY id
    LIMIT 60
""")
rows = cursor.fetchall()
print(f"Total found matching keywords: {len(rows)}")
for r in rows[:30]:
    print(f"ID: {r['id']} | Type: {r['question_type']} | Diff: {r['difficulty']} | Stem: {r['stem'][:60]}...")

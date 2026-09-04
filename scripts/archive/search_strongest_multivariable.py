import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

print("=== Search for Concept & Differentiability targeted questions ===")
cursor.execute("""
    SELECT id, stem, correct_answer, category_path, question_type, difficulty 
    FROM questions 
    WHERE (category_path LIKE '%多元微分 / 概念题%' OR category_path LIKE '%多元微分 / 重极限%')
      AND id NOT IN (2171, 2187, 2214, 2476, 2481, 2529, 2487, 10713)
    ORDER BY difficulty DESC, id ASC
    LIMIT 10
""")
for r in cursor.fetchall():
    print(f"[{r['id']}] ({r['question_type']}, diff {r['difficulty']}) -> {r['stem'][:70]}...")

print("\n=== Search for Implicit Function Differentiation (Single & System) ===")
cursor.execute("""
    SELECT id, stem, correct_answer, category_path, question_type, difficulty 
    FROM questions 
    WHERE category_path LIKE '%多元隐函数求偏导%'
    ORDER BY difficulty DESC, id ASC
    LIMIT 20
""")
for r in cursor.fetchall():
    print(f"[{r['id']}] ({r['question_type']}, diff {r['difficulty']}) {r['category_path']} -> {r['stem'][:70]}...")

print("\n=== Search for PDE Variable Substitution (偏微分方程代换化简) ===")
cursor.execute("""
    SELECT id, stem, correct_answer, category_path, question_type, difficulty 
    FROM questions 
    WHERE category_path LIKE '%利用变量代换化简偏微分方程%'
    ORDER BY id ASC
    LIMIT 10
""")
for r in cursor.fetchall():
    print(f"[{r['id']}] ({r['question_type']}, diff {r['difficulty']}) {r['category_path']} -> {r['stem'][:70]}...")

print("\n=== Search for Multivariable Extrema (无条件极值 AC-B^2) ===")
cursor.execute("""
    SELECT id, stem, correct_answer, category_path, question_type, difficulty 
    FROM questions 
    WHERE category_path LIKE '%无条件极值%' AND question_type = 'subjective'
    ORDER BY difficulty DESC, id ASC
    LIMIT 10
""")
for r in cursor.fetchall():
    print(f"[{r['id']}] ({r['question_type']}, diff {r['difficulty']}) {r['category_path']} -> {r['stem'][:70]}...")

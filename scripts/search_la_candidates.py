import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

# Search representative questions from each chapter
queries = [
    ("Ch1 行列式", "category_path LIKE '线性代数 / 行列式%'", 3),
    ("Ch2 矩阵与伴随", "category_path LIKE '线性代数 / 矩阵 / 伴随矩阵%' OR category_path LIKE '线性代数 / 矩阵 / 秩%' OR category_path LIKE '线性代数 / 矩阵 / 初等变换%'", 4),
    ("Ch3 向量组与相关性", "category_path LIKE '线性代数 / 向量%'", 3),
    ("Ch4 线性方程组", "category_path LIKE '线性代数 / 线性方程组%'", 4),
    ("Ch5 特征值与相似", "category_path LIKE '线性代数 / 特征值与特征向量%'", 4),
    ("Ch6 二次型", "category_path LIKE '线性代数 / 二次型%'", 3),
]

for name, condition, limit in queries:
    print(f"=== {name} ===")
    cursor.execute(f"""
        SELECT id, stem, correct_answer, category_path, question_type, difficulty 
        FROM questions 
        WHERE {condition}
        ORDER BY difficulty DESC, id ASC
        LIMIT {limit}
    """)
    for r in cursor.fetchall():
        print(f"ID {r['id']} ({r['question_type']}, diff {r['difficulty']}) | {r['category_path']}")
        print(f"  Stem: {r['stem'][:90]}...")
        print(f"  Ans: {str(r['correct_answer'])[:60]}\n")

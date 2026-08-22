import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

def search_area(title, pattern):
    print(f"\n=======================================================")
    print(f"=== {title} ===")
    print(f"=======================================================")
    cursor.execute(f'''
        SELECT id, category_path, question_type, stem, correct_answer, explanation
        FROM questions
        WHERE category_path LIKE ?
        ORDER BY id
    ''', (pattern,))
    rows = cursor.fetchall()
    print(f"Total found: {len(rows)}")
    for r in rows:
        stem = (r['stem'] or '').replace('\n', ' ')
        ans = (r['correct_answer'] or '').replace('\n', ' ')
        if not stem.startswith('![原始题图]'):
            print(f"#{r['id']:5d} [{r['question_type']:12s}] ({r['category_path'].split(' / ')[-1]}): {stem[:100]} | Ans: {ans[:40]}")

search_area("1. 几何应用 (面积/体积/弧长/侧面积/平均值)", "高等数学 / 一元积分 / 积分应用 / 几何应用%")
search_area("2. 物理应用 (做功/压力/质心/引力/路程)", "高等数学 / 一元积分 / 积分应用 / 物理应用%")
search_area("3. 反常积分 (敛散性/含参/参数关系/极限)", "高等数学 / 一元积分 / 反常积分%")

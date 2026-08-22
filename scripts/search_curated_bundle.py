import sqlite3
import os
import json

db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

print("=== 1. SEARCHING CATEGORY TREES IN DB ===")
cursor.execute('''
    SELECT DISTINCT category_path, COUNT(*) as cnt 
    FROM questions 
    WHERE category_path LIKE "%积分%" OR category_path LIKE "%三角%" OR category_path LIKE "%分部%" OR category_path LIKE "%分段%"
    GROUP BY category_path
    ORDER BY cnt DESC
''')
for row in cursor.fetchall()[:30]:
    print(f"{row['cnt']:3d} | {row['category_path']}")

print("\n=== 2. SEARCHING QUESTIONS BY KEYWORDS ===")
categories = {
    "两函数相乘(分部积分)": ["分部", "乘", "xe^", "x\\sin", "x\\cos", "x\\ln", "x\\arctan", "x\\arcsin", "e^x\\sin"],
    "三角函数积分": ["三角", "\\sin", "\\cos", "\\tan", "万能", "点火", "降幂", "积化和差"],
    "分段与绝对值": ["分段", "绝对值", "|x", "\\max", "\\min", "[x]"],
    "定积分特殊性质(区间再现/对称/周期)": ["区间再现", "对称", "周期", "\\pi-x", "f(a+b-x)", "Wallis", "0}^{\\pi}"]
}

for cat_name, kw_list in categories.items():
    print(f"\n--- Category: {cat_name} ---")
    query_conditions = " OR ".join(["stem LIKE ? OR explanation LIKE ? OR category_path LIKE ?" for _ in kw_list])
    params = []
    for kw in kw_list:
        params.extend([f"%{kw}%", f"%{kw}%", f"%{kw}%"])
    
    cursor.execute(f'''
        SELECT id, category_path, question_type, stem, correct_answer
        FROM questions
        WHERE category_path LIKE "高等数学 / 一元积分%"
          AND ({query_conditions})
        LIMIT 15
    ''', params)
    
    rows = cursor.fetchall()
    print(f"Found {len(rows)} matching sample questions:")
    for r in rows[:6]:
        stem = (r['stem'] or '').replace('\n', ' ')
        print(f"  #{r['id']} [{r['question_type']}] ({r['category_path']}): {stem[:80]}...")

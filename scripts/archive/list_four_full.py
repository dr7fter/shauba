import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

def show_group(title, query):
    print(f"\n==========================================")
    print(f"=== {title} ===")
    print(f"==========================================")
    cursor.execute(query)
    for r in cursor.fetchall():
        stem = (r['stem'] or '').replace('\n', ' ')
        ans = (r['correct_answer'] or '').replace('\n', ' ')
        print(f"#{r['id']:5d} [{r['question_type']:15s}] ({r['category_path']})")
        print(f"   Stem: {stem[:100]}")
        print(f"   Ans:  {ans[:60]}")

# 1. 两函数相乘
show_group("1. 两函数相乘 (两函数乘积 / 分部积分 / 递推 / 循环分部)", '''
    SELECT id, question_type, category_path, stem, correct_answer
    FROM questions
    WHERE category_path LIKE "%两函数相乘%"
    ORDER BY id
''')

# 2. 三角相关
show_group("2. 三角相关 (高次幂 / 万能公式 / sincos乘积 / 线性组合)", '''
    SELECT id, question_type, category_path, stem, correct_answer
    FROM questions
    WHERE category_path LIKE "%三角相关%"
    ORDER BY id
''')

# 3. 分段函数 / 绝对值 / 取整
show_group("3. 分段函数 / 绝对值 / 取整", '''
    SELECT id, question_type, category_path, stem, correct_answer
    FROM questions
    WHERE category_path LIKE "%分段函数%" OR category_path LIKE "%取整%" OR category_path LIKE "%含根式 / 根号下绝对值%"
    ORDER BY id
''')

# 4. 定积分特殊题型
show_group("4. 定积分特殊题型 (区间再现 / 奇偶消项 / 变限双重积分 / 周期抵消)", '''
    SELECT id, question_type, category_path, stem, correct_answer
    FROM questions
    WHERE category_path LIKE "%定积分特殊题型%"
    ORDER BY id
''')

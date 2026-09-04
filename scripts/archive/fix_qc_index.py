import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

cursor.execute("SELECT id, category_path FROM questions WHERE category_path LIKE '信号与系统%'")
for q in cursor.fetchall():
    qid = q['id']
    cpath = q['category_path']
    cursor.execute("SELECT id FROM categories WHERE path = ?", (cpath,))
    cat_row = cursor.fetchone()
    if cat_row:
        cat_id = cat_row['id']
        cursor.execute("SELECT * FROM question_categories WHERE question_id = ? AND category_id = ?", (qid, cat_id))
        if not cursor.fetchone():
            cursor.execute("INSERT INTO question_categories (question_id, category_id) VALUES (?, ?)", (qid, cat_id))

conn.commit()
print("Indexed question_categories successfully!")

cursor.execute("SELECT count(*) as cnt FROM question_categories qc JOIN categories c ON qc.category_id = c.id WHERE c.root_name = '信号与系统'")
print(f"Total mapped question_categories for 信号与系统: {cursor.fetchone()['cnt']}")

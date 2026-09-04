import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

# Get max category id
cursor.execute("SELECT MAX(id) as max_id FROM categories")
max_cat_id = cursor.fetchone()['max_id'] or 500

# Let's see unique paths in questions for 信号与系统
cursor.execute("SELECT DISTINCT category_path FROM questions WHERE category_path LIKE '信号与系统%'")
paths = [r['category_path'] for r in cursor.fetchall()]
print("Signals category paths to index:", paths)

# Helper to ensure category node exists
def ensure_cat_path(path_str):
    global max_cat_id
    parts = [p.strip() for p in path_str.split(" / ")]
    current_parent = None
    current_path = ""
    for depth, part in enumerate(parts):
        if depth == 0:
            current_path = part
        else:
            current_path = current_path + " / " + part
        
        cursor.execute("SELECT id FROM categories WHERE path = ?", (current_path,))
        r = cursor.fetchone()
        if r:
            current_parent = r['id']
        else:
            max_cat_id += 1
            cat_id = max_cat_id
            root_name = parts[0]
            sort_key = (depth + 1) * 1024
            cursor.execute('''
                INSERT INTO categories (id, parent_id, name, path, root_name, depth, sort_key, math1)
                VALUES (?, ?, ?, ?, ?, ?, ?, 1)
            ''', (cat_id, current_parent, part, current_path, root_name, depth, sort_key))
            current_parent = cat_id
            print(f"Added category #{cat_id}: {current_path}")
    return current_parent

for p in paths:
    leaf_id = ensure_cat_path(p)

# Now populate question_categories
cursor.execute("PRAGMA table_info(question_categories)")
print("question_categories cols:", [r['name'] for r in cursor.fetchall()])

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
            cursor.execute("INSERT INTO question_categories (question_id, category_id, is_primary) VALUES (?, ?, 1)", (qid, cat_id))

conn.commit()
print("Categories and question_categories indexed successfully!")

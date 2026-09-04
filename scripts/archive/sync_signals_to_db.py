import sqlite3
import os
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

sig_bank_dir = r"E:\考研资料\题库-信号"

# Let's read the questions from E:\考研资料\题库-信号
files = [f for f in os.listdir(sig_bank_dir) if f.endswith(".json")]
print(f"Found {len(files)} questions in {sig_bank_dir}")

# In shuaba.db, let's find the max question id or use IDs starting from 20001 to avoid any conflict with math questions
cursor.execute("SELECT MAX(id) as max_id FROM questions")
row = cursor.fetchone()
max_id = row['max_id'] if row and row['max_id'] else 10000
start_sig_id = max(20000, max_id + 1000)

inserted = 0
for f in sorted(files):
    fpath = os.path.join(sig_bank_dir, f)
    with open(fpath, 'r', encoding='utf-8') as fp:
        qdata = json.load(fp)
    
    local_id = qdata['id']
    target_id = start_sig_id + local_id
    
    stem = qdata.get('stem', '')
    ans = qdata.get('correct_answer', '')
    exp = qdata.get('explanation', '')
    qtype = qdata.get('question_type', 'subjective')
    cat_path = qdata.get('category_path', '信号与系统 / 未分类')
    tags = json.dumps(qdata.get('tags', []), ensure_ascii=False)
    
    # Check if exists by category_path and stem prefix
    cursor.execute("SELECT id FROM questions WHERE category_path = ? AND stem = ?", (cat_path, stem))
    existing = cursor.fetchone()
    if not existing:
        cursor.execute('''
            INSERT INTO questions (id, category_path, question_type, stem, correct_answer, explanation, tags)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (target_id, cat_path, qtype, stem, ans, exp, tags))
        inserted += 1

conn.commit()
print(f"Imported {inserted} Signal and System questions into shuaba.db!")

cursor.execute("SELECT COUNT(*) as cnt FROM questions WHERE category_path LIKE '信号与系统%'")
print(f"Total '信号与系统' questions in DB: {cursor.fetchone()['cnt']}")

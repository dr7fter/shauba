import sqlite3
import os
import json
import hashlib
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

sig_bank_dir = r"E:\考研资料\题库-信号"

files = [f for f in os.listdir(sig_bank_dir) if f.endswith(".json")]
print(f"Found {len(files)} questions in {sig_bank_dir}")

start_sig_id = 20000

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
    source = '考研信号与系统基础母题库'
    content_hash = hashlib.sha256((stem + ans + cat_path).encode('utf-8')).hexdigest()
    
    cursor.execute("SELECT id FROM questions WHERE category_path = ? AND stem = ?", (cat_path, stem))
    existing = cursor.fetchone()
    if not existing:
        cursor.execute('''
            INSERT INTO questions (id, stem, options_json, correct_answer, explanation, source, question_type, category_path, image_paths_json, is_core, difficulty, content_hash)
            VALUES (?, ?, '[]', ?, ?, ?, ?, ?, '[]', 1, 3, ?)
        ''', (target_id, stem, ans, exp, source, qtype, cat_path, content_hash))
        inserted += 1

conn.commit()
print(f"Successfully inserted {inserted} Signal & System questions into database!")

cursor.execute("SELECT id, category_path, stem FROM questions WHERE category_path LIKE '信号与系统%' ORDER BY id")
rows = cursor.fetchall()
print(f"\nTotal '信号与系统' questions currently active in DB: {len(rows)}")
for r in rows:
    stem_snippet = r['stem'].split(chr(10))[0][:60]
    print(f"#{r['id']}: [{r['category_path']}] -> {stem_snippet}")

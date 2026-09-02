import sqlite3
import os
import json

db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

print('=== 1. ALL ATTEMPTS COUNT ===')
cursor.execute('SELECT COUNT(*) FROM attempts')
print('Total attempts in DB:', cursor.fetchone()[0])

print('\n=== 2. LATEST ATTEMPTS (LAST 30) ===')
cursor.execute('''
    SELECT a.id, a.question_id, a.result, a.outcome, a.self_rating, a.duration_seconds, a.created_at, a.evidence_source,
           q.stem, q.category_path
    FROM attempts a
    LEFT JOIN questions q ON a.question_id = q.id
    ORDER BY a.created_at DESC
    LIMIT 30
''')
attempts = cursor.fetchall()
for att in attempts:
    stem = (att['stem'] or '').replace('\n', ' ')
    print(f"Attempt #{att['id']}: Question #{att['question_id']}, Result={att['result']}, Rating={att['self_rating']}, Time={att['duration_seconds']}s, At={att['created_at']}")
    print(f"   Path: {att['category_path']}")
    print(f"   Stem: {stem[:70]}...")

print('\n=== 3. 16 RECOMMENDED QUESTIONS STATUS ===')
rec_ids = [10623, 1284, 10624, 2008, 1024, 1026, 1029, 7052, 981, 10576, 7090, 10590, 7074, 7088, 7105, 1266]
for qid in rec_ids:
    cursor.execute('''
        SELECT a.result, a.outcome, a.self_rating, a.duration_seconds, a.created_at, a.evidence_source
        FROM attempts a
        WHERE a.question_id = ?
        ORDER BY a.created_at DESC
        LIMIT 1
    ''', (qid,))
    row = cursor.fetchone()
    if row:
        print(f"Q #{qid}: Result={row['result']}, Rating={row['self_rating']}, Duration={row['duration_seconds']}s, Source={row['evidence_source']}, At={row['created_at']}")
    else:
        print(f"Q #{qid}: [NO ATTEMPT RECORD FOUND]")

print('\n=== 4. NOTES TABLE ===')
cursor.execute('SELECT * FROM notes ORDER BY updated_at DESC LIMIT 10')
notes = cursor.fetchall()
for n in notes:
    print(f"Note on Q #{n['question_id']}: {n['content'][:100]}")

print('\n=== 5. PROGRESS & MASTERY ===')
for qid in rec_ids:
    cursor.execute('SELECT * FROM progress WHERE question_id = ?', (qid,))
    p = cursor.fetchone()
    if p:
        print(f"Progress #{qid}: Interval={p['review_interval']}, Next={p['next_review']}, Reps={p['repetitions']}, Lapses={p['lapses']}")

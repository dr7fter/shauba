import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

batch2_ids = [1041, 1157, 7114, 10553, 1008, 7160, 1005, 7168, 7173, 7179, 10563, 7218, 7206, 2002, 7209, 7219]

print("=== BATCH 2 (16 QUESTIONS) ATTEMPT DETAILS ===")
b2_correct = 0
b2_partial = 0
b2_wrong = 0
b2_time = 0

for qid in batch2_ids:
    cursor.execute('''
        SELECT a.id, a.question_id, a.result, a.outcome, a.self_rating, a.duration_seconds, a.attempted_at,
               q.stem, q.category_path, q.question_type, q.correct_answer
        FROM questions q
        LEFT JOIN attempts a ON a.question_id = q.id
        WHERE q.id = ?
        ORDER BY a.attempted_at DESC
        LIMIT 1
    ''', (qid,))
    r = cursor.fetchone()
    if r and r['attempted_at']:
        res = r['outcome'] or r['result']
        dur = r['duration_seconds'] or 0
        b2_time += dur
        if res == 'correct': b2_correct += 1
        elif res == 'partial': b2_partial += 1
        else: b2_wrong += 1
        stem = (r['stem'] or '').replace('\n', ' ')
        print(f"Q #{r['question_id']:5d} [{r['question_type']:12s}] -> Result: {res:8s} | Rating: {r['self_rating']} | Time: {dur//60}m{dur%60:02d}s ({dur:3d}s) | Path: {r['category_path']}")
        print(f"   Stem: {stem[:90]}")
    else:
        print(f"Q #{qid}: [NO ATTEMPT YET]")

print(f"\nBatch 2 Summary: Total={len(batch2_ids)}, Correct={b2_correct}, Partial={b2_partial}, Wrong={b2_wrong}, Time={b2_time//60}m {b2_time%60}s")

print("\n=== OVERALL ATTEMPTS (LAST 40) ===")
cursor.execute('''
    SELECT a.id, a.question_id, a.result, a.outcome, a.self_rating, a.duration_seconds, a.attempted_at, q.category_path
    FROM attempts a
    LEFT JOIN questions q ON a.question_id = q.id
    ORDER BY a.attempted_at DESC
    LIMIT 40
''')
for r in cursor.fetchall():
    print(f"#{r['id']:3d} | Q #{r['question_id']:5d} | {r['result']:8s} | {r['outcome']:8s} | Rating={r['self_rating']} | {r['duration_seconds']:3d}s | {r['attempted_at']} | {r['category_path']}")

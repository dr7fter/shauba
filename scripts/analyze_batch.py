import sqlite3
import os
import json

db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

rec_ids = [10623, 1284, 10624, 2008, 1024, 1026, 1029, 7052, 981, 10576, 7090, 10590, 7074, 7088, 7105, 1266]

print("=== DETAILED BREAKDOWN OF 16 QUESTIONS ===")
for qid in rec_ids:
    cursor.execute('''
        SELECT q.id, q.stem, q.correct_answer, q.explanation, q.category_path, q.question_type,
               a.result, a.outcome, a.self_rating, a.duration_seconds, a.attempted_at, a.evidence_source
        FROM questions q
        LEFT JOIN attempts a ON a.question_id = q.id
        WHERE q.id = ?
        ORDER BY a.attempted_at DESC
        LIMIT 1
    ''', (qid,))
    row = cursor.fetchone()
    if row:
        stem = (row['stem'] or '').replace('\n', ' ')
        exp = (row['explanation'] or '').replace('\n', ' ')
        print(f"\n[{'有理函数' if qid in rec_ids[:8] else '根式无理函数'}] Q #{row['id']} ({row['question_type']}):")
        print(f"  Attempt: Result={row['result']} (Outcome={row['outcome']}), SelfRating={row['self_rating']}, Duration={row['duration_seconds']}s ({row['duration_seconds']//60}m{row['duration_seconds']%60}s)")
        print(f"  Path: {row['category_path']}")
        print(f"  Stem: {stem[:120]}")
        print(f"  Ans: {row['correct_answer']}")
        print(f"  Exp: {exp[:150]}...")

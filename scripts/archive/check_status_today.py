import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

cursor.execute("SELECT task_id, status, created_at, started_at, completed_at FROM recommendation_batches ORDER BY created_at DESC LIMIT 5")
for r in cursor.fetchall():
    print(f"Batch task_id: {r['task_id']}, status: {r['status']}, started: {r['started_at']}, completed: {r['completed_at']}")

cursor.execute("SELECT id, question_id, result, outcome, self_rating, duration_seconds, attempted_at FROM attempts ORDER BY attempted_at DESC LIMIT 20")
rows = cursor.fetchall()
print(f"\nRecent {len(rows)} attempts in DB:")
for r in rows:
    print(f"Attempt: {r['id']}, Q: {r['question_id']}, res: {r['result']}, outcome: {r['outcome']}, dur: {r['duration_seconds']}s, at: {r['attempted_at']}")

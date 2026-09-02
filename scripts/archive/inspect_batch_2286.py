import sqlite3
import os
import sys
import json

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

cursor.execute("SELECT payload_json FROM codex_inbox WHERE task_id='SB-BATCH-20260828-2286'")
r = cursor.fetchone()
if r:
    data = json.loads(r['payload_json'])
    print(f"Summary: {data.get('summary')}")
    print("\nBatch attempts diagnosis summary:")
    for a in data.get('batchAttempts', []):
        print(f"- Q{a['questionId']}: verdict={a.get('verdict')}, result={a.get('result')}, rating={a.get('rating')}")
        print(f"  Summary: {a.get('summary')}")
        print(f"  EarliestError: {a.get('earliestError')}")
        print(f"  Advice: {a.get('advice')}\n")

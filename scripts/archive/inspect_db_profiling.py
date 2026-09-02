import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = [r[0] for r in cursor.fetchall()]
print(f"Tables in shuaba.db: {tables}")

for t in ['learning_diagnoses', 'codex_analysis_signals', 'attempts', 'elo_events', 'recommendation_batches']:
    if t in tables:
        cursor.execute(f"PRAGMA table_info({t})")
        cols = [r['name'] for r in cursor.fetchall()]
        print(f"\nColumns in {t}: {cols}")

import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

# Let's inspect chapters/tags/topics or attempts count
cursor.execute("SELECT count(*) as total_attempts FROM attempts")
print(f"Total attempts: {cursor.fetchone()['total_attempts']}")

cursor.execute("SELECT DISTINCT chapter FROM questions WHERE chapter IS NOT NULL")
chapters = [r['chapter'] for r in cursor.fetchall()]
print(f"Chapters in DB: {chapters}")

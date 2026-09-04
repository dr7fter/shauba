import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

ids = [2783, 2784, 10714, 10716, 2767, 2566, 2777, 2765]
cursor.execute(f"SELECT id, stem, correct_answer FROM questions WHERE id IN ({','.join(map(str, ids))})")
rows = cursor.fetchall()
print(f"Verified {len(rows)}/8 questions in DB:")
for r in rows:
    print(f"Q{r[0]}: {r[1][:60]}...")

import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

ids = [2758, 2733, 2768, 2719, 2766, 2291, 2352, 2356, 1238, 1241]
cursor.execute(f"SELECT id, stem, correct_answer, category_path FROM questions WHERE id IN ({','.join(map(str, ids))})")
rows = cursor.fetchall()
print(f"Verified {len(rows)}/10 questions in DB:")
for r in rows:
    print(f"Q{r[0]}: {r[3]} | {r[1][:60]}... -> {str(r[2])[:30]}")

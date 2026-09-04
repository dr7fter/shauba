import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

ids = [5615, 5566, 177, 198, 370, 395, 446, 514, 533, 664, 675, 687, 808, 837]
cursor.execute(f"SELECT id, stem, correct_answer FROM questions WHERE id IN ({','.join(map(str, ids))})")
rows = cursor.fetchall()
print(f"Verified {len(rows)}/14 Linear Algebra questions in DB:")
for r in rows:
    print(f"Q{r[0]}: {r[1][:70]}...")

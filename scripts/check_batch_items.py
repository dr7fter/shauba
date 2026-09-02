import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

cursor.execute("SELECT item_index, question_id, completed_at, dropped_at FROM recommendation_batch_items WHERE task_id='SB-REC-20260826-7096' ORDER BY item_index ASC")
rows = cursor.fetchall()
for r in rows:
    print(f"Item {r['item_index']}: Q{r['question_id']}, completed: {r['completed_at']}, dropped: {r['dropped_at']}")

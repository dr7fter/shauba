import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

cursor.execute("SELECT id, stem, correct_answer, analysis FROM questions WHERE id=2946")
r = cursor.fetchone()
print(f"ID {r['id']}: Stem:\n{r['stem']}\n")
print(f"Correct: {r['correct_answer']}")
print(f"Analysis:\n{r['analysis']}")

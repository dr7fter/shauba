import sqlite3
import os
import shutil
import sys

sys.stdout.reconfigure(encoding='utf-8')

# 1. Clean up shuaba.db
db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

cursor.execute("DELETE FROM question_categories WHERE question_id >= 20000")
cursor.execute("DELETE FROM questions WHERE id >= 20000 OR category_path LIKE '信号与系统%'")
cursor.execute("DELETE FROM categories WHERE root_name = '信号与系统' OR path LIKE '信号与系统%'")
conn.commit()
print("Cleaned up 信号与系统 records from shuaba.db")

# 2. Clean up E:\考研资料\题库-信号
sig_dir = r"E:\考研资料\题库-信号"
if os.path.exists(sig_dir):
    shutil.rmtree(sig_dir, ignore_errors=True)
    print(f"Removed directory: {sig_dir}")

conn.close()

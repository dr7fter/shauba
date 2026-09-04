import sqlite3
import os
import glob

appdata = os.environ.get('APPDATA', r'C:\Users\86136\AppData\Roaming')
inbox_dir = os.path.join(appdata, 'com.shuaba.math', 'codex-inbox')
print("Inbox dir:", inbox_dir)
if os.path.exists(inbox_dir):
    files = glob.glob(os.path.join(inbox_dir, "*.json"))
    print("Inbox files:", files)
    for f in files:
        print("File:", os.path.basename(f), "Size:", os.path.getsize(f))
        with open(f, 'r', encoding='utf-8') as fp:
            print(fp.read()[:200])

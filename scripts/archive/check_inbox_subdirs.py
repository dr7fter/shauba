import os
import glob

appdata = os.environ.get('APPDATA', r'C:\Users\86136\AppData\Roaming')
inbox_dir = os.path.join(appdata, 'com.shuaba.math', 'codex-inbox')
for root, dirs, files in os.walk(inbox_dir):
    print("Directory:", root)
    for f in files:
        fpath = os.path.join(root, f)
        print("  -", f, "Size:", os.path.getsize(fpath))

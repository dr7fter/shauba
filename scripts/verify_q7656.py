import json
import os

target_file = os.path.expandvars(r'%APPDATA%\com.shuaba.math\codex-inbox\SB-20260824-7656-2358.json')
with open(target_file, 'r', encoding='utf-8') as f:
    data = json.load(f)

print("JSON file verified!")
print(f"Task ID: {data['taskId']}, Kind: {data['kind']}, Verdict: {data['verdict']}, Rating: {data['rating']}")

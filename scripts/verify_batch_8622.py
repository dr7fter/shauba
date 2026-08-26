import json
import os

target_file = os.path.expandvars(r'%APPDATA%\com.shuaba.math\codex-inbox\SB-BATCH-20260825-8622.json')
with open(target_file, 'r', encoding='utf-8') as f:
    data = json.load(f)

print(f"Verified batch JSON: taskId={data['taskId']}, attempts={len(data['batchAttempts'])}")
for att in data['batchAttempts']:
    print(f"  Q{att['questionId']}: verdict={att['verdict']}, rating={att['rating']}, tier={att['ratingTier']}")

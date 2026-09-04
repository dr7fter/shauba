import json
import os

target_file = os.path.expandvars(r'%APPDATA%\com.shuaba.math\codex-inbox\SB-BATCH-20260824-6191.json')
with open(target_file, 'r', encoding='utf-8') as f:
    data = json.load(f)

print("JSON file verified!")
print(f"Task ID: {data['taskId']}, Kind: {data['kind']}, Total attempts: {len(data['batchAttempts'])}")
for att in data['batchAttempts']:
    print(f"Q{att['questionId']}: verdict={att['verdict']}, rating={att['rating']}, ratingTier={att['ratingTier']}")

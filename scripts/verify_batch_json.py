import json
import os

target_file = os.path.expandvars(r'%APPDATA%\com.shuaba.math\codex-inbox\SB-BATCH-20260822-1972.json')
with open(target_file, 'r', encoding='utf-8') as f:
    data = json.load(f)

print(f"Loaded successfully! Kind: {data['kind']}, Attempts: {len(data['batchAttempts'])}")
for att in data['batchAttempts']:
    print(f"Q{att['questionId']}: result={att['result']}, selfRating={att['selfRating']}, verdict={att['verdict']}, duration={att['durationSeconds']}s")

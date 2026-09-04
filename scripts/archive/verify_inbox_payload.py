import json
import os

target_file = os.path.expandvars(r'%APPDATA%\com.shuaba.math\codex-inbox\SB-BATCH-20260825-8622.json')
with open(target_file, 'r', encoding='utf-8') as f:
    data = json.load(f)

print("Validating all batch attempts in SB-BATCH-20260825-8622.json:")
for att in data['batchAttempts']:
    res = att['result']
    ver = att['verdict']
    consistent = (
        (res == "uncertain" and ver == "uncertain") or
        (res == "correct" and ver in ["correct", "partial"]) or
        (res == "wrong" and ver in ["partial", "incorrect"])
    )
    rating = att['rating']
    print(f"  Q{att['questionId']}: result='{res}', verdict='{ver}', consistent={consistent}, rating={rating}")
    assert consistent, f"Inconsistency for Q{att['questionId']}"
    assert 1 <= att['selfRating'] <= 4
    assert 0.0 <= rating <= 2.5
print("All 8 questions passed strict validation rules!")

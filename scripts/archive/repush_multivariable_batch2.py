import json
import sqlite3
import os
import random
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

ids = [2188, 2553, 2593, 2600, 2535, 2537, 2695, 2721]
cursor.execute(f"SELECT id, stem, correct_answer FROM questions WHERE id IN ({','.join(map(str, ids))})")
rows = cursor.fetchall()
print(f"Verified {len(rows)} questions in DB:")
for r in rows:
    print(f"ID: {r['id']} -> {r['stem'][:60]}...")

appdata = os.environ.get('APPDATA', r'C:\Users\86136\AppData\Roaming')
inbox_dir = os.path.join(appdata, 'com.shuaba.math', 'codex-inbox')
os.makedirs(inbox_dir, exist_ok=True)

task_id = f"SB-REC-20260826-{random.randint(1000, 9999)}"
target_file = os.path.join(inbox_dir, f"{task_id}.json")

payload = {
  "schemaVersion": 1,
  "kind": "recommendation",
  "taskId": task_id,
  "questionId": None,
  "summary": "【多元微分第二批 · 进阶硬核母题组】：靶向精准补齐可微性判定、攻克隐函数（单方程/方程组）求导天花板、二阶PDE变量代换化简与多元无条件/隐函数极值压轴题！",
  "verdict": None,
  "earliestError": None,
  "errorTags": [],
  "weaknessTags": ["可微性定义式检验", "抽象隐函数二阶偏导", "方程组隐函数求导", "偏微分方程坐标代换", "多元函数无条件极值与隐函数极值"],
  "advice": None,
  "betterSolution": None,
  "confidence": 0.98,
  "recommendedQuestionIds": ids,
  "recommendationReason": "根据上一轮战报画像精准定制：1) #2188 靶向纠偏可微性极坐标判别；2) #2553, #2593, #2600 彻底打通单方程、二阶抽象方程与方程组隐函数求导；3) #2535, #2537 攻克 12 分考研大题 PDE 代换与通解还原；4) #2695, #2721 掌握 AC-B² 与隐函数极值满分大题范式。"
}

with open(target_file, 'w', encoding='utf-8') as f:
    json.dump(payload, f, ensure_ascii=False, indent=2)

print(f"\nSuccessfully generated fresh recommendation file: {target_file}")
print(f"Task ID: {task_id}")

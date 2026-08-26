import json
import os
import random

appdata = os.environ.get('APPDATA', r'C:\Users\86136\AppData\Roaming')
inbox_dir = os.path.join(appdata, 'com.shuaba.math', 'codex-inbox')
os.makedirs(inbox_dir, exist_ok=True)

task_id = f"SB-REC-20260825-{random.randint(1000, 9999)}"
target_file = os.path.join(inbox_dir, f"{task_id}.json")

recommended_ids = [2171, 2187, 2214, 2476, 2481, 2529, 2487, 10713]

payload = {
  "schemaVersion": 1,
  "kind": "recommendation",
  "taskId": task_id,
  "questionId": None,
  "summary": "多元函数微分学 · 第一批母题组（概念四大金刚辨析 + 复合函数一阶/二阶链式求导硬功）",
  "verdict": None,
  "earliestError": None,
  "errorTags": [],
  "weaknessTags": ["多元函数连续可微概念", "抽象复合函数链式法则", "二阶混合偏导数"],
  "advice": None,
  "betterSolution": None,
  "confidence": 0.95,
  "recommendedQuestionIds": recommended_ids,
  "recommendationReason": "多元微分第一阶段奠基精练：1) #2171, #2187 扫清四大金刚概念与经典反例；2) #2214 攻克可微性定义式极限证明；3) #2476, #2481, #2529 熟练一阶与嵌套链式求导；4) #2487, #10713 夯实二阶混合偏导计算硬功。"
}

with open(target_file, 'w', encoding='utf-8') as f:
    json.dump(payload, f, ensure_ascii=False, indent=2)

print(f"Successfully generated recommendation file: {target_file}")
print(f"Task ID: {task_id}")

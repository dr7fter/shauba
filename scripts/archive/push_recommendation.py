import json
import os
import random

appdata = os.environ.get('APPDATA', r'C:\Users\86136\AppData\Roaming')
inbox_dir = os.path.join(appdata, 'com.shuaba.math', 'codex-inbox')
os.makedirs(inbox_dir, exist_ok=True)

task_id = f"SB-REC-20260824-{random.randint(1000, 9999)}"
target_file = os.path.join(inbox_dir, f"{task_id}.json")

payload = {
  "schemaVersion": 1,
  "kind": "recommendation",
  "taskId": task_id,
  "questionId": None,
  "summary": "常微分方程 3 题靶向收尾封盘组（精准狙击不显含 $x$ 降阶微元合法性、二阶非齐次线性解结构与几何应用建模）",
  "verdict": None,
  "earliestError": None,
  "errorTags": [],
  "weaknessTags": ["不显含x可降阶微分方程", "非齐次线性微分方程解的结构", "微分方程切线几何建模"],
  "advice": None,
  "betterSolution": None,
  "confidence": 0.95,
  "recommendedQuestionIds": [7656, 4426, 4659],
  "recommendationReason": "根据前两轮作答数据精准定位的三大靶向题：1) #7656 纠正高阶不显含 $x$ 伪积分；2) #4426 强化已知解结构直接写通解；3) #4659 强化考研切线面积微分方程建模。"
}

with open(target_file, 'w', encoding='utf-8') as f:
    json.dump(payload, f, ensure_ascii=False, indent=2)

print(f"Successfully generated recommendation file: {target_file}")

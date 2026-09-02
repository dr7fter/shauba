import json
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

task_id = "SB-20260831-278-3754"
inbox_dir = os.path.expandvars(r"%APPDATA%\com.shuaba.math\codex-inbox")
out_path = os.path.join(inbox_dir, f"{task_id}.json")

payload = {
    "schemaVersion": 1,
    "kind": "analysis",
    "taskId": task_id,
    "questionId": 278,
    "summary": "【满分秒杀！矩阵代数消元封神现场】从 $A(A-B)=E$ 精准解出 $B = A-A^{-1}$，代入原式展开 $A^{-1}(A-A^{-1})-(A-A^{-1})A^{-1}+2A = E-(A^{-1})^2-E+(A^{-1})^2+2A = 2A$，因 $A$ 可逆锁定 $r(2A)=n$！",
    "verdict": "correct",
    "earliestError": None,
    "errorTags": [],
    "weaknessTags": [],
    "advice": "消元法 $B=A-A^{-1}$ 极其漂亮！记住另一条 5 秒秒杀性质：$A(A-B)=E \\implies A$ 与 $(A-B)$ 互逆必可交换 $\\implies A^2-AB = A^2-BA \\implies AB=BA$，直接消去 $AB-BA=O$！",
    "betterSolution": "因 $A(A-B)=E$，故 $A$ 与 $A-B$ 互为逆矩阵，因而必可交换：$A(A-B)=(A-B)A \\implies A^2-AB = A^2-BA \\implies AB=BA$。故 $AB-BA+2A = 2A$。又 $|A||A-B|=1 \\ne 0 \\implies A$ 可逆，故 $r(AB-BA+2A) = r(2A) = n$。",
    "confidence": 0.98,
    "rating": 1.35,
    "ratingTier": "S",
    "difficultyMultiplier": 1.05,
    "dimensions": {
        "rigor": {"score": 95, "confidence": 0.95, "evidence": "从矩阵求逆到乘法结合律展开与满秩判定严密规范"},
        "computation": {"score": 95, "confidence": 0.95, "evidence": "代数展开与 $(A^{-1})^2$ 抵消零失误"},
        "modeling": {"score": 95, "confidence": 0.95, "evidence": "矩阵方程消元模型满分"},
        "methodUse": {"score": 95, "confidence": 0.95, "evidence": "熟练掌握逆矩阵代数变换"},
        "speed": {"score": 95, "confidence": 0.95, "evidence": "思路通畅，极速解出"},
        "strategyInsight": {"score": 95, "confidence": 0.95, "evidence": "将未知矩阵 B 化为 A 的代数多项式，直觉顶级", "techniqueLevel": 3, "independentDiscovery": "confirmed"}
    },
    "recommendedQuestionIds": [],
    "recommendationReason": None
}

with open(out_path, "w", encoding="utf-8") as f:
    json.dump(payload, f, ensure_ascii=False, indent=2)

print(f"Analysis grading report successfully written to {out_path}")

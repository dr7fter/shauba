import json
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

task_id = "SB-BATCH-20260831-4073"
inbox_dir = os.path.expandvars(r"%APPDATA%\com.shuaba.math\codex-inbox")
out_path = os.path.join(inbox_dir, f"{task_id}.json")

batch_attempts = [
    # Q1: 148
    {
        "questionId": 148,
        "result": "wrong",
        "selfRating": 1,
        "durationSeconds": 421,
        "summary": "草稿写“不会写”。矩阵分式通分不可直接套用标量除法，核心在于“左右夹击提取公因式”：$A^{-1}+B^{-1} = A^{-1}(B+A)B^{-1}$，两边直接取逆即得 $B(A+B)^{-1}A$。",
        "verdict": "incorrect",
        "earliestError": "首行：未掌握矩阵分式求逆的左右提公因式法 $A^{-1}+B^{-1} = A^{-1}(A+B)B^{-1}$",
        "errorTags": ["概念盲区"],
        "weaknessTags": ["矩阵分式左右提取公因式", "矩阵和的逆矩阵"],
        "advice": "牢记矩阵求逆黄金法则：看到 $A^{-1}+B^{-1}$，两边夹击提公因式 $A^{-1}(B+A)B^{-1}$，整体取逆直接颠倒次序得 $B(A+B)^{-1}A$（或 $A(A+B)^{-1}B$）！",
        "betterSolution": "因 $A^{-1}+B^{-1} = A^{-1}(B+A)B^{-1}$，两边取逆：$(A^{-1}+B^{-1})^{-1} = [A^{-1}(A+B)B^{-1}]^{-1} = (B^{-1})^{-1}(A+B)^{-1}(A^{-1})^{-1} = B(A+B)^{-1}A$。",
        "confidence": 0.98,
        "rating": 0.50,
        "ratingTier": "D",
        "difficultyMultiplier": 1.05,
        "dimensions": {
            "rigor": {"score": 50, "confidence": 0.95, "evidence": "草稿未写出推导"},
            "computation": {"score": 50, "confidence": 0.95, "evidence": "未动笔"},
            "modeling": {"score": 50, "confidence": 0.95, "evidence": "矩阵分式求逆建模盲区"},
            "methodUse": {"score": 50, "confidence": 0.95, "evidence": "未运用矩阵乘法结合律提取公因式"},
            "speed": {"score": 70, "confidence": 0.95, "evidence": "7分01秒"},
            "strategyInsight": {"score": 50, "confidence": 0.95, "evidence": "概念盲区", "techniqueLevel": 3, "independentDiscovery": "uncertain"}
        }
    },
    # Q2: 149
    {
        "questionId": 149,
        "result": "wrong",
        "selfRating": 1,
        "durationSeconds": 730,
        "summary": "草稿敏锐发现了 $A^2+A+E = A^3+E$，但随后引入求逆公式陷入死循环（“感觉思路好乱”）。矩阵高次多项式求逆通法为“待定系数降次法”：设 $(A^2+A+E)(xA+yE)=E$，展开代入 $A^3=A^2+A$ 瞬间解得 $x=-\\frac{1}{2}, y=1$，即 $E-\\frac{1}{2}A$。",
        "verdict": "incorrect",
        "earliestError": "第 4 行：试图对 $(A+E)(A^2-A+E)$ 展开两边求逆导致引入未知逆矩阵项陷入死循环",
        "errorTags": ["战术绕路", "概念盲区"],
        "weaknessTags": ["矩阵多项式待定系数求逆", "矩阵方程降次化简"],
        "advice": "多项式矩阵求逆放弃因式分解死胡同，直接用待定系数法：设逆为 $xA+yE$，展开代入降次关系式，恒等对比常数与各项系数，30 秒直出！",
        "betterSolution": "设 $(A^2+A+E)(xA+yE) = E$。展开得 $xA^3 + (x+y)A^2 + (x+y)A + yE = E$。代入 $A^3 = A^2+A$ 得 $(2x+y)A^2 + (2x+y)A + yE = E$。令 $2x+y=0, y=1 \\implies x=-\\frac{1}{2}$，故逆矩阵为 $E - \\frac{1}{2}A$。",
        "confidence": 0.98,
        "rating": 0.55,
        "ratingTier": "D",
        "difficultyMultiplier": 1.05,
        "dimensions": {
            "rigor": {"score": 60, "confidence": 0.95, "evidence": "代数变形有探索但陷入逻辑循环"},
            "computation": {"score": 60, "confidence": 0.95, "evidence": "因式分解正确但未能求出结果"},
            "modeling": {"score": 55, "confidence": 0.95, "evidence": "未建立待定系数求逆模型"},
            "methodUse": {"score": 55, "confidence": 0.95, "evidence": "未运用矩阵降次法"},
            "speed": {"score": 50, "confidence": 0.95, "evidence": "12分10秒严重超时"},
            "strategyInsight": {"score": 65, "confidence": 0.95, "evidence": "发现了 A^3+E 关系但未找到出口", "techniqueLevel": 3, "independentDiscovery": "uncertain"}
        }
    }
]

payload = {
    "schemaVersion": 1,
    "kind": "batch",
    "taskId": task_id,
    "summary": "【矩阵代数求逆专项排雷 · 2 题深度批改】：学员已敏锐观察到代数多项式关系，但受困于传统因式分解与分式思维陷阱。本批改精准注入「左右夹击提公因式法」与「多项式待定系数降次法」两大万能母模板，彻底扫清此类题目障碍。",
    "errorTags": ["概念盲区", "战术绕路"],
    "weaknessTags": ["矩阵分式左右提取公因式", "矩阵多项式待定系数求逆"],
    "confidence": 0.98,
    "recommendedQuestionIds": [],
    "batchAttempts": batch_attempts
}

with open(out_path, "w", encoding="utf-8") as f:
    json.dump(payload, f, ensure_ascii=False, indent=2)

print(f"Batch grading report successfully written to {out_path}")

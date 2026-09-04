import json
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

task_id = "SB-REC-20260827-8832"
inbox_dir = os.path.expandvars(r"%APPDATA%\com.shuaba.math\codex-inbox")
out_path = os.path.join(inbox_dir, f"{task_id}.json")

payload = {
    "schemaVersion": 2,
    "kind": "recommendation",
    "taskId": task_id,
    "questionId": None,
    "summary": "多元微分大圆满封盘组（8题）：攻坚拉格朗日条件极值、闭区域最值、空间切平面与方向导数，并抽检方程组微分消元（E-003）。包含 4 精做 + 2 主思路 + 2 快筛。",
    "goal": "一举扫清多元微分最后两个考纲专题（拉格朗日条件极值、数一切平面与方向导数），并完成 48 小时方程组消元排期抽测，达成多元微分 100% 全考纲大圆满封盘！",
    "estimatedMinutes": 75,
    "recommendedQuestionIds": [2783, 2784, 10714, 10716, 2767, 2566, 2777, 2765],
    "recommendationOrder": [2783, 2784, 10714, 10716, 2767, 2566, 2777, 2765],
    "questionRoles": {
        "2783": "integration",
        "2784": "integration",
        "10714": "diagnosis",
        "10716": "method_choice",
        "2767": "consolidate",
        "2566": "review",
        "2777": "timed",
        "2765": "timed"
    },
    "coverage": [
        {
            "knowledge": "数一专项：空间曲面切平面、法线与闭区域最值综合大题",
            "questionIds": [2783],
            "priority": "high"
        },
        {
            "knowledge": "数一专项：方向导数、偏积分还原原函数与闭区域最值综合大题",
            "questionIds": [2784],
            "priority": "high"
        },
        {
            "knowledge": "拉格朗日乘数法条件极值（单约束与多元几何代数模型）",
            "questionIds": [10714, 10716],
            "priority": "high"
        },
        {
            "knowledge": "有界闭区域最值求解（内部驻点 + 椭圆边界条件极值对比）",
            "questionIds": [2767],
            "priority": "high"
        },
        {
            "knowledge": "48小时排期抽检：含参方程组 G(x,y,t)=0 微分消元（E-003）",
            "questionIds": [2566],
            "priority": "high"
        },
        {
            "knowledge": "闭区域最值与最值点位置定性分析（快筛）",
            "questionIds": [2777, 2765],
            "priority": "medium"
        }
    ],
    "noveltyPlan": [
        "将多元偏导计算与空间几何切平面（数一必考）以及方向导数矢量公式进行大题综合。",
        "将无条件极值升级为拉格朗日乘数法约束优化与闭区域最值对比。",
        "对含参方程组采用隐式 G(x,y,t)=0 结构检验 dt 消元反射。"
    ],
    "successCriteria": [
        "精做 4 题（#2783, #2784, #10714, #2767）：完整写出切平面法向量、方向导数点乘式、拉格朗日函数驻点方程与闭区域边界最值比较步骤。",
        "主思路 2 题（#10716, #2566）：90 秒内写出拉格朗日乘子构造式与 dt 消元第一步微分等式。",
        "快筛 2 题（#2777, #2765）：2 分钟内准确分析圆域极值与零边界内部极值点定性。",
        "完成后记录亲笔自省小结，同步沉淀至 characteristic.md。"
    ],
    "recommendationReason": "依据画像 v2.0 与考研数一大纲，多元微分主干计算已基本打通，仅剩拉格朗日条件极值、闭区域最值、空间曲面切平面与方向导数 2 个小专题未实测。本组 8 题精选 2 道数一高分综合母题（#2783, #2784）与拉格朗日核心题，并联动排期表抽检 #2566 方程组消元，实现 75 分钟轻量高效的多元微分大圆满封盘！",
    "sourceEvidenceIds": ["E-003", "Q2783", "Q2784", "Q10714", "Q2566"],
    "excludedQuestionIds": [],
    "fallbackPlan": "若总耗时超过 75 分钟，可在完成前 5 题后暂停；遇到无入口卡壳题目严格遵守 3-12 分钟止损协议。",
    "confidence": 0.95
}

with open(out_path, "w", encoding="utf-8") as f:
    json.dump(payload, f, ensure_ascii=False, indent=2)

print(f"Successfully generated recommendation batch file: {out_path}")

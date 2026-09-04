import json
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

task_id = "SB-REC-20260828-4412"
inbox_dir = os.path.expandvars(r"%APPDATA%\com.shuaba.math\codex-inbox")
out_path = os.path.join(inbox_dir, f"{task_id}.json")

payload = {
    "schemaVersion": 2,
    "kind": "recommendation",
    "taskId": task_id,
    "questionId": None,
    "summary": "【一元积分应用 + 多元微分高危断点 10 题靶向排雷组】：精准覆盖切平面大题、拉格朗日相减法、闭区域边界降维代换、隐函数极值代回定值，以及一元变限积分弧长、旋转体体积综合与反常积分快筛！排雷完毕后即可昂首跨入二重积分！",
    "goal": "靶向清剿一元积分几何应用与多元微分遗留断点，将昨日自省中的「边界代入降维」、「拉格朗日相减」与「切平面公式」彻底固化为实战肌肉反射！",
    "estimatedMinutes": 75,
    "recommendedQuestionIds": [2758, 2733, 2768, 2719, 2766, 2291, 2352, 2356, 1238, 1241],
    "recommendationOrder": [2758, 2733, 2768, 2719, 2766, 2291, 2352, 2356, 1238, 1241],
    "questionRoles": {
        "2758": "integration",
        "2733": "method_choice",
        "2768": "consolidate",
        "2719": "diagnosis",
        "2766": "timed",
        "2291": "consolidate",
        "2352": "challenge",
        "2356": "challenge",
        "1238": "timed",
        "1241": "timed"
    },
    "coverage": [
        {
            "knowledge": "多元微分：椭球面切平面与条件极值综合大题",
            "questionIds": [2758],
            "priority": "high"
        },
        {
            "knowledge": "多元微分：拉格朗日乘数法构造与相减消元",
            "questionIds": [2733],
            "priority": "high"
        },
        {
            "knowledge": "多元微分：闭区域最值内部驻点与边界一元降维代换",
            "questionIds": [2768, 2766],
            "priority": "high"
        },
        {
            "knowledge": "多元微分：隐函数极值求驻点代回原方程定值",
            "questionIds": [2719],
            "priority": "high"
        },
        {
            "knowledge": "一元积分：变上限积分曲线弧长计算与微元法",
            "questionIds": [2291],
            "priority": "high"
        },
        {
            "knowledge": "一元积分：旋转体体积参数最值与反常积分综合",
            "questionIds": [2352, 2356],
            "priority": "high"
        },
        {
            "knowledge": "一元积分：反常积分敛散性审敛快筛",
            "questionIds": [1238, 1241],
            "priority": "high"
        }
    ],
    "noveltyPlan": [
        "将切平面公式与拉格朗日乘数法、均值不等式融为一体（#2758 数一经典大题）。",
        "将闭区域最值边界代入直接化为一元二次函数闭环（#2768）。",
        "将变上限求导与弧长微元法结合，扫清一元积分几何应用盲区。"
    ],
    "successCriteria": [
        "精做大题（#2758, #2733, #2768, #2719, #2291, #2352, #2356）：写出标准切平面方程、拉格朗日相减步骤、边界代换区间及弧长微元积分式。",
        "快筛题（#2766, #1238, #1241）：2 分钟内精准辨析反常积分瑕点与定性定理。",
        "遵守 3-12 分钟止损协议，做完后即可无后顾之忧开启二重积分！"
    ],
    "recommendationReason": "精准响应学员关于「一元积分 + 多元微分靶向排雷」的战术需求。本组 10 题直接对齐学员昨晚亲笔自省真言，彻底打通切平面、拉格朗日相减、闭区域边界代换及一元积分几何应用，为平稳过渡到二重积分筑牢底盘！",
    "sourceEvidenceIds": ["REMEDIATION-INT-DIFF-10"],
    "excludedQuestionIds": [],
    "fallbackPlan": "若遇到卡壳题，写出核心切平面方程或微元公式后即可按 10 分钟止损，保持推进节奏。",
    "confidence": 0.98
}

with open(out_path, "w", encoding="utf-8") as f:
    json.dump(payload, f, ensure_ascii=False, indent=2)

print(f"Successfully generated remediation batch: {out_path}")

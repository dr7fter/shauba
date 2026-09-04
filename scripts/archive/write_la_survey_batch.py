import json
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

task_id = "SB-REC-20260827-9910"
inbox_dir = os.path.expandvars(r"%APPDATA%\com.shuaba.math\codex-inbox")
out_path = os.path.join(inbox_dir, f"{task_id}.json")

payload = {
    "schemaVersion": 2,
    "kind": "recommendation",
    "taskId": task_id,
    "questionId": None,
    "summary": "【线性代数全章综合火力侦察卷（14题）】：全景覆盖考研数一线代全部 6 大主干板块（行列式、伴随与初等变换、向量组相关性与秩、线性方程组解结构、特征值与相似对角化、实对称矩阵与二次型）。作为构建线代完整画像地图的基准主干试卷！",
    "goal": "全面激活线性代数思维手感，摸排 6 大板块真实掌握度底数，精准定位线代断点并构建完整的线性代数专属战力画像与考点拓扑！",
    "estimatedMinutes": 135,
    "recommendedQuestionIds": [5615, 5566, 177, 198, 370, 395, 446, 514, 533, 664, 675, 687, 808, 837],
    "recommendationOrder": [5615, 5566, 177, 198, 370, 395, 446, 514, 533, 664, 675, 687, 808, 837],
    "questionRoles": {
        "5615": "diagnosis",
        "5566": "method_choice",
        "177": "diagnosis",
        "198": "consolidate",
        "370": "timed",
        "395": "challenge",
        "446": "timed",
        "514": "diagnosis",
        "533": "method_choice",
        "664": "consolidate",
        "675": "integration",
        "687": "timed",
        "808": "integration",
        "837": "challenge"
    },
    "coverage": [
        {
            "knowledge": "Ch1 行列式：抽象分块行列式性质与代数余子式求和",
            "questionIds": [5615, 5566],
            "priority": "high"
        },
        {
            "knowledge": "Ch2 矩阵与伴随：伴随矩阵性质、代数余子式关系与矩阵的秩",
            "questionIds": [177, 198],
            "priority": "high"
        },
        {
            "knowledge": "Ch3 向量组与相关性：向量组等价判定与线性无关性证明大题",
            "questionIds": [370, 395],
            "priority": "high"
        },
        {
            "knowledge": "Ch4 线性方程组：解的判定充分条件、线性无关解个数与特征向量解法",
            "questionIds": [446, 514, 533],
            "priority": "high"
        },
        {
            "knowledge": "Ch5 特征值与相似对角化：实对称矩阵伴随特征值、相似对角化求可逆阵P与分块相似判定",
            "questionIds": [664, 675, 687],
            "priority": "high"
        },
        {
            "knowledge": "Ch6 二次型与合同：实对称矩阵正交变换化标准形大题与规范形综合",
            "questionIds": [808, 837],
            "priority": "high"
        }
    ],
    "noveltyPlan": [
        "从一阶与高阶行列式性质，无缝递进到伴随矩阵与秩的不等式。",
        "将向量组线性无关性与线性方程组解的结构（齐次+特解）进行深度交织。",
        "将特征多项式与二次型正交变换大题（数一必考 12 分大题）完整整合。"
    ],
    "successCriteria": [
        "精做大题（#395, #675, #808, #837）：写出完整的代数证明、特征值求解、施密特正交化与正交矩阵构造步骤。",
        "主思路题（#5566, #198, #514, #533, #664）：90 秒内写出代数余子式转换公式、自由变量个数 $n-r(A)$ 以及相似特征值不变性。",
        "快筛题（#370, #446, #687）：2 分钟内准确完成概念判定与反例排除。",
        "做完后写下个人自省小结，共同绘制属于你的线性代数掌握度全景地图！"
    ],
    "recommendationReason": "作为开启线性代数板块的基准侦察试卷，全卷精选 14 道高含金量母题，严格对齐考研数一 6 大章节大纲要求。兼顾概念辨析、计算技巧与大题压轴，兼具精做、主思路与快筛分层，旨在全景摸排学员线代手感与盲区，为后续自适应题组延伸建立单源真理地图！",
    "sourceEvidenceIds": ["LA-FULL-SPECTRUM-SURVEY"],
    "excludedQuestionIds": [],
    "fallbackPlan": "若总耗时超过 135 分钟，可按 Ch1-Ch3（前 6 题）与 Ch4-Ch6（后 8 题）分两场完成；遇到卡壳题目遵守 3-12 分钟止损协议。",
    "confidence": 0.96
}

with open(out_path, "w", encoding="utf-8") as f:
    json.dump(payload, f, ensure_ascii=False, indent=2)

print(f"Successfully generated Linear Algebra survey batch: {out_path}")

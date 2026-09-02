import json, os

inbox = os.path.join(os.environ["APPDATA"], "com.shuaba.math", "codex-inbox")

payloads = [
    {
        "schemaVersion": 2,
        "kind": "recommendation",
        "taskId": "SB-REC-20260901-LA-V4-C",
        "questionId": None,
        "summary": "线代第 3 组：按错叶修复多项式求逆、AB/BA 与对角化判据，7 题，限时 32 分钟。",
        "goal": "用独立变式验证 E-028、E-032、E-033 是否真正固化，同时修复合同判定、正交标准形与矩阵代数的考场节奏。",
        "estimatedMinutes": 32,
        "recommendedQuestionIds": [141, 142, 311, 712, 904, 814, 907],
        "recommendationOrder": [141, 142, 311, 712, 904, 814, 907],
        "questionRoles": {"141": "diagnosis", "142": "transfer", "311": "transfer", "712": "diagnosis", "904": "method_choice", "814": "consolidate", "907": "challenge"},
        "coverage": [
            {"knowledge": "矩阵多项式降次与待定系数求逆", "questionIds": [141, 142], "priority": "high"},
            {"knowledge": "AB 与 BA 的低维结构映射", "questionIds": [311], "priority": "high"},
            {"knowledge": "相似对角化充分条件与充要条件辨析", "questionIds": [712], "priority": "high"},
            {"knowledge": "合同关系与正负惯性指数", "questionIds": [904, 907], "priority": "high"},
            {"knowledge": "实对称二次型正交标准形参数识别", "questionIds": [814], "priority": "medium"}
        ],
        "noveltyPlan": [
            "7 题覆盖 6 个末级叶子；抽象逆叶保留 2 题，其余叶子各 1 题。",
            "先用 #141/#142 检查能否把多项式关系降次，再用 #311 检查 AB/BA 定理能否独立迁移。",
            "#712 与 #904 检查命题关系边界，#814/#907 提供二次型与合同的跨叶迁移；不提供方法提示。"
        ],
        "successCriteria": [
            "#141/#142 均在 90 秒内写出正确逆式；任一失败即保留 E-028 高危，不追加同叶题。",
            "#311 在 5 分钟内完成并明确写出非零特征值或等价降次理由。",
            "#712 在 90 秒内区分充分非必要与充要；#904 在 2 分钟内写出合同判据。",
            "7 题至少 6 题严格正确，且总耗时不超过 32 分钟；任一主观题超过 8 分钟先止损记录。",
            "#814 或 #907 至少 1 题在 6 分钟内完成，作为二次型/合同的迁移证据。"
        ],
        "recommendationReason": "两组线代客观复核显示结构识别已建立，但 E-028、E-032、E-033 仍缺独立变式证据，第二组总耗时还超预算约 70%。本组遵循 v4 错叶修复，不进入泛化强化；通过阈值同时约束正确率、单题止损和总时长。",
        "sourceEvidenceIds": ["SB-BATCH-20260901-2679", "SB-BATCH-20260901-5936"],
        "excludedQuestionIds": [148, 149, 205, 218, 266, 301, 310, 319, 665, 676, 678, 705, 706, 713, 717, 722, 729, 7360, 756, 767, 874, 895, 837, 267, 395, 446, 514, 533, 565],
        "fallbackPlan": "若 #141/#142 任一失败，转入 E-028 低难度待定系数补救；若逆题通过但 #311 失败，下一轮只补 AB/BA 一道独立变式；若正确率达到 6/7 但超时，则先做节奏重训而非升档。",
        "confidence": 0.92
    },
    {
        "schemaVersion": 2,
        "kind": "recommendation",
        "taskId": "SB-REC-20260901-PROB-V4-A",
        "questionId": None,
        "summary": "概率论第 1 组：事件概率与一维随机变量入门基线，7 题，限时 25 分钟。",
        "goal": "建立概率统计首轮真实基线，测量事件关系、经典概型、条件概率与一维分布变换四类入口动作。",
        "estimatedMinutes": 25,
        "recommendedQuestionIds": [5548, 5504, 5497, 5498, 5490, 5251, 5264],
        "recommendationOrder": [5548, 5504, 5497, 5498, 5490, 5251, 5264],
        "questionRoles": {"5548": "diagnosis", "5504": "diagnosis", "5497": "consolidate", "5498": "transfer", "5490": "method_choice", "5251": "transfer", "5264": "challenge"},
        "coverage": [
            {"knowledge": "事件包含关系与概率基本性质", "questionIds": [5548], "priority": "high"},
            {"knowledge": "伯努利与古典概型建模", "questionIds": [5504, 5497], "priority": "high"},
            {"knowledge": "几何概型与区域面积", "questionIds": [5498], "priority": "medium"},
            {"knowledge": "条件概率与不放回抽样", "questionIds": [5490], "priority": "high"},
            {"knowledge": "一维随机变量取值概率与函数变换", "questionIds": [5251, 5264], "priority": "high"}
        ],
        "noveltyPlan": [
            "7 题来自 7 个不同末级叶子，首次概率统计训练不重复叶子。",
            "前 3 题建立事件与概型入口，#5498/#5490 检查图形与条件化路线，末 2 题迁移到一维变量。",
            "不预告公式；每题必须写出事件域或变量变换的第一步。"
        ],
        "successCriteria": [
            "7 题至少 5 题严格正确；达到 6/7 才进入下一组强化，否则按失败叶子各补 1 题。",
            "选择题单题不超过 2.5 分钟；主观题单题不超过 5 分钟，超时先记录卡点。",
            "#5490 必须明确写出条件化分母；#5264 必须写出值域与雅可比/导数因子。",
            "总耗时不超过 25 分钟，且至少 1 道主观题在止损线内完整收束。"
        ],
        "recommendationReason": "概率统计已有 317 题库但尚无有效作答基线。本组从事件关系、伯努利/古典/几何概型推进到条件概率和一维函数分布，按 v4 最小有效剂量建立入口地图，不用随机抽题制造结构性偏差。",
        "sourceEvidenceIds": [],
        "excludedQuestionIds": [],
        "fallbackPlan": "若事件与概型题正确率低于 3/4，下一轮只修复事件域与条件概率；若前半组通过而一维变换失败，单独补值域—单调性—导数因子链，不追加更难题。",
        "confidence": 0.9
    },
    {
        "schemaVersion": 2,
        "kind": "recommendation",
        "taskId": "SB-REC-20260901-PROB-V4-B",
        "questionId": None,
        "summary": "概率论第 2 组：二维分布、数字特征与统计推断侦察，7 题，限时 28 分钟。",
        "goal": "在第一组建立概率入口后，测量二维联合分布、独立性、期望方差、中心极限定理与矩估计的跨章节迁移能力。",
        "estimatedMinutes": 28,
        "recommendedQuestionIds": [5290, 5329, 5327, 5333, 5348, 5410, 5457],
        "recommendationOrder": [5290, 5329, 5327, 5333, 5348, 5410, 5457],
        "questionRoles": {"5290": "diagnosis", "5329": "method_choice", "5327": "consolidate", "5333": "transfer", "5348": "diagnosis", "5410": "challenge", "5457": "challenge"},
        "coverage": [
            {"knowledge": "二维离散分布与独立性", "questionIds": [5290], "priority": "high"},
            {"knowledge": "二维连续随机变量概率与指数分布", "questionIds": [5329, 5327], "priority": "high"},
            {"knowledge": "联合、边缘与条件密度", "questionIds": [5333], "priority": "high"},
            {"knowledge": "方差线性组合", "questionIds": [5348], "priority": "medium"},
            {"knowledge": "中心极限定理标准化", "questionIds": [5410], "priority": "high"},
            {"knowledge": "矩估计建模", "questionIds": [5457], "priority": "high"}
        ],
        "noveltyPlan": [
            "7 题覆盖 7 个不同末级叶子，避免同一二维分布叶过采样。",
            "先做二维离散/连续快筛，再做联合密度与数字特征，最后以中心极限定理和矩估计检验跨章迁移。",
            "#5327/#5333 要求先画积分域或写边缘化上下限，禁止直接套结果。"
        ],
        "successCriteria": [
            "7 题至少 5 题严格正确；若仅 3-4 题正确，按失败叶子拆分修复，不直接升难。",
            "选择题单题不超过 2.5 分钟；主观题单题不超过 6 分钟；超过即止损并记录卡点。",
            "#5333 必须同时给出至少一个边缘密度和一个条件密度；#5410 必须完成标准化而非只写结论。",
            "总耗时不超过 28 分钟；#5457 若进入驻点求导，超过 6 分钟应先写似然/矩方程结构再止损。"
        ],
        "recommendationReason": "第一组负责概率入口，第二组负责二维与统计推断的结构迁移。题目来自未作答且解析完整的不同叶子，难度以 4 个 d1、3 个 d2 形成可解释梯度，符合 v4 的反馈驱动与最小剂量原则。",
        "sourceEvidenceIds": [],
        "excludedQuestionIds": [],
        "fallbackPlan": "若二维联合/边缘密度失败，下一轮只补积分域和边缘化；若二维通过但中心极限定理或矩估计失败，分别进入标准化模板或似然/矩方程专项，不混合加量。",
        "confidence": 0.9
    }
]

for payload in payloads:
    path = os.path.join(inbox, payload["taskId"] + ".json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    print(path)

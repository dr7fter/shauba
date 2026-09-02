import json
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

task_id = "SB-BATCH-20260830-8209"
inbox_dir = os.path.expandvars(r"%APPDATA%\com.shuaba.math\codex-inbox")
out_path = os.path.join(inbox_dir, f"{task_id}.json")

batch_attempts = [
    # Q1: 209
    {
        "questionId": 209,
        "result": "correct",
        "selfRating": 3,
        "durationSeconds": 191,
        "summary": "【伴随矩阵秩三段论精准运用！】由 $r(A^*)=1 \\implies r(A)=2$，因式分解行列式 $|A|=(2b+a)(a-b)^2=0$，准确排除 $a=b$（此时 $r(A)=1$），锁定 $a+2b=0$ 且 $a\\ne b$，选 C！",
        "verdict": "correct",
        "earliestError": None,
        "errorTags": [],
        "weaknessTags": [],
        "advice": "伴随矩阵秩三段论（$n \\leftrightarrow n-1 \\leftrightarrow <n-1$）已完全固化，继续保持！",
        "betterSolution": None,
        "confidence": 0.98,
        "rating": 1.15,
        "ratingTier": "A",
        "difficultyMultiplier": 1.0,
        "dimensions": {
            "rigor": {"score": 95, "confidence": 0.95, "evidence": "行列式因式分解与秩推导严密规范"},
            "computation": {"score": 95, "confidence": 0.95, "evidence": "因式分解零失误"},
            "modeling": {"score": 95, "confidence": 0.95, "evidence": "伴随矩阵与原矩阵秩对应模型满分"},
            "methodUse": {"score": 95, "confidence": 0.95, "evidence": "熟练运用特征多项式分解"},
            "speed": {"score": 90, "confidence": 0.95, "evidence": "3分11秒标准节奏"},
            "strategyInsight": {"score": 95, "confidence": 0.95, "evidence": "排除法与代数分解结合", "techniqueLevel": 2, "independentDiscovery": "confirmed"}
        }
    },
    # Q2: 143
    {
        "questionId": 143,
        "result": "wrong",
        "selfRating": 1,
        "durationSeconds": 269,
        "summary": "草稿写“没思路啊”。幂零矩阵乘法公式因式分解：$(E-A)(E+A+A^2+\\cdots+A^{n-1}) = E - A^n = E$ 即可瞬秒逆矩阵。",
        "verdict": "incorrect",
        "earliestError": "首行：未动用等比数列因式分解公式 $(E-A)(E+A+A^2+\\cdots+A^{n-1}) = E - A^n$",
        "errorTags": ["概念盲区"],
        "weaknessTags": ["幂零矩阵逆矩阵", "矩阵多项式因式分解"],
        "advice": "牢记实数与矩阵的高次因式分解统一法则：$1-x^n = (1-x)(1+x+x^2+\\cdots+x^{n-1})$ $\\implies (E-A)(E+A+\\cdots+A^{n-1}) = E - A^n = E$，逆矩阵直接等于该因式！",
        "betterSolution": "因 $(E-A)(E+A+A^2+\\cdots+A^{n-1}) = E - A^n = E - O = E$，由逆矩阵定义直接得 $(E-A)^{-1} = E+A+A^2+\\cdots+A^{n-1}$。",
        "confidence": 0.98,
        "rating": 0.50,
        "ratingTier": "D",
        "difficultyMultiplier": 1.0,
        "dimensions": {
            "rigor": {"score": 50, "confidence": 0.95, "evidence": "未写出推导"},
            "computation": {"score": 50, "confidence": 0.95, "evidence": "未动笔"},
            "modeling": {"score": 50, "confidence": 0.95, "evidence": "矩阵因式分解模型盲区"},
            "methodUse": {"score": 50, "confidence": 0.95, "evidence": "未运用矩阵乘法定义"},
            "speed": {"score": 70, "confidence": 0.95, "evidence": "4分29秒果断止损"},
            "strategyInsight": {"score": 50, "confidence": 0.95, "evidence": "概念盲区", "techniqueLevel": 2, "independentDiscovery": "uncertain"}
        }
    },
    # Q3: 204
    {
        "questionId": 204,
        "result": "correct",
        "selfRating": 3,
        "durationSeconds": 191,
        "summary": "【满分秒杀！】因式分解 $(A-E)(B-E)=(k+1)E$，动用 Sylvester 秩不等式分析 $r(A-E)+r(B-E)-n \\leqslant r((k+1)E)$，秒出当 $k=-1$ 时乘积为零矩阵取得最小值，选 B！",
        "verdict": "correct",
        "earliestError": None,
        "errorTags": [],
        "weaknessTags": [],
        "advice": "Sylvester 秩不等式 $r(A)+r(B)-n \\leqslant r(AB)$ 运用极其熟练，矩阵分解意识极强！",
        "betterSolution": None,
        "confidence": 0.98,
        "rating": 1.25,
        "ratingTier": "A",
        "difficultyMultiplier": 1.05,
        "dimensions": {
            "rigor": {"score": 95, "confidence": 0.95, "evidence": "矩阵因式分解与 Sylvester 不等式推导严密规范"},
            "computation": {"score": 95, "confidence": 0.95, "evidence": "代数分解零失误"},
            "modeling": {"score": 95, "confidence": 0.95, "evidence": "矩阵乘积秩模型满分"},
            "methodUse": {"score": 95, "confidence": 0.95, "evidence": "熟练运用 Sylvester 秩公式"},
            "speed": {"score": 90, "confidence": 0.95, "evidence": "3分11秒标准节奏"},
            "strategyInsight": {"score": 95, "confidence": 0.95, "evidence": "敏锐配凑 (A-E)(B-E)", "techniqueLevel": 3, "independentDiscovery": "confirmed"}
        }
    },
    # Q4: 262
    {
        "questionId": 262,
        "result": "correct",
        "selfRating": 4,
        "durationSeconds": 203,
        "summary": "【满分秒杀！】利用 $M^* = M^{-1}|M|$，分块求逆与分块行列式符号 $|M|=(-1)^{2\\times 2}|A||B|=6$ 零误差化简出 $\\begin{pmatrix}O&2B^*\\\\3A^*&O\\end{pmatrix}$，选 B！",
        "verdict": "correct",
        "earliestError": None,
        "errorTags": [],
        "weaknessTags": [],
        "advice": "副对角分块伴随矩阵行列式符号与逆矩阵对应法则掌握完美，无懈可击！",
        "betterSolution": None,
        "confidence": 0.98,
        "rating": 1.30,
        "ratingTier": "S",
        "difficultyMultiplier": 1.05,
        "dimensions": {
            "rigor": {"score": 95, "confidence": 0.95, "evidence": "分块求逆与行列式符号推导严密规范"},
            "computation": {"score": 95, "confidence": 0.95, "evidence": "伴随与逆矩阵关系代换零失误"},
            "modeling": {"score": 95, "confidence": 0.95, "evidence": "分块伴随模型满分"},
            "methodUse": {"score": 95, "confidence": 0.95, "evidence": "熟练掌握分块求逆公式"},
            "speed": {"score": 95, "confidence": 0.95, "evidence": "3分23秒极速搞定"},
            "strategyInsight": {"score": 95, "confidence": 0.95, "evidence": "分块伴随转求逆直觉顶级", "techniqueLevel": 3, "independentDiscovery": "confirmed"}
        }
    },
    # Q5: 274
    {
        "questionId": 274,
        "result": "wrong",
        "selfRating": 2,
        "durationSeconds": 156,
        "summary": "草稿写“感觉是充分，因为 $C$ 可为 0 矩阵”。混淆了充分性与必要性的推导方向（反例 $A=O, B=E, C=E$ 秩公式成立但 $C$ 不可由 $A$ 表示，故非充分），应为必要非充分条件，选 A。",
        "verdict": "incorrect",
        "earliestError": "结论行：将“线性表示 $\\implies$ 秩相等（必要）”误判断为充分条件",
        "errorTags": ["概念盲区"],
        "weaknessTags": ["分块矩阵初等变换", "充分必要性推导方向"],
        "advice": "牢记矩阵列表示与分块消元定理：若 $C=AX$，则 $\\begin{pmatrix}A&C\\\\O&B\\end{pmatrix} \\to \\begin{pmatrix}A&O\\\\O&B\\end{pmatrix} \\implies$ 秩相等（故为必要）；但秩相等不一定能消掉 $C$（如 $A=O, B=E, C=E$），故非充分！选 A。",
        "betterSolution": "① 必要性：若 $C$ 可由 $A$ 线性表示，则存在 $X$ 使 $AX=C$，做列变换 $c_2 - c_1 X$ 得 $r\\begin{pmatrix}A&C\\\\O&B\\end{pmatrix} = r\\begin{pmatrix}A&O\\\\O&B\\end{pmatrix} = r(A)+r(B)$，故必要；② 充分性不成立反例：取 $A=O, B=E, C=E$，则 $r\\begin{pmatrix}O&E\\\\O&E\\end{pmatrix}=n = r(A)+r(B)=0+n$，但 $E$ 无法由 $O$ 线性表示。故为必要非充分条件，选 A。",
        "confidence": 0.95,
        "rating": 0.60,
        "ratingTier": "D",
        "difficultyMultiplier": 1.0,
        "dimensions": {
            "rigor": {"score": 65, "confidence": 0.95, "evidence": "充分必要推导方向混淆"},
            "computation": {"score": 75, "confidence": 0.9, "evidence": "定性逻辑分析"},
            "modeling": {"score": 65, "confidence": 0.9, "evidence": "分块初等变换模型不完整"},
            "methodUse": {"score": 65, "confidence": 0.9, "evidence": "未动用初等列变换消元证明"},
            "speed": {"score": 85, "confidence": 0.9, "evidence": "2分36秒"},
            "strategyInsight": {"score": 60, "confidence": 0.9, "evidence": "反例构造意识欠缺", "techniqueLevel": 2, "independentDiscovery": "uncertain"}
        }
    },
    # Q6: 144
    {
        "questionId": 144,
        "result": "correct",
        "selfRating": 4,
        "durationSeconds": 218,
        "summary": "【满分秒杀！】展开 $(E-\\alpha\\alpha^{\\mathrm{T}})(E+\\frac{1}{a}\\alpha\\alpha^{\\mathrm{T}})=E$，准确利用内积 $\\alpha^{\\mathrm{T}}\\alpha=2a^2$ 得到二次方程 $2a^2+a-1=0$，结合 $a<0$ 锁定 $a=-1$！",
        "verdict": "correct",
        "earliestError": None,
        "errorTags": [],
        "weaknessTags": [],
        "advice": "向量外积 $\\alpha\\alpha^{\\mathrm{T}}$ 乘法结合律与内积 $\\alpha^{\\mathrm{T}}\\alpha$ 标量提公因式解法堪称标准答案典范！",
        "betterSolution": None,
        "confidence": 0.98,
        "rating": 1.35,
        "ratingTier": "S",
        "difficultyMultiplier": 1.05,
        "dimensions": {
            "rigor": {"score": 95, "confidence": 0.95, "evidence": "矩阵方程展开、内积代换与负根筛选无懈可击"},
            "computation": {"score": 95, "confidence": 0.95, "evidence": "二次方程求解零失误"},
            "modeling": {"score": 95, "confidence": 0.95, "evidence": "一维外积矩阵逆矩阵模型满分"},
            "methodUse": {"score": 95, "confidence": 0.95, "evidence": "熟练掌握内积标量化"},
            "speed": {"score": 95, "confidence": 0.95, "evidence": "3分38秒极速秒解"},
            "strategyInsight": {"score": 95, "confidence": 0.95, "evidence": "结合律直觉顶级", "techniqueLevel": 3, "independentDiscovery": "confirmed"}
        }
    },
    # Q7: 211
    {
        "questionId": 211,
        "result": "correct",
        "selfRating": 4,
        "durationSeconds": 272,
        "summary": "【满分秒杀！】秩三段论 $r(A)=1 \\implies r(A^*)=0 \\implies r(-B^*)=1 \\implies r(B)=2$，因式分解 $|B|=(2a+2)(a-2)^2=0$，排除 $a=2$（此时 $r(B)=1$）锁定 $a=-1$，选 B！",
        "verdict": "correct",
        "earliestError": None,
        "errorTags": [],
        "weaknessTags": [],
        "advice": "外积秩 1 矩阵伴随为零 + 伴随矩阵秩三段论连招行云流水，无懈可击！",
        "betterSolution": None,
        "confidence": 0.98,
        "rating": 1.30,
        "ratingTier": "S",
        "difficultyMultiplier": 1.05,
        "dimensions": {
            "rigor": {"score": 95, "confidence": 0.95, "evidence": "秩三段论与行列式特征根求解严密规范"},
            "computation": {"score": 95, "confidence": 0.95, "evidence": "因式分解零失误"},
            "modeling": {"score": 95, "confidence": 0.95, "evidence": "矩阵秩与伴随矩阵综合模型满分"},
            "methodUse": {"score": 95, "confidence": 0.95, "evidence": "熟练运用秩推导定理"},
            "speed": {"score": 90, "confidence": 0.95, "evidence": "4分32秒"},
            "strategyInsight": {"score": 95, "confidence": 0.95, "evidence": "连招逻辑极其清晰", "techniqueLevel": 3, "independentDiscovery": "confirmed"}
        }
    },
    # Q8: 147
    {
        "questionId": 147,
        "result": "wrong",
        "selfRating": 2,
        "durationSeconds": 482,
        "summary": "矩阵代数未先化简导致硬算求逆：$E+B = E+(E+A)^{-1}(E-A) = 2(E+A)^{-1} \\implies [(E+B)^2]^{-1} = \\frac{1}{4}(E+A)^2$，草稿硬求 $(E+A)^{-1}$ 产生分数通分运算失误。",
        "verdict": "partial",
        "earliestError": "第 3 行：直接硬算 $(E+A)^{-1}$ 进行分式矩阵相乘，未对 $E+B$ 提取 $(E+A)^{-1}$ 公因式",
        "errorTags": ["战术绕路"],
        "weaknessTags": ["矩阵代数化简提取公因式", "凯莱变换(Cayley Transform)"],
        "advice": "看到 $B=(E+A)^{-1}(E-A)$（凯莱变换）绝技：通分提取 $(E+A)^{-1}$，必有 $E+B = 2(E+A)^{-1}$，两边同时求逆即得 $(E+B)^{-1} = \\frac{1}{2}(E+A)$，直接求平方，彻底避开求逆！",
        "betterSolution": "$E+B = E + (E+A)^{-1}(E-A) = (E+A)^{-1}[(E+A)+(E-A)] = 2(E+A)^{-1}$。两边求逆：$(E+B)^{-1} = \\frac{1}{2}(E+A)$。故 $[(E+B)^2]^{-1} = \\frac{1}{4}(E+A)^2 = \\frac{1}{4}\\begin{pmatrix}2&0&0\\\\2&4&0\\\\0&4&6\\end{pmatrix}^2 = \\begin{pmatrix}1&0&0\\\\1&2&0\\\\0&2&3\\end{pmatrix}^2 = \\begin{pmatrix}1&0&0\\\\3&4&0\\\\2&10&9\\end{pmatrix}$。",
        "confidence": 0.95,
        "rating": 0.80,
        "ratingTier": "C",
        "difficultyMultiplier": 1.1,
        "dimensions": {
            "rigor": {"score": 80, "confidence": 0.95, "evidence": "矩阵计算流程完整"},
            "computation": {"score": 75, "confidence": 0.9, "evidence": "分数矩阵乘法产生数值偏差"},
            "modeling": {"score": 80, "confidence": 0.9, "evidence": "矩阵多项式建模正确"},
            "methodUse": {"score": 75, "confidence": 0.9, "evidence": "未运用矩阵代数提取公因式"},
            "speed": {"score": 85, "confidence": 0.9, "evidence": "8分02秒"},
            "strategyInsight": {"score": 75, "confidence": 0.9, "evidence": "硬算避开化简", "techniqueLevel": 3, "independentDiscovery": "confirmed"}
        }
    },
    # Q9: 265
    {
        "questionId": 265,
        "result": "correct",
        "selfRating": 4,
        "durationSeconds": 524,
        "summary": "【满分高分秒杀！】分块求逆 $\\begin{pmatrix}O&A\\\\B&E\\end{pmatrix}^{-1} = \\begin{pmatrix}-B^{-1}A^{-1}&B^{-1}\\\\A^{-1}&O\\end{pmatrix}$ 极其严密，行列式 $|M|=-3$ 准确展开得到 $\\begin{pmatrix}-B^*A^*&3B^*\\\\-A^*&O\\end{pmatrix}$，选 A！",
        "verdict": "correct",
        "earliestError": None,
        "errorTags": [],
        "weaknessTags": [],
        "advice": "非对角分块矩阵伴随求逆大题掌握极其扎实，解法严谨规范！",
        "betterSolution": None,
        "confidence": 0.98,
        "rating": 1.25,
        "ratingTier": "A",
        "difficultyMultiplier": 1.1,
        "dimensions": {
            "rigor": {"score": 95, "confidence": 0.95, "evidence": "分块矩阵待定系数求逆与伴随矩阵换算无懈可击"},
            "computation": {"score": 95, "confidence": 0.95, "evidence": "符号与行列式乘积零失误"},
            "modeling": {"score": 95, "confidence": 0.95, "evidence": "分块求伴随模型满分"},
            "methodUse": {"score": 95, "confidence": 0.95, "evidence": "熟练掌握分块求逆"},
            "speed": {"score": 85, "confidence": 0.9, "evidence": "8分44秒完整推导"},
            "strategyInsight": {"score": 95, "confidence": 0.95, "evidence": "分块消元直觉极强", "techniqueLevel": 4, "independentDiscovery": "confirmed"}
        }
    },
    # Q10: 254
    {
        "questionId": 254,
        "result": "correct",
        "selfRating": 4,
        "durationSeconds": 153,
        "summary": "【满分秒杀！】敏锐识别“左乘初等行变换，右乘初等列变换”，利用 $(P^{\\mathrm{T}})^{-1}$ 与 $(P^2)^{-1}$ 迅速反解 $A = \\begin{pmatrix}a&0&0\\\\0&b&0\\\\0&0&c\\end{pmatrix}$，选 C！",
        "verdict": "correct",
        "earliestError": None,
        "errorTags": [],
        "weaknessTags": [],
        "advice": "初等矩阵行列变换几何意义极其清晰，秒杀速度极快！",
        "betterSolution": None,
        "confidence": 0.98,
        "rating": 1.20,
        "ratingTier": "A",
        "difficultyMultiplier": 1.0,
        "dimensions": {
            "rigor": {"score": 95, "confidence": 0.95, "evidence": "初等矩阵逆矩阵与初等变换对应法则严密规范"},
            "computation": {"score": 95, "confidence": 0.95, "evidence": "行列变换零失误"},
            "modeling": {"score": 95, "confidence": 0.95, "evidence": "初等矩阵反解模型满分"},
            "methodUse": {"score": 95, "confidence": 0.95, "evidence": "熟练掌握初等变换法则"},
            "speed": {"score": 95, "confidence": 0.95, "evidence": "2分33秒极速搞定"},
            "strategyInsight": {"score": 95, "confidence": 0.95, "evidence": "初等变换直觉极强", "techniqueLevel": 2, "independentDiscovery": "confirmed"}
        }
    }
]

payload = {
    "schemaVersion": 1,
    "kind": "batch",
    "taskId": task_id,
    "summary": "【线性代数全章综合火力侦察 · 实战 10 题深度批改】：学员在线代分块求逆与伴随矩阵（#262 满分、#265 满分）、一维外积矩阵（#144 满分）、伴随矩阵秩三段论（#209 满分、#211 满分）、Sylvester 秩不等式（#204 满分）及初等矩阵行列变换（#254 满分）展现出统治级的实力！7 题满分秒杀！仅在幂零因式分解（#143）、必要充分判定（#274）与凯莱变换提取公因式（#147）存在微观技巧断点。",
    "errorTags": ["概念盲区", "战术绕路"],
    "weaknessTags": ["幂零矩阵逆矩阵", "分块矩阵初等变换", "矩阵代数化简提取公因式"],
    "confidence": 0.98,
    "recommendedQuestionIds": [],
    "batchAttempts": batch_attempts
}

with open(out_path, "w", encoding="utf-8") as f:
    json.dump(payload, f, ensure_ascii=False, indent=2)

print(f"Batch grading report successfully written to {out_path}")

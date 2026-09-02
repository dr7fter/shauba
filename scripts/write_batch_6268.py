import json
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

task_id = "SB-BATCH-20260829-6268"
inbox_dir = os.path.expandvars(r"%APPDATA%\com.shuaba.math\codex-inbox")
out_path = os.path.join(inbox_dir, f"{task_id}.json")

# The 8 attempted questions:
# 1: 2894
# 2: 2862
# 3: 2909
# 4: 2921
# 9: 2953
# 10: 2986
# 11: 2972
# 12: 2982

batch_attempts = [
    # Q1: 2894
    {
        "questionId": 2894,
        "result": "wrong",
        "selfRating": 2,
        "durationSeconds": 360,
        "summary": "【变量分离极佳！】极坐标转化为 $\\int_0^{\\pi/2}\\frac{\\cos\\theta}{\\cos\\theta+\\sin\\theta}\\mathrm{d}\\theta \\cdot \\int_1^2 r\\sin(\\pi r)\\mathrm{d}r$ 完全正确，$r$ 积分算得 $-\\frac{3}{\\pi}$ 满分无误！仅在三角积分原函数代入时将上限误代为 $2\\pi$（应为 $\\frac{\\pi}{2}$）导致笔误。",
        "verdict": "partial",
        "earliestError": "倒数第 2 行：三角积分原函数 $\\frac{1}{2}(x+\\ln|\\sin x+\\cos x|)$ 代限时，将上限 $\\frac{\\pi}{2}$ 误写为 $2\\pi$",
        "errorTags": ["瞄准失误"],
        "weaknessTags": ["定积分上下限代入", "对称性/King变换求三角有理式"],
        "advice": "三角有理式 $\\int_0^{\\pi/2}\\frac{\\cos\\theta}{\\cos\\theta+\\sin\\theta}\\mathrm{d}\\theta$ 考场秒杀：令 $\\theta=\\frac{\\pi}{2}-t$，分子分母互换相加得 $2J=\\int_0^{\\pi/2}1\\mathrm{d}\\theta=\\frac{\\pi}{2} \\implies J=\\frac{\\pi}{4}$，5 秒出结果！",
        "betterSolution": "极坐标分离变量：$I = (\\int_0^{\\pi/2}\\frac{\\cos\\theta}{\\cos\\theta+\\sin\\theta}\\mathrm{d}\\theta)(\\int_1^2 r\\sin(\\pi r)\\mathrm{d}r)$。由区间对称性知前项 $=\\frac{\\pi}{4}$；分部积分知后项 $=-\\frac{3}{\\pi}$。两项相乘立得 $I = \\frac{\\pi}{4}\\cdot(-\\frac{3}{\\pi}) = -\\frac{3}{4}$。",
        "confidence": 0.95,
        "rating": 0.85,
        "ratingTier": "C",
        "difficultyMultiplier": 1.1,
        "dimensions": {
            "rigor": {"score": 85, "confidence": 0.95, "evidence": "极坐标分离变量与分部积分推导极严密"},
            "computation": {"score": 80, "confidence": 0.9, "evidence": "三角原函数代入上限笔误"},
            "modeling": {"score": 95, "confidence": 0.95, "evidence": "圆环第一象限极坐标建模满分"},
            "methodUse": {"score": 85, "confidence": 0.95, "evidence": "熟练掌握分部积分与拆项求积"},
            "speed": {"score": 85, "confidence": 0.9, "evidence": "6分钟完成大题主要推导"},
            "strategyInsight": {"score": 90, "confidence": 0.95, "evidence": "敏锐实现变量分离", "techniqueLevel": 3, "independentDiscovery": "confirmed"}
        }
    },
    # Q2: 2862
    {
        "questionId": 2862,
        "result": "wrong",
        "selfRating": 2,
        "durationSeconds": 300,
        "summary": "画图定限直角坐标列式正确，但在面对 $\\frac{x-y}{x+y}$ 复杂结构时未动用线性变量替换 $u=x+y, v=x-y$。",
        "verdict": "partial",
        "earliestError": "第 2 行：直角坐标二次积分写出后停顿，未引入变量替换 $u=x+y, v=x-y$",
        "errorTags": ["战术绕路"],
        "weaknessTags": ["二重积分变量替换(Jacobian)", "对称线性代换"],
        "advice": "看到 $\\frac{x-y}{x+y}$、$\\frac{y}{x}$ 等对称分式，必定令 $u=x+y, v=x-y$，Jacobian $|J|=\\frac{1}{2}$，积分区域化为直角三角形直接秒杀！",
        "betterSolution": "令 $u=x+y, v=x-y$，则 $|J|=\\frac{1}{2}$，新区域为 $0\\leqslant u\\leqslant 1, -u\\leqslant v\\leqslant u$。$I = \\frac{1}{2}\\int_0^1\\mathrm{d}u \\int_{-u}^u \\cos(\\frac{v}{u})\\mathrm{d}v = \\frac{1}{2}\\int_0^1 2u\\sin 1\\mathrm{d}u = \\sin 1 [\\frac{u^2}{2}]_0^1 = \\frac{1}{2}\\sin 1$。",
        "confidence": 0.95,
        "rating": 0.75,
        "ratingTier": "C",
        "difficultyMultiplier": 1.1,
        "dimensions": {
            "rigor": {"score": 80, "confidence": 0.95, "evidence": "几何区域图画法正确"},
            "computation": {"score": 75, "confidence": 0.9, "evidence": "直角坐标积分停顿"},
            "modeling": {"score": 80, "confidence": 0.9, "evidence": "直角坐标建模正确"},
            "methodUse": {"score": 70, "confidence": 0.9, "evidence": "未动用变量代换"},
            "speed": {"score": 85, "confidence": 0.9, "evidence": "5分钟"},
            "strategyInsight": {"score": 75, "confidence": 0.9, "evidence": "识别分式难度", "techniqueLevel": 3, "independentDiscovery": "confirmed"}
        }
    },
    # Q3: 2909
    {
        "questionId": 2909,
        "result": "correct",
        "selfRating": 4,
        "durationSeconds": 330,
        "summary": "【满分高分秒杀！】极坐标建模 $I = 2\\pi \\int_0^3 |r^2-4|r\\mathrm{d}r$，在 $r=2$ 处精准拆分绝对值，分段多项式定积分零失误算出 $\\frac{41\\pi}{2}$！",
        "verdict": "correct",
        "earliestError": None,
        "errorTags": [],
        "weaknessTags": [],
        "advice": "含绝对值二重积分的极坐标分段拆分与计算堪称标准范本！",
        "betterSolution": None,
        "confidence": 0.98,
        "rating": 1.30,
        "ratingTier": "S",
        "difficultyMultiplier": 1.05,
        "dimensions": {
            "rigor": {"score": 95, "confidence": 0.95, "evidence": "绝对值零点分段与极坐标定限严密规范"},
            "computation": {"score": 95, "confidence": 0.95, "evidence": "多项式定积分代限零笔误"},
            "modeling": {"score": 95, "confidence": 0.95, "evidence": "圆域绝对值二重积分建模满分"},
            "methodUse": {"score": 95, "confidence": 0.95, "evidence": "熟练掌握极坐标与绝对值分段积分"},
            "speed": {"score": 95, "confidence": 0.95, "evidence": "5分30秒标准节奏"},
            "strategyInsight": {"score": 95, "confidence": 0.95, "evidence": "绝对值几何分段直觉极强", "techniqueLevel": 2, "independentDiscovery": "confirmed"}
        }
    },
    # Q4: 2921
    {
        "questionId": 2921,
        "result": "wrong",
        "selfRating": 2,
        "durationSeconds": 310,
        "summary": "【对称性拆分极佳！】敏锐识别 $y=x$ 为分界线并利用对称性化为 $2\\iint_{D_1} e^{y^2}\\mathrm{d}x\\mathrm{d}y$！仅差最后一步写出 $X$ 型定限 $\\int_0^1 \\mathrm{d}y \\int_0^y \\mathrm{d}x = y$ 即可秒杀。",
        "verdict": "partial",
        "earliestError": "倒数第 2 行：化为 $2\\iint_{D_1} e^{y^2}\\mathrm{d}x\\mathrm{d}y$ 后写“不知道怎么积了”，未将 $D_1$ 写为 $0\\leqslant y\\leqslant 1, 0\\leqslant x\\leqslant y$ 先对 $x$ 积分",
        "errorTags": ["战术绕路"],
        "weaknessTags": ["max分段函数二重积分", "X型区域优先定限"],
        "advice": "对 $e^{y^2}$ 不可积因式，在三角形域 $D_1$ 上永远先积 $x$：$\\int_0^1 \\mathrm{d}y \\int_0^y e^{y^2}\\mathrm{d}x = \\int_0^1 y e^{y^2}\\mathrm{d}y$，多出来的一个 $y$ 正好凑微分 $\\mathrm{d}(y^2)$！",
        "betterSolution": "$D$ 关于 $y=x$ 对称，故 $I = 2\\iint_{D_1} e^{y^2}\\mathrm{d}x\\mathrm{d}y = 2\\int_0^1\\mathrm{d}y \\int_0^y e^{y^2}\\mathrm{d}x = 2\\int_0^1 y e^{y^2}\\mathrm{d}y = [e^{y^2}]_0^1 = e - 1$。",
        "confidence": 0.95,
        "rating": 0.85,
        "ratingTier": "C",
        "difficultyMultiplier": 1.05,
        "dimensions": {
            "rigor": {"score": 90, "confidence": 0.95, "evidence": "区域沿 y=x 对称拆分非常标准"},
            "computation": {"score": 80, "confidence": 0.9, "evidence": "未完成内层 x 积分"},
            "modeling": {"score": 90, "confidence": 0.95, "evidence": "max函数分块建模完全正确"},
            "methodUse": {"score": 85, "confidence": 0.95, "evidence": "掌握对称性简化"},
            "speed": {"score": 85, "confidence": 0.9, "evidence": "5分10秒"},
            "strategyInsight": {"score": 90, "confidence": 0.95, "evidence": "识别 y=x 割线对称性", "techniqueLevel": 2, "independentDiscovery": "confirmed"}
        }
    },
    # Q9: 2953
    {
        "questionId": 2953,
        "result": "correct",
        "selfRating": 4,
        "durationSeconds": 140,
        "summary": "【满分秒杀！】极坐标化简被积函数 $r\\cos r, r\\cos(r^2), r\\cos(r^4)$，利用 $r\\in(0,1)$ 时 $r^4<r^2<r$ 且 $\\cos t$ 单调递减，秒出 $I_1<I_2<I_3$，选 A！",
        "verdict": "correct",
        "earliestError": None,
        "errorTags": [],
        "weaknessTags": [],
        "advice": "单调性比较二重积分大小思路极其清晰，继续保持！",
        "betterSolution": None,
        "confidence": 0.98,
        "rating": 1.25,
        "ratingTier": "A",
        "difficultyMultiplier": 1.0,
        "dimensions": {
            "rigor": {"score": 95, "confidence": 0.95, "evidence": "复合函数单调性论证严密"},
            "computation": {"score": 95, "confidence": 0.95, "evidence": "极坐标转化完全正确"},
            "modeling": {"score": 95, "confidence": 0.95, "evidence": "二重积分大小比较模型满分"},
            "methodUse": {"score": 95, "confidence": 0.95, "evidence": "熟练运用单调性性质"},
            "speed": {"score": 95, "confidence": 0.95, "evidence": "2分20秒秒杀"},
            "strategyInsight": {"score": 95, "confidence": 0.95, "evidence": "单调区间洞察准确", "techniqueLevel": 2, "independentDiscovery": "confirmed"}
        }
    },
    # Q10: 2986
    {
        "questionId": 2986,
        "result": "correct",
        "selfRating": 4,
        "durationSeconds": 130,
        "summary": "【满分秒杀！】敏锐识别二重积分定义，提取 $\\frac{1}{n^2}\\to\\mathrm{d}\\sigma$，化为二次积分 $\\int_0^1 \\frac{\\mathrm{d}x}{1+x} \\int_0^1 \\frac{\\mathrm{d}y}{1+y^2} = \\frac{\\pi}{4}\\ln 2$，选 D！",
        "verdict": "correct",
        "earliestError": None,
        "errorTags": [],
        "weaknessTags": [],
        "advice": "双重 Riemann 和式极限向二重积分的映射极其熟练，考研压轴概念题满分通过！",
        "betterSolution": None,
        "confidence": 0.98,
        "rating": 1.30,
        "ratingTier": "S",
        "difficultyMultiplier": 1.05,
        "dimensions": {
            "rigor": {"score": 95, "confidence": 0.95, "evidence": "Riemann 和式网格微元与上下限定向极其标准"},
            "computation": {"score": 95, "confidence": 0.95, "evidence": "积分计算零误差"},
            "modeling": {"score": 95, "confidence": 0.95, "evidence": "二重积分和式极限建模满分"},
            "methodUse": {"score": 95, "confidence": 0.95, "evidence": "熟练掌握定积分定义"},
            "speed": {"score": 95, "confidence": 0.95, "evidence": "2分10秒极速秒解"},
            "strategyInsight": {"score": 95, "confidence": 0.95, "evidence": "极限结构识别极准", "techniqueLevel": 3, "independentDiscovery": "confirmed"}
        }
    },
    # Q11: 2972
    {
        "questionId": 2972,
        "result": "wrong",
        "selfRating": 2,
        "durationSeconds": 240,
        "summary": "准确画出区域 $D$ 并算出面积 $S_0=\\frac{1}{3}$！但在积分方程处理时未将常数核设为待定常数 $A=\\iint_D f(u,v)\\mathrm{d}u\\mathrm{d}v$ 代回求解。",
        "verdict": "partial",
        "earliestError": "第 2 行：写出 $f(x,y)=xy+S_0\\cdot f(u,v)$，未将积分项整体设为常数 $A$",
        "errorTags": ["概念边界"],
        "weaknessTags": ["常数核二重积分方程", "待定常数代回法"],
        "advice": "二重积分方程经典套路：定积分结果必为常数，直接令 $A = \\iint_D f(u,v)\\mathrm{d}u\\mathrm{d}v$，则 $f(x,y)=xy+A$，代回原方程定积分式中 20 秒解出 $A=\\frac{1}{8}$！",
        "betterSolution": "令常数 $A = \\iint_D f(u,v)\\mathrm{d}u\\mathrm{d}v$，则 $f(x,y) = xy+A$。代入得 $A = \\iint_D (xy+A)\\mathrm{d}x\\mathrm{d}y = \\int_0^1 x\\mathrm{d}x\\int_0^{x^2} y\\mathrm{d}y + A\\cdot\\frac{1}{3} = \\frac{1}{12} + \\frac{1}{3}A \\implies A = \\frac{1}{8}$。故 $f(x,y) = xy+\\frac{1}{8}$，选 C。",
        "confidence": 0.95,
        "rating": 0.75,
        "ratingTier": "C",
        "difficultyMultiplier": 1.0,
        "dimensions": {
            "rigor": {"score": 80, "confidence": 0.95, "evidence": "区域面积计算准确"},
            "computation": {"score": 75, "confidence": 0.9, "evidence": "积分方程未代回"},
            "modeling": {"score": 75, "confidence": 0.9, "evidence": "积分方程常数核建模轻微混淆"},
            "methodUse": {"score": 75, "confidence": 0.9, "evidence": "未运用待定常数法"},
            "speed": {"score": 85, "confidence": 0.9, "evidence": "4分钟"},
            "strategyInsight": {"score": 75, "confidence": 0.9, "evidence": "识别积分方程形式", "techniqueLevel": 2, "independentDiscovery": "confirmed"}
        }
    },
    # Q12: 2982
    {
        "questionId": 2982,
        "result": "wrong",
        "selfRating": 2,
        "durationSeconds": 180,
        "summary": "【顶级数学直觉！】第一眼敏锐写出“感觉要用轮换对称”！仅差临门一脚：交换 $x, y$ 得到等价积分式，两式相加分子分母直接约分得 $(a+b)S_D$。",
        "verdict": "partial",
        "earliestError": "第 2 行：写出“感觉要用轮换对称，但不知道怎么用”，未写出 $2I = \\iint_D \\frac{(a+b)(\\sqrt{f(x)}+\\sqrt{f(y)})}{\\sqrt{f(x)}+\\sqrt{f(y)}}\\mathrm{d}\\sigma$",
        "errorTags": ["战术绕路"],
        "weaknessTags": ["二重积分轮换对称性", "King变换求和"],
        "advice": "轮换对称秒杀标准动作：写出原式 $I$，再令 $x,y$ 互换写出 $I$，两式相加 $2I = \\iint_D (a+b)\\mathrm{d}\\sigma = (a+b)S_D \\implies I = \\frac{a+b}{2}\\cdot \\pi$，10 秒出答案！",
        "betterSolution": "由 $D$ 关于 $y=x$ 对称，互换 $x,y$ 得 $I = \\iint_D \\frac{a\\sqrt{f(y)}+b\\sqrt{f(x)}}{\\sqrt{f(x)}+\\sqrt{f(y)}}\\mathrm{d}\\sigma$。两式相加：$2I = \\iint_D (a+b)\\mathrm{d}\\sigma = (a+b)S_D = (a+b)\\pi \\implies I = \\frac{a+b}{2}\\pi$，选 D。",
        "confidence": 0.95,
        "rating": 0.85,
        "ratingTier": "C",
        "difficultyMultiplier": 1.05,
        "dimensions": {
            "rigor": {"score": 85, "confidence": 0.95, "evidence": "扇形区域对称性绘制准确"},
            "computation": {"score": 80, "confidence": 0.9, "evidence": "未完成两式相加"},
            "modeling": {"score": 85, "confidence": 0.9, "evidence": "轮换对称模型识别极快"},
            "methodUse": {"score": 85, "confidence": 0.9, "evidence": "轮换对称直觉完全到位"},
            "speed": {"score": 90, "confidence": 0.9, "evidence": "3分钟"},
            "strategyInsight": {"score": 95, "confidence": 0.95, "evidence": "一眼识别轮换对称，直觉顶级", "techniqueLevel": 3, "independentDiscovery": "confirmed"}
        }
    }
]

payload = {
    "schemaVersion": 1,
    "kind": "batch",
    "taskId": task_id,
    "summary": "【二重积分进阶精选 8 题深度批改】：学员在绝对值分段积分（#2909 满分）、单调性大小比较（#2953 满分）、和式极限向二重积分映射（#2986 满分）、分段对称性拆分（#2921）及轮换对称直觉（#2982 一眼看出）展现出顶尖的微积分素养！仅在变量替换（#2862）、常数核积分方程（#2972）等个别考法需要固化套路。",
    "errorTags": ["瞄准失误", "战术绕路", "概念边界"],
    "weaknessTags": ["二重积分变量替换(Jacobian)", "max分段函数二重积分", "常数核二重积分方程", "二重积分轮换对称性"],
    "confidence": 0.96,
    "recommendedQuestionIds": [],
    "batchAttempts": batch_attempts
}

with open(out_path, "w", encoding="utf-8") as f:
    json.dump(payload, f, ensure_ascii=False, indent=2)

print(f"Batch grading report successfully written to {out_path}")

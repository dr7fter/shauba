import json
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

task_id = "SB-BATCH-20260830-5742"
inbox_dir = os.path.expandvars(r"%APPDATA%\com.shuaba.math\codex-inbox")
out_path = os.path.join(inbox_dir, f"{task_id}.json")

batch_attempts = [
    # Q1: 3559
    {
        "questionId": 3559,
        "result": "correct",
        "selfRating": 4,
        "durationSeconds": 87,
        "summary": "【满分极速秒杀！】等价无穷小 $\\sin\\frac{2}{x} \\sim \\frac{2}{x}$ 与多项式抓大头 $\\frac{6x^2+10}{5x^2+3x} \\to \\frac{6}{5}$，用时 1 分 27 秒！",
        "verdict": "correct",
        "earliestError": None,
        "errorTags": [],
        "weaknessTags": [],
        "advice": "无穷小代换与无穷大抓大头结合得极其干脆，继续保持！",
        "betterSolution": None,
        "confidence": 0.98,
        "rating": 1.30,
        "ratingTier": "S",
        "difficultyMultiplier": 1.0,
        "dimensions": {
            "rigor": {"score": 95, "confidence": 0.95, "evidence": "等价代换与极限运算法则严密"},
            "computation": {"score": 95, "confidence": 0.95, "evidence": "抓大头计算零失误"},
            "modeling": {"score": 95, "confidence": 0.95, "evidence": "极限模型满分"},
            "methodUse": {"score": 95, "confidence": 0.95, "evidence": "熟练运用等价无穷小"},
            "speed": {"score": 98, "confidence": 0.95, "evidence": "87秒极速秒杀"},
            "strategyInsight": {"score": 95, "confidence": 0.95, "evidence": "抓大头直觉顶级", "techniqueLevel": 2, "independentDiscovery": "confirmed"}
        }
    },
    # Q2: 3487
    {
        "questionId": 3487,
        "result": "correct",
        "selfRating": 4,
        "durationSeconds": 133,
        "summary": "【Taylor 展开满分秒杀！】$\\sqrt{1+x} = 1+\\frac{1}{2}x-\\frac{1}{8}x^2$ 与 $\\sqrt{1-x} = 1-\\frac{1}{2}x-\\frac{1}{8}x^2$，分子抵消后直接得出 $-\\frac{1}{4}$！",
        "verdict": "correct",
        "earliestError": None,
        "errorTags": [],
        "weaknessTags": [],
        "advice": "二项式展开到 $x^2$ 项极其熟练，精度与符号毫无差错！",
        "betterSolution": None,
        "confidence": 0.98,
        "rating": 1.30,
        "ratingTier": "S",
        "difficultyMultiplier": 1.0,
        "dimensions": {
            "rigor": {"score": 95, "confidence": 0.95, "evidence": "Taylor 展开阶数判断精准"},
            "computation": {"score": 95, "confidence": 0.95, "evidence": "系数抵消与相加零失误"},
            "modeling": {"score": 95, "confidence": 0.95, "evidence": "0/0 型极限展开模型满分"},
            "methodUse": {"score": 95, "confidence": 0.95, "evidence": "熟练掌握 Taylor 展开"},
            "speed": {"score": 95, "confidence": 0.95, "evidence": "2分13秒极速搞定"},
            "strategyInsight": {"score": 95, "confidence": 0.95, "evidence": "展开意识极强", "techniqueLevel": 2, "independentDiscovery": "confirmed"}
        }
    },
    # Q3: 3581
    {
        "questionId": 3581,
        "result": "correct",
        "selfRating": 4,
        "durationSeconds": 111,
        "summary": "【满分秒杀！】分子有理化 $\\frac{2x}{\\sqrt{x^2+x}+\\sqrt{x^2-x}} = \\frac{2}{\\sqrt{1+1/x}+\\sqrt{1-1/x}} \\to 1$，干净利落！",
        "verdict": "correct",
        "earliestError": None,
        "errorTags": [],
        "weaknessTags": [],
        "advice": "$\\infty-\\infty$ 型根式有理化标准化解法，无懈可击！",
        "betterSolution": None,
        "confidence": 0.98,
        "rating": 1.30,
        "ratingTier": "S",
        "difficultyMultiplier": 1.0,
        "dimensions": {
            "rigor": {"score": 95, "confidence": 0.95, "evidence": "有理化与提公因式严谨"},
            "computation": {"score": 95, "confidence": 0.95, "evidence": "平方差化简零失误"},
            "modeling": {"score": 95, "confidence": 0.95, "evidence": "无穷减无穷模型满分"},
            "methodUse": {"score": 95, "confidence": 0.95, "evidence": "熟练运用有理化技巧"},
            "speed": {"score": 95, "confidence": 0.95, "evidence": "1分51秒极速搞定"},
            "strategyInsight": {"score": 95, "confidence": 0.95, "evidence": "有理化直觉顶级", "techniqueLevel": 2, "independentDiscovery": "confirmed"}
        }
    },
    # Q4: 3616
    {
        "questionId": 3616,
        "result": "correct",
        "selfRating": 4,
        "durationSeconds": 210,
        "summary": "【满分秒杀！】$1^\\infty$ 型指数化：$e^{\\frac{1}{x}\\ln(1+\\frac{2^x-1}{2})} = e^{\\frac{2^x-1}{2x}} = e^{\\frac{x\\ln 2}{2x}} = e^{\\frac{\\ln 2}{2}} = \\sqrt{2}$！",
        "verdict": "correct",
        "earliestError": None,
        "errorTags": [],
        "weaknessTags": [],
        "advice": "$1^\\infty$ 型底数配凑与对数等价代换行云流水！",
        "betterSolution": None,
        "confidence": 0.98,
        "rating": 1.35,
        "ratingTier": "S",
        "difficultyMultiplier": 1.05,
        "dimensions": {
            "rigor": {"score": 95, "confidence": 0.95, "evidence": "指数化与对数等价代换严密规范"},
            "computation": {"score": 95, "confidence": 0.95, "evidence": "指数求值零失误"},
            "modeling": {"score": 95, "confidence": 0.95, "evidence": "幂指函数极限模型满分"},
            "methodUse": {"score": 95, "confidence": 0.95, "evidence": "熟练掌握 $1^\\infty$ 经典套路"},
            "speed": {"score": 95, "confidence": 0.95, "evidence": "3分30秒"},
            "strategyInsight": {"score": 95, "confidence": 0.95, "evidence": "对数配凑技巧顶级", "techniqueLevel": 3, "independentDiscovery": "confirmed"}
        }
    },
    # Q5: 10519
    {
        "questionId": 10519,
        "result": "correct",
        "selfRating": 4,
        "durationSeconds": 38,
        "summary": "【38秒满分秒杀！】直接动用 $x-\\sin x \\sim \\frac{1}{6}x^3$，阶数 $3>2$，秒判高阶无穷小，选 B！",
        "verdict": "correct",
        "earliestError": None,
        "errorTags": [],
        "weaknessTags": [],
        "advice": "经典等价无穷小阶数记忆精准，秒杀反应顶级！",
        "betterSolution": None,
        "confidence": 0.98,
        "rating": 1.30,
        "ratingTier": "S",
        "difficultyMultiplier": 1.0,
        "dimensions": {
            "rigor": {"score": 95, "confidence": 0.95, "evidence": "阶数判定依据严密"},
            "computation": {"score": 95, "confidence": 0.95, "evidence": "口算零失误"},
            "modeling": {"score": 95, "confidence": 0.95, "evidence": "无穷小阶数模型满分"},
            "methodUse": {"score": 95, "confidence": 0.95, "evidence": "熟练掌握 Taylor 阶数"},
            "speed": {"score": 100, "confidence": 0.95, "evidence": "38秒光速答题"},
            "strategyInsight": {"score": 95, "confidence": 0.95, "evidence": "神经反射顶级", "techniqueLevel": 1, "independentDiscovery": "confirmed"}
        }
    },
    # Q6: 4183
    {
        "questionId": 4183,
        "result": "correct",
        "selfRating": 4,
        "durationSeconds": 82,
        "summary": "【满分极速秒杀！】二项式 $(1-ax^2)^{1/4}-1 \\sim -\\frac{1}{4}ax^2$，分母 $x\\sin x \\sim x^2$，等价比值为 $1 \\implies -\\frac{1}{4}a=1 \\implies a=-4$！",
        "verdict": "correct",
        "earliestError": None,
        "errorTags": [],
        "weaknessTags": [],
        "advice": "广义二项式 $(1+u)^\\alpha-1 \\sim \\alpha u$ 运用得非常娴熟！",
        "betterSolution": None,
        "confidence": 0.98,
        "rating": 1.30,
        "ratingTier": "S",
        "difficultyMultiplier": 1.0,
        "dimensions": {
            "rigor": {"score": 95, "confidence": 0.95, "evidence": "等价无穷小代换严谨"},
            "computation": {"score": 95, "confidence": 0.95, "evidence": "一元一次方程求解准确"},
            "modeling": {"score": 95, "confidence": 0.95, "evidence": "等价无穷小定参模型满分"},
            "methodUse": {"score": 95, "confidence": 0.95, "evidence": "熟练掌握广义二项式"},
            "speed": {"score": 98, "confidence": 0.95, "evidence": "1分22秒秒杀"},
            "strategyInsight": {"score": 95, "confidence": 0.95, "evidence": "代换直觉顶级", "techniqueLevel": 2, "independentDiscovery": "confirmed"}
        }
    },
    # Q7: 3996
    {
        "questionId": 3996,
        "result": "correct",
        "selfRating": 4,
        "durationSeconds": 106,
        "summary": "【满分秒杀！】Taylor 展开 $\\ln(1+x) = x-\\frac{1}{2}x^2+o(x^2)$，分子为 $(1-a)x - (\\frac{1}{2}+b)x^2$，对比极限得 $a=1, b=-\\frac{5}{2}$，选 A！",
        "verdict": "correct",
        "earliestError": None,
        "errorTags": [],
        "weaknessTags": [],
        "advice": "Taylor 展开待定系数法规范清晰，一气呵成！",
        "betterSolution": None,
        "confidence": 0.98,
        "rating": 1.30,
        "ratingTier": "S",
        "difficultyMultiplier": 1.0,
        "dimensions": {
            "rigor": {"score": 95, "confidence": 0.95, "evidence": "展开项数与待定方程对应严谨"},
            "computation": {"score": 95, "confidence": 0.95, "evidence": "方程求解零失误"},
            "modeling": {"score": 95, "confidence": 0.95, "evidence": "极限待定系数模型满分"},
            "methodUse": {"score": 95, "confidence": 0.95, "evidence": "熟练掌握 Taylor 定参"},
            "speed": {"score": 95, "confidence": 0.95, "evidence": "1分46秒"},
            "strategyInsight": {"score": 95, "confidence": 0.95, "evidence": "待定系数直觉顶级", "techniqueLevel": 2, "independentDiscovery": "confirmed"}
        }
    },
    # Q8: 4352
    {
        "questionId": 4352,
        "result": "correct",
        "selfRating": 4,
        "durationSeconds": 123,
        "summary": "【满分秒杀！】分段点 $x=0$ 处连续性：$f(0)=a$，右极限 $\\lim_{x\\to 0^+} e^x(\\sin x+\\cos x) = 1 \\implies a=1$！",
        "verdict": "correct",
        "earliestError": None,
        "errorTags": [],
        "weaknessTags": [],
        "advice": "分段函数连续性左右极限对齐，节奏稳定！",
        "betterSolution": None,
        "confidence": 0.98,
        "rating": 1.25,
        "ratingTier": "A",
        "difficultyMultiplier": 1.0,
        "dimensions": {
            "rigor": {"score": 95, "confidence": 0.95, "evidence": "连续性定义与左右极限推导严谨"},
            "computation": {"score": 95, "confidence": 0.95, "evidence": "三角与指数函数代值零失误"},
            "modeling": {"score": 95, "confidence": 0.95, "evidence": "连续性定参模型满分"},
            "methodUse": {"score": 95, "confidence": 0.95, "evidence": "熟练掌握连续性判定"},
            "speed": {"score": 95, "confidence": 0.95, "evidence": "2分03秒"},
            "strategyInsight": {"score": 95, "confidence": 0.95, "evidence": "连续性直觉清晰", "techniqueLevel": 1, "independentDiscovery": "confirmed"}
        }
    },
    # Q9: 4384
    {
        "questionId": 4384,
        "result": "wrong",
        "selfRating": 2,
        "durationSeconds": 146,
        "summary": "在 $x=1$ 处的跳跃间断点判定完全正确（$f(1^+)=0, f(1^-)=-1$）；但在 $x=0$ 处分母 $e^{\\frac{x}{x-1}}-1 \\to 0 \\implies f(x) \\to \\infty$，误记为极限为 $1$。故 $x=0$ 为第二类（无穷）间断点，$x=1$ 为第一类（跳跃）间断点，应选 D。",
        "verdict": "partial",
        "earliestError": "第 2 行：在 $x\\to 0$ 处写出 $\\lim_{x\\to 0} f(x) = \\frac{x-1}{x} = 1$，忽略了分母趋于 0 导致极限趋于无穷大",
        "errorTags": ["瞄准失误"],
        "weaknessTags": ["间断点类型判定", "无穷小倒数趋于无穷"],
        "advice": "牢记当 $x\\to 0$ 时，$\\frac{1}{e^u-1} \\sim \\frac{1}{u} = \\frac{x-1}{x} \\to \\infty$，分母为 0 且无公因式抵消必为无穷间断点（第二类）！",
        "betterSolution": "① $x=0$ 处：$\\lim_{x\\to 0} (e^{\\frac{x}{x-1}}-1) = e^0-1 = 0 \\implies \\lim_{x\\to 0} f(x) = \\infty$，为无穷间断点（第二类）；② $x=1$ 处：$\\lim_{x\\to 1^+} \\frac{x}{x-1} = +\\infty \\implies f(1^+) = \\frac{1}{+\\infty} = 0$，$\\lim_{x\\to 1^-} \\frac{x}{x-1} = -\\infty \\implies f(1^-) = \\frac{1}{0-1} = -1$，左右极限均存在但不相等，为跳跃间断点（第一类）。故选 D。",
        "confidence": 0.95,
        "rating": 0.80,
        "ratingTier": "C",
        "difficultyMultiplier": 1.0,
        "dimensions": {
            "rigor": {"score": 80, "confidence": 0.95, "evidence": "跳跃间断点推导完整，无穷间断点代值笔误"},
            "computation": {"score": 75, "confidence": 0.9, "evidence": "x->0 时倒数极限运算失误"},
            "modeling": {"score": 85, "confidence": 0.9, "evidence": "间断点分类模型清晰"},
            "methodUse": {"score": 80, "confidence": 0.9, "evidence": "左右极限判定熟练"},
            "speed": {"score": 90, "confidence": 0.9, "evidence": "2分26秒"},
            "strategyInsight": {"score": 80, "confidence": 0.9, "evidence": "分类思想明确", "techniqueLevel": 2, "independentDiscovery": "confirmed"}
        }
    },
    # Q10: 3674
    {
        "questionId": 3674,
        "result": "correct",
        "selfRating": 4,
        "durationSeconds": 206,
        "summary": "【导数定义满分秒杀！】将分母增量拆分为 $\\frac{f(x_0-2x)-f(x_0)}{-2x}\\cdot(-2) - \\frac{f(x_0-x)-f(x_0)}{-x}\\cdot(-1) = -2f'(x_0)+f'(x_0) = -f'(x_0) = 1$，原式取倒数直接得 $1$！",
        "verdict": "correct",
        "earliestError": None,
        "errorTags": [],
        "weaknessTags": [],
        "advice": "导数定义增量配凑规范严谨，倒数还原意识清晰！",
        "betterSolution": None,
        "confidence": 0.98,
        "rating": 1.30,
        "ratingTier": "S",
        "difficultyMultiplier": 1.0,
        "dimensions": {
            "rigor": {"score": 95, "confidence": 0.95, "evidence": "导数定义加减中间项严谨"},
            "computation": {"score": 95, "confidence": 0.95, "evidence": "系数化简零失误"},
            "modeling": {"score": 95, "confidence": 0.95, "evidence": "导数定义增量模型满分"},
            "methodUse": {"score": 95, "confidence": 0.95, "evidence": "熟练掌握导数定义配凑"},
            "speed": {"score": 95, "confidence": 0.95, "evidence": "3分26秒"},
            "strategyInsight": {"score": 95, "confidence": 0.95, "evidence": "倒数还原直觉顶级", "techniqueLevel": 2, "independentDiscovery": "confirmed"}
        }
    },
    # Q11: 4082
    {
        "questionId": 4082,
        "result": "correct",
        "selfRating": 4,
        "durationSeconds": 153,
        "summary": "【切线方程满分秒杀！】连续性得 $f(1)=1$，导数定义 $f'(1) = \\lim_{x\\to 1}\\frac{f(x)-1}{x-1} = \\lim \\frac{f(x)-1}{\\ln x}\\cdot\\frac{\\ln x}{x-1} = 2$，切线方程 $y-1=2(x-1) \\implies y=2x-1$！",
        "verdict": "correct",
        "earliestError": None,
        "errorTags": [],
        "weaknessTags": [],
        "advice": "极限拆项求切线斜率与切点坐标一气呵成！",
        "betterSolution": None,
        "confidence": 0.98,
        "rating": 1.30,
        "ratingTier": "S",
        "difficultyMultiplier": 1.0,
        "dimensions": {
            "rigor": {"score": 95, "confidence": 0.95, "evidence": "连续性定点与极限求导严密"},
            "computation": {"score": 95, "confidence": 0.95, "evidence": "点斜式方程化简零失误"},
            "modeling": {"score": 95, "confidence": 0.95, "evidence": "导数几何意义模型满分"},
            "methodUse": {"score": 95, "confidence": 0.95, "evidence": "熟练掌握切线求法"},
            "speed": {"score": 95, "confidence": 0.95, "evidence": "2分33秒"},
            "strategyInsight": {"score": 95, "confidence": 0.95, "evidence": "等价代换求导直觉顶级", "techniqueLevel": 2, "independentDiscovery": "confirmed"}
        }
    },
    # Q12: 4100
    {
        "questionId": 4100,
        "result": "correct",
        "selfRating": 4,
        "durationSeconds": 248,
        "summary": "【局部保号性满分秒杀！】$f'(a)=\\lim\\frac{f(x)-f(a)}{x-a}=0$ 确认驻点；局部 $f(x)-f(a) = -(x-a)^2+o((x-a)^2) < 0 \\implies f(x) < f(a)$，秒判极大值，选 B！",
        "verdict": "correct",
        "earliestError": None,
        "errorTags": [],
        "weaknessTags": [],
        "advice": "高阶极限局部保号性与极值第一定义结合得非常漂亮！",
        "betterSolution": None,
        "confidence": 0.98,
        "rating": 1.35,
        "ratingTier": "S",
        "difficultyMultiplier": 1.05,
        "dimensions": {
            "rigor": {"score": 95, "confidence": 0.95, "evidence": "极值定义与局部符号分析严密规范"},
            "computation": {"score": 95, "confidence": 0.95, "evidence": "导数与极值判定零失误"},
            "modeling": {"score": 95, "confidence": 0.95, "evidence": "高阶极限局部展开模型满分"},
            "methodUse": {"score": 95, "confidence": 0.95, "evidence": "熟练掌握保号性极值判定"},
            "speed": {"score": 90, "confidence": 0.95, "evidence": "4分08秒深度推导"},
            "strategyInsight": {"score": 95, "confidence": 0.95, "evidence": "局部保号性直觉顶级", "techniqueLevel": 3, "independentDiscovery": "confirmed"}
        }
    },
    # Q13: 3960
    {
        "questionId": 3960,
        "result": "correct",
        "selfRating": 4,
        "durationSeconds": 86,
        "summary": "【反例排除满分秒杀！】A 排除 $x_n=\\pi$，B/C 排除 $x_n=-1$，锁定函数 $g(x)=x+\\sin x$ 单调增且 $g(0)=0 \\implies x_n \\to 0$，选 D！",
        "verdict": "correct",
        "earliestError": None,
        "errorTags": [],
        "weaknessTags": [],
        "advice": "考场经典反例秒杀体系掌握得非常扎实！",
        "betterSolution": None,
        "confidence": 0.98,
        "rating": 1.30,
        "ratingTier": "S",
        "difficultyMultiplier": 1.0,
        "dimensions": {
            "rigor": {"score": 95, "confidence": 0.95, "evidence": "反例构造与单调性分析严谨"},
            "computation": {"score": 95, "confidence": 0.95, "evidence": "定性逻辑零失误"},
            "modeling": {"score": 95, "confidence": 0.95, "evidence": "数列极限反例模型满分"},
            "methodUse": {"score": 95, "confidence": 0.95, "evidence": "熟练掌握反例排除法"},
            "speed": {"score": 98, "confidence": 0.95, "evidence": "1分26秒极速秒杀"},
            "strategyInsight": {"score": 95, "confidence": 0.95, "evidence": "反例敏锐度顶级", "techniqueLevel": 2, "independentDiscovery": "confirmed"}
        }
    },
    # Q14: 3718
    {
        "questionId": 3718,
        "result": "correct",
        "selfRating": 4,
        "durationSeconds": 256,
        "summary": "【变上限积分极限满分秒杀！】分母换元 $\\int_0^x f(x-t)dt = \\int_0^x f(u)du$，分子拆项对 $x$ 洛必达求导得 $\\frac{\\int_0^x f(t)dt}{\\int_0^x f(u)du + xf(x)}$，再洛必达得 $\\frac{f(0)}{2f(0)} = \\frac{1}{2}$！",
        "verdict": "correct",
        "earliestError": None,
        "errorTags": [],
        "weaknessTags": [],
        "advice": "卷积变上限积分换元与乘积求导法则运用得天衣无缝！",
        "betterSolution": None,
        "confidence": 0.98,
        "rating": 1.35,
        "ratingTier": "S",
        "difficultyMultiplier": 1.05,
        "dimensions": {
            "rigor": {"score": 95, "confidence": 0.95, "evidence": "变上限积分拆项与换元求导严密规范"},
            "computation": {"score": 95, "confidence": 0.95, "evidence": "洛必达求导零失误"},
            "modeling": {"score": 95, "confidence": 0.95, "evidence": "变上限积分 0/0 型极限模型满分"},
            "methodUse": {"score": 95, "confidence": 0.95, "evidence": "熟练掌握卷积换元与导数计算"},
            "speed": {"score": 95, "confidence": 0.95, "evidence": "4分16秒"},
            "strategyInsight": {"score": 95, "confidence": 0.95, "evidence": "换元意识顶级", "techniqueLevel": 3, "independentDiscovery": "confirmed"}
        }
    },
    # Q15: 3839
    {
        "questionId": 3839,
        "result": "correct",
        "selfRating": 4,
        "durationSeconds": 600,
        "summary": "【压轴大题满分秒杀！】Riemann 定积分和式 $\\int_0^1 x\\arctan\\sqrt{x}dx$ $\\to$ 凑微分分部积分 $\\to$ 换元 $t=\\sqrt{x}$ 转化为有理分式 $\\int_0^1 \\frac{t^4}{t^2+1}dt$ 长除法拆项，全程零失误算出 $\\frac{1}{3}$！",
        "verdict": "correct",
        "earliestError": None,
        "errorTags": [],
        "weaknessTags": [],
        "advice": "从和式极限到分部积分再到有理分式长除法多步连招，计算功底炉火纯青！",
        "betterSolution": None,
        "confidence": 0.98,
        "rating": 1.45,
        "ratingTier": "S",
        "difficultyMultiplier": 1.1,
        "dimensions": {
            "rigor": {"score": 98, "confidence": 0.95, "evidence": "积分换元、分部积分边界代入及长除法分解无懈可击"},
            "computation": {"score": 98, "confidence": 0.95, "evidence": "四步复合计算零失误，最终化简精准"},
            "modeling": {"score": 95, "confidence": 0.95, "evidence": "和式极限转定积分模型满分"},
            "methodUse": {"score": 98, "confidence": 0.95, "evidence": "熟练综合运用微积分三大核心技巧"},
            "speed": {"score": 90, "confidence": 0.95, "evidence": "10分钟标准攻克压轴大题"},
            "strategyInsight": {"score": 95, "confidence": 0.95, "evidence": "长除法降次直觉顶级", "techniqueLevel": 4, "independentDiscovery": "confirmed"}
        }
    }
]

payload = {
    "schemaVersion": 1,
    "kind": "batch",
    "taskId": task_id,
    "summary": "【极限/导数/积分综合实战 15 题 · 统治级 14 题满分通关】：学员展现了考研数一一元微积分极其深厚的内功！涵盖 Taylor展开（#3487 满分）、1^∞型幂指极限（#3616 满分）、导数定义拆项（#3674 满分）、局部保号性极值（#4100 满分）、变上限卷积积分极限（#3718 满分）及 Riemann和式有理分式长除法（#3839 满分 100% 满分）。仅在间断点判定（#4384）出现无穷小倒数代值微观笔误。",
    "errorTags": ["瞄准失误"],
    "weaknessTags": ["间断点类型判定"],
    "confidence": 0.98,
    "recommendedQuestionIds": [],
    "batchAttempts": batch_attempts
}

with open(out_path, "w", encoding="utf-8") as f:
    json.dump(payload, f, ensure_ascii=False, indent=2)

print(f"Batch grading report successfully written to {out_path}")

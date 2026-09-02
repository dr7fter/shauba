import json
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

task_id = "SB-BATCH-20260828-7151"
inbox_dir = os.path.expandvars(r"%APPDATA%\com.shuaba.math\codex-inbox")
out_path = os.path.join(inbox_dir, f"{task_id}.json")

batch_attempts = [
    # Q1: 3005
    {
        "questionId": 3005,
        "result": "correct",
        "selfRating": 4,
        "durationSeconds": 369,
        "summary": "【满分秒杀！】交换积分次序极其熟练，精准化为 $\\int_0^2 \\mathrm{d}y \\int_0^y e^{-y^2}\\mathrm{d}x = \\int_0^2 y e^{-y^2}\\mathrm{d}y$，配元积分零误差算出 $\\frac{1}{2}(1-e^{-4})$！",
        "verdict": "correct",
        "earliestError": None,
        "errorTags": [],
        "weaknessTags": [],
        "advice": "交换积分次序第一定理运用极度丝滑，保持对 $e^{-y^2}$ 不可积因式必先对 $x$ 积分的敏锐嗅觉！",
        "betterSolution": None,
        "confidence": 0.98,
        "rating": 1.25,
        "ratingTier": "A",
        "difficultyMultiplier": 1.0,
        "dimensions": {
            "rigor": {"score": 95, "confidence": 0.95, "evidence": "积分区域不等式互换与定积分上下限严密正确"},
            "computation": {"score": 95, "confidence": 0.95, "evidence": "凑微分积分计算零失误"},
            "modeling": {"score": 95, "confidence": 0.95, "evidence": "完全掌握二重积分交换次序模型"},
            "methodUse": {"score": 95, "confidence": 0.95, "evidence": "熟练运用凑微分法"},
            "speed": {"score": 90, "confidence": 0.95, "evidence": "6分09秒节奏规范"},
            "strategyInsight": {"score": 95, "confidence": 0.95, "evidence": "交换次序直觉极强", "techniqueLevel": 2, "independentDiscovery": "confirmed"}
        }
    },
    # Q2: 2806
    {
        "questionId": 2806,
        "result": "correct",
        "selfRating": 4,
        "durationSeconds": 306,
        "summary": "【满分高分表现！】敏锐识别“先对 $x$ 积好积”，$X$ 型区域定限 $y^2\\leqslant x\\leqslant y (0\\leqslant y\\leqslant 1)$ 一次写对，内层积分后分部积分计算零失误算出 $1-\\sin 1$！",
        "verdict": "correct",
        "earliestError": None,
        "errorTags": [],
        "weaknessTags": [],
        "advice": "解法堪称标准答案典范，二重积分分部积分手感已达顶格水平！",
        "betterSolution": None,
        "confidence": 0.98,
        "rating": 1.30,
        "ratingTier": "S",
        "difficultyMultiplier": 1.05,
        "dimensions": {
            "rigor": {"score": 95, "confidence": 0.95, "evidence": "区域定限与两项拆分分部积分严密规范"},
            "computation": {"score": 95, "confidence": 0.95, "evidence": "分部积分符号与三角数值完全准确"},
            "modeling": {"score": 95, "confidence": 0.95, "evidence": "二重积分区域化简模型满分"},
            "methodUse": {"score": 95, "confidence": 0.95, "evidence": "熟练运用分部积分"},
            "speed": {"score": 95, "confidence": 0.95, "evidence": "5分06秒极速搞定"},
            "strategyInsight": {"score": 95, "confidence": 0.95, "evidence": "定限顺序选择极其精准", "techniqueLevel": 3, "independentDiscovery": "confirmed"}
        }
    },
    # Q3: 2832
    {
        "questionId": 2832,
        "result": "wrong",
        "selfRating": 2,
        "durationSeconds": 493,
        "summary": "利用第一象限对称性 $I=4\\iint_{D_1}$ 与极坐标变量分离 $I = 8\\int_0^{\\pi/2}\\cos^2\\theta\\mathrm{d}\\theta \\int_1^e r^3\\ln r\\mathrm{d}r$ 100% 满分拆解！仅在内层一元反常分部积分 $\\int_1^e r^3\\ln r\\mathrm{d}r$ 稍有犹豫卡壳。",
        "verdict": "partial",
        "earliestError": "第 6 行：写出“有点不会算 $\\int_1^e r^3\\ln r\\mathrm{d}r$”，未直接动用分部积分 $\\int \\ln r \\mathrm{d}(\\frac{r^4}{4})$ 进行计算",
        "errorTags": ["战术绕路"],
        "weaknessTags": ["极坐标二重积分", "对数幂函数分部积分"],
        "advice": "多项式乘对数 $\\int r^k \\ln r\\mathrm{d}r$ 永远优先把 $r^k$ 凑入微分：$\\int \\ln r \\mathrm{d}(\\frac{r^{k+1}}{k+1}) = \\frac{r^{k+1}}{k+1}\\ln r - \\int \\frac{r^k}{k+1}\\mathrm{d}r$，10 秒出结果！",
        "betterSolution": "原式 $= 4\\int_0^{\\pi/2}\\cos^2\\theta\\mathrm{d}\\theta \\int_1^e (r^2\\cos^2\\theta)(2\\ln r)r\\mathrm{d}r = 8\\cdot\\frac{\\pi}{4}\\int_1^e r^3\\ln r\\mathrm{d}r = 2\\pi \\left([\\frac{r^4}{4}\\ln r]_1^e - \\int_1^e \\frac{r^3}{4}\\mathrm{d}r\\right) = 2\\pi (\\frac{e^4}{4} - \\frac{e^4-1}{16}) = \\frac{3\\pi}{8}e^4 + \\frac{\\pi}{8}$。",
        "confidence": 0.95,
        "rating": 0.85,
        "ratingTier": "C",
        "difficultyMultiplier": 1.05,
        "dimensions": {
            "rigor": {"score": 90, "confidence": 0.95, "evidence": "对称性判断与极坐标微元 $r\\mathrm{d}r\\mathrm{d}\\theta$ 极其标准"},
            "computation": {"score": 80, "confidence": 0.9, "evidence": "极坐标展开正确，分部积分未写完"},
            "modeling": {"score": 95, "confidence": 0.95, "evidence": "圆环域极坐标建模满分"},
            "methodUse": {"score": 85, "confidence": 0.95, "evidence": "掌握极坐标分离变量法"},
            "speed": {"score": 85, "confidence": 0.9, "evidence": "8分13秒推进至最后一元积分"},
            "strategyInsight": {"score": 90, "confidence": 0.95, "evidence": "对称性洞察极其敏锐", "techniqueLevel": 3, "independentDiscovery": "confirmed"}
        }
    },
    # Q4: 2847
    {
        "questionId": 2847,
        "result": "wrong",
        "selfRating": 2,
        "durationSeconds": 380,
        "summary": "成功识别偏心圆 $D: (x-1)^2+y^2\\leqslant 1$ 极坐标方程 $r=2\\cos\\theta$ 与范围 $[-\\frac{\\pi}{2}, \\frac{\\pi}{2}]$！未动用奇函数对称性 $\\iint_D 3y\\mathrm{d}\\sigma = 0$ 与形心公式进行秒杀。",
        "verdict": "partial",
        "earliestError": "第 2 行：极坐标展开式中被积函数写为 $r(2\\cos\\theta+3\\sin\\theta)$（漏写 $x=r\\cos\\theta$ 内部的 $r$），未利用 $D$ 关于 $x$ 轴对称 $\\iint_D y\\mathrm{d}\\sigma=0$",
        "errorTags": ["战术绕路"],
        "weaknessTags": ["二重积分对称性秒杀", "形心坐标公式"],
        "advice": "遇到偏心圆积分秒杀两步走：① 对称性消项：$D$ 关于 $x$ 轴对称 $\\implies \\iint 3y\\mathrm{d}\\sigma = 0$；② 形心公式秒杀：$\\iint_D 2x\\mathrm{d}\\sigma = 2 \\bar{x} S_D = 2(1)(\\pi\\cdot 1^2) = 2\\pi$，10 秒出答案！",
        "betterSolution": "因 $D$ 关于 $x$ 轴对称，而 $3y$ 为 $y$ 的奇函数，故 $\\iint_D 3y\\,\\mathrm{d}\\sigma = 0$。由对称中心/形心 $\\bar{x}=1$，$I = 2\\iint_D x\\,\\mathrm{d}\\sigma = 2\\bar{x}\\cdot \\operatorname{Area}(D) = 2(1)(\\pi\\cdot 1^2) = 2\\pi$。",
        "confidence": 0.95,
        "rating": 0.80,
        "ratingTier": "C",
        "difficultyMultiplier": 1.0,
        "dimensions": {
            "rigor": {"score": 85, "confidence": 0.95, "evidence": "偏心圆极坐标定限准确"},
            "computation": {"score": 75, "confidence": 0.9, "evidence": "极坐标被积函数漏了一个 r"},
            "modeling": {"score": 85, "confidence": 0.9, "evidence": "圆域建模正确"},
            "methodUse": {"score": 75, "confidence": 0.9, "evidence": "未动用对称性化简"},
            "speed": {"score": 85, "confidence": 0.9, "evidence": "6分20秒"},
            "strategyInsight": {"score": 75, "confidence": 0.9, "evidence": "识别偏心圆极坐标", "techniqueLevel": 2, "independentDiscovery": "confirmed"}
        }
    },
    # Q5: 2835
    {
        "questionId": 2835,
        "result": "wrong",
        "selfRating": 2,
        "durationSeconds": 279,
        "summary": "准确利用对称性 $I=4\\iint_{D_1}y^2\\mathrm{d}x\\mathrm{d}y$！直角坐标定限时外层 $\\mathrm{d}y$ 上限写成 $a$（应为 $b$）；未动用广义极坐标进行秒杀。",
        "verdict": "partial",
        "earliestError": "第 3 行：直角坐标定限 $\\int_0^a \\mathrm{d}y$ 将 $y$ 的上限误写为 $a$（椭圆 $y$ 范围为 $[0,b]$）",
        "errorTags": ["瞄准失误"],
        "weaknessTags": ["椭圆域广义极坐标", "直角坐标上下限定向"],
        "advice": "椭圆域 $\\frac{x^2}{a^2}+\\frac{y^2}{b^2}\\leqslant 1$ 绝技：令广义极坐标 $x=ar\\cos\\theta, y=br\\sin\\theta, \\mathrm{d}\\sigma=ab r\\mathrm{d}r\\mathrm{d}\\theta$，直接化为矩形域秒杀！",
        "betterSolution": "令广义极坐标 $x=ar\\cos\\theta, y=br\\sin\\theta$，则 $I = \\int_0^{2\\pi}\\mathrm{d}\\theta \\int_0^1 (b^2 r^2\\sin^2\\theta) ab r\\mathrm{d}r = ab^3 (\\int_0^{2\\pi}\\sin^2\\theta\\mathrm{d}\\theta)(\\int_0^1 r^3\\mathrm{d}r) = ab^3 \\cdot \\pi \\cdot \\frac{1}{4} = \\frac{\\pi ab^3}{4}$。",
        "confidence": 0.95,
        "rating": 0.80,
        "ratingTier": "C",
        "difficultyMultiplier": 1.0,
        "dimensions": {
            "rigor": {"score": 80, "confidence": 0.95, "evidence": "对称性拆分正确"},
            "computation": {"score": 75, "confidence": 0.9, "evidence": "外层积分上限字母标反"},
            "modeling": {"score": 80, "confidence": 0.9, "evidence": "椭圆第一象限建模"},
            "methodUse": {"score": 75, "confidence": 0.9, "evidence": "未动用广义极坐标"},
            "speed": {"score": 90, "confidence": 0.9, "evidence": "4分39秒果断推进"},
            "strategyInsight": {"score": 75, "confidence": 0.9, "evidence": "识别对称性", "techniqueLevel": 2, "independentDiscovery": "confirmed"}
        }
    },
    # Q6: 2932
    {
        "questionId": 2932,
        "result": "correct",
        "selfRating": 4,
        "durationSeconds": 133,
        "summary": "【满分秒杀！】画图精准定限：在 $x\\in[\\frac{\\pi}{2},\\pi]$ 上 $\\sin x=y \\implies x=\\pi-\\arcsin y$，准确交换次序为 $\\int_0^1\\mathrm{d}y \\int_{\\pi/2}^{\\pi-\\arcsin y}f(x,y)\\mathrm{d}x$，选 B！",
        "verdict": "correct",
        "earliestError": None,
        "errorTags": [],
        "weaknessTags": [],
        "advice": "三角函数反函数定限极其熟练，继续保持反三角函数单调区间的敏锐度！",
        "betterSolution": None,
        "confidence": 0.98,
        "rating": 1.15,
        "ratingTier": "A",
        "difficultyMultiplier": 1.0,
        "dimensions": {
            "rigor": {"score": 95, "confidence": 0.95, "evidence": "反三角函数区间主值选取严密"},
            "computation": {"score": 95, "confidence": 0.95, "evidence": "定限零失误"},
            "modeling": {"score": 95, "confidence": 0.95, "evidence": "二次积分几何区域建模满分"},
            "methodUse": {"score": 95, "confidence": 0.95, "evidence": "熟练掌握交换积分次序"},
            "speed": {"score": 95, "confidence": 0.95, "evidence": "2分13秒极速秒解"},
            "strategyInsight": {"score": 95, "confidence": 0.95, "evidence": "反函数区间识别极准", "techniqueLevel": 2, "independentDiscovery": "confirmed"}
        }
    },
    # Q7: 2946
    {
        "questionId": 2946,
        "result": "wrong",
        "selfRating": 1,
        "durationSeconds": 289,
        "summary": "几何草图画得极其标准（大圆 $r=2$ 与小圆 $r=2\\cos\\theta$ 在第一象限所夹阴影）！在直角坐标微元判定时受阻，误选了含有额外模长因子的 C（应为 B）。",
        "verdict": "partial",
        "earliestError": "最后选项行：草稿写“排除 A, B $\\implies$ 选 C”，混淆了面积微元 $\\mathrm{d}\\sigma = r\\mathrm{d}r\\mathrm{d}\\theta = \\mathrm{d}x\\mathrm{d}y$（无需额外再乘 $\\sqrt{x^2+y^2}$）",
        "errorTags": ["概念边界"],
        "weaknessTags": ["极坐标面积微元", "直角坐标 X型区域定限"],
        "advice": "牢记极坐标与直角坐标对应关系：$r\\mathrm{d}r\\mathrm{d}\\theta = \\mathrm{d}x\\mathrm{d}y$（两者直接等价，不需要额外补 $r$）；所画阴影为 $X$ 型区域：$0\\leqslant x\\leqslant 2, \\sqrt{2x-x^2}\\leqslant y\\leqslant \\sqrt{4-x^2}$，直接选 B！",
        "betterSolution": "阴影区域在直角坐标下表示为 $0\\leqslant x\\leqslant 2, \\sqrt{2x-x^2}\\leqslant y\\leqslant \\sqrt{4-x^2}$。因 $f(r^2)r\\mathrm{d}r\\mathrm{d}\\theta = f(x^2+y^2)\\mathrm{d}x\\mathrm{d}y$，故原积分直接等于 $\\int_0^2\\mathrm{d}x \\int_{\\sqrt{2x-x^2}}^{\\sqrt{4-x^2}} f(x^2+y^2)\\mathrm{d}y$，选 B。",
        "confidence": 0.95,
        "rating": 0.75,
        "ratingTier": "C",
        "difficultyMultiplier": 1.0,
        "dimensions": {
            "rigor": {"score": 85, "confidence": 0.95, "evidence": "几何草图圆弧交点绘制极其精准"},
            "computation": {"score": 80, "confidence": 0.9, "evidence": "极坐标圆方程转换正确"},
            "modeling": {"score": 85, "confidence": 0.9, "evidence": "区域几何模型完整"},
            "methodUse": {"score": 75, "confidence": 0.9, "evidence": "面积微元概念轻微混淆"},
            "speed": {"score": 80, "confidence": 0.9, "evidence": "4分49秒"},
            "strategyInsight": {"score": 85, "confidence": 0.9, "evidence": "画图找区域直觉敏锐", "techniqueLevel": 2, "independentDiscovery": "confirmed"}
        }
    },
    # Q8: 2820
    {
        "questionId": 2820,
        "result": "wrong",
        "selfRating": 2,
        "durationSeconds": 257,
        "summary": "【直觉敏锐度极高！】第一眼敏锐洞察到“一看就要改直角坐标系”，成功将 $r^2\\sin\\theta\\mathrm{d}r\\mathrm{d}\\theta$ 转化为 $y\\mathrm{d}x\\mathrm{d}y$！仅在根号内利用倍角公式 $r^2\\cos 2\\theta = x^2-y^2$ 进行化简时卡壳。",
        "verdict": "partial",
        "earliestError": "第 2 行：写出“根号里面怎么约？”，未动用倍角公式 $\\cos 2\\theta = \\cos^2\\theta-\\sin^2\\theta \\implies r^2\\cos 2\\theta = x^2-y^2$",
        "errorTags": ["战术绕路"],
        "weaknessTags": ["极坐标三角倍角化简", "直角坐标二重积分"],
        "advice": "三角二倍角在极坐标中的经典代换：$r^2\\cos 2\\theta = r^2(\\cos^2\\theta-\\sin^2\\theta) = x^2-y^2$；$r^2\\sin 2\\theta = 2xy$！看到立刻秒换！",
        "betterSolution": "因 $r^2\\cos 2\\theta = x^2-y^2$ 且 $r^2\\sin\\theta\\mathrm{d}r\\mathrm{d}\\theta = y\\mathrm{d}x\\mathrm{d}y$。区域 $D: 0\\leqslant x\\leqslant 1, 0\\leqslant y\\leqslant x$。原式 $= \\int_0^1\\mathrm{d}x \\int_0^x y\\sqrt{1-x^2+y^2}\\mathrm{d}y = \\frac{1}{3}\\int_0^1 [1-(1-x^2)^{3/2}]\\mathrm{d}x = \\frac{1}{3} - \\frac{1}{3}\\int_0^{\\pi/2}\\cos^4 t\\mathrm{d}t = \\frac{1}{3} - \\frac{\\pi}{16}$。",
        "confidence": 0.95,
        "rating": 0.85,
        "ratingTier": "C",
        "difficultyMultiplier": 1.1,
        "dimensions": {
            "rigor": {"score": 85, "confidence": 0.95, "evidence": "坐标系转换方向完全正确"},
            "computation": {"score": 80, "confidence": 0.9, "evidence": "三角代数化简未闭环"},
            "modeling": {"score": 90, "confidence": 0.95, "evidence": "敏锐建立直角坐标直角三角形区域模型"},
            "methodUse": {"score": 85, "confidence": 0.95, "evidence": "掌握坐标系相互转换"},
            "speed": {"score": 90, "confidence": 0.9, "evidence": "4分17秒推进敏捷"},
            "strategyInsight": {"score": 95, "confidence": 0.95, "evidence": "瞬间识别直角坐标转换，洞察力顶级", "techniqueLevel": 4, "independentDiscovery": "confirmed"}
        }
    }
]

payload = {
    "schemaVersion": 1,
    "kind": "batch",
    "taskId": task_id,
    "summary": "【二重积分开拔 8 题实战批改】：学员在二重积分交换次序（#3005 满分）、分部积分（#2806 满分）、反三角函数定限（#2932 满分）及直角坐标转换直觉（#2820 敏锐识别）展现出顶级的微积分嗅觉与计算功底！仅在对数分部积分（#2832）、偏心圆对称性与形心公式（#2847）、椭圆广义极坐标（#2835）以及极坐标倍角化简（#2820）等 4 个专属技巧暴露了微观断点。",
    "errorTags": ["战术绕路", "瞄准失误", "概念边界"],
    "weaknessTags": ["极坐标二重积分", "二重积分对称性秒杀", "椭圆域广义极坐标", "极坐标三角倍角化简"],
    "confidence": 0.96,
    "recommendedQuestionIds": [],
    "batchAttempts": batch_attempts
}

with open(out_path, "w", encoding="utf-8") as f:
    json.dump(payload, f, ensure_ascii=False, indent=2)

print(f"Batch grading report successfully written to {out_path}")

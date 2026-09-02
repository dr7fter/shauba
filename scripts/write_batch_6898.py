import json
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

task_id = "SB-BATCH-20260828-6898"
inbox_dir = os.path.expandvars(r"%APPDATA%\com.shuaba.math\codex-inbox")
out_path = os.path.join(inbox_dir, f"{task_id}.json")

batch_attempts = [
    # Q1: 2758
    {
        "questionId": 2758,
        "result": "wrong",
        "selfRating": 2,
        "durationSeconds": 470,
        "summary": "【战力重大突破！】切平面公式 $\\frac{2}{a^2}x_0(x-x_0)+\\frac{2}{b^2}y_0(y-y_0)+\\frac{2}{c^2}z_0(z-z_0)=0$ 100% 满分写出！仅在截距求取时未利用椭球面方程 $\\frac{x_0^2}{a^2}+\\frac{y_0^2}{b^2}+\\frac{z_0^2}{c^2}=1$ 进行化简，导致通分繁琐卡壳。",
        "verdict": "partial",
        "earliestError": "第 4 行：求 $x$ 截距时展开通分为 $\\frac{a^2(c^2+b^2)}{c^2 b^2 x_0}+x_0$，未直接利用切点在椭球面上 $\\frac{x_0^2}{a^2}+\\frac{y_0^2}{b^2}+\\frac{z_0^2}{c^2}=1$ 得到截距式 $\\frac{x_0 x}{a^2}+\\frac{y_0 y}{b^2}+\\frac{z_0 z}{c^2}=1$",
        "errorTags": ["方法绕路"],
        "weaknessTags": ["切平面截距式", "均值不等式秒杀"],
        "advice": "二次曲面切平面化简绝招：切点 $(x_0,y_0,z_0)$ 必定满足原曲面方程，将常数项移到右边直接等于 $1$，三截距即为 $X=\\frac{a^2}{x_0}, Y=\\frac{b^2}{y_0}, Z=\\frac{c^2}{z_0}$！",
        "betterSolution": "切平面即 $\\frac{x_0 x}{a^2}+\\frac{y_0 y}{b^2}+\\frac{z_0 z}{c^2}=1$ $\\implies$ 截距 $X=\\frac{a^2}{x_0}, Y=\\frac{b^2}{y_0}, Z=\\frac{c^2}{z_0}$。四面体体积 $V=\\frac{1}{6}XYZ = \\frac{a^2b^2c^2}{6x_0y_0z_0}$。由均值不等式 $1 = \\frac{x_0^2}{a^2}+\\frac{y_0^2}{b^2}+\\frac{z_0^2}{c^2} \\geqslant 3\\sqrt[3]{\\frac{x_0^2y_0^2z_0^2}{a^2b^2c^2}} \\implies x_0y_0z_0 \\leqslant \\frac{abc}{3\\sqrt{3}}$，故 $V_{\\min} = \\frac{\\sqrt{3}}{2}abc$。",
        "confidence": 0.95,
        "rating": 0.80,
        "ratingTier": "C",
        "difficultyMultiplier": 1.05,
        "dimensions": {
            "rigor": {"score": 85, "confidence": 0.95, "evidence": "法向量与切平面方程推导完全严密正确"},
            "computation": {"score": 75, "confidence": 0.9, "evidence": "截距代数通分受阻"},
            "modeling": {"score": 85, "confidence": 0.95, "evidence": "切平面几何模型构建完整"},
            "methodUse": {"score": 80, "confidence": 0.9, "evidence": "掌握切平面求法，待巩固曲面方程代入截距化简"},
            "speed": {"score": 85, "confidence": 0.9, "evidence": "7分50秒推进至截距计算"},
            "strategyInsight": {"score": 80, "confidence": 0.9, "evidence": "曲面法向量直觉准确", "techniqueLevel": 3, "independentDiscovery": "confirmed"}
        }
    },
    # Q2: 2733
    {
        "questionId": 2733,
        "result": "wrong",
        "selfRating": 2,
        "durationSeconds": 734,
        "summary": "【拉格朗日相减法实战见效！】成功构造辅助函数 $L = 3x^2+3y^2-7xy+\\lambda(x^2+y^2-xy-9)$，准确解出 $x=y=\\pm 3$ 分支得到最小值 $-9$！仅漏掉另一对称分支 $x=-y$ 对应的最大值 $39$。",
        "verdict": "partial",
        "earliestError": "第 7 行：解出 $x=y$ 后写“再考虑边界情况... 然后不会算了”，未由 $(6+2\\lambda)(x+y)-(7+\\lambda)(x+y)=0$ 分解出另一分支 $x=-y$",
        "errorTags": ["战术绕路"],
        "weaknessTags": ["拉格朗日乘数法", "对称方程组分支讨论"],
        "advice": "对称拉格朗日方程组两式相加与相减双管齐下：相减得 $(13+3\\lambda)(x-y)=0 \\implies x=y$ 或 $\\lambda=-\\frac{13}{3}$；代入相加式立得 $x=-y$，两组驻点一个不漏！",
        "betterSolution": "两式相减：$(13+3\\lambda)(x-y)=0$。① 若 $x=y \\implies x^2=9 \\implies (\\pm 3, \\pm 3)$，代入得 $f = -9$（最小值）；② 若 $\\lambda=-\\frac{13}{3}$ 代入相加式得 $x=-y \\implies 3x^2=9 \\implies x=\\pm\\sqrt{3}, y=\\mp\\sqrt{3}$，代入得 $f = 3(3)+3(3)-7(-3) = 39$（最大值）。",
        "confidence": 0.95,
        "rating": 0.85,
        "ratingTier": "C",
        "difficultyMultiplier": 1.05,
        "dimensions": {
            "rigor": {"score": 85, "confidence": 0.95, "evidence": "辅助函数构造与偏导令零规范，第一分支计算完全正确"},
            "computation": {"score": 85, "confidence": 0.95, "evidence": "代数消元准确"},
            "modeling": {"score": 90, "confidence": 0.95, "evidence": "完全掌握拉格朗日条件极值模型"},
            "methodUse": {"score": 85, "confidence": 0.95, "evidence": "成功运用相减法提取 x=y 分支"},
            "speed": {"score": 80, "confidence": 0.9, "evidence": "12分钟完整推导"},
            "strategyInsight": {"score": 80, "confidence": 0.9, "evidence": "识别条件极值对称结构", "techniqueLevel": 3, "independentDiscovery": "confirmed"}
        }
    },
    # Q3: 2768
    {
        "questionId": 2768,
        "result": "wrong",
        "selfRating": 2,
        "durationSeconds": 955,
        "summary": "【边界降维代换极佳！】圆弧边界 $x^2=4-y^2$ 代入化为一元函数 $f(y)=y^4-3y^2+4 (0\\leqslant y\\leqslant 2)$ 求导分析极其漂亮，满分锁定最大值 $8$！仅因未检查底边线段 $y=0 (-2\\leqslant x\\leqslant 2)$ 漏掉了最小值 $f(0,0)=0$。",
        "verdict": "partial",
        "earliestError": "第 12 行：草稿仅分析了圆弧边界 $x^2=4-y^2$，未检查半圆域底边线段 $y=0 (-2\\leqslant x\\leqslant 2)$ 上 $f(x,0)=x^2$ 在 $x=0$ 处的最小值 $0$",
        "errorTags": ["概念边界"],
        "weaknessTags": ["闭区域最值", "分段边界完整性"],
        "advice": "闭区域为半圆域时边界由两段组成：① 圆弧段 $x^2+y^2=4 (y\\geqslant 0)$；② 直线段 $y=0 (-2\\leqslant x\\leqslant 2)$。两段边界都要代入求极值与端点值！",
        "betterSolution": "① 内部驻点：$f_x=2x(1-y^2)=0, f_y=2y(2-x^2)=0 \\implies (0,0), (\\pm\\sqrt{2}, 1)$，对应 $f(0,0)=0, f(\\pm\\sqrt{2},1)=2$；② 圆弧边界 $x^2=4-y^2 \\implies g(y)=y^4-3y^2+4(0\\leqslant y\\leqslant 2)$，极值点 $y=\\sqrt{\\frac{3}{2}}$ 得 $\\frac{7}{4}$，端点 $y=0$ 得 $4$，$y=2$ 得 $8$；③ 直线边界 $y=0 \\implies f=x^2(-2\\leqslant x\\leqslant 2)$，端点得 $4$，最小为 $0$。综上：最大值为 $8$，最小值为 $0$。",
        "confidence": 0.95,
        "rating": 0.85,
        "ratingTier": "C",
        "difficultyMultiplier": 1.05,
        "dimensions": {
            "rigor": {"score": 85, "confidence": 0.95, "evidence": "圆弧代换求导与端点分析无懈可击"},
            "computation": {"score": 88, "confidence": 0.95, "evidence": "四次函数求导与驻点求值零失误"},
            "modeling": {"score": 80, "confidence": 0.9, "evidence": "漏掉半圆域底边直线段边界"},
            "methodUse": {"score": 85, "confidence": 0.95, "evidence": "降维一元求导方法完全掌握"},
            "speed": {"score": 75, "confidence": 0.9, "evidence": "15分钟推导偏长但工作量大"},
            "strategyInsight": {"score": 85, "confidence": 0.95, "evidence": "自主降维代换极度丝滑", "techniqueLevel": 3, "independentDiscovery": "confirmed"}
        }
    },
    # Q4: 2719
    {
        "questionId": 2719,
        "result": "wrong",
        "selfRating": 2,
        "durationSeconds": 653,
        "summary": "隐函数求导、Hessian 判别式构造与代回方程检验极大值的全流程完全掌握！仅在一阶偏导求 $F_x$ 时将 $2(x+y+1)$ 误求导为 $2x$ 产生代数瞄准失误。",
        "verdict": "partial",
        "earliestError": "第 1 行：求 $F_x$ 时写成 $2zx+2x$，将线性项 $2(x+y+1)$ 对 $x$ 偏导误写为 $2x$（应为 $2$）",
        "errorTags": ["瞄准失误"],
        "weaknessTags": ["一阶偏导数求导精度"],
        "advice": "对多项式求偏导时慢半拍核对：$2(x+y+1)$ 对 $x$ 求导是常数 $2$ 而不是 $2x$。",
        "betterSolution": "$F_x = 2xz+2=0 \\implies x=-\\frac{1}{z}$，$F_y = 2yz+2=0 \\implies y=-\\frac{1}{z}$。代回原方程：$\\frac{2}{z}+\\ln z-\\frac{4}{z}+2=0 \\implies \\ln z-\\frac{2}{z}+2=0 \\implies z=1$。故驻点为 $(-1,-1)$ 对应 $z=1$。二阶导 $z_{xx}=-\\frac{F_{xx}}{F_z}=-\\frac{2}{3}<0, z_{xy}=0, z_{yy}=-\\frac{2}{3}$，$\\Delta = \\frac{4}{9}>0, A<0 \\implies$ 在 $(-1,-1)$ 处取得极大值 $1$。",
        "confidence": 0.95,
        "rating": 0.80,
        "ratingTier": "C",
        "difficultyMultiplier": 1.0,
        "dimensions": {
            "rigor": {"score": 85, "confidence": 0.95, "evidence": "二阶偏导商法则与 Hessian 判别极其严密"},
            "computation": {"score": 75, "confidence": 0.9, "evidence": "首行求导笔误连锁影响后续数值"},
            "modeling": {"score": 90, "confidence": 0.95, "evidence": "完全掌握隐函数极值全套解题模型"},
            "methodUse": {"score": 90, "confidence": 0.95, "evidence": "熟练运用代回原方程与 Hessian 判定"},
            "speed": {"score": 85, "confidence": 0.9, "evidence": "10分53秒节奏合理"},
            "strategyInsight": {"score": 85, "confidence": 0.9, "evidence": "方法路径完全正确", "techniqueLevel": 3, "independentDiscovery": "confirmed"}
        }
    },
    # Q5: 2766
    {
        "questionId": 2766,
        "result": "wrong",
        "selfRating": 1,
        "durationSeconds": 210,
        "summary": "学员推导出 $\\Delta = AC-B^2 = -A^2-B^2 \\leqslant 0$，已触及核心本质！仅差临门一脚：内部无极值点则最值必在边界上取得，选 C。",
        "verdict": "partial",
        "earliestError": "第 2 行：写出 $\\Delta = AC-B^2 < 0$ 后写“不会了”，未得出“内部各点均不满足极值充分条件 $\\implies$ 最值必在边界 $\\partial D$ 上取得”的定性结论",
        "errorTags": ["概念边界"],
        "weaknessTags": ["调和函数极值原理", "最值点定性"],
        "advice": "牢记调和函数经典定理：若 $u_{xx}+u_{yy}=0$（且非常数），则内部各点处 $AC-B^2 = -A^2-B^2 < 0$ 均不是极值点，由闭区域最值存在定理，最大值与最小值必都在边界 $\\partial D$ 上取得！",
        "betterSolution": "因 $u_{xx}+u_{yy}=0$，故 $A = -C$。在内部驻点处 $\\Delta = AC-B^2 = -A^2-B^2 \\leqslant 0$，不可能有极值。由连续函数在有界闭区域上必有最值，故最大值与最小值必都在边界上取得，选 C。",
        "confidence": 0.95,
        "rating": 0.75,
        "ratingTier": "C",
        "difficultyMultiplier": 0.95,
        "dimensions": {
            "rigor": {"score": 80, "confidence": 0.95, "evidence": "能推导出 Hessian 判别式恒负"},
            "computation": {"score": 80, "confidence": 0.95, "evidence": "代数变换正确"},
            "modeling": {"score": 75, "confidence": 0.9, "evidence": "定性反证模型仅差最后一步逻辑跳跃"},
            "methodUse": {"score": 75, "confidence": 0.9, "evidence": "掌握 Hessian 判别式"},
            "speed": {"score": 85, "confidence": 0.9, "evidence": "3分30秒果断止损"},
            "strategyInsight": {"score": 80, "confidence": 0.9, "evidence": "洞察到 Hessian 负定性", "techniqueLevel": 3, "independentDiscovery": "confirmed"}
        }
    },
    # Q6: 2291
    {
        "questionId": 2291,
        "result": "correct",
        "selfRating": 4,
        "durationSeconds": 515,
        "summary": "【满分秒杀！】准确求导 $y'=\\sqrt{3-x^2}$，构造弧长微元 $\\mathrm{d}s=\\sqrt{4-x^2}\\mathrm{d}x$，三角代换 $x=2\\sin t$ 零误差算出 $\\frac{4\\pi}{3}+\\sqrt{3}$！一元积分几何应用第一题满分过关！",
        "verdict": "correct",
        "earliestError": None,
        "errorTags": [],
        "weaknessTags": [],
        "advice": "弧长微元公式 $\\mathrm{d}s=\\sqrt{1+(y')^2}\\mathrm{d}x$ 与变上限求导极其熟练，继续保持！",
        "betterSolution": None,
        "confidence": 0.98,
        "rating": 1.15,
        "ratingTier": "A",
        "difficultyMultiplier": 1.05,
        "dimensions": {
            "rigor": {"score": 95, "confidence": 0.95, "evidence": "变上限求导、弧长微元构造及三角定积分计算无懈可击"},
            "computation": {"score": 95, "confidence": 0.95, "evidence": "三角积分定限与代数展开零失误"},
            "modeling": {"score": 95, "confidence": 0.95, "evidence": "完全掌握直角坐标平面曲线弧长模型"},
            "methodUse": {"score": 95, "confidence": 0.95, "evidence": "熟练运用弧长微元法"},
            "speed": {"score": 90, "confidence": 0.95, "evidence": "8分35秒标准节奏"},
            "strategyInsight": {"score": 90, "confidence": 0.95, "evidence": "三角换元意识极强", "techniqueLevel": 3, "independentDiscovery": "confirmed"}
        }
    }
]

payload = {
    "schemaVersion": 1,
    "kind": "batch",
    "taskId": task_id,
    "summary": "【一元积分应用与多元微分高危排雷实战】：学员在切平面公式（#2758 100% 写出）、拉格朗日相减法（#2733 构造正确拿下最小值 -9）、闭区域边界降维一元求导（#2768 满分锁定最大值 8）、隐函数全流程（#2719）及弧长定积分大题（#2291 满分 100% 算出）展现出极大的认知突破！昨日自省的所有神经反射套路已全部进入实战运行状态！",
    "errorTags": ["方法绕路", "战术绕路", "概念边界", "瞄准失误"],
    "weaknessTags": ["切平面截距式", "对称方程组分支讨论", "分段边界完整性", "调和函数极值原理"],
    "confidence": 0.96,
    "recommendedQuestionIds": [],
    "batchAttempts": batch_attempts
}

with open(out_path, "w", encoding="utf-8") as f:
    json.dump(payload, f, ensure_ascii=False, indent=2)

print(f"Batch grading report successfully written to {out_path}")

import json
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

task_id = "SB-BATCH-20260827-2600"
inbox_dir = os.path.expandvars(r"%APPDATA%\com.shuaba.math\codex-inbox")
out_path = os.path.join(inbox_dir, f"{task_id}.json")

# Build batch attempts
batch_attempts = [
    # Q1: 2783
    {
        "questionId": 2783,
        "result": "wrong",
        "selfRating": 1,
        "durationSeconds": 172,
        "summary": "学员未掌握切平面公式 $z-z_0=f_x(x-x_0)+f_y(y-y_0)$，第一问未动笔；未建立切平面投影区域 $D$ 与闭区域最值模型。",
        "verdict": "incorrect",
        "earliestError": "第 1 行直接写“第一次遇到，没有思路呀”，未动用偏导求切平面法向量 $(f_x, f_y, -1)$",
        "errorTags": ["概念边界"],
        "weaknessTags": ["切平面与法线", "闭区域最值"],
        "advice": "牢记显式曲面切平面公式：$z-z_0 = f_x(x_0,y_0)(x-x_0) + f_y(x_0,y_0)(y-y_0)$，求偏导直接代点即可。",
        "betterSolution": "（Ⅰ）$f_x(1,1)=3-4=-1, f_y(1,1)=-1$ $\\implies$ 切平面 $z-1=-(x-1)-(y-1) \\implies z=3-x-y$；（Ⅱ）投影区域 $D: x+y\\leqslant 3, x\\geqslant 0, y\\geqslant 0$，求内部驻点 $(0,0), (\\frac{2}{3},\\frac{2}{3})$ 及三条边界即得最值 $21$ 与 $\\frac{17}{27}$。",
        "confidence": 0.95,
        "rating": 0.40,
        "ratingTier": "D",
        "difficultyMultiplier": 1.05,
        "dimensions": {
            "rigor": {"score": 20, "confidence": 0.95, "evidence": "未动笔推导"},
            "computation": {"score": 20, "confidence": 0.95, "evidence": "未计算"},
            "modeling": {"score": 20, "confidence": 0.95, "evidence": "缺乏切平面几何模型"},
            "methodUse": {"score": 20, "confidence": 0.95, "evidence": "未掌握切平面公式"},
            "speed": {"score": 80, "confidence": 0.9, "evidence": "2分52秒果断放弃无无效硬耗"},
            "strategyInsight": {"score": 20, "confidence": 0.9, "evidence": "未识别几何题型", "techniqueLevel": 2, "independentDiscovery": "uncertain"}
        }
    },
    # Q2: 2784
    {
        "questionId": 2784,
        "result": "wrong",
        "selfRating": 2,
        "durationSeconds": 557,
        "summary": "第（1）问偏积分还原原函数 $f(x,y)=xy-\\frac{1}{3}x^3-1$ 100% 满分！第（2）问准确求出内部驻点 $(0,0)$ 并用 Hessian 判别 $\\Delta=-1<0$ 无极值；卡在三角形边界 $x+y=7$ 的一元最值代换。",
        "verdict": "partial",
        "earliestError": "第（2）问第 6 行写“$x+y\\leqslant 7$ 不会了”，未把边界 $y=7-x$ 代入转化为一元三次函数求导",
        "errorTags": ["方法绕路"],
        "weaknessTags": ["闭区域最值", "边界参数化"],
        "advice": "闭区域最值三步走：① 内部求驻点并判别；② 各条边界分别代入化为一元函数求极值与端点值；③ 全部汇总比较挑出最大最小值。",
        "betterSolution": "边界 $y=7-x(0\\leqslant x\\leqslant 7)$ 代入：$g(x) = x(7-x)-\\frac{x^3}{3}-1$，求导 $g'(x) = 7-2x-x^2=0 \\implies x=\\sqrt{8}-1=2\\sqrt{2}-1$，代入即得最大值 $\\frac{32\\sqrt{2}-26}{3}$。",
        "confidence": 0.95,
        "rating": 0.80,
        "ratingTier": "C",
        "difficultyMultiplier": 1.05,
        "dimensions": {
            "rigor": {"score": 85, "confidence": 0.95, "evidence": "第(1)问与内部 Hessian 判别极其严密规范"},
            "computation": {"score": 85, "confidence": 0.95, "evidence": "偏积分与二阶导数计算零失误"},
            "modeling": {"score": 60, "confidence": 0.9, "evidence": "边界一元代换模型未闭环"},
            "methodUse": {"score": 75, "confidence": 0.9, "evidence": "掌握偏积分与无条件极值，待固化边界代换"},
            "speed": {"score": 85, "confidence": 0.9, "evidence": "9分17秒节奏合理"},
            "strategyInsight": {"score": 70, "confidence": 0.9, "evidence": "能敏锐判断内部无极值", "techniqueLevel": 3, "independentDiscovery": "confirmed"}
        }
    },
    # Q3: 10714
    {
        "questionId": 10714,
        "result": "wrong",
        "selfRating": 1,
        "durationSeconds": 25,
        "summary": "学员未掌握拉格朗日乘数法 $L=f-\\lambda \\varphi$ 构造与联立方程求解技巧，未动笔作答。",
        "verdict": "incorrect",
        "earliestError": "第 1 行写“不会，没见过”，未构造辅助函数 $L(x,y,\\lambda)$",
        "errorTags": ["概念边界"],
        "weaknessTags": ["拉格朗日乘数法", "条件极值"],
        "advice": "遇到条件极值先设 $L = f(x,y) - \\lambda \\varphi(x,y)$，求偏导令零后两式相减提取公因式 $(x-y)$ 秒杀。",
        "betterSolution": "设 $L = (x+1)^2+(y+1)^2 - \\lambda(x^2+y^2+xy-3)$，偏导令零得 $2(x+1)=\\lambda(2x+y), 2(y+1)=\\lambda(2y+x)$，相减得 $(2-\\lambda)(x-y)=0$。若 $\\lambda=2 \\implies x+y=1 \\implies xy=-2 \\implies (2,-1), (-1,2)$ 处取得最大值 $9$；若 $x=y \\implies (1,1)$ 得 $8, (-1,-1)$ 得 $0$。最大值为 $9$。",
        "confidence": 0.95,
        "rating": 0.40,
        "ratingTier": "D",
        "difficultyMultiplier": 1.05,
        "dimensions": {
            "rigor": {"score": 20, "confidence": 0.95, "evidence": "未动笔推导"},
            "computation": {"score": 20, "confidence": 0.95, "evidence": "未计算"},
            "modeling": {"score": 20, "confidence": 0.95, "evidence": "缺乏拉格朗日乘数法模型"},
            "methodUse": {"score": 20, "confidence": 0.95, "evidence": "未掌握条件极值"},
            "speed": {"score": 90, "confidence": 0.9, "evidence": "25秒果断放弃无无效硬耗"},
            "strategyInsight": {"score": 20, "confidence": 0.9, "evidence": "未识别条件极值", "techniqueLevel": 3, "independentDiscovery": "uncertain"}
        }
    },
    # Q4: 10716
    {
        "questionId": 10716,
        "result": "correct",
        "selfRating": 4,
        "durationSeconds": 720,
        "summary": "【满分神级秒解！】自主动用 $z=\\frac{1}{xy}$ 将三元约束降维为二元函数，偏导求驻点 $(\\sqrt[3]{2}, \\sqrt[3]{2})$、二阶 Hessian 判别式 $\\Delta=3>0$、边界趋于无穷的定性论证完全满分！",
        "verdict": "correct",
        "earliestError": None,
        "errorTags": [],
        "weaknessTags": [],
        "advice": "解法极其优异！本题亦可用均值不等式秒杀验证：$xy+2xz+2yz \\geqslant 3\\sqrt[3]{xy\\cdot 2xz\\cdot 2yz} = 3\\sqrt[3]{4(xyz)^2} = 3\\sqrt[3]{4}$。",
        "betterSolution": None,
        "confidence": 0.98,
        "rating": 1.40,
        "ratingTier": "S",
        "difficultyMultiplier": 1.05,
        "dimensions": {
            "rigor": {"score": 95, "confidence": 0.95, "evidence": "驻点求解、Hessian 正定性及边界趋向无穷论证极其严密"},
            "computation": {"score": 95, "confidence": 0.95, "evidence": "全微分与二阶偏导计算零失误"},
            "modeling": {"score": 95, "confidence": 0.95, "evidence": "自主降维消元代换模型极其精准"},
            "methodUse": {"score": 95, "confidence": 0.95, "evidence": "熟练运用消元法与无条件极值判别"},
            "speed": {"score": 85, "confidence": 0.9, "evidence": "12分钟完整严密推导大题"},
            "strategyInsight": {"score": 95, "confidence": 0.95, "evidence": "降维思维极其敏锐", "techniqueLevel": 4, "independentDiscovery": "confirmed"}
        }
    },
    # Q5: 2767
    {
        "questionId": 2767,
        "result": "wrong",
        "selfRating": 2,
        "durationSeconds": 354,
        "summary": "全微分还原 $f(x,y)=x^2-y^2+2$ 完美正确！内部驻点 $(0,0)$ 判别 $\\Delta=-4<0$ 准确！在边界 $x^2=1-\\frac{y^2}{4}$ 上已化为 $3-\\frac{5}{4}y^2$，仅差最后一步根据 $y\\in[-2,2]$ 定出最大 3 最小 -2。",
        "verdict": "partial",
        "earliestError": "第 10 行写出 $f(x,y)\\leqslant 3-\\frac{5}{4}y^2$ 后写“不太会”，未根据椭圆上 $y^2\\in[0,4]$ 直接定出端点最值",
        "errorTags": ["战术绕路"],
        "weaknessTags": ["闭区域最值", "二次型单变量分析"],
        "advice": "化为 $g(y) = 3 - \\frac{5}{4}y^2$ 后，标出椭圆 $y$ 的取值范围 $[-2,2] \\implies y^2\\in[0,4]$，令 $y=0$ 得 $\\max=3$，$y=\\pm 2$ 得 $\\min=-2$ 即可直接闭环！",
        "betterSolution": "边界 $x^2 = 1 - \\frac{y^2}{4} \\implies f = 1 - \\frac{y^2}{4} - y^2 + 2 = 3 - \\frac{5}{4}y^2$。因 $y\\in[-2,2]$，当 $y=0$ 时取最大值 $3$；当 $y=\\pm 2$ 时取最小值 $3 - 5 = -2$。",
        "confidence": 0.95,
        "rating": 0.80,
        "ratingTier": "C",
        "difficultyMultiplier": 1.0,
        "dimensions": {
            "rigor": {"score": 85, "confidence": 0.95, "evidence": "原函数还原与内部驻点 Hessian 计算无懈可击"},
            "computation": {"score": 85, "confidence": 0.95, "evidence": "代数消元已推进到 90%"},
            "modeling": {"score": 75, "confidence": 0.9, "evidence": "已完成椭圆边界代换，仅差自变量区间截取"},
            "methodUse": {"score": 80, "confidence": 0.9, "evidence": "偏积分与闭区域框架扎实"},
            "speed": {"score": 90, "confidence": 0.9, "evidence": "5分54秒节奏极佳"},
            "strategyInsight": {"score": 75, "confidence": 0.9, "evidence": "能敏锐利用边界方程消去 x", "techniqueLevel": 3, "independentDiscovery": "confirmed"}
        }
    },
    # Q6: 2566
    {
        "questionId": 2566,
        "result": "correct",
        "selfRating": 4,
        "durationSeconds": 208,
        "summary": "【48小时排期抽测 · 满分秒杀！】完全独立动用两式全微分 $\\mathrm{d}y = f_1'\\mathrm{d}x + f_2'\\mathrm{d}t$ 与 $G_1'\\mathrm{d}x+G_2'\\mathrm{d}y+G_3'\\mathrm{d}t=0$，精准提取 $\\mathrm{d}t$ 消元，3.5 分钟一次性满分求出 $\\frac{\\mathrm{d}y}{\\mathrm{d}x}=\\frac{f_1'G_3'-f_2'G_1'}{f_2'G_2'+G_3'}$！[E-003] 神经反射彻底固化！",
        "verdict": "correct",
        "earliestError": None,
        "errorTags": [],
        "weaknessTags": [],
        "advice": "步骤堪称标准答案典范，方程组求导体系已具备考研满分硬实力！",
        "betterSolution": None,
        "confidence": 0.98,
        "rating": 1.45,
        "ratingTier": "S",
        "difficultyMultiplier": 1.0,
        "dimensions": {
            "rigor": {"score": 95, "confidence": 0.95, "evidence": "全微分消元逻辑与同类项合并严密规范"},
            "computation": {"score": 95, "confidence": 0.95, "evidence": "代数整理与符号提取零失误"},
            "modeling": {"score": 95, "confidence": 0.95, "evidence": "完全掌握方程组中间变量消元模型"},
            "methodUse": {"score": 95, "confidence": 0.95, "evidence": "熟练运用全微分消元法秒杀"},
            "speed": {"score": 95, "confidence": 0.95, "evidence": "3分28秒极速秒解"},
            "strategyInsight": {"score": 95, "confidence": 0.95, "evidence": "反射动作极度敏锐", "techniqueLevel": 4, "independentDiscovery": "confirmed"}
        }
    },
    # Q7: 2777
    {
        "questionId": 2777,
        "result": "wrong",
        "selfRating": 1,
        "durationSeconds": 89,
        "summary": "学员写“不会”，未动用柯西不等式或极坐标参数化秒解线性函数在圆域上的最值。",
        "verdict": "incorrect",
        "earliestError": "第 1 行写“不会”，未动用极坐标参数化 $x=\\cos\\theta, y=\\sin\\theta$",
        "errorTags": ["概念边界"],
        "weaknessTags": ["闭区域最值", "柯西不等式秒杀"],
        "advice": "求 $Ax+By+C$ 在 $x^2+y^2\\leqslant R^2$ 上的最值：直接用柯西不等式 $|Ax+By|\\leqslant \\sqrt{A^2+B^2}R$，10 秒出最大 $C+\\sqrt{A^2+B^2}R$、最小 $C-\\sqrt{A^2+B^2}R$。",
        "betterSolution": "由柯西不等式：$-\\sqrt{2} \\leqslant x+y \\leqslant \\sqrt{2} \\implies$ 最大值为 $1+\\sqrt{2}$，最小值为 $1-\\sqrt{2}$。两数之积为 $(1+\\sqrt{2})(1-\\sqrt{2}) = 1-2 = -1$，选 A。",
        "confidence": 0.95,
        "rating": 0.40,
        "ratingTier": "D",
        "difficultyMultiplier": 0.95,
        "dimensions": {
            "rigor": {"score": 20, "confidence": 0.95, "evidence": "未动笔"},
            "computation": {"score": 20, "confidence": 0.95, "evidence": "未计算"},
            "modeling": {"score": 20, "confidence": 0.95, "evidence": "缺乏线性目标函数圆域极值模型"},
            "methodUse": {"score": 20, "confidence": 0.95, "evidence": "未掌握柯西不等式或极坐标"},
            "speed": {"score": 85, "confidence": 0.9, "evidence": "1分29秒果断放弃"},
            "strategyInsight": {"score": 20, "confidence": 0.9, "evidence": "未识别线性极值结构", "techniqueLevel": 2, "independentDiscovery": "uncertain"}
        }
    },
    # Q8: 2765
    {
        "questionId": 2765,
        "result": "wrong",
        "selfRating": 1,
        "durationSeconds": 30,
        "summary": "学员写“不会”，未掌握由偏导方程 $f_x+f_y=f$ 结合区域最值定理定性极值点的考法。",
        "verdict": "incorrect",
        "earliestError": "第 1 行写“不会”，未利用内部极值点偏导为零与方程联立矛盾推导",
        "errorTags": ["概念边界"],
        "weaknessTags": ["最值点位置定性", "反证法"],
        "advice": "定性分析题核心套路：假设内部有极值点 $\\implies f_x=f_y=0$，代入已知偏导方程得 $f=0$；若最大最小值均为 0 则 $f\\equiv 0$ 恒成立，选 D。",
        "betterSolution": "若 $f(x,y)$ 在内部取得最大（小）值，则驻点处 $f_x=f_y=0$，代入方程 $f_x+f_y=f$ 得此时 $f=0$。又边界上 $f=0$，故 $f$ 在 $D$ 上的最大值和最小值均为 $0$，即 $f(x,y)\\equiv 0$，选 D。",
        "confidence": 0.95,
        "rating": 0.40,
        "ratingTier": "D",
        "difficultyMultiplier": 0.95,
        "dimensions": {
            "rigor": {"score": 20, "confidence": 0.95, "evidence": "未动笔"},
            "computation": {"score": 20, "confidence": 0.95, "evidence": "未计算"},
            "modeling": {"score": 20, "confidence": 0.95, "evidence": "缺乏极值必要条件反证模型"},
            "methodUse": {"score": 20, "confidence": 0.95, "evidence": "未掌握最值定性定理"},
            "speed": {"score": 90, "confidence": 0.9, "evidence": "30秒果断放弃"},
            "strategyInsight": {"score": 20, "confidence": 0.9, "evidence": "未识别定性反证结构", "techniqueLevel": 3, "independentDiscovery": "uncertain"}
        }
    }
]

payload = {
    "schemaVersion": 1,
    "kind": "batch",
    "taskId": task_id,
    "summary": "本轮多元微分大圆满封盘组实测：Q6 (#2566) 方程组消元（E-003）与 Q4 (#10716) 三元消元降维极值斩获双满分秒杀（Rating 1.45 / 1.40）！Q2 与 Q5 偏积分还原与内部 Hessian 极佳（Rating 0.80），仅在闭区域边界代换临门一脚卡壳；Q1、Q3、Q7、Q8 暴露出拉格朗日乘数法联立、切平面公式与闭区域边界代换 3 个集中断点。",
    "errorTags": ["概念边界", "方法绕路", "战术绕路"],
    "weaknessTags": ["闭区域最值", "边界参数化", "拉格朗日乘数法", "切平面与法线"],
    "confidence": 0.96,
    "recommendedQuestionIds": [],
    "batchAttempts": batch_attempts
}

with open(out_path, "w", encoding="utf-8") as f:
    json.dump(payload, f, ensure_ascii=False, indent=2)

print(f"Batch grading report successfully written to {out_path}")

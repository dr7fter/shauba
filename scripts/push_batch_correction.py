import json
import os
import sys

appdata = os.environ.get('APPDATA', r'C:\Users\86136\AppData\Roaming')
inbox_dir = os.path.join(appdata, 'com.shuaba.math', 'codex-inbox')
os.makedirs(inbox_dir, exist_ok=True)

out_file = os.path.join(inbox_dir, 'SB-BATCH-20260821-6677.json')

batch_data = {
    "schemaVersion": 1,
    "kind": "batch",
    "taskId": "SB-BATCH-20260821-6677",
    "summary": "【几何应用8题全景批改】完成8题（5题正确、1题部分、2题做错）。参数方程摆线面积（$3\\pi a^2$）、极坐标心形线面积（$\\frac{3\\pi a^2}{2}$）、圆柱壳法体积（$\\frac{\\pi}{2}$）与旋转曲面侧面积表现极佳；主要薄弱点在于：1) 三角展开积分末尾粗心（$\\int_0^{\\pi/2}\\cos 2t\\,\\mathrm{d}t=0$ 误算）；2) 绕斜线 $y=x$ 旋转体体积模型未建立，误用绕 $x$ 轴公式；3) 凸函数切线与曲线面积上/下边界颠倒导致迟疑。",
    "errorTags": ["斜线旋转模型未掌握", "三角定积分计算粗心", "凸函数切线上方判定"],
    "weaknessTags": ["绕斜线旋转体体积", "点火公式/Wallis公式", "切线最值面积模型"],
    "confidence": 0.98,
    "recommendedQuestionIds": [10649, 10633, 7264],
    "batchAttempts": [
        {
            "questionId": 10633,
            "result": "wrong",
            "selfRating": 2,
            "durationSeconds": 469,
            "summary": "平均值积分思路清晰（换元 $x=\\sin t$），但在手动展开 $\\cos 2t$ 定积分时代入上下限误算，多减了 $\\frac{1}{2}$ 导致最终答案错误。",
            "verdict": "incorrect",
            "earliestError": "在第6步计算 $-\\frac{1}{4}\\int_0^{\\pi/2}\\cos 2t\\,\\mathrm{d}(2t)$ 时误将其算为 $-\\frac{1}{2}$（实际上 $\\sin 2t\\big|_0^{\\pi/2} = \\sin\\pi - \\sin 0 = 0$）。",
            "errorTags": ["符号计算错误", "定积分代限粗心"],
            "weaknessTags": ["点火公式/Wallis公式"],
            "advice": "遇到 $\\int_0^{\\pi/2}\\sin^n t\\,\\mathrm{d}t$ 或 $\\int_0^{\\pi/2}\\cos^n t\\,\\mathrm{d}t$ 时，强行使用点火公式（Wallis公式）：$\\int_0^{\\pi/2}\\sin^2 t\\,\\mathrm{d}t = \\frac{1}{2}\\cdot\\frac{\\pi}{2} = \\frac{\\pi}{4}$，一步写出答案，彻底避免二倍角代限失误。",
            "betterSolution": "换元 $x=\\sin t$ 后直接套用点火公式：$$\\bar{y} = \\int_0^{\\pi/2} \\frac{\\sin^2 t}{\\cos t}\\cdot\\cos t\\,\\mathrm{d}t = \\int_0^{\\pi/2}\\sin^2 t\\,\\mathrm{d}t = \\frac{1}{2}\\cdot\\frac{\\pi}{2} = \\frac{\\pi}{4}$$",
            "confidence": 0.98
        },
        {
            "questionId": 2288,
            "result": "correct",
            "selfRating": 4,
            "durationSeconds": 398,
            "summary": "解法非常漂亮！准确利用换元 $u=xt$ 将积分方程转化为 $F(x)F'(x)=2x^3$，反解出 $f(x)=2x$ 并求出平均值 $2$。",
            "verdict": "correct",
            "earliestError": None,
            "errorTags": [],
            "weaknessTags": [],
            "advice": "保持这种换元剥离参数 $x$ 的肌肉记忆（$\\int_0^1 f(xt)\\,\\mathrm{d}t = \\frac{1}{x}\\int_0^x f(u)\\,\\mathrm{d}u$），考场遇此类变限综合题可稳拿满分。",
            "betterSolution": "原解法已达最优：由 $F'(x)F(x)=2x^3 \\implies \\frac{1}{2}(F^2(x))' = 2x^3 \\implies F^2(x) = x^4 \\implies F(x)=x^2 \\implies f(x)=2x$，平均值 $\\bar{f} = \\frac{1}{2}\\int_0^2 2x\\,\\mathrm{d}x = 2$。",
            "confidence": 0.99
        },
        {
            "questionId": 2340,
            "result": "correct",
            "selfRating": 4,
            "durationSeconds": 528,
            "summary": "参数方程面积公式列式规范，准确利用正余弦全周期对称性积分为 0 快速得出 $3\\pi a^2$，推导极度流畅。",
            "verdict": "correct",
            "earliestError": None,
            "errorTags": [],
            "weaknessTags": [],
            "advice": "牢记摆线重要特征结论：摆线一支拱高 $2a$、底宽 $2\\pi a$、围成面积 $3\\pi a^2$、弧长 $8a$、绕底边旋转体积 $5\\pi^2 a^3$。",
            "betterSolution": "原解法非常标准：$A = \\int_0^{2\\pi} a(1-\\cos t)\\cdot a(1-\\cos t)\\,\\mathrm{d}t = a^2 \\int_0^{2\\pi}(1 - 2\\cos t + \\cos^2 t)\\,\\mathrm{d}t = a^2(2\\pi - 0 + \\pi) = 3\\pi a^2$。",
            "confidence": 0.99
        },
        {
            "questionId": 7264,
            "result": "wrong",
            "selfRating": 2,
            "durationSeconds": 888,
            "summary": "求切线方程正确，但因混淆凸函数上下位置导致被积函数符号写反，迟疑后虽判断出 $x_0=1$，但未明确写出切线方程 $l: y=\\frac{x+1}{2}$。",
            "verdict": "partial",
            "earliestError": "误将下曲线减上曲线列为面积，导致算出的 $S(x_0)$ 出现负值并产生困惑；最终虽得出 $x_0=1$，但未代回写出所求切线方程 $l: y=\\frac{x+1}{2}$。",
            "errorTags": ["几何图像上下边界混淆", "最终结论未明确呈现"],
            "weaknessTags": ["切线最值面积模型", "凸函数切线几何性质"],
            "advice": "牢记几何常识：上凸曲线（如 $y=\\sqrt{x},\\ln x$）的切线必然位于曲线上方！因此面积积分恒为 $S(x_0)=\\int_a^b (y_{切} - y_{曲})\\,\\mathrm{d}x$；利用均值不等式得驻点后切记代回切线方程。",
            "betterSolution": "切线为 $y = \\frac{x+x_0}{2\\sqrt{x_0}}$。由于 $y=\\sqrt{x}$ 向上凸，切线在上方，面积 $$S(x_0)=\\int_0^2\\left(\\frac{x+x_0}{2\\sqrt{x_0}}-\\sqrt{x}\\right)\\mathrm{d}x = \\sqrt{x_0}+\\frac{1}{\\sqrt{x_0}}-\\frac{4\\sqrt{2}}{3} \\ge 2 - \\frac{4\\sqrt{2}}{3}$$ 取等条件为 $\\sqrt{x_0}=\\frac{1}{\\sqrt{x_0}} \\implies x_0=1$，故所求切线为 $l: y=\\frac{x+1}{2}$。",
            "confidence": 0.95
        },
        {
            "questionId": 10655,
            "result": "correct",
            "selfRating": 4,
            "durationSeconds": 129,
            "summary": "极速秒杀（2分09秒）！极坐标面积微元 $\\mathrm{d}A = \\frac{1}{2}r^2\\,\\mathrm{d}\\theta$ 列式完美，利用周期积分消项一气呵成得出 $\\frac{3\\pi a^2}{2}$。",
            "verdict": "correct",
            "earliestError": None,
            "errorTags": [],
            "weaknessTags": [],
            "advice": "继续保持对极坐标标准图形（心形线 $\\frac{3\\pi a^2}{2}$、双纽线 $a^2$、三叶玫瑰线 $\\frac{\\pi a^2}{4}$）的秒杀熟练度。",
            "betterSolution": "原解法已达最高境界：$S = \\frac{1}{2}\\int_0^{2\\pi} a^2(1+2\\cos\\theta+\\cos^2\\theta)\\,\\mathrm{d}\\theta = \\frac{a^2}{2}\\left(2\\pi + 0 + \\pi\\right) = \\frac{3\\pi a^2}{2}$。",
            "confidence": 0.99
        },
        {
            "questionId": 10644,
            "result": "correct",
            "selfRating": 4,
            "durationSeconds": 287,
            "summary": "柱壳法绕 $y$ 轴旋转体积模型运用极其标准，准确识别 $x\\in(1,2)$ 上 $y<0$ 并添加负号，积分计算精确无误得出 $\\frac{\\pi}{2}$。",
            "verdict": "correct",
            "earliestError": None,
            "errorTags": [],
            "weaknessTags": [],
            "advice": "圆柱壳法（$V_y = 2\\pi\\int a b x |y|\\,\\mathrm{d}x$）是绕 $y$ 轴旋转的最强武器，考场遇到此类题型继续优先使用。",
            "betterSolution": "原解法即为标准答案：$V = 2\\pi\\int_1^2 x[-(x^2-3x+2)]\\,\\mathrm{d}x = 2\\pi\\left[-\\frac{x^4}{4}+x^3-x^2\\right]_1^2 = \\frac{\\pi}{2}$。",
            "confidence": 0.99
        },
        {
            "questionId": 10649,
            "result": "wrong",
            "selfRating": 1,
            "durationSeconds": 684,
            "summary": "遭遇严重卡点。前期尝试列出点到斜线距离 $d=\\frac{\\sqrt{x}-x}{\\sqrt{2}}$ 后因不知道如何沿斜线轴积分而放弃，随后退化使用绕 $x$ 轴的错误公式 $V_1-V_2$ 导致全题做错。",
            "verdict": "incorrect",
            "earliestError": "在第二页草稿中放弃点到直线距离微元，错误地套用绕 $x$ 轴旋转体积公式 $V = \\pi\\int_0^1 ((\\sqrt{x})^2 - x^2)\\,\\mathrm{d}x$。",
            "errorTags": ["斜线旋转模型未掌握", "概念混淆"],
            "weaknessTags": ["绕斜线旋转体体积", "二重积分旋转体公式"],
            "advice": "掌握考研绕斜线 $y=kx+b$ 旋转体积的通用通法：采用**二重积分公式** $V = 2\\pi \\iint_D d(x,y)\\,\\mathrm{d}\\sigma$，其中 $d(x,y)=\\frac{|y-x|}{\\sqrt{2}}$ 为点到轴的距离，转化为简单二重积分直接计算。",
            "betterSolution": "绕斜线 $y=x$ 旋转体积推荐**二重积分直接法**：$$V = 2\\pi \\iint_D \\frac{y-x}{\\sqrt{2}}\\,\\mathrm{d}x\\mathrm{d}y = \\sqrt{2}\\pi \\int_0^1 \\mathrm{d}x \\int_x^{\\sqrt{x}}(y-x)\\,\\mathrm{d}y = \\frac{\\sqrt{2}\\pi}{2}\\int_0^1 (\\sqrt{x}-x)^2\\,\\mathrm{d}x = \\frac{\\sqrt{2}\\pi}{2}\\left(\\frac{1}{2}-\\frac{4}{5}+\\frac{1}{3}\\right) = \\mathbf{\\frac{\\sqrt{2}\\pi}{60}}$$ 一步到位，无需计算复杂的斜轴截面！",
            "confidence": 0.99
        },
        {
            "questionId": 7732,
            "result": "correct",
            "selfRating": 4,
            "durationSeconds": 331,
            "summary": "数一特有旋转侧面积公式运用熟练，弧长微元 $\\mathrm{d}s = \\sqrt{1+4x^2}\\,\\mathrm{d}x$ 与凑微分计算严密准确，得出 $\\frac{\\pi}{6}(17\\sqrt{17}-5\\sqrt{5})$。",
            "verdict": "correct",
            "earliestError": None,
            "errorTags": [],
            "weaknessTags": [],
            "advice": "牢记侧面积微元方向：绕 $y$ 轴侧面积为 $S = 2\\pi\\int x\\,\\mathrm{d}s$；绕 $x$ 轴侧面积为 $S = 2\\pi\\int y\\,\\mathrm{d}s$。",
            "betterSolution": "原解法即为考研标准满分解法：$S = 2\\pi\\int_1^2 x\\sqrt{1+(2x)^2}\\,\\mathrm{d}x = \\frac{\\pi}{4}\\int_1^2 (1+4x^2)^{1/2}\\,\\mathrm{d}(1+4x^2) = \\frac{\\pi}{6}(17\\sqrt{17}-5\\sqrt{5})$。",
            "confidence": 0.99
        }
    ]
}

with open(out_file, 'w', encoding='utf-8') as f:
    json.dump(batch_data, f, ensure_ascii=False, indent=2)

print(f"Successfully generated batch correction file: {out_file}")

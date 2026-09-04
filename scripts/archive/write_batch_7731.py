import json
import os
import sys

appdata = os.environ.get('APPDATA', r'C:\Users\86136\AppData\Roaming')
inbox_dir = os.path.join(appdata, 'com.shuaba.math', 'codex-inbox')
os.makedirs(inbox_dir, exist_ok=True)
target_file = os.path.join(inbox_dir, 'SB-BATCH-20260823-7731.json')

payload = {
  "schemaVersion": 1,
  "kind": "batch",
  "taskId": "SB-BATCH-20260823-7731",
  "summary": "【常微分方程一阶与高阶 8 题全景批改复盘】：整体完成度良好，在标准型求解（可分离变量 #4437、一阶线性 #4451、二阶不显含 $y$ 降阶 #7647、常系数特征根 #7597）中反应迅速、公式熟练；主要暴露三大核心短板：1) **全微分方程识别盲区**（#4491 齐次硬算陷入复杂积分，漏看 $\\frac{\\partial P}{\\partial y}=\\frac{\\partial Q}{\\partial x}$；#4520 未能根据全微分条件反求 $f(x)$ 微分方程）；2) **变量混淆与代换失误**（#7654 降阶 $p(y)$ 积分后误将自变量当成 $x$；#4464 伯努利方程抄错正负号）；3) **导数凑微分敏感度**（#7654 漏看 $(yy')'=0$ 秒杀结构）。",
  "errorTags": ["全微分识别遗漏", "降阶变量混淆", "抄题符号笔误", "凑微分结构不敏感"],
  "weaknessTags": ["全微分方程充要条件", "二阶不显含x降阶法", "伯努利方程代换", "导数乘积构造"],
  "confidence": 0.95,
  "recommendedQuestionIds": [],
  "batchAttempts": [
    {
      "questionId": 4437,
      "result": "correct",
      "selfRating": 3,
      "durationSeconds": 447,
      "summary": "变量分离法掌握扎实，积分步骤准确；但化简时未将 $e^{\\ln x - x + C}$ 展开为 $C x e^{-x}$，化简略显拖沓。",
      "verdict": "correct",
      "earliestError": None,
      "errorTags": [],
      "weaknessTags": ["指数对数代数化简"],
      "advice": "求出 $\\ln y = \\ln x - x + C$ 后，直接利用指数法则化简为 $y = e^C \\cdot e^{\\ln x} \\cdot e^{-x} = C x e^{-x}$，常数 $C$ 吸纳符号与常数幂。",
      "betterSolution": "分离变量：$\\frac{dy}{y} = \\left(\\frac{1}{x} - 1\\right)dx \\implies \\ln|y| = \\ln|x| - x + C_1 \\implies y = Cxe^{-x}$ ($x \\neq 0$)。",
      "confidence": 0.98,
      "rating": 1.15,
      "ratingTier": "B",
      "difficultyMultiplier": 1.0,
      "dimensions": {
        "rigor": {
          "score": 85,
          "confidence": 0.95,
          "evidence": "草稿完整写出分离变量与两端积分过程，但最后写为 $y = e^{\\ln x - x + C}$ 未彻底化简。"
        },
        "computation": {
          "score": 85,
          "confidence": 0.95,
          "evidence": "两端积分 $\\int \\frac{1-x}{x}dx = \\ln x - x$ 计算无误。"
        },
        "modeling": {
          "score": 88,
          "confidence": 0.95,
          "evidence": "准确识别可分离变量方程类型。"
        },
        "methodUse": {
          "score": 88,
          "confidence": 0.95,
          "evidence": "熟练运用分离变量法。"
        },
        "speed": {
          "score": 75,
          "confidence": 0.95,
          "evidence": "耗时 7分27秒，在 10分基准时间内，但略显冗长。"
        },
        "strategyInsight": {
          "score": 82,
          "confidence": 0.9,
          "evidence": "一阶可分离变量标准反射。",
          "techniqueLevel": 2,
          "independentDiscovery": "confirmed"
        }
      }
    },
    {
      "questionId": 4491,
      "result": "wrong",
      "selfRating": 2,
      "durationSeconds": 512,
      "summary": "战术严重绕路且计算失误！本题本质为**全微分方程**，草稿误当作齐次方程换元 $u=\\frac{y}{x}$，陷入极其繁琐的有理积分并发生系数笔误；若用全微分凑微分法 10 秒即可秒杀。",
      "verdict": "incorrect",
      "earliestError": "草稿第 4 行在积分 $\\int \\frac{1-2u}{3(u^2-u-1)}du$ 时，分子写为 $u-1/2$ 时漏算了系数 $2$，导致常数写成 $-\\frac{1}{6}$ 与 $-\\frac{1}{12}$，最终得到错误根式通解。",
      "errorTags": ["全微分识别遗漏", "方法绕路", "计算笔误"],
      "weaknessTags": ["全微分方程判定", "凑微分法"],
      "advice": "只要看到 $P(x,y)dx + Q(x,y)dy = 0$，**第一步务必心算验证 $\\frac{\\partial P}{\\partial y} = \\frac{\\partial Q}{\\partial x}$**！若相等，立刻凑微分或偏积分，严禁盲目套用复杂的齐次换元。",
      "betterSolution": "验证全微分：令 $P = 3x^2+2xy-y^2, Q = x^2-2xy$，则 $\\frac{\\partial P}{\\partial y} = 2x-2y = \\frac{\\partial Q}{\\partial x}$，原方程为全微分方程。\n直接凑微分：\n$$3x^2dx + (2xy dx + x^2 dy) - (y^2 dx + 2xy dy) = 0$$\n$$d(x^3) + d(x^2y) - d(xy^2) = 0 \\implies \\mathbf{x^3 + x^2y - xy^2 = C}$$（极速 15 秒写出）。",
      "confidence": 0.98,
      "rating": 0.65,
      "ratingTier": "C",
      "difficultyMultiplier": 1.1,
      "dimensions": {
        "rigor": {
          "score": 60,
          "confidence": 0.95,
          "evidence": "齐次方程推导虽有框架，但积分系数推导出错导致通解形态完全错误。"
        },
        "computation": {
          "score": 55,
          "confidence": 0.95,
          "evidence": "在有理分式拆分与配方积分过程中产生多重系数笔误。"
        },
        "modeling": {
          "score": 50,
          "confidence": 0.95,
          "evidence": "未识别出全微分对称结构。"
        },
        "methodUse": {
          "score": 55,
          "confidence": 0.95,
          "evidence": "选择齐次换元而非全微分凑微分，陷入计算黑洞。"
        },
        "speed": {
          "score": 60,
          "confidence": 0.95,
          "evidence": "耗时 8分32秒且未得出正确答案。"
        },
        "strategyInsight": {
          "score": 50,
          "confidence": 0.9,
          "evidence": "缺乏对 $P dx + Q dy$ 全微分先验检验意识。",
          "techniqueLevel": 3,
          "independentDiscovery": "uncertain"
        }
      }
    },
    {
      "questionId": 4451,
      "result": "correct",
      "selfRating": 4,
      "durationSeconds": 44,
      "summary": "44 秒极速秒杀！一阶线性非齐次通解公式一气呵成，积分因子化简精准无误！",
      "verdict": "correct",
      "earliestError": None,
      "errorTags": [],
      "weaknessTags": [],
      "advice": "公式法熟练度极高，注意考场保持此状态，继续保持。",
      "betterSolution": "直接套一阶线性公式：$y = e^{-\\int \\tan x dx}\\left[\\int \\cos x \\cdot e^{\\int \\tan x dx}dx + C\\right] = \\cos x \\left[\\int 1 dx + C\\right] = \\mathbf{(x+C)\\cos x}$。",
      "confidence": 0.99,
      "rating": 1.40,
      "ratingTier": "A",
      "difficultyMultiplier": 1.0,
      "dimensions": {
        "rigor": {
          "score": 95,
          "confidence": 0.95,
          "evidence": "草稿两行直接规范写出公式、化简与任意常数声明。"
        },
        "computation": {
          "score": 98,
          "confidence": 0.95,
          "evidence": "$\\cos x \\cdot \\frac{1}{\\cos x} = 1$ 与 $\\int 1 dx = x$ 心算准确。"
        },
        "modeling": {
          "score": 95,
          "confidence": 0.95,
          "evidence": "精准映射为一阶线性非齐次微分方程标准型。"
        },
        "methodUse": {
          "score": 98,
          "confidence": 0.95,
          "evidence": "积分因子公式法运用完美。"
        },
        "speed": {
          "score": 100,
          "confidence": 0.95,
          "evidence": "耗时仅 44 秒，极速秒杀。"
        },
        "strategyInsight": {
          "score": 95,
          "confidence": 0.9,
          "evidence": "标准公式神经反射。",
          "techniqueLevel": 2,
          "independentDiscovery": "confirmed"
        }
      }
    },
    {
      "questionId": 4464,
      "result": "wrong",
      "selfRating": 2,
      "durationSeconds": 451,
      "summary": "准确识别伯努利方程并令 $z=\\sqrt{y}$ 降为线性方程；但在代换第二行将 $-\\frac{4}{x}$ 误抄写为 $+\\frac{4}{x}$，导致系数变为 $\\frac{1}{10}$（正确为 $\\frac{1}{2}$），且遗漏奇异解 $y \\equiv 0$。",
      "verdict": "partial",
      "earliestError": "草稿第 3 行由原式 $y' - \\frac{4}{x}y = x^2\\sqrt{y}$ 两端同除 $\\sqrt{y}$ 时，将负号抄为正号写成 $\\frac{1}{\\sqrt{y}}y' + \\frac{4}{x}\\sqrt{y} = x^2$。",
      "errorTags": ["计算笔误", "符号抄错", "奇异解遗漏"],
      "weaknessTags": ["抄题核对", "伯努利除零讨论"],
      "advice": "1) 伯努利方程同除 $y^n$ 时，务必先在草稿纸上圈出原式项的符号（负号极易漏抄）；2) 同除 $\\sqrt{y}$ 时，在卷面最后务必补上一句：'另显然 $y \\equiv 0$ 也是原方程的解'，避免漏给 1 分步骤分。",
      "betterSolution": "1) 原式 $y' - \\frac{4}{x}y = x^2\\sqrt{y}$（$n=\\frac{1}{2}$）。两端同除 $\\sqrt{y}$：$y^{-\\frac{1}{2}}y' - \\frac{4}{x}y^{\\frac{1}{2}} = x^2$；\n2) 令 $z = \\sqrt{y}$，则 $z' = \\frac{1}{2\\sqrt{y}}y'$，方程化为 $2z' - \\frac{4}{x}z = x^2 \\implies z' - \\frac{2}{x}z = \\frac{1}{2}x^2$；\n3) 一阶线性求解：$z = e^{\\int \\frac{2}{x}dx}\\left[\\int \\frac{1}{2}x^2 e^{-\\int \\frac{2}{x}dx}dx + C\\right] = x^2\\left[\\int \\frac{1}{2}dx + C\\right] = \\mathbf{\\frac{1}{2}x^3 + Cx^2}$；\n4) $\\therefore \\sqrt{y} = \\frac{1}{2}x^3 + Cx^2$，另有解 $y \\equiv 0$。",
      "confidence": 0.98,
      "rating": 0.78,
      "ratingTier": "C",
      "difficultyMultiplier": 1.2,
      "dimensions": {
        "rigor": {
          "score": 70,
          "confidence": 0.95,
          "evidence": "换元思路与线性求解框架完整，但符号笔误导致结果偏差且未讨论 $y=0$。"
        },
        "computation": {
          "score": 75,
          "confidence": 0.95,
          "evidence": "线性积分公式计算本身过程正确，但带入了错误的 $+2/x$ 系数。"
        },
        "modeling": {
          "score": 90,
          "confidence": 0.95,
          "evidence": "准确识别伯努利方程并设 $z = y^{1-n} = \\sqrt{y}$。"
        },
        "methodUse": {
          "score": 85,
          "confidence": 0.95,
          "evidence": "伯努利标准代换法掌握规范。"
        },
        "speed": {
          "score": 75,
          "confidence": 0.95,
          "evidence": "耗时 7分31秒。"
        },
        "strategyInsight": {
          "score": 85,
          "confidence": 0.9,
          "evidence": "精准判定 $z=y^{1/2}$ 线性化路径。",
          "techniqueLevel": 3,
          "independentDiscovery": "confirmed"
        }
      }
    },
    {
      "questionId": 4520,
      "result": "wrong",
      "selfRating": 1,
      "durationSeconds": 300,
      "summary": "卡题未动笔（草稿标注'有点识别不出题型'）。本题为数一经典**全微分充要条件反求二阶常系数方程**，利用 $\\frac{\\partial P}{\\partial y} = \\frac{\\partial Q}{\\partial x}$ 可直接导出 $f''(x)+f(x)=x^2$ 并定解。",
      "verdict": "incorrect",
      "earliestError": "未能在看到题干'为一全微分方程'时联立充要条件 $\\frac{\\partial P}{\\partial y} = \\frac{\\partial Q}{\\partial x}$ 列出关于未知函数 $f(x)$ 的等式，草稿完全空白。",
      "errorTags": ["概念盲区", "全微分条件未触发"],
      "weaknessTags": ["全微分方程充要条件", "常系数非齐次反求"],
      "advice": "只要题目提到 '$P dx + Q dy = 0$ 为全微分方程'，**条件反射第一反应：立即写出 $\\frac{\\partial P}{\\partial y} = \\frac{\\partial Q}{\\partial x}$**！将偏导代入后立即转化为已知函数/未知函数微分方程。",
      "betterSolution": "1) 记 $P(x,y) = x^2y + xy^2 - f(x)y, Q(x,y) = f'(x) + x^2y$；\n2) 由全微分充要条件 $\\frac{\\partial P}{\\partial y} = \\frac{\\partial Q}{\\partial x}$ 得：\n$$x^2 + 2xy - f(x) = f''(x) + 2xy \\implies \\mathbf{f''(x) + f(x) = x^2}$$\n3) 解二阶常系数非齐次方程 $f''+f=x^2$：\n齐次通解 $Y = C_1\\cos x + C_2\\sin x$，设特解 $y^* = Ax^2+Bx+C$，代入得 $A=1, B=0, C=-2 \\implies y^* = x^2 - 2$；\n由初始条件 $f(0)=0, f'(0)=1$ 解得 $C_1=2, C_2=1$ $\\implies \\mathbf{f(x) = 2\\cos x + \\sin x + x^2 - 2}$；\n4) 代入原方程偏积分求势函数：$\\mathbf{\\frac{1}{2}x^2y^2 - 2y\\sin x + y\\cos x + 2xy = C}$。",
      "confidence": 0.98,
      "rating": 0.50,
      "ratingTier": "D",
      "difficultyMultiplier": 1.5,
      "dimensions": {
        "rigor": {
          "score": 0,
          "confidence": 0.95,
          "evidence": "草稿未写出任何有效推导步骤，标注识别不出题型。"
        },
        "computation": {
          "score": None,
          "confidence": 0,
          "evidence": "uncertain"
        },
        "modeling": {
          "score": 20,
          "confidence": 0.95,
          "evidence": "未将全微分文本条件翻译为数学偏导等式。"
        },
        "methodUse": {
          "score": 20,
          "confidence": 0.95,
          "evidence": "未能触发全微分判定与二阶微分方程联立解法。"
        },
        "speed": {
          "score": 60,
          "confidence": 0.95,
          "evidence": "5分钟内未动笔。"
        },
        "strategyInsight": {
          "score": 20,
          "confidence": 0.9,
          "evidence": "缺乏全微分条件与微分方程结合的综合题型认知。",
          "techniqueLevel": 4,
          "independentDiscovery": "uncertain"
        }
      }
    },
    {
      "questionId": 7647,
      "result": "correct",
      "selfRating": 4,
      "durationSeconds": 262,
      "summary": "可降阶方程（不显含 $y$）令 $y'=p(x)$ 降为一阶线性齐次，二次积分规范严谨，常数吸纳利落，顺利得出 $y = C_1 + \\frac{C_2}{x^2}$。",
      "verdict": "correct",
      "earliestError": None,
      "errorTags": [],
      "weaknessTags": [],
      "advice": "对于形如 $x y'' + 3y' = 0$，也可以直接视作欧拉方程或两端同乘 $x^2$ 凑微分 $(x^3 y')' = 0$，10 秒即可积分得出 $x^3 y' = C$。",
      "betterSolution": "方法一（降阶法）：令 $p = y'$，原式为 $x p' + 3p = 0 \\implies \\frac{dp}{p} = -\\frac{3}{x}dx \\implies p = \\frac{C_1}{x^3} \\implies y = C_2 + \\frac{C_1}{x^2}$；\n方法二（凑微分秒杀）：方程两端同乘 $x^2$：$x^3 y'' + 3x^2 y' = 0 \\implies (x^3 y')' = 0 \\implies x^3 y' = C_2' \\implies y' = \\frac{C_2'}{x^3} \\implies \\mathbf{y = C_1 + \\frac{C_2}{x^2}}$。",
      "confidence": 0.99,
      "rating": 1.25,
      "ratingTier": "A",
      "difficultyMultiplier": 1.0,
      "dimensions": {
        "rigor": {
          "score": 92,
          "confidence": 0.95,
          "evidence": "草稿完整标出 $y'=p(x), y''=p'$ 及二次积分吸收常数 $-\\frac{C_1}{2} \\to C_1$。"
        },
        "computation": {
          "score": 92,
          "confidence": 0.95,
          "evidence": "二次积分计算准确无误。"
        },
        "modeling": {
          "score": 92,
          "confidence": 0.95,
          "evidence": "准确识别不显含 $y$ 可降阶方程。"
        },
        "methodUse": {
          "score": 90,
          "confidence": 0.95,
          "evidence": "熟练掌握二阶降一阶标准代换。"
        },
        "speed": {
          "score": 90,
          "confidence": 0.95,
          "evidence": "耗时 4分22秒，远低于基准 10分。"
        },
        "strategyInsight": {
          "score": 88,
          "confidence": 0.9,
          "evidence": "降阶代换路径清晰。",
          "techniqueLevel": 2,
          "independentDiscovery": "confirmed"
        }
      }
    },
    {
      "questionId": 7654,
      "result": "wrong",
      "selfRating": 2,
      "durationSeconds": 246,
      "summary": "不显含 $x$ 可降阶代换 $y'=p(y)$ 逻辑正确，但在求得 $p = \\frac{C_1}{y}$ 后，草稿第 4 行误将自变量当成 $x$ 写成 $y' = \\frac{C_1}{x}$，导致积分出 $y = C_1 \\ln x + C_2$ 无法代入初始条件 $x=0$；本题更推荐用导数乘积 $(yy')'=0$ 极速秒杀。",
      "verdict": "incorrect",
      "earliestError": "草稿第 4 行在解出一阶方程 $p' + \\frac{1}{y}p = 0 \\implies p = \\frac{C_1}{y}$ 后，错误写成 $y' = C_1 \\frac{1}{x}$，混淆了自变量 $y$ 与 $x$。",
      "errorTags": ["变量混淆", "自变量代换失误", "凑微分结构遗漏"],
      "weaknessTags": ["不显含x降阶变量跟踪", "导数乘积构造"],
      "advice": "1) 不显含 $x$ 方程令 $y'=p(y), y''=p\\frac{dp}{dy}$ 时，牢记**此时自变量是 $y$**！求出 $p(y)=\\frac{C_1}{y}$ 后应写成 $\\frac{dy}{dx} = \\frac{C_1}{y} \\implies y dy = C_1 dx$；2) 牢记常用导数乘积模型：$y y'' + (y')^2 = (y y')'$，直接一步积分出 $y y' = C$！",
      "betterSolution": "考场 20 秒极速凑微分：\n注意到 $y y'' + (y')^2 = (y y')' = 0$；\n积分得 $y y' = C_1$；\n代入初始条件 $y(0)=1, y'(0)=\\frac{1}{2}$ 得 $1 \\cdot \\frac{1}{2} = C_1 \\implies C_1 = \\frac{1}{2}$；\n则 $y \\frac{dy}{dx} = \\frac{1}{2} \\implies y dy = \\frac{1}{2}dx \\implies \\frac{1}{2}y^2 = \\frac{1}{2}x + C_2$；\n代入 $y(0)=1$ 得 $\\frac{1}{2} = C_2 \\implies y^2 = x+1 \\implies \\mathbf{y = \\sqrt{x+1}}$。",
      "confidence": 0.98,
      "rating": 0.65,
      "ratingTier": "C",
      "difficultyMultiplier": 1.2,
      "dimensions": {
        "rigor": {
          "score": 60,
          "confidence": 0.95,
          "evidence": "草稿中混淆了以 $y$ 为自变量的方程，写出 $\\ln x$ 并在代入初始条件时发现 $x=0$ 无定义。"
        },
        "computation": {
          "score": 65,
          "confidence": 0.95,
          "evidence": "降阶代换与一阶齐次求解过程正确，但变量替换中断。"
        },
        "modeling": {
          "score": 75,
          "confidence": 0.95,
          "evidence": "识别出不显含 $x$ 方程并设 $p=p(y)$。"
        },
        "methodUse": {
          "score": 65,
          "confidence": 0.95,
          "evidence": "执行 $p(y)$ 代换时自变量跟踪丢失，且未看出 $(yy')'$ 整体结构。"
        },
        "speed": {
          "score": 75,
          "confidence": 0.95,
          "evidence": "耗时 4分06秒。"
        },
        "strategyInsight": {
          "score": 60,
          "confidence": 0.9,
          "evidence": "缺乏对常用导数乘积公式 $(yy')'=yy''+y'^2$ 的敏感度。",
          "techniqueLevel": 3,
          "independentDiscovery": "uncertain"
        }
      }
    },
    {
      "questionId": 7597,
      "result": "correct",
      "selfRating": 4,
      "durationSeconds": 230,
      "summary": "二阶常系数齐次特征方程法掌握纯熟，准确求出共轭复根 $r = -1 \\pm \\sqrt{2}i$ 并写出欧拉形式实通解，答案规范标准！",
      "verdict": "correct",
      "earliestError": None,
      "errorTags": [],
      "weaknessTags": [],
      "advice": "复根通解公式记忆牢固，继续保持二阶常系数非齐次特解的待定练习。",
      "betterSolution": "特征方程为 $r^2+2r+3=0 \\implies r = \\frac{-2 \\pm \\sqrt{4-12}}{2} = -1 \\pm \\sqrt{2}i$；\n故通解为 $\\mathbf{y = e^{-x}(C_1\\cos\\sqrt{2}x + C_2\\sin\\sqrt{2}x)}$。",
      "confidence": 0.99,
      "rating": 1.25,
      "ratingTier": "A",
      "difficultyMultiplier": 1.0,
      "dimensions": {
        "rigor": {
          "score": 95,
          "confidence": 0.95,
          "evidence": "草稿完整写明特征方程、共轭复根与标准通解。"
        },
        "computation": {
          "score": 95,
          "confidence": 0.95,
          "evidence": "求根公式与三角系数计算精准。"
        },
        "modeling": {
          "score": 95,
          "confidence": 0.95,
          "evidence": "精准映射为二阶常系数线性齐次微分方程。"
        },
        "methodUse": {
          "score": 95,
          "confidence": 0.95,
          "evidence": "特征方程法运用标准熟练。"
        },
        "speed": {
          "score": 92,
          "confidence": 0.95,
          "evidence": "耗时 3分50秒，远低于基准 10分。"
        },
        "strategyInsight": {
          "score": 90,
          "confidence": 0.9,
          "evidence": "复根通解标准反射。",
          "techniqueLevel": 2,
          "independentDiscovery": "confirmed"
        }
      }
    }
  ]
}

with open(target_file, 'w', encoding='utf-8') as f:
    json.dump(payload, f, ensure_ascii=False, indent=2)

print(f"Successfully wrote batch correction JSON to {target_file}")

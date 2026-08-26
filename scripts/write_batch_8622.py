import json
import os
import sys

appdata = os.environ.get('APPDATA', r'C:\Users\86136\AppData\Roaming')
inbox_dir = os.path.join(appdata, 'com.shuaba.math', 'codex-inbox')
os.makedirs(inbox_dir, exist_ok=True)
target_file = os.path.join(inbox_dir, 'SB-BATCH-20260825-8622.json')

payload = {
  "schemaVersion": 1,
  "kind": "batch",
  "taskId": "SB-BATCH-20260825-8622",
  "summary": "【多元微分第一批 · 战术诊断】：**计算硬功极强，概念存在一元直觉迁移盲区**！在多元复合函数一阶、二阶偏导及乘积法则（Q4, Q5, Q7, Q8）展现出极高的推导精度与熟练度；但在多元概念底层（Q1, Q2, Q3）暴露了两大高频考研陷阱：① 误以为可微强于偏导连续；② 误将一元函数的「不连续则不可导」直觉套用至多元偏导数。需彻底厘清四大金刚单向蕴含网络与分段点可微性判别三步法。",
  "errorTags": ["概念边界", "计算笔误"],
  "weaknessTags": ["多元函数四大金刚关系网", "偏导数与连续性反例", "可微性定义式检验"],
  "confidence": 0.96,
  "recommendedQuestionIds": [],
  "batchAttempts": [
    {
      "questionId": 2171,
      "result": "wrong",
      "selfRating": 1,
      "durationSeconds": 141,
      "summary": "【概念盲区 · 误判蕴含方向】：误以为可微 ③ 能推出偏导连续 ②（选 B）。实为偏导连续 ② 是充分条件，可微 ③ 无法推出偏导连续（经典反例 $f(x,y)=(x^2+y^2)\\sin\\frac{1}{x^2+y^2}$）。正确链条为 ② $\\Rightarrow$ ③ $\\Rightarrow$ ①（选 A）。",
      "verdict": "incorrect",
      "earliestError": "草稿第 2 行 `我感觉 ③ -> ② -> ① 选 B`（误判可微与偏导连续的强弱关系）",
      "errorTags": ["概念边界"],
      "weaknessTags": ["多元函数四大金刚关系网"],
      "advice": "牢记考研多元微分金字塔：最顶层为「偏导数连续」$\\implies$ 中间层为「可微」$\\implies$ 底层为「连续」与「偏导数存在」（底层二者互不相推）。反向推导全部不成立！",
      "betterSolution": "【四大金刚记忆口诀】：\n1) **偏导连续最强**：偏导连续 $\\implies$ 可微 $\\implies$ (连续 且 偏导存在)；\n2) **反向全断裂**：可微推不出偏导连续（震荡函数反例）；连续推不出偏导（折线角点）；偏导存在推不出连续（轴向孤岛）；\n3) 题目直接锁定 ② $\\Rightarrow$ ③ $\\Rightarrow$ ①，秒选 **A**。",
      "confidence": 0.98,
      "rating": 0.50,
      "ratingTier": "D",
      "difficultyMultiplier": 1.0,
      "dimensions": {
        "rigor": {
          "score": 40,
          "confidence": 0.95,
          "evidence": "草稿凭直觉判定 ③ 强于 ②，缺乏充分必要性逻辑论证。"
        },
        "computation": {
          "score": 90,
          "confidence": 0.9,
          "evidence": "无复杂数值计算。"
        },
        "modeling": {
          "score": 50,
          "confidence": 0.9,
          "evidence": "未能正确建构多元微分四大性质的逻辑网络拓扑。"
        },
        "methodUse": {
          "score": 45,
          "confidence": 0.95,
          "evidence": "概念判定方法出现方向性倒置。"
        },
        "speed": {
          "score": 85,
          "confidence": 0.9,
          "evidence": "耗时 2分21秒。"
        },
        "strategyInsight": {
          "score": 40,
          "confidence": 0.9,
          "evidence": "未识别出考研最经典的偏导连续 vs 可微陷阱。",
          "techniqueLevel": 2,
          "independentDiscovery": "uncertain"
        }
      }
    },
    {
      "questionId": 2187,
      "result": "wrong",
      "selfRating": 1,
      "durationSeconds": 110,
      "summary": "【概念盲区 · 一元直觉迁移偏差】：通过极坐标正确判定了极限不存在导致不连续，但凭一元直觉认为「不连续就更不可能有偏导数」。实际上按定义沿坐标轴 $y=0$ 时 $f(x,0)\\equiv 0$，偏导数 $f_x'(0,0)=0, f_y'(0,0)=0$ 完全存在！正确结论为「不连续，偏导数存在」（选 C）。",
      "verdict": "incorrect",
      "earliestError": "草稿第 3 行 `偏导数更不存在`（未按定义式计算轴向极限，误套一元结论）",
      "errorTags": ["概念边界"],
      "weaknessTags": ["偏导数与连续性反例", "分段函数偏导数定义式"],
      "advice": "遇到分段点求偏导，**永远强制写定义式** $f_x'(0,0) = \\lim_{x\\to0}\\frac{f(x,0)-f(0,0)}{x}$！偏导数只关心坐标轴上的取值，与全平面连续性毫无因果关系。",
      "betterSolution": "【两步秒杀法】：\n1) **判连续**：令 $y=kx$，$\\lim_{x\\to0}\\frac{kx^2}{x^2+k^2x^2} = \\frac{k}{1+k^2}$ 随 $k$ 变化，极限不存在 $\\implies$ **不连续**；\n2) **判偏导（走定义）**：$f_x'(0,0) = \\lim_{x\\to0}\\frac{f(x,0)-f(0,0)}{x} = \\lim_{x\\to0}\\frac{0-0}{x} = 0$，同理 $f_y'(0,0)=0 \\implies$ **偏导数存在**；\n3) 立即选 **C**。",
      "confidence": 0.98,
      "rating": 0.50,
      "ratingTier": "D",
      "difficultyMultiplier": 1.0,
      "dimensions": {
        "rigor": {
          "score": 45,
          "confidence": 0.95,
          "evidence": "极坐标求重极限正确，但偏导数判定未写定义。"
        },
        "computation": {
          "score": 85,
          "confidence": 0.9,
          "evidence": "极坐标代换化简正确。"
        },
        "modeling": {
          "score": 50,
          "confidence": 0.9,
          "evidence": "混淆了多元全方位连续与坐标轴单向导数的独立性。"
        },
        "methodUse": {
          "score": 50,
          "confidence": 0.95,
          "evidence": "未运用偏导数定义求极限。"
        },
        "speed": {
          "score": 90,
          "confidence": 0.9,
          "evidence": "耗时 1分50秒，节奏极快但出现概念盲区。"
        },
        "strategyInsight": {
          "score": 45,
          "confidence": 0.9,
          "evidence": "掉入考研最著名的 $xy/(x^2+y^2)$ 经典陷阱题。",
          "techniqueLevel": 2,
          "independentDiscovery": "uncertain"
        }
      }
    },
    {
      "questionId": 2214,
      "result": "uncertain",
      "selfRating": 2,
      "durationSeconds": 580,
      "summary": "【步骤欠缺 · 遗漏偏导存在性前置判定】：第 (I) 问利用极限运算法则证明连续完全正确；第 (II)(III) 问准确调用了全微分判定极限式 $\\lim \\frac{\\Delta z - A\\Delta x - B\\Delta y}{\\rho}$，但**遗漏了计算 $f_x'(0,0), f_y'(0,0)$ 的前置步骤**。当 $1+k \\ne 0$ 时，$\\lim_{x\\to0^+} \\frac{f(x,0)}{x} = 1+k$ 而 $\\lim_{x\\to0^-} \\frac{f(x,0)}{x} = -(1+k)$，偏导数根本不存在，故直接不可微。",
      "verdict": "partial",
      "earliestError": "草稿第 (2) 问未先考察 $f_x'(0,0)$ 与 $f_y'(0,0)$ 是否存在，直接将二者当作 0 带入全微分判别式",
      "errorTags": ["概念边界"],
      "weaknessTags": ["可微性定义式检验", "分段函数偏导数定义式"],
      "advice": "大题证明「可微/不可微」的铁律三步法：① 先算 $f_x'(0,0), f_y'(0,0)$，若任一不存在则**直接判不可微**；② 若偏导数均存在，再构造 $\\Delta z - f_x'\\Delta x - f_y'\\Delta y$；③ 算 $\\lim_{\\rho\\to0}\\frac{\\Delta z - \\dots}{\\rho}$ 是否为 0。",
      "betterSolution": "【大题标准满分书写范式】：\n(Ⅰ) $\\lim f(x,y) = \\lim \\left[ \\frac{f(x,y)}{\\sqrt{x^2+y^2}}\\cdot \\sqrt{x^2+y^2} \\right] = (1+k)\\cdot 0 = 0 = f(0,0)$，故在 $(0,0)$ 连续；\n(Ⅱ) 考察偏导数：$\\frac{f(x,0)-f(0,0)}{x} = \\frac{f(x,0)}{|x|}\\cdot \\frac{|x|}{x}$。因 $\\lim_{x\\to0}\\frac{f(x,0)}{|x|} = 1+k$：\n- 右极限 $\\lim_{x\\to0^+}=1+k$；左极限 $\\lim_{x\\to0^-}=-(1+k)$；\n- 当 $k\\ne -1$ 时，左右极限不相等 $\\implies f_x'(0,0)$ 不存在 $\\implies$ 必不可微；\n(Ⅲ) 当 $k=-1$ 时，左右极限均为 $0 \\implies f_x'(0,0)=f_y'(0,0)=0$。此时 $\\lim_{\\rho\\to0}\\frac{f(x,y)-0-0}{\\rho} = 1+(-1) = 0$，故可微且 $\\mathrm{d}f|_{(0,0)}=0$。",
      "confidence": 0.95,
      "rating": 0.90,
      "ratingTier": "B",
      "difficultyMultiplier": 1.05,
      "dimensions": {
        "rigor": {
          "score": 75,
          "confidence": 0.95,
          "evidence": "连续性证明规范，全微分定义式结构清晰，但忽略了左右单侧导数符号讨论。"
        },
        "computation": {
          "score": 85,
          "confidence": 0.9,
          "evidence": "极限乘积变形准确。"
        },
        "modeling": {
          "score": 85,
          "confidence": 0.9,
          "evidence": "准确把握了重极限与微商定义的关系。"
        },
        "methodUse": {
          "score": 80,
          "confidence": 0.95,
          "evidence": "掌握可微性判定的主干框架。"
        },
        "speed": {
          "score": 85,
          "confidence": 0.9,
          "evidence": "耗时 9分40秒，证明大题节奏正常。"
        },
        "strategyInsight": {
          "score": 75,
          "confidence": 0.9,
          "evidence": "缺少单侧极限符号分析导致对不可微成因的定位不够彻底。",
          "techniqueLevel": 3,
          "independentDiscovery": "confirmed"
        }
      }
    },
    {
      "questionId": 2476,
      "result": "correct",
      "selfRating": 3,
      "durationSeconds": 127,
      "summary": "【极速秒杀 · 规范严密】：准确运用一元复合链式法则，分别求得偏导数 $\\frac{\\partial z}{\\partial x} = f'\\cdot \\frac{1}{x}$ 与 $\\frac{\\partial z}{\\partial y} = f'\\cdot (-\\frac{1}{y^2})$，线性组合直接抵消得 0，干净利落！",
      "verdict": "correct",
      "earliestError": None,
      "errorTags": [],
      "weaknessTags": [],
      "advice": "复合函数一阶偏导基础扎实，继续保持这种链式微元清晰度。",
      "betterSolution": None,
      "confidence": 0.99,
      "rating": 1.35,
      "ratingTier": "A",
      "difficultyMultiplier": 0.95,
      "dimensions": {
        "rigor": {
          "score": 95,
          "confidence": 0.95,
          "evidence": "严格写出复合变量链式微元，代数抵消清晰完整。"
        },
        "computation": {
          "score": 95,
          "confidence": 0.95,
          "evidence": "负幂次求导与化简零失误。"
        },
        "modeling": {
          "score": 95,
          "confidence": 0.95,
          "evidence": "标准抽象复合函数模型。"
        },
        "methodUse": {
          "score": 95,
          "confidence": 0.95,
          "evidence": "链式求导法则运用娴熟。"
        },
        "speed": {
          "score": 95,
          "confidence": 0.95,
          "evidence": "耗时 2分07秒，极速通关。"
        },
        "strategyInsight": {
          "score": 90,
          "confidence": 0.9,
          "evidence": "识别一阶偏微分算子组合对称性。",
          "techniqueLevel": 2,
          "independentDiscovery": "confirmed"
        }
      }
    },
    {
      "questionId": 2481,
      "result": "correct",
      "selfRating": 3,
      "durationSeconds": 193,
      "summary": "【真题母题 · 稳健通关】：将 $u = \\sin y - \\sin x$ 与多项式乘积项拆解清晰，分别求导并跟踪符号 $-\\cos x$ 与 $\\cos y$，线性组合后 $f'(u)$ 项完美对消，准确得出 $\\frac{y}{\\cos x} + \\frac{x}{\\cos y}$。",
      "verdict": "correct",
      "earliestError": None,
      "errorTags": [],
      "weaknessTags": [],
      "advice": "遇到带三角函数的复合求导，注意导数符号（如 $-\\sin x$ 的导数是 $-\\cos x$），本题符号跟踪非常精准。",
      "betterSolution": None,
      "confidence": 0.99,
      "rating": 1.30,
      "ratingTier": "A",
      "difficultyMultiplier": 1.0,
      "dimensions": {
        "rigor": {
          "score": 95,
          "confidence": 0.95,
          "evidence": "定义中间变量 $u, v$ 并完整写出偏导算式。"
        },
        "computation": {
          "score": 95,
          "confidence": 0.95,
          "evidence": "三角求导与代数通分抵消准确。"
        },
        "modeling": {
          "score": 95,
          "confidence": 0.95,
          "evidence": "复合多元函数结构拆解清晰。"
        },
        "methodUse": {
          "score": 95,
          "confidence": 0.95,
          "evidence": "链式求导法则与线性组合处理规范。"
        },
        "speed": {
          "score": 92,
          "confidence": 0.95,
          "evidence": "耗时 3分13秒，节奏标准。"
        },
        "strategyInsight": {
          "score": 90,
          "confidence": 0.9,
          "evidence": "敏锐利用 $1/\\cos x$ 与 $1/\\cos y$ 的系数消去未知抽象函数 $f'(u)$。",
          "techniqueLevel": 2,
          "independentDiscovery": "confirmed"
        }
      }
    },
    {
      "questionId": 2529,
      "result": "uncertain",
      "selfRating": 2,
      "durationSeconds": 510,
      "summary": "【瞄准失误 · 终点代数遗留】：复合嵌套链式求导树状图 $\\varphi \\to (u, v) \\to (t, (m,n) \\to t)$ 构建极其精妙，一阶导数展开式完全正确；但在代入 $t=0$ 时，仅代入了 $u,v,m,n$ 的函数值，**遗漏了对三角函数 $\\cos 0 = 1, \\sin 0 = 0$ 的求值**，导致结果停留在 $a\\cos t + \\frac{ab}{\\cos^2 t} + b^2\\sin t$，未化为最终常数 $a(1+b)$。",
      "verdict": "partial",
      "earliestError": "草稿最后一步未将 $t=0$ 代入三角函数项（遗留了 $\\cos t, \\sin t$）",
      "errorTags": ["计算笔误"],
      "weaknessTags": ["定点求导数值化简"],
      "advice": "题目求「$\\varphi'(0)$」表示在 $t=0$ 处的导数值，求导展开后必须**将所有 $t$ 彻底替换为 $0$**（$\\cos 0 = 1, \\sin 0 = 0, \\sec 0 = 1$），输出纯常数表达式。",
      "betterSolution": "【定点快速代入（节省草稿）】：\n由 $\\varphi'(t) = f_1'\\cdot \\cos t + f_2'\\cdot [f_1'\\cdot \\sec^2 t + f_2'\\cdot \\sin t]$：\n当 $t=0$ 时，$u=0, v=0, m=0, n=0$，直接带入点 $(0,0)$ 的已知导数值 $f_1'=a, f_2'=b$ 及 $t=0$ 的三角函数值：\n$$\\varphi'(0) = a\\cdot 1 + b\\cdot [a\\cdot 1 + b\\cdot 0] = a + ab = \\mathbf{a(1+b)}$$（30秒秒出）。",
      "confidence": 0.98,
      "rating": 0.85,
      "ratingTier": "B",
      "difficultyMultiplier": 1.05,
      "dimensions": {
        "rigor": {
          "score": 85,
          "confidence": 0.95,
          "evidence": "链式树状图与中间变量展开极其清晰规范，唯终点赋值不彻底。"
        },
        "computation": {
          "score": 78,
          "confidence": 0.95,
          "evidence": "导数符号展开正确，最后一步三角求值遗漏。"
        },
        "modeling": {
          "score": 95,
          "confidence": 0.95,
          "evidence": "完美构建两层复合函数求导模型。"
        },
        "methodUse": {
          "score": 92,
          "confidence": 0.95,
          "evidence": "嵌套多元链式法则掌握透彻。"
        },
        "speed": {
          "score": 80,
          "confidence": 0.9,
          "evidence": "耗时 8分30秒。"
        },
        "strategyInsight": {
          "score": 88,
          "confidence": 0.9,
          "evidence": "成功拆解高难度嵌套函数。",
          "techniqueLevel": 3,
          "independentDiscovery": "confirmed"
        }
      }
    },
    {
      "questionId": 2487,
      "result": "correct",
      "selfRating": 3,
      "durationSeconds": 443,
      "summary": "【二阶偏导 · 稳健精准】：先求一阶偏导 $\\frac{\\partial z}{\\partial x} = \\frac{y}{x}f'(xy) - \\frac{1}{x^2}f(xy) + y\\varphi'(x+y)$，再对 $y$ 求偏导时准确运用乘积法则与链式法则，一阶项 $\\frac{1}{x}f'(xy)$ 相互对消，准确得出 $y f''(xy) + \\varphi'(x+y) + y\\varphi''(x+y)$！",
      "verdict": "correct",
      "earliestError": None,
      "errorTags": [],
      "weaknessTags": [],
      "advice": "对 $y/x$ 与 $f(xy)$ 的混合乘积求偏导极其严谨，乘积求导与链式求导的交织处理得无可挑剔。",
      "betterSolution": None,
      "confidence": 0.99,
      "rating": 1.25,
      "ratingTier": "A",
      "difficultyMultiplier": 1.0,
      "dimensions": {
        "rigor": {
          "score": 95,
          "confidence": 0.95,
          "evidence": "拆解 $u, v$ 并完整书写一阶偏导与二阶混合偏导的每一项展开。"
        },
        "computation": {
          "score": 95,
          "confidence": 0.95,
          "evidence": "乘积求导法则与同类项抵消零失误。"
        },
        "modeling": {
          "score": 95,
          "confidence": 0.95,
          "evidence": "二阶偏导数结构把握精准。"
        },
        "methodUse": {
          "score": 95,
          "confidence": 0.95,
          "evidence": "掌握二阶混合偏导求导流程。"
        },
        "speed": {
          "score": 90,
          "confidence": 0.9,
          "evidence": "耗时 7分23秒，节奏扎实。"
        },
        "strategyInsight": {
          "score": 90,
          "confidence": 0.9,
          "evidence": "先对 $x$ 再对 $y$ 顺序求导，代数结构清晰。",
          "techniqueLevel": 3,
          "independentDiscovery": "confirmed"
        }
      }
    },
    {
      "questionId": 10713,
      "result": "correct",
      "selfRating": 3,
      "durationSeconds": 348,
      "summary": "【考研核心母题 · 完美大满贯】：二元复合函数二阶混合偏导的标准教科书级演练！准确写出一阶偏导 $z_x = f_u + y f_v$；对 $y$ 二次求导时，对 $f_u$ 再次链式展开 $(f_{uu}+x f_{uv})$，对 $y f_v$ 运用乘积法则展开为 $f_v + y(f_{vu}+x f_{vv})$，合并对称项得出 $(x+y)f_{uv} + f_{uu} + f_v + xy f_{vv}$，推导无懈可击！",
      "verdict": "correct",
      "earliestError": None,
      "errorTags": [],
      "weaknessTags": [],
      "advice": "此题是考研多元微分大题的核心母题，二阶全微分与偏微分方程化简均以此为底座，你已完全具备该部分大题满分能力！",
      "betterSolution": None,
      "confidence": 0.99,
      "rating": 1.30,
      "ratingTier": "A",
      "difficultyMultiplier": 1.0,
      "dimensions": {
        "rigor": {
          "score": 98,
          "confidence": 0.95,
          "evidence": "树状图清晰，二次链式求导与乘积求导项分类明确，同类项合并无任何遗漏。"
        },
        "computation": {
          "score": 98,
          "confidence": 0.95,
          "evidence": "四项展开与系数合并计算极其精准。"
        },
        "modeling": {
          "score": 98,
          "confidence": 0.95,
          "evidence": "熟练建构二元双中间变量二次复合模型。"
        },
        "methodUse": {
          "score": 98,
          "confidence": 0.95,
          "evidence": "完全掌握考研高频二阶偏导母题解法。"
        },
        "speed": {
          "score": 95,
          "confidence": 0.95,
          "evidence": "耗时 5分48秒，高精度快速完成。"
        },
        "strategyInsight": {
          "score": 95,
          "confidence": 0.9,
          "evidence": "对 $f_u, f_v$ 仍是 $(u,v)$ 的复合函数具有敏锐的二次求导神经反射。",
          "techniqueLevel": 3,
          "independentDiscovery": "confirmed"
        }
      }
    }
  ]
}

with open(target_file, 'w', encoding='utf-8') as f:
    json.dump(payload, f, ensure_ascii=False, indent=2)

print(f"Successfully wrote batch JSON to {target_file}")

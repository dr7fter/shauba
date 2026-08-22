import json
import os
import sys

appdata = os.environ.get('APPDATA', r'C:\Users\86136\AppData\Roaming')
inbox_dir = os.path.join(appdata, 'com.shuaba.math', 'codex-inbox')
os.makedirs(inbox_dir, exist_ok=True)
target_file = os.path.join(inbox_dir, 'SB-BATCH-20260822-1972.json')

payload = {
  "schemaVersion": 1,
  "kind": "batch",
  "taskId": "SB-BATCH-20260822-1972",
  "summary": "【反常积分 8 题全景母题批改复盘】：整体正确率 $6/8$（$75\\%$），总作答耗时 28分03秒，作答节奏干净利落！在纯幂与对数双奇点判敛（#1245、#2157、#2153）、含参消除发散项大题（#2160、#2169）及微分方程两边定积分秒杀（#4618）中展现出极高的考点敏锐度与严密推导力；失分点集中在：1) #2164 三角非零瑕点平移展开时误套用 $x=0$ 处麦克劳林展开；2) #10566 面对 $\\int_0^{+\\infty}\\frac{x\\ln x}{1+x^4}\\mathrm{d}x$ 错选分部积分导致绕路，未应用区间倒代换 $x=\\frac{1}{t}$ 秒杀大招。",
  "errorTags": ["非零瑕点展开混淆", "对称性倒代换未触发"],
  "weaknessTags": ["三角非零点泰勒展开", "区间倒代换对称性"],
  "confidence": 0.95,
  "recommendedQuestionIds": [],
  "batchAttempts": [
    {
      "questionId": 1245,
      "result": "correct",
      "selfRating": 4,
      "durationSeconds": 118,
      "summary": "标准双奇点拆分，完美利用瑕点阶数 $a<1$ 与无穷阶数 $a+b>1$ 双重判定收敛，选 $C$ 一气呵成。",
      "verdict": "correct",
      "earliestError": None,
      "errorTags": [],
      "weaknessTags": ["双奇点拆分"],
      "advice": "保持当前双奇点拆分 $\\int_0^1 + \\int_1^{+\\infty}$ 规范，对于纯幂函数直接看两端主部阶数。",
      "betterSolution": "原式拆为 $I_1 = \\int_0^1 \\frac{1}{x^a(1+x)^b}\\,\\mathrm{d}x$ 与 $I_2 = \\int_1^{+\\infty} \\frac{1}{x^a(1+x)^b}\\,\\mathrm{d}x$。$x\\to 0^+$ 时被积函数 $\\sim \\frac{1}{x^a} \\implies a<1$；$x\\to+\\infty$ 时被积函数 $\\sim \\frac{1}{x^{a+b}} \\implies a+b>1$。充要条件为 $a<1$ 且 $a+b>1$，直接选 $\\mathbf{C}$。",
      "confidence": 0.98,
      "rating": 1.25,
      "ratingTier": "A",
      "difficultyMultiplier": 1.0,
      "dimensions": {
        "rigor": {
          "score": 90,
          "confidence": 0.95,
          "evidence": "草稿完整写出拆分两段式及对应参数不等式 $a<1$ 与 $a+b>1$。"
        },
        "computation": {
          "score": 88,
          "confidence": 0.95,
          "evidence": "主部阶数提炼迅速准确无任何多余草稿。"
        },
        "modeling": {
          "score": 92,
          "confidence": 0.95,
          "evidence": "准确识别 $0$ 与 $+\\infty$ 两处奇点短板效应。"
        },
        "methodUse": {
          "score": 90,
          "confidence": 0.95,
          "evidence": "熟练运用极限比较审敛法之 $p$-积分判据。"
        },
        "speed": {
          "score": 92,
          "confidence": 0.95,
          "evidence": "耗时 1分58秒，低于基准 3分。"
        },
        "strategyInsight": {
          "score": 90,
          "confidence": 0.9,
          "evidence": "两端主部抓取直击考点。",
          "techniqueLevel": 2,
          "independentDiscovery": "confirmed"
        }
      }
    },
    {
      "questionId": 2157,
      "result": "correct",
      "selfRating": 4,
      "durationSeconds": 114,
      "summary": "准确运用等价无穷小 $\\ln(1+x)\\sim x$，将瑕点阶数归结为 $p-1<1\\implies p<2$，结合无穷远 $p>1$ 迅速选出 $B$。",
      "verdict": "correct",
      "earliestError": None,
      "errorTags": [],
      "weaknessTags": ["对数瑕点阶数"],
      "advice": "对数在 $0$ 处的等价无穷小与在 $\\infty$ 处的极慢增长特性运用熟练，继续保持。",
      "betterSolution": "拆为 $\\int_0^1 + \\int_1^{+\\infty}$：$x\\to 0^+$ 时 $\\frac{\\ln(1+x)}{x^p} \\sim \\frac{x}{x^p} = \\frac{1}{x^{p-1}}$，收敛需 $p-1<1 \\implies p<2$；$x\\to+\\infty$ 时对数弱于任意幂次，需 $p>1$。综合得 $1<p<2$，选 $\\mathbf{B}$。",
      "confidence": 0.98,
      "rating": 1.25,
      "ratingTier": "A",
      "difficultyMultiplier": 1.0,
      "dimensions": {
        "rigor": {
          "score": 90,
          "confidence": 0.95,
          "evidence": "草稿明确写明 $\\frac{1}{x^{p-1}}$ 对应 $p-1<1$ 导出 $p<2$。"
        },
        "computation": {
          "score": 90,
          "confidence": 0.95,
          "evidence": "阶数不等式化简准确。"
        },
        "modeling": {
          "score": 90,
          "confidence": 0.95,
          "evidence": "精准拆分双端并锁定对数阶数。"
        },
        "methodUse": {
          "score": 90,
          "confidence": 0.95,
          "evidence": "等价无穷小化简瑕积分与比较判别法。"
        },
        "speed": {
          "score": 92,
          "confidence": 0.95,
          "evidence": "耗时 1分54秒，显著低于基准 3分。"
        },
        "strategyInsight": {
          "score": 90,
          "confidence": 0.9,
          "evidence": "深刻理解对数在 0 与 $\\infty$ 处的不同渐近行为。",
          "techniqueLevel": 2,
          "independentDiscovery": "confirmed"
        }
      }
    },
    {
      "questionId": 2153,
      "result": "correct",
      "selfRating": 4,
      "durationSeconds": 159,
      "summary": "清晰识别 $x=1$ 处的对数瑕点 $\\frac{1}{\\ln^q x}\\sim\\frac{1}{(x-1)^q}$ 需 $q<1$，结合无穷远 $p>1$，精准选出 $A$。",
      "verdict": "correct",
      "earliestError": None,
      "errorTags": [],
      "weaknessTags": ["p-q双重基准"],
      "advice": "牢记考研 $p-q$ 积分结论：$\\int_1^{+\\infty} \\frac{\\mathrm{d}x}{x^p \\ln^q x}$ 当 $x=1$ 成为瑕点时拆为两段，$x\\to 1^+$ 看 $q<1$，$x\\to+\\infty$ 看 $p>1$。",
      "betterSolution": "拆分为 $\\int_1^2 + \\int_2^{+\\infty}$。在 $x=1$ 处：$\\ln x = \\ln(1+(x-1)) \\sim x-1$，故 $\\frac{1}{x^p \\ln^q x} \\sim \\frac{1}{(x-1)^q}$，收敛需 $q<1$；在 $+\\infty$ 处：当 $q<1$ 时需 $p>1$ 才能压制发散。故收敛条件为 $p>1$ 且 $q<1$，选 $\\mathbf{A}$。",
      "confidence": 0.98,
      "rating": 1.25,
      "ratingTier": "A",
      "difficultyMultiplier": 1.0,
      "dimensions": {
        "rigor": {
          "score": 88,
          "confidence": 0.95,
          "evidence": "草稿写明 $\\frac{1}{\\ln^q x} \\sim \\frac{1}{(x-1)^q} \\implies q<1$ 及无穷处 $p>1$。"
        },
        "computation": {
          "score": 88,
          "confidence": 0.95,
          "evidence": "等价无穷小替换准确。"
        },
        "modeling": {
          "score": 90,
          "confidence": 0.95,
          "evidence": "准确锁定 $x=1$ 为瑕点并拆为 $\\int_1^2 + \\int_2^{+\\infty}$。"
        },
        "methodUse": {
          "score": 88,
          "confidence": 0.95,
          "evidence": "瑕点平移等价替换与无穷阶数对比。"
        },
        "speed": {
          "score": 88,
          "confidence": 0.95,
          "evidence": "耗时 2分39秒，在基准 3分内完成。"
        },
        "strategyInsight": {
          "score": 88,
          "confidence": 0.9,
          "evidence": "识别出 $\\ln x$ 增长缓慢对无穷远敛散性的微弱影响。",
          "techniqueLevel": 3,
          "independentDiscovery": "confirmed"
        }
      }
    },
    {
      "questionId": 2164,
      "result": "wrong",
      "selfRating": 2,
      "durationSeconds": 298,
      "summary": "在分析左端瑕点 $x\\to\\frac{\\pi}{2}^+$ 时，混淆了展开点，误将 $-\\cos x$ 按 $x=0$ 处展开为 $1-\\frac{1}{2}x^2$（二阶），错误得出 $\\alpha<\\frac{1}{2}$ 并错选 $B$（正确为 $C$）。",
      "verdict": "incorrect",
      "earliestError": "草稿第 4 行在 $x\\to\\frac{\\pi}{2}^+$ 处展开 $(-\\cos x)^\\alpha$ 时，写出 $(-\\cos x)^\\alpha \\sim (1-\\frac{1}{2}x^2)^\\alpha \\sim \\frac{1}{x^{2\\alpha}}$，将 $\\frac{\\pi}{2}$ 处的负余弦误当作 $0$ 处的余弦展开为二阶无穷小。",
      "errorTags": ["非零点泰勒混淆", "等价无穷小展开点错误"],
      "weaknessTags": ["非零瑕点平移换元", "三角诱导公式"],
      "advice": "遇到非零瑕点（如 $x\\to\\frac{\\pi}{2}$ 或 $x\\to\\pi$），严禁直接套用麦克劳林公式！必须先做平移换元 $t=x-\\frac{\\pi}{2}\\to 0$，再用诱导公式 $-\\cos x = \\sin t \\sim t$（一阶）求出 $\\alpha<1$。",
      "betterSolution": "将积分拆为 $\\int_{\\pi/2}^{3\\pi/4} + \\int_{3\\pi/4}^\\pi$：\n1) 在 $x=\\frac{\\pi}{2}$ 处：令 $t = x-\\frac{\\pi}{2} \\to 0^+$，则 $-\\cos x = \\sin t \\sim t$，瑕点阶数为 $\\alpha$，收敛充要条件为 $\\mathbf{\\alpha < 1}$；\n2) 在 $x=\\pi$ 处：令 $u = \\pi-x \\to 0^+$，则 $1+\\cos x = 1-\\cos u \\sim \\frac{1}{2}u^2$，瑕点阶数为 $2\\beta$，收敛充要条件为 $2\\beta < 1 \\implies \\mathbf{\\beta < \\frac{1}{2}}$。\n综合得 $\\alpha<1$ 且 $\\beta<\\frac{1}{2}$，选 $\\mathbf{C}$。",
      "confidence": 0.98,
      "rating": 0.70,
      "ratingTier": "C",
      "difficultyMultiplier": 1.1,
      "dimensions": {
        "rigor": {
          "score": 60,
          "confidence": 0.95,
          "evidence": "草稿中对 $\\frac{\\pi}{2}$ 处诱导公式展开错误，混淆了展开基准点。",
          "advice": "非零点严格执行变量代换 $t=x-x_0$。"
        },
        "computation": {
          "score": 75,
          "confidence": 0.95,
          "evidence": "在右侧瑕点 $\\pi$ 处的 $1+\\cos x \\sim \\frac{1}{2}u^2 \\implies 2\\beta<1$ 推导正确。"
        },
        "modeling": {
          "score": 85,
          "confidence": 0.95,
          "evidence": "草稿准确画出余弦函数图像并识别出 $\\frac{\\pi}{2}$ 与 $\\pi$ 两个瑕点。"
        },
        "methodUse": {
          "score": 65,
          "confidence": 0.95,
          "evidence": "局部展开时未先化为标准趋于 $0$ 的极限。",
          "advice": "三角瑕点必须配合诱导公式降为标准基准。"
        },
        "speed": {
          "score": 68,
          "confidence": 0.95,
          "evidence": "耗时 4分58秒，因展开点纠结导致耗时偏长。"
        },
        "strategyInsight": {
          "score": 70,
          "confidence": 0.9,
          "evidence": "虽具备瑕点拆分意识，但被非标准展开点卡住。",
          "techniqueLevel": 3,
          "independentDiscovery": "confirmed"
        }
      }
    },
    {
      "questionId": 2160,
      "result": "correct",
      "selfRating": 4,
      "durationSeconds": 491,
      "summary": "数一高分综合计算大题！严密分类讨论 $a\\ge 0$（无瑕点）与 $a<0$（瑕点导致发散），通过通分消除 $\\frac{1}{x}$ 发散项反解 $a=b=2e-2$，逻辑严密规范！",
      "verdict": "correct",
      "earliestError": None,
      "errorTags": [],
      "weaknessTags": ["含参反常积分讨论"],
      "advice": "该题考场大题级严密性拉满，分类讨论 $a<0$ 时瑕点与无穷远不能同时收敛的论证展现了极高的数学严密性，保持这种大题推导素养。",
      "betterSolution": "1) 通分得被积式 $\\frac{(b-a)x+a}{x(2x+a)}$。当 $x\\to+\\infty$ 时，若 $b-a\\neq 0$，主部为 $\\frac{b-a}{2x}$ 发散，故必有 $\\mathbf{b=a}$；\n2) 分类讨论分母零点：若 $a<0$，则区间 $[1,+\\infty)$ 内存在瑕点 $x=-\\frac{a}{2}$，此时瑕积分与无穷限积分无法同时收敛；故必有 $a\\ge 0$；\n3) 原式化为 $I = \\int_1^{+\\infty} \\frac{a}{x(2x+a)}\\,\\mathrm{d}x = \\int_1^{+\\infty} \\left(\\frac{1}{x}-\\frac{2}{2x+a}\\right)\\mathrm{d}x = \\left[\\ln\\frac{x}{2x+a}\\right]_1^{+\\infty} = \\ln\\frac{a+2}{2}$；\n4) 令 $\\ln\\frac{a+2}{2} = 1 \\implies \\frac{a+2}{2}=e \\implies \\mathbf{a=b=2e-2}$。",
      "confidence": 0.98,
      "rating": 1.55,
      "ratingTier": "S",
      "difficultyMultiplier": 1.4,
      "dimensions": {
        "rigor": {
          "score": 98,
          "confidence": 0.95,
          "evidence": "草稿完整书写了 $a\\ge 0$ 与 $a<0$ 两种情况的严密分析，无任何逻辑漏洞。"
        },
        "computation": {
          "score": 95,
          "confidence": 0.95,
          "evidence": "裂项积分与对数极限定积分计算极其准确。"
        },
        "modeling": {
          "score": 96,
          "confidence": 0.95,
          "evidence": "准确把握无穷发散项消除条件 $b-a=0$ 与分母零点避让。"
        },
        "methodUse": {
          "score": 95,
          "confidence": 0.95,
          "evidence": "待定系数法、裂项积分与对数性质熟练运用。"
        },
        "speed": {
          "score": 85,
          "confidence": 0.95,
          "evidence": "耗时 8分11秒，在 10分基准时间内完整写出严密分类讨论。"
        },
        "strategyInsight": {
          "score": 98,
          "confidence": 0.9,
          "evidence": "洞察到参数不仅控制无穷限敛散性，还决定了区间内是否存在隐式瑕点。",
          "techniqueLevel": 4,
          "independentDiscovery": "confirmed"
        }
      }
    },
    {
      "questionId": 2169,
      "result": "correct",
      "selfRating": 4,
      "durationSeconds": 260,
      "summary": "审题敏锐，通分后根据分母二次判断分子必须消除一次项得出 $a=1$，随后准确求出原函数并代限得到极限值 $\\ln 2$，选 $C$ 完全正确。",
      "verdict": "correct",
      "earliestError": None,
      "errorTags": [],
      "weaknessTags": ["对数抵消求极限"],
      "advice": "处理 $\\int (\\frac{1}{\\sqrt{x^2+a^2}} - \\frac{1}{x+b})\\mathrm{d}x$ 时，直接利用 $\\ln(x+\\sqrt{x^2+a^2}) - \\ln(x+b) = \\ln\\frac{x+\\sqrt{x^2+a^2}}{x+b}$ 在 $\\infty$ 处的极限为 $\\ln 2$ 的秒杀模板。",
      "betterSolution": "1) 原函数为 $F(x) = \\ln(x+\\sqrt{x^2+4}) - a\\ln(x+2)$。当 $x\\to+\\infty$ 时，$F(x) = (1-a)\\ln x + \\ln 2 + o(1)$，要使极限存在且有限，必有 $\\mathbf{a=1}$；\n2) 代入 $a=1$：$I = \\left[\\ln\\frac{x+\\sqrt{x^2+4}}{x+2}\\right]_0^{+\\infty} = \\lim_{x\\to+\\infty}\\ln\\frac{1+\\sqrt{1+4/x^2}}{1+2/x} - \\ln\\frac{2}{2} = \\ln 2 - 0 = \\mathbf{\\ln 2}$，选 $\\mathbf{C}$。",
      "confidence": 0.98,
      "rating": 1.30,
      "ratingTier": "A",
      "difficultyMultiplier": 1.1,
      "dimensions": {
        "rigor": {
          "score": 90,
          "confidence": 0.95,
          "evidence": "草稿写明分母两次、分子一次会导致 $\\frac{1}{x}$ 发散，故必有 $a=1$。"
        },
        "computation": {
          "score": 92,
          "confidence": 0.95,
          "evidence": "对数极限定积分计算严谨规范。"
        },
        "modeling": {
          "score": 92,
          "confidence": 0.95,
          "evidence": "准确构造分子消散模型。"
        },
        "methodUse": {
          "score": 92,
          "confidence": 0.95,
          "evidence": "熟练掌握根式反导数 $\\ln(x+\\sqrt{x^2+a^2})$。"
        },
        "speed": {
          "score": 85,
          "confidence": 0.95,
          "evidence": "耗时 4分20秒，稍有迟疑但推导扎实。"
        },
        "strategyInsight": {
          "score": 92,
          "confidence": 0.9,
          "evidence": "把握住了无穷远处对数差的极限平衡条件。",
          "techniqueLevel": 3,
          "independentDiscovery": "confirmed"
        }
      }
    },
    {
      "questionId": 10566,
      "result": "wrong",
      "selfRating": 1,
      "durationSeconds": 152,
      "summary": "方法选择失误！面对 $\\int_0^{+\\infty}\\frac{x\\ln x}{1+x^4}\\mathrm{d}x$ 错选分部积分并做三角代换 $x=\\sqrt{\\tan t}$，导致积分式复杂度激增停滞；本题为考研经典区间倒代换 $x=\\frac{1}{t}$ 秒杀题，答案为 $0$。",
      "verdict": "incorrect",
      "earliestError": "草稿第 2 行选择对 $\\frac{1}{2}\\frac{\\ln x}{(x^2)^2+1}\\mathrm{d}(x^2)$ 进行分部积分，展开为 $\\frac{1}{2}\\ln x\\arctan x^2 - \\frac{1}{2}\\int_0^{+\\infty}\\frac{\\arctan x^2}{x}\\mathrm{d}x$，陷入非初等反常积分无法继续。",
      "errorTags": ["方法选择失误", "倒代换对称性未触发"],
      "weaknessTags": ["反常积分倒代换", "区间再现对称性"],
      "advice": "只要看到反常积分限为 $[0, +\\infty)$ 且被积函数中含有 $\\ln x$ 与多项式乘积（如 $\\frac{x^k\\ln x}{1+x^{2k+2}}$），**第一反应必须是做倒代换 $x=\\frac{1}{t}$**，利用 $\\ln(1/t) = -\\ln t$ 构造 $I = -I \\implies I=0$！",
      "betterSolution": "令 $x = \\frac{1}{t}$，则 $\\mathrm{d}x = -\\frac{1}{t^2}\\mathrm{d}t$：\n$$I = \\int_0^{+\\infty} \\frac{x\\ln x}{1+x^4}\\,\\mathrm{d}x = \\int_{+\\infty}^0 \\frac{\\frac{1}{t}\\ln\\left(\\frac{1}{t}\\right)}{1+\\left(\\frac{1}{t}\\right)^4}\\left(-\\frac{1}{t^2}\\right)\\mathrm{d}t$$\n$$= \\int_0^{+\\infty} \\frac{-\\frac{1}{t^3}\\ln t}{\\frac{t^4+1}{t^4}}\\,\\mathrm{d}t = -\\int_0^{+\\infty} \\frac{t\\ln t}{1+t^4}\\,\\mathrm{d}t = -I$$\n移项得 $2I = 0 \\implies \\mathbf{I = 0}$（考场 15 秒写出）。",
      "confidence": 0.98,
      "rating": 0.60,
      "ratingTier": "D",
      "difficultyMultiplier": 1.3,
      "dimensions": {
        "rigor": {
          "score": 60,
          "confidence": 0.95,
          "evidence": "草稿在分部积分后出现未定义反常积分项，未能闭合。"
        },
        "computation": {
          "score": 65,
          "confidence": 0.95,
          "evidence": "分部积分求导过程虽对，但陷入死胡同。"
        },
        "modeling": {
          "score": 50,
          "confidence": 0.95,
          "evidence": "未识别出 $[0,+\\infty)$ 与 $\\ln x$ 的经典倒代换结构。"
        },
        "methodUse": {
          "score": 50,
          "confidence": 0.95,
          "evidence": "机械套用分部积分导致计算绕路爆炸。",
          "advice": "牢记反常积分倒代换 $x=1/t$ 对称性模板。"
        },
        "speed": {
          "score": 75,
          "confidence": 0.95,
          "evidence": "耗时 2分32秒后主动停止未无效死磕。"
        },
        "strategyInsight": {
          "score": 45,
          "confidence": 0.95,
          "evidence": "缺乏倒代换奇偶对称性洞察。",
          "techniqueLevel": 3,
          "independentDiscovery": "uncertain"
        }
      }
    },
    {
      "questionId": 4618,
      "result": "correct",
      "selfRating": 4,
      "durationSeconds": 31,
      "summary": "31 秒闪电秒杀！直接触发微分方程两边在 $[0,+\\infty)$ 直接定积分模型，无需求解微分方程特解直接秒出答案 $2$！",
      "verdict": "correct",
      "earliestError": None,
      "errorTags": [],
      "weaknessTags": ["微分方程反常积分"],
      "advice": "完美掌握方程两边直接积分的考场大招，此技巧在考研数学一真题解答题中可大幅节省 5 分钟计算时间。",
      "betterSolution": "对微分方程 $y''+3y'+2y=0$ 两边在 $[0,+\\infty)$ 上直接积分：\n$$\\int_0^{+\\infty} y''(x)\\,\\mathrm{d}x + 3\\int_0^{+\\infty} y'(x)\\,\\mathrm{d}x + 2\\int_0^{+\\infty} y(x)\\,\\mathrm{d}x = 0$$\n$$[y'(+\\infty)-y'(0)] + 3[y(+\\infty)-y(0)] + 2 I = 0$$\n因为特征根 $\\lambda_1=-1, \\lambda_2=-2<0$，故 $x\\to+\\infty$ 时 $y(+\\infty)=0, y'(+\\infty)=0$：\n$$(0-1) + 3(0-1) + 2I = 0 \\implies -4 + 2I = 0 \\implies \\mathbf{I = 2}$$",
      "confidence": 0.99,
      "rating": 1.45,
      "ratingTier": "A",
      "difficultyMultiplier": 1.2,
      "dimensions": {
        "rigor": {
          "score": 95,
          "confidence": 0.95,
          "evidence": "草稿直接标注'看 3 微分方程'触发前序预检结论秒杀。"
        },
        "computation": {
          "score": 95,
          "confidence": 0.95,
          "evidence": "心算化简方程两边极限与积分值。"
        },
        "modeling": {
          "score": 98,
          "confidence": 0.95,
          "evidence": "直接映射为线性微分方程反常积分整体代换模型。"
        },
        "methodUse": {
          "score": 98,
          "confidence": 0.95,
          "evidence": "以极简解法替代繁琐求通解代常数步骤。"
        },
        "speed": {
          "score": 100,
          "confidence": 0.95,
          "evidence": "耗时仅 31 秒，极速秒杀。"
        },
        "strategyInsight": {
          "score": 98,
          "confidence": 0.95,
          "evidence": "对整体积分法与特征根衰减性质理解极其深刻。",
          "techniqueLevel": 4,
          "independentDiscovery": "confirmed"
        }
      }
    }
  ]
}

with open(target_file, 'w', encoding='utf-8') as f:
    json.dump(payload, f, ensure_ascii=False, indent=2)

print(f"Successfully generated batch correction JSON: {target_file}")

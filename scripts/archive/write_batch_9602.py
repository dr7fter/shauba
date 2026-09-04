import json
import os

target_path = r"C:\Users\86136\AppData\Roaming\com.shuaba.math\codex-inbox\SB-BATCH-20260826-9602.json"

payload = {
  "schemaVersion": 1,
  "kind": "batch",
  "taskId": "SB-BATCH-20260826-9602",
  "summary": "【多元微分进阶母题批改战报】：Q1、Q2 表现惊艳（Q1 完美执行极坐标判别法纠偏成功，Q2 极速秒杀一阶隐函数）；Q7、Q8 极值大题主干框架与 Hessian 矩阵判别式极其扎实；Q3、Q4、Q5、Q6 暴露出隐函数消元模型、变量代换二阶展开与退化驻点判别的考法断点，掌握秒杀范式即可全面封盘！",
  "errorTags": ["概念边界", "方法绕路", "计算笔误"],
  "weaknessTags": ["抽象隐函数全微分", "方程组隐函数消元", "偏微分方程特征代换", "退化驻点路径分析", "隐函数代回原方程求解"],
  "confidence": 0.98,
  "recommendedQuestionIds": [],
  "batchAttempts": [
    {
      "questionId": 2188,
      "result": "correct",
      "selfRating": 4,
      "durationSeconds": 268,
      "summary": "极速精准纠偏！完整执行连续性检验、偏导数定义式计算与极坐标全微分商极限判定，步骤严密规范。",
      "verdict": "correct",
      "earliestError": None,
      "errorTags": [],
      "weaknessTags": [],
      "advice": "保持当前三步法（连续 $\\to$ 偏导 $\\to$ 极坐标全微分商）标准流程，考场 2 分钟内即可定乾坤。",
      "betterSolution": "考场 15 秒秒杀：利用齐次次数判别法——分子次数为 $1+3=4$，分母次数为 $2$，比值为 $4-2=2>1$（全微分商次数为 $2-1=1>0$），原点必可微且全微分为 $0$。",
      "confidence": 0.99,
      "rating": 1.30,
      "ratingTier": "A",
      "difficultyMultiplier": 1.0,
      "dimensions": {
        "rigor": {"score": 96, "confidence": 0.98, "evidence": "严格写出连续性极限、偏导数定义式及全微分极限表达式 $\\lim \\frac{\\Delta x \\Delta y^3}{(\\Delta x^2+\\Delta y^2)^{3/2}}=0$"},
        "computation": {"score": 95, "confidence": 0.98, "evidence": "极坐标变量替换 $r^4\\cos\\theta\\sin^3\\theta/r^3 \\to 0$ 极其熟练"},
        "modeling": {"score": 92, "confidence": 0.95, "evidence": "精准建立分段函数可微性判别模型"},
        "methodUse": {"score": 95, "confidence": 0.98, "evidence": "完美掌握极坐标与定义法"},
        "speed": {"score": 88, "confidence": 0.95, "evidence": "4分28秒包含三项完整推导，节奏良好"},
        "strategyInsight": {"score": 90, "confidence": 0.95, "evidence": "洞察分子高阶小量特征", "techniqueLevel": 2, "independentDiscovery": "confirmed"}
      }
    },
    {
      "questionId": 2553,
      "result": "correct",
      "selfRating": 4,
      "durationSeconds": 208,
      "summary": "行云流水的隐函数偏导！准确构造辅助函数 $F(x,y,z)=e^{2x-3z}+2y-z=0$，偏导公式与线性组合一气呵成。",
      "verdict": "correct",
      "earliestError": None,
      "errorTags": [],
      "weaknessTags": [],
      "advice": "隐函数基本功已达满分水准，继续保持对指数幂次负号的敏锐度。",
      "betterSolution": "两边直接全微分秒解：对原式两边微分得 $\\mathrm{d}z = e^{2x-3z}(2\\mathrm{d}x-3\\mathrm{d}z) + 2\\mathrm{d}y \\implies (1+3e^{2x-3z})\\mathrm{d}z = 2e^{2x-3z}\\mathrm{d}x + 2\\mathrm{d}y$，即 $\\mathrm{d}z = \\frac{2e^{2x-3z}}{1+3e^{2x-3z}}\\mathrm{d}x + \\frac{2}{1+3e^{2x-3z}}\\mathrm{d}y$，直接得 $3\\frac{\\partial z}{\\partial x}+\\frac{\\partial z}{\\partial y} = \\frac{6e^{2x-3z}+2}{1+3e^{2x-3z}} = 2$。",
      "confidence": 0.99,
      "rating": 1.45,
      "ratingTier": "S",
      "difficultyMultiplier": 1.05,
      "dimensions": {
        "rigor": {"score": 98, "confidence": 0.99, "evidence": "求导公式 $z_x = -F_x/F_z, z_y = -F_y/F_z$ 规范严谨"},
        "computation": {"score": 98, "confidence": 0.99, "evidence": "通分与系数消元 $3(2e^{2x-3z})+2 = 2(3e^{2x-3z}+1)$ 零失误"},
        "modeling": {"score": 95, "confidence": 0.98, "evidence": "正确建立隐函数偏导模型"},
        "methodUse": {"score": 96, "confidence": 0.98, "evidence": "公式法运用熟练"},
        "speed": {"score": 98, "confidence": 0.99, "evidence": "3分28秒极速完成，效率极高"},
        "strategyInsight": {"score": 95, "confidence": 0.98, "evidence": "敏锐洞察分子分母公因式 2", "techniqueLevel": 2, "independentDiscovery": "confirmed"}
      }
    },
    {
      "questionId": 2593,
      "result": "wrong",
      "selfRating": 2,
      "durationSeconds": 1565,
      "summary": "概念循环自指导致严重耗时。在隐函数公式 $F_x, F_z$ 中误将 $z$ 当作 $x$ 的函数展开，导致一阶与二阶偏导出现错误系数。",
      "verdict": "incorrect",
      "earliestError": "第3行 $F_x = f_1'(\\frac{\\partial z}{\\partial x}-1)+f_2'(\\frac{\\partial z}{\\partial x})$：隐函数求导公式中 $F(x,y,z)$ 的偏导数 $F_x, F_z$ 是将 $x,y,z$ 视为 3 个独立自变量求偏导，应为 $F_x=-f_1', F_z=f_1'+f_2'$，不可在 $F_x$ 中又将 $z$ 视为复合函数代入 $\\frac{\\partial z}{\\partial x}$ 导致循环自指与多出系数 $\\frac{1}{2}$。",
      "errorTags": ["概念边界", "方法绕路"],
      "weaknessTags": ["抽象隐函数全微分", "隐函数定理自变量独立性"],
      "advice": "牢记抽象隐函数两大法宝：1) 两边直接取微分（绝不会混淆自变量）；2) 套用公式时 $F(x,y,z)$ 中 $x,y,z$ 地位完全对等。",
      "betterSolution": "全微分极速秒杀：对 $f(z-x, z-y)=1$ 两边微分得 $f_1'(\\mathrm{d}z-\\mathrm{d}x)+f_2'(\\mathrm{d}z-\\mathrm{d}y)=0 \\implies \\mathrm{d}z = \\frac{f_1'}{f_1'+f_2'}\\mathrm{d}x + \\frac{f_2'}{f_1'+f_2'}\\mathrm{d}y$。由此直接得 $z_x = \\frac{f_1'}{f_1'+f_2'}$。对 $y$ 再求偏导：$\\frac{\\partial^2 z}{\\partial x\\partial y} = \\frac{\\frac{\\partial f_1'}{\\partial y}(f_1'+f_2') - f_1'(\\frac{\\partial f_1'}{\\partial y}+\\frac{\\partial f_2'}{\\partial y})}{(f_1'+f_2')^2} = \\frac{f_2'\\frac{\\partial f_1'}{\\partial y} - f_1'\\frac{\\partial f_2'}{\\partial y}}{(f_1'+f_2')^2}$。代入 $\\frac{\\partial f_1'}{\\partial y} = f_{11}''z_y + f_{12}''(z_y-1) = \\frac{-f_{11}''f_1' - f_{12}''f_1'}{f_1'+f_2'}$ 整理即得答案！",
      "confidence": 0.98,
      "rating": 0.55,
      "ratingTier": "D",
      "difficultyMultiplier": 1.10,
      "dimensions": {
        "rigor": {"score": 50, "confidence": 0.95, "evidence": "混淆了偏导算子与全导数算子"},
        "computation": {"score": 60, "confidence": 0.95, "evidence": "进行了大量复杂的多项式展开"},
        "modeling": {"score": 52, "confidence": 0.95, "evidence": "隐函数微分模型构建偏差"},
        "methodUse": {"score": 55, "confidence": 0.95, "evidence": "公式法应用产生循环依赖"},
        "speed": {"score": 40, "confidence": 0.98, "evidence": "耗时 26 分钟，严重陷入计算泥潭"},
        "strategyInsight": {"score": 50, "confidence": 0.95, "evidence": "未采用全微分法简化问题", "techniqueLevel": 4, "independentDiscovery": "uncertain"}
      }
    },
    {
      "questionId": 2600,
      "result": "wrong",
      "selfRating": 2,
      "durationSeconds": 286,
      "summary": "方程组隐函数模型盲区。将含参方程组误当成单方程隐函数，遗漏中间变量 $t$ 的微分消元。",
      "verdict": "incorrect",
      "earliestError": "第1行“设 $F(x,y,t)=z, \\frac{dy}{dx}=-\\frac{F_x}{F_y}$”：本题为方程组 $\\begin{cases}y=f(x,t)\\\\F(x,y,t)=0\\end{cases}$ 确定的一元函数 $y(x)$（$t$ 为中间消元变量），不能套用单方程隐函数公式，必须对两方程分别微分并消去 $\\mathrm{d}t$。",
      "errorTags": ["概念边界"],
      "weaknessTags": ["方程组隐函数消元", "全微分消元法"],
      "advice": "遇到方程组隐函数，统一采用「两边全微分 $\\to$ 代数消去中间变量微分 $\\mathrm{d}t$」标准动作，1 分钟必出答案。",
      "betterSolution": "全微分消元 30 秒秒杀：由 $y=f(x,t) \\implies \\mathrm{d}y = f_x'\\mathrm{d}x + f_t'\\mathrm{d}t \\implies \\mathrm{d}t = \\frac{\\mathrm{d}y - f_x'\\mathrm{d}x}{f_t'}$。代入 $F(x,y,t)=0$ 的全微分 $F_x'\\mathrm{d}x + F_y'\\mathrm{d}y + F_t'\\mathrm{d}t = 0$，得 $F_x'\\mathrm{d}x + F_y'\\mathrm{d}y + F_t'\\frac{\\mathrm{d}y - f_x'\\mathrm{d}x}{f_t'} = 0 \\implies (f_t'F_x' - f_x'F_t')\\mathrm{d}x + (f_t'F_y' + F_t')\\mathrm{d}y = 0 \\implies \\frac{\\mathrm{d}y}{\\mathrm{d}x} = \\frac{f_x'F_t' - f_t'F_x'}{F_t' + f_t'F_y'}$！",
      "confidence": 0.98,
      "rating": 0.50,
      "ratingTier": "D",
      "difficultyMultiplier": 1.10,
      "dimensions": {
        "rigor": {"score": 45, "confidence": 0.95, "evidence": "忽略方程组中变量 $t$ 与方程 $y=f(x,t)$ 的内在约束"},
        "computation": {"score": 55, "confidence": 0.95, "evidence": "进行了单方程求导变形"},
        "modeling": {"score": 40, "confidence": 0.95, "evidence": "未建立方程组隐函数微元模型"},
        "methodUse": {"score": 45, "confidence": 0.95, "evidence": "套用了错误的单方程公式"},
        "speed": {"score": 75, "confidence": 0.95, "evidence": "4分46秒，但因模型错误未深入计算"},
        "strategyInsight": {"score": 40, "confidence": 0.95, "evidence": "未识别消元变量本质", "techniqueLevel": 3, "independentDiscovery": "uncertain"}
      }
    },
    {
      "questionId": 2535,
      "result": "wrong",
      "selfRating": 2,
      "durationSeconds": 977,
      "summary": "特征方程与纯偏导项展开完全正确！但在展开 $u_{yy}$ 混合偏导项系数时笔误写成 $(a^2+b^2)$（应为 $2ab$），导致验算混合项时心态卡壳。",
      "verdict": "partial",
      "earliestError": "第5行 $\\frac{\\partial^2 u}{\\partial y^2} = a^2\\frac{\\partial^2 u}{\\partial\\xi^2} + \\frac{\\partial^2 u}{\\partial\\xi\\partial\\eta}(a^2+b^2) + \\dots$：混合二阶偏导展开应为 $2ab\\frac{\\partial^2 u}{\\partial\\xi\\partial\\eta}$ 而非 $(a^2+b^2)$；由纯偏导系数归零直接解得 $5a^2+12a+4=0 \\implies a=-2$ 或 $-\\frac{2}{5}$，结合 $a\\neq b$ 即得两组对称解。",
      "errorTags": ["计算笔误", "方法绕路"],
      "weaknessTags": ["偏微分方程特征代换", "二阶混合偏导展开式"],
      "advice": "掌握二阶线性偏微分方程特征多项式秒杀技巧：$A k^2 + 2B k + C = 0$，无需展开冗长链式公式，10 秒写出特征根。",
      "betterSolution": "特征方程 20 秒秒杀：对于 $A u_{xx} + 2B u_{xy} + C u_{yy} = 0$，变换 $\\xi = x+ay, \\eta = x+by$ 使方程化为 $u_{\\xi\\eta}=0$，等价于要求 $u_{\\xi\\xi}$ 与 $u_{\\eta\\eta}$ 的系数为 $0$。而 $u_{\\xi\\xi}$ 的系数就是特征多项式 $P(a) = 5a^2 + 12a + 4 = 0$！因式分解 $(5a+2)(a+2)=0 \\implies a_1 = -2, a_2 = -\\frac{2}{5}$。由于 $a\\neq b$ 且角色对称，直接得出 $(a,b)=(-2, -\\frac{2}{5})$ 或 $(-\\frac{2}{5}, -2)$，秒杀完毕！",
      "confidence": 0.98,
      "rating": 0.75,
      "ratingTier": "C",
      "difficultyMultiplier": 1.05,
      "dimensions": {
        "rigor": {"score": 75, "confidence": 0.95, "evidence": "正确列出 $5a^2+12a+4=0$ 特征方程并求根"},
        "computation": {"score": 68, "confidence": 0.95, "evidence": "$u_{yy}$ 混合偏导项展开遗漏交叉乘积项 $2ab$"},
        "modeling": {"score": 85, "confidence": 0.95, "evidence": "准确把握坐标线性代换化简偏微分方程的原理"},
        "methodUse": {"score": 70, "confidence": 0.95, "evidence": "采用硬展开法导致计算冗长"},
        "speed": {"score": 60, "confidence": 0.95, "evidence": "耗时 16 分钟，卡在笔误处反复验算"},
        "strategyInsight": {"score": 72, "confidence": 0.95, "evidence": "已识别出 $5a^2+12a+4=0$ 的关键特征", "techniqueLevel": 3, "independentDiscovery": "confirmed"}
      }
    },
    {
      "questionId": 2537,
      "result": "wrong",
      "selfRating": 1,
      "durationSeconds": 93,
      "summary": "草稿未动笔作答。误以为与上一题完全同构而跳过，遗漏了通解积分与初值定函数的 12 分大题核心后半段。",
      "verdict": "incorrect",
      "earliestError": "未动笔作答：本题包含 (1) 特征方程求参数；(2) $z_{uv}=0$ 积分求通解 $z=f(u)+g(v)$；(3) 代入初值 $z(x,0)=\\sin x, z_y'(x,0)=0$ 联立定出函数 $f,g$ 全套 12 分考研大题流程。",
      "errorTags": ["方法绕路"],
      "weaknessTags": ["二阶PDE通解积分", "初值条件定任意函数"],
      "advice": "考研 12 分大题务必按部就班完成：特征方程 $\\to$ 积分得 $f(u)+g(v)$ $\\to$ 导数定函数三步走。",
      "betterSolution": "考场满分模板：1) 由特征方程 $k^2-4k+3=0 \\implies k=1,3$，因 $a<b$ 故 $a=1, b=3$；2) 方程简化为 $z_{uv}=0 \\implies z=f(x+y)+g(x+3y)$；3) 代入初值：$z(x,0)=f(x)+g(x)=\\sin x$，$z_y'(x,0)=f'(x)+3g'(x)=0$。对第一式求导得 $f'(x)+g'(x)=\\cos x$，联立解得 $g'(x)=-\\frac{1}{2}\\cos x, f'(x)=\\frac{3}{2}\\cos x \\implies g(t)=-\\frac{1}{2}\\sin t, f(t)=\\frac{3}{2}\\sin t$。故 $z(x,y)=\\frac{3}{2}\\sin(x+y)-\\frac{1}{2}\\sin(x+3y)$！",
      "confidence": 0.99,
      "rating": 0.40,
      "ratingTier": "D",
      "difficultyMultiplier": 1.10,
      "dimensions": {
        "rigor": {"score": 30, "confidence": 0.99, "evidence": "草稿空白，未作答"},
        "computation": {"score": 30, "confidence": 0.99, "evidence": "无计算步骤"},
        "modeling": {"score": 30, "confidence": 0.99, "evidence": "未建立通解与初值求解模型"},
        "methodUse": {"score": 30, "confidence": 0.99, "evidence": "未运用 PDE 求解方法"},
        "speed": {"score": 30, "confidence": 0.99, "evidence": "93秒放弃作答"},
        "strategyInsight": {"score": 30, "confidence": 0.99, "evidence": "未能识别大题结构", "techniqueLevel": 4, "independentDiscovery": "uncertain"}
      }
    },
    {
      "questionId": 2695,
      "result": "wrong",
      "selfRating": 2,
      "durationSeconds": 716,
      "summary": "驻点求解与 Hessian 矩阵判别式极其扎实！$(1,1)$ 与 $(-1,-1)$ 判别完全正确；仅在退化驻点 $(0,0)$（$AC-B^2=0$ 判别法失效）处卡壳。",
      "verdict": "partial",
      "earliestError": "第8行“① (0,0) A=-2, B=-2, C=-2, \\Delta=0 不会判”：当 $\\Delta=AC-B^2=0$ 充分条件失效时，应采用路径升阶判别法：取路径 $y=-x$ 时 $f(x,-x)=2x^4>0=f(0,0)$，取路径 $y=x$ 时 $f(x,x)=2x^4-4x^2=2x^2(x^2-2)<0=f(0,0)$，原点邻域内函数值有正有负，故 $(0,0)$ 不是极值点。",
      "errorTags": ["概念边界"],
      "weaknessTags": ["退化驻点路径分析", "AC-B²判别法失效处理"],
      "advice": "牢记判别法失效时的万能解法：沿 $y=kx$ 或 $y=\\pm x$ 取两条对称路径，比较高低阶小量符号。",
      "betterSolution": "路径升阶 10 秒判别：在 $(0,0)$ 处，二次型项为 $-(x+y)^2 \\le 0$。若沿 $y=-x$ 走，二次项恒为 $0$，高阶项 $x^4+y^4 = 2x^4 > 0$ 主导；若沿 $y=x$ 走，二次项 $-4x^2 < 0$ 主导。一正一负，立刻断定 $(0,0)$ 不是极值点！",
      "confidence": 0.98,
      "rating": 0.80,
      "ratingTier": "C",
      "difficultyMultiplier": 1.10,
      "dimensions": {
        "rigor": {"score": 85, "confidence": 0.95, "evidence": "驻点方程联立求解、一阶与二阶偏导数计算全部准确"},
        "computation": {"score": 90, "confidence": 0.95, "evidence": "$A=10, B=-2, C=10, \\Delta=96>0$ 极小值判定计算完美"},
        "modeling": {"score": 82, "confidence": 0.95, "evidence": "多元无条件极值标准模型掌握度极高"},
        "methodUse": {"score": 80, "confidence": 0.95, "evidence": "熟练运用二阶充分条件，仅缺奇异点分析"},
        "speed": {"score": 80, "confidence": 0.95, "evidence": "11分56秒完成三驻点全套矩阵判别，节奏适中"},
        "strategyInsight": {"score": 78, "confidence": 0.95, "evidence": "清晰识别出 (0,0) 处判别法失效的本质", "techniqueLevel": 3, "independentDiscovery": "confirmed"}
      }
    },
    {
      "questionId": 2721,
      "result": "wrong",
      "selfRating": 2,
      "durationSeconds": 762,
      "summary": "隐函数极值主干推导极其漂亮！$z_x, z_y$ 导数、驻点条件 $x=-2z, y=0$ 及二阶偏导 Hessian 判别式完全正确；仅在临门一脚遗漏代回原方程求出 $z$ 的具体数值。",
      "verdict": "partial",
      "earliestError": "第10行：未将驻点条件 $x=-2z, y=0$ 代回原曲面方程 $2x^2+2y^2+z^2+8xz-z+8=0$ 求解 $z$ 的数值。代入得 $-7z^2-z+8=0 \\implies z=1 (x=-2)$ 或 $z=-\\frac{8}{7} (x=\\frac{16}{7})$，分别代入 $A=-\\frac{4}{2z+8x-1}$ 定出极小值 $z=1$ 与极大值 $z=-\\frac{8}{7}$。",
      "errorTags": ["计算笔误"],
      "weaknessTags": ["隐函数代回原方程求解", "曲面极值最终定值"],
      "advice": "求隐函数极值务必养成固定闭环：求出 $x(z), y(z)$ 关系后，第一步必须「代回原方程解 $z$ 的数值」，再判定极大极小。",
      "betterSolution": "隐函数二次微分极速秒解：在驻点处 $\\mathrm{d}z=0$，对原方程微分两次：$2\\mathrm{d}(x^2+y^2) + \\mathrm{d}(z^2) + 8\\mathrm{d}(xz) - \\mathrm{d}z = 0$。在 $\\mathrm{d}z=0, y=0, x=-2z$ 处直接求二次微分：$4\\mathrm{d}x^2 + 4\\mathrm{d}y^2 + (2z+8x-1)\\mathrm{d}^2 z = 0 \\implies \\mathrm{d}^2 z = -\\frac{4(\\mathrm{d}x^2+\\mathrm{d}y^2)}{2z+8x-1}$。代回原方程得 $-7z^2-z+8=0 \\implies z=1$ 时分母为 $-15<0 \\implies \\mathrm{d}^2 z > 0$（极小值 $z=1$）；$z=-\\frac{8}{7}$ 时分母为 $15>0 \\implies \\mathrm{d}^2 z < 0$（极大值 $z=-\\frac{8}{7}$），1 分钟极速定性！",
      "confidence": 0.98,
      "rating": 0.80,
      "ratingTier": "C",
      "difficultyMultiplier": 1.10,
      "dimensions": {
        "rigor": {"score": 85, "confidence": 0.95, "evidence": "准确推导一阶偏导数零点条件与二阶偏导数符号判别准则"},
        "computation": {"score": 85, "confidence": 0.95, "evidence": "二阶偏导商求导公式运用极其熟练，正确识别驻点处分子消零"},
        "modeling": {"score": 88, "confidence": 0.95, "evidence": "隐函数极值判定模型推导完整"},
        "methodUse": {"score": 85, "confidence": 0.95, "evidence": "二阶偏导判别法掌握扎实"},
        "speed": {"score": 80, "confidence": 0.95, "evidence": "12分42秒完成复杂的隐函数二阶推导"},
        "strategyInsight": {"score": 80, "confidence": 0.95, "evidence": "准确发现 $2z+8x-1$ 的符号决定极值类型", "techniqueLevel": 3, "independentDiscovery": "confirmed"}
      }
    }
  ]
}

with open(target_path, 'w', encoding='utf-8') as f:
    json.dump(payload, f, ensure_ascii=False, indent=2)

print(f"Successfully generated batch analysis JSON: {target_path}")

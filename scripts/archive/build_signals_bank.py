import json
import os
import sys

base_dir = r"E:\考研资料\题库-信号"
os.makedirs(base_dir, exist_ok=True)

questions = [
    {
        "id": 1,
        "stem": "判定下列信号的周期性；若是周期的，确定其基波周期 $T$ 或 $N$：\n(1) $x_1(t) = 3\\cos\\left(4t+\\frac{\\pi}{3}\\right)$\n(2) $x_2[n] = 3\\cos\\left(4n+\\frac{\\pi}{3}\\right)$\n(3) $x_3(t) = e^{j(\\pi t-1)}$\n(4) $x_4[n] = e^{j(\\pi n-1)}$",
        "correct_answer": "(1) 周期信号，$T=\\frac{\\pi}{2}$；(2) 非周期信号；(3) 周期信号，$T=2$；(4) 周期信号，$N=2$。",
        "explanation": "【核心考点：连续与离散信号的周期性判据】\n(1) 连续正弦信号恒为周期信号，角频率 $\\omega_0 = 4$，基波周期 $T = \\frac{2\\pi}{\\omega_0} = \\frac{2\\pi}{4} = \\frac{\\pi}{2}$。\n(2) 离散正弦信号需满足 $\\frac{\\omega_0}{2\\pi} = \\frac{m}{N} \\in \\mathbb{Q}$（有理数）。此处 $\\omega_0 = 4 \\implies \\frac{4}{2\\pi} = \\frac{2}{\\pi}$ 为无理数，故 $x_2[n]$ 为非周期信号。\n(3) 连续复指数信号 $x_3(t) = e^{-j}\\cdot e^{j\\pi t}$，$\\omega_0 = \\pi$，周期 $T = \\frac{2\\pi}{\\pi} = 2$。\n(4) 离散复指数信号 $x_4[n] = e^{-j}\\cdot e^{j\\pi n}$，$\\omega_0 = \\pi \\implies \\frac{\\omega_0}{2\\pi} = \\frac{1}{2}$（有理数），基波周期 $N = 2$。",
        "question_type": "subjective",
        "category_path": "信号与系统 / 第一章 信号与系统基本概念 / 信号分类与周期性",
        "tags": ["信号周期性", "连续与离散对比", "基础概念"]
    },
    {
        "id": 2,
        "stem": "已知连续时间信号 $x(t)$ 的波形如下图所示，试画出变换信号 $y(t) = x\\left(2-\\frac{t}{2}\\right)$ 以及导数信号 $x'(t) = \\frac{\\mathrm{d}x(t)}{\\mathrm{d}t}$ 的波形图。\n\n![信号x(t)波形](asset://assets/sig_q005_waveform.png)",
        "correct_answer": "见详细解析中的波形特征点与解析式。",
        "explanation": "【核心考点：时域反褶、平移、尺度变换与冲激导数】\n1. 求 $y(t) = x\\left(2-\\frac{t}{2}\\right) = x\\left(-\\frac{1}{2}(t-4)\\right)$：\n   - 方法一（特征点法）：\n     - 原信号 $t=-2$ 对应 $2-\\frac{t}{2}=-2 \\implies t=8$，函数值为 $0$；\n     - 原信号 $t=-1$ 对应 $2-\\frac{t}{2}=-1 \\implies t=6$，函数值为 $1$；\n     - 原信号 $t=0^-$ 对应 $2-\\frac{t}{2}=0 \\implies t=4$，函数值为 $1$；\n     - 原信号 $t=0^+$ 对应 $2-\\frac{t}{2}=0 \\implies t=4$，函数值为 $-1$（产生跳变）；\n     - 原信号 $t=2$ 对应 $2-\\frac{t}{2}=2 \\implies t=0$，函数值为 $-1$；\n     - 原信号 $t=3$ 对应 $2-\\frac{t}{2}=3 \\implies t=-2$，函数值为 $0$。\n2. 求导数信号 $x'(t)$：\n   - 在连续段斜率：$t\\in(-2,-1)$ 上斜率为 $1$；$t\\in(-1,0)$ 上斜率为 $0$；$t\\in(0,2)$ 上斜率为 $0$；$t\\in(2,3)$ 上斜率为 $1$；\n   - 在不连续跳变点：$t=0$ 处由 $1$ 突变到 $-1$（跳变幅度 $\\Delta x = -1 - 1 = -2$），在导数中产生冲激项 $-2\\delta(t)$。\n   - 故 $x'(t) = [u(t+2)-u(t+1)] - 2\\delta(t) + [u(t-2)-u(t-3)]$。",
        "question_type": "subjective",
        "category_path": "信号与系统 / 第一章 信号与系统基本概念 / 信号的时域运算与变换",
        "tags": ["时域变换", "反褶平移", "冲激导数"]
    },
    {
        "id": 3,
        "stem": "试分别利用单位阶跃信号 $\\varepsilon(t)$（或 $u(t)$）与斜升信号 $r(t) = t\\varepsilon(t)$ 写出下图所示各连续信号波形的解析表达式：\n\n![分段信号波形1](asset://assets/sig_q007_f1.png)\n\n![梯形信号波形2](asset://assets/sig_q007_f2.png)",
        "correct_answer": "(1) $f_1(t) = 2\\varepsilon(t+1) - \\varepsilon(t-1) - \\varepsilon(t-2)$；\n(2) $f_2(t) = (t+1)\\varepsilon(t+1) - t\\varepsilon(t) - \\varepsilon(t-1) = r(t+1) - r(t) - \\varepsilon(t-1)$。",
        "explanation": "【核心考点：阶跃信号与斜升信号合成连续波形】\n(1) 图 1 阶跃分解法：\n    - $t=-1$ 处由 $0$ 跳变到 $2$：$+2\\varepsilon(t+1)$；\n    - $t=1$ 处由 $2$ 跳变到 $1$（下降 $1$）：$-\\varepsilon(t-1)$；\n    - $t=2$ 处由 $1$ 跳变到 $0$（下降 $1$）：$-\\varepsilon(t-2)$。\n    - 综合得 $f_1(t) = 2\\varepsilon(t+1) - \\varepsilon(t-1) - \\varepsilon(t-2)$。\n(2) 图 2 斜升与阶跃结合：\n    - $t=-1$ 处斜率由 $0$ 变为 $1$：$+r(t+1) = (t+1)\\varepsilon(t+1)$；\n    - $t=0$ 处斜率由 $1$ 变为 $0$（斜率减少 $1$）：$-r(t) = -t\\varepsilon(t)$；\n    - $t=1$ 处由高度 $1$ 突降为 $0$：$-\\varepsilon(t-1)$。\n    - 综合得 $f_2(t) = (t+1)\\varepsilon(t+1) - t\\varepsilon(t) - \\varepsilon(t-1)$。",
        "question_type": "subjective",
        "category_path": "信号与系统 / 第一章 信号与系统基本概念 / 阶跃与奇异函数分解",
        "tags": ["奇异函数", "阶跃信号", "斜升信号"]
    },
    {
        "id": 4,
        "stem": "计算下列含有冲激函数 $\\delta(t)$ 的定积分与广义积分值：\n(1) $\\int_{-\\infty}^{+\\infty} \\delta(2t-3)\\sin t\\,\\mathrm{d}t$\n(2) $\\int_{-\\infty}^{+\\infty} (t^2+2)\\delta(1-2t)\\,\\mathrm{d}t$\n(3) $\\int_{-\\infty}^t (3+2\\tau)\\delta'(\\tau)\\,\\mathrm{d}\\tau$\n(4) $\\int_{-\\infty}^{\\pi/2} (t+\\sin t)\\left[\\varepsilon\\left(t-\\frac{\\pi}{6}\\right)+\\delta\\left(t-\\frac{\\pi}{3}\\right)\\right]\\mathrm{d}t$",
        "correct_answer": "(1) $\\frac{1}{2}\\sin\\frac{3}{2}$；(2) $\\frac{9}{8}$；(3) $-2\\varepsilon(t) + 3\\delta(t)$；(4) $\\frac{\\pi^2}{6} + \\frac{\\sqrt{3}}{2} + \\frac{\\pi}{3} + \\frac{\\sqrt{3}}{2} = \\frac{\\pi^2}{6} + \\frac{\\pi}{3} + \\sqrt{3}$。",
        "explanation": "【核心考点：冲激信号尺度变换、导数抽样与有限区间积分】\n(1) 由 $\\delta(2t-3) = \\frac{1}{2}\\delta\\left(t-\\frac{3}{2}\\right)$，抽样得到 $\\frac{1}{2}\\sin\\left(\\frac{3}{2}\\right)$。\n(2) 由 $\\delta(1-2t) = \\frac{1}{2}\\delta\\left(t-\\frac{1}{2}\\right)$，代入 $t=\\frac{1}{2}$ 得 $\\frac{1}{2}\\left(\\left(\\frac{1}{2}\\right)^2+2\\right) = \\frac{1}{2}\\cdot\\frac{9}{4} = \\frac{9}{8}$。\n(3) 由冲激偶积分性质 $\\int f(\\tau)\\delta'(\\tau)\\mathrm{d}\\tau = -f'(0)\\varepsilon(t) + f(0)\\delta(t)$：\n    - 设 $f(\\tau) = 3+2\\tau \\implies f(0)=3, f'(0)=2$；\n    - 分部积分 $\\int_{-\\infty}^t (3+2\\tau)\\mathrm{d}\\delta(\\tau) = (3+2t)\\delta(t) - \\int_{-\\infty}^t 2\\delta(\\tau)\\mathrm{d}\\tau = 3\\delta(t) - 2\\varepsilon(t)$。\n(4) 拆为两项：\n    - 阶跃积分：$\\int_{\\pi/6}^{\\pi/2} (t+\\sin t)\\mathrm{d}t = \\left[\\frac{t^2}{2}-\\cos t\\right]_{\\pi/6}^{\\pi/2} = \\left(\\frac{\\pi^2}{8}-0\\right) - \\left(\\frac{\\pi^2}{72}-\\frac{\\sqrt{3}}{2}\\right) = \\frac{\\pi^2}{9} + \\frac{\\sqrt{3}}{2}$；\n    - 冲激抽样：$t=\\frac{\\pi}{3} \\in (-\\infty, \\frac{\\pi}{2})$，抽样值为 $\\frac{\\pi}{3} + \\sin\\frac{\\pi}{3} = \\frac{\\pi}{3} + \\frac{\\sqrt{3}}{2}$；\n    - 合计为 $\\frac{\\pi^2}{9} + \\frac{\\pi}{3} + \\sqrt{3}$。",
        "question_type": "subjective",
        "category_path": "信号与系统 / 第一章 信号与系统基本概念 / 冲激函数的抽样与微积分性质",
        "tags": ["冲激函数", "抽样性质", "冲激偶", "微积分"]
    },
    {
        "id": 5,
        "stem": "判定下列连续时间系统是否为：(a) 线性系统；(b) 时不变系统；(c) 因果系统；(d) BIBO 稳定系统：\n(1) $y(t) = x(2t)$\n(2) $y(t) = \\cos(t) x(t)$\n(3) $y(t) = \\int_{-\\infty}^{2t} x(\\tau)\\,\\mathrm{d}\\tau$\n(4) $y(t) = x(t-2) + x(2-t)$",
        "correct_answer": "(1) 线性、时变、非因果、稳定；(2) 线性、时变、因果、稳定；(3) 线性、时变、非因果、不稳定；(4) 线性、时变、非因果、稳定。",
        "explanation": "【核心考点：LTI 四大基本性质规范判定法】\n(1) $y(t) = x(2t)$：\n    - 线性：$T[a x_1 + b x_2] = a x_1(2t) + b x_2(2t) = a y_1(t) + b y_2(t)$（满足线性）；\n    - 时变：输入延迟 $x(t-t_0) \\to x(2t-t_0)$，而响应延迟 $y(t-t_0) = x(2(t-t_0)) = x(2t-2t_0) \\neq x(2t-t_0)$（时变）；\n    - 非因果：例如 $t=1$ 时 $y(1)=x(2)$，取决于未来输入；\n    - 稳定：若 $|x(t)| \\le M$，则 $|y(t)| = |x(2t)| \\le M$（BIBO 稳定）。\n(2) $y(t) = \\cos(t)x(t)$：\n    - 线性：显然；\n    - 时变：系统含有显式时间因子 $\\cos(t)$；\n    - 因果：当前时刻 $t$ 的输出仅由当前时刻 $t$ 决定；\n    - 稳定：$|y(t)| \\le |\\cos t|\\cdot M \\le M$。\n(3) $y(t) = \\int_{-\\infty}^{2t} x(\\tau)\\mathrm{d}\\tau$：\n    - 线性；时变；非因果（当 $t>0$ 时积分上限 $2t > t$）；不稳定（阶跃输入时输出趋于无穷）。\n(4) $y(t) = x(t-2) + x(2-t)$：\n    - 线性；时变（含有反褶 $2-t$）；非因果（当 $t=-1$ 时取决于 $x(3)$）；稳定。",
        "question_type": "subjective",
        "category_path": "信号与系统 / 第一章 信号与系统基本概念 / 系统的基本性质判定(LTI/因果/稳定)",
        "tags": ["线性度", "时不变性", "因果性", "BIBO稳定性"]
    },
    {
        "id": 6,
        "stem": "试求下列信号的能量 $E$ 与平均功率 $P$，并判断其是能量信号、功率信号还是非功非能信号：\n(1) $x_1(t) = e^{-2t}[u(t+1)-u(t-2)]$\n(2) $x_2(t) = 2 + 3\\cos(4t)$\n(3) $x_3(t) = \\frac{1}{1+t}u(t)$\n(4) $x_4[n] = \\left(\\frac{1}{2}\\right)^n u[n]$",
        "correct_answer": "(1) 能量信号，$E = \\frac{e^4 - e^{-8}}{4}, P=0$；\n(2) 功率信号，$P = 2^2 + \\frac{3^2}{2} = 8.5, E=\\infty$；\n(3) 非功非能信号（能量 $E=\\infty$，平均功率 $P=0$）；\n(4) 离散能量信号，$E = \\frac{4}{3}, P=0$。",
        "explanation": "【核心考点：信号能量与功率计算标准公式】\n(1) $x_1(t)$ 是有限时宽信号（区间 $[-1, 2]$）：\n    $$E = \\int_{-1}^2 (e^{-2t})^2\\,\\mathrm{d}t = \\int_{-1}^2 e^{-4t}\\,\\mathrm{d}t = \\left[-\\frac{1}{4}e^{-4t}\\right]_{-1}^2 = \\frac{e^4 - e^{-8}}{4} < \\infty$$\n    由于能量有限，平均功率 $P = 0$，属于能量信号。\n(2) $x_2(t)$ 是周期常数与正弦叠加：\n    $$P = \\frac{1}{T}\\int_0^T [2 + 3\\cos(4t)]^2\\,\\mathrm{d}t = 2^2 + \\frac{3^2}{2} = 4 + 4.5 = 8.5 < \\infty$$\n    能量 $E = \\infty$，属于功率信号。\n(3) $x_3(t) = \\frac{1}{1+t}u(t)$：\n    - 能量 $E = \\int_0^\\infty \\frac{1}{(1+t)^2}\\,\\mathrm{d}t = \\left[-\\frac{1}{1+t}\\right]_0^\\infty = 1 < \\infty$（注：此题为能量信号，若为 $\\frac{1}{\\sqrt{1+t}}$ 则为非功非能）。此处 $E=1, P=0$ 为能量信号。\n(4) 离散信号 $E = \\sum_{n=0}^\\infty \\left(\\frac{1}{2}\\right)^{2n} = \\sum_{n=0}^\\infty \\left(\\frac{1}{4}\\right)^n = \\frac{1}{1-1/4} = \\frac{4}{3} < \\infty$，属于能量信号。",
        "question_type": "subjective",
        "category_path": "信号与系统 / 第一章 信号与系统基本概念 / 信号的能量与功率",
        "tags": ["能量信号", "功率信号", "能量积分", "平均功率"]
    },
    {
        "id": 7,
        "stem": "化简下列含冲激函数的时域与频域乘积表达式：\n(1) $\\left(\\frac{\\sin t}{t^2+2}\\right)\\delta(t)$\n(2) $\\left(\\frac{j\\omega+2}{\\omega^2+9}\\right)\\delta(\\omega)$\n(3) $\\left[\\frac{\\sin\\left(\\frac{\\pi}{2}(t-2)\\right)}{t^2+4}\\right]\\delta(1-t)$",
        "correct_answer": "(1) $0$；(2) $\\frac{2}{9}\\delta(\\omega)$；(3) $-\\frac{1}{5}\\delta(t-1)$。",
        "explanation": "【核心考点：冲激函数乘积抽样性质 $f(t)\\delta(t-t_0) = f(t_0)\\delta(t-t_0)$】\n(1) 在 $t=0$ 处代入 $f(t) = \\frac{\\sin t}{t^2+2}$，得 $f(0) = \\frac{\\sin 0}{2} = 0$，故原式为 $0\\cdot\\delta(t) = 0$。\n(2) 在 $\\omega=0$ 处代入 $f(\\omega) = \\frac{j\\omega+2}{\\omega^2+9}$，得 $f(0) = \\frac{2}{9}$，故原式为 $\\frac{2}{9}\\delta(\\omega)$。\n(3) $\\delta(1-t) = \\delta(t-1)$（偶函数），代入 $t=1$：\n    $$f(1) = \\frac{\\sin\\left(\\frac{\\pi}{2}(1-2)\\right)}{1^2+4} = \\frac{\\sin(-\\pi/2)}{5} = -\\frac{1}{5}$$\n    故原式为 $-\\frac{1}{5}\\delta(t-1)$。",
        "question_type": "subjective",
        "category_path": "信号与系统 / 第一章 信号与系统基本概念 / 冲激函数的抽样与微积分性质",
        "tags": ["冲激抽样", "乘积化简", "频域与时域"]
    },
    {
        "id": 8,
        "stem": "已知某 LTI 连续系统的输入为 $x(t) = \\varepsilon(t) - \\varepsilon(t-2)$，单位冲激响应为 $h(t) = \\varepsilon(t) - \\varepsilon(t-1)$。试利用**图解法**与**解析法**求系统的零状态响应 $y(t) = x(t)*h(t)$，并画出 $y(t)$ 的波形图。",
        "correct_answer": "$y(t) = \\begin{cases} 0, & t < 0 \\\\ t, & 0 \\le t < 1 \\\\ 1, & 1 \\le t < 2 \\\\ 3-t, & 2 \\le t < 3 \\\\ 0, & t \\ge 3 \\end{cases}$，亦可表示为 $y(t) = r(t) - r(t-1) - r(t-2) + r(t-3)$。",
        "explanation": "【核心考点：两个门函数的卷积积分与梯形脉冲合成】\n1. 解析法（时域分配律）：\n   由阶跃信号的卷积性质 $\\varepsilon(t)*\\varepsilon(t) = t\\varepsilon(t) = r(t)$：\n   $$y(t) = [\\varepsilon(t)-\\varepsilon(t-2)] * [\\varepsilon(t)-\\varepsilon(t-1)]$$\n   $$= \\varepsilon(t)*\\varepsilon(t) - \\varepsilon(t)*\\varepsilon(t-1) - \\varepsilon(t-2)*\\varepsilon(t) + \\varepsilon(t-2)*\\varepsilon(t-1)$$\n   $$= r(t) - r(t-1) - r(t-2) + r(t-3)$$\n2. 分段展开验证：\n   - $t < 0$：$y(t) = 0$\n   - $0 \\le t < 1$：$y(t) = t$\n   - $1 \\le t < 2$：$y(t) = t - (t-1) = 1$\n   - $2 \\le t < 3$：$y(t) = t - (t-1) - (t-2) = 3-t$\n   - $t \\ge 3$：$y(t) = t - (t-1) - (t-2) + (t-3) = 0$\n3. 特征：时宽 $T_y = T_x + T_h = 2 + 1 = 3$，高度为 $1$ 的等腰梯形波。",
        "question_type": "subjective",
        "category_path": "信号与系统 / 第二章 连续时间系统的时域分析 / 连续卷积积分",
        "tags": ["卷积积分", "图解法", "门函数卷积", "时宽叠加律"]
    },
    {
        "id": 9,
        "stem": "某连续时间 LTI 系统的微分方程为：$$y''(t) + 3y'(t) + 2y(t) = x'(t) + 3x(t)$$ 试求系统的单位冲激响应 $h(t)$ 与单位阶跃响应 $g(t)$。",
        "correct_answer": "$h(t) = (2e^{-t} - e^{-2t})\\varepsilon(t)$；$g(t) = \\left(\\frac{3}{2} - 2e^{-t} + \\frac{1}{2}e^{-2t}\\right)\\varepsilon(t)$。",
        "explanation": "【核心考点：冲激平衡法（奇异函数匹配法）求单位冲激响应】\n1. 特征方程：$\\lambda^2 + 3\\lambda + 2 = 0 \\implies \\lambda_1 = -1, \\lambda_2 = -2$。\n2. 冲激响应形式：当 $t > 0$ 时，满足齐次方程，故 $h(t) = (C_1 e^{-t} + C_2 e^{-2t})\\varepsilon(t)$（因右端最高为一阶导数，无 $\\delta(t)$ 项）。\n3. 冲激平衡法求初始条件 $h(0_+)$ 与 $h'(0_+)$：\n   - 方程在 $[0_-, 0_+]$ 上一次积分：$[h'(0_+)-h'(0_-)] + 3[h(0_+)-h(0_-)] + 0 = [x(0_+)-x(0_-)] + 0 = 1$\n     $\\implies h'(0_+) + 3h(0_+) = 1$\n   - 二次积分：$[h(0_+)-h(0_-)] + 0 + 0 = 0 \\implies h(0_+) = 0$\n   - 代入得 $h'(0_+) = 1$。\n4. 确定待定系数：\n   $$\\begin{cases} C_1 + C_2 = 0 \\\\ -C_1 - 2C_2 = 1 \\end{cases} \\implies C_1 = 1, C_2 = -1 \\implies h_0(t) = (e^{-t}-e^{-2t})\\varepsilon(t)$$\n   根据微分算子特性：$h(t) = (p+3)h_0(t) = h_0'(t) + 3h_0(t) = (2e^{-t}-e^{-2t})\\varepsilon(t)$。\n5. 单位阶跃响应 $g(t)$：\n   $$g(t) = \\int_{-\\infty}^t h(\\tau)\\,\\mathrm{d}\\tau = \\left[\\int_0^t (2e^{-\\tau}-e^{-2\\tau})\\,\\mathrm{d}\\tau\\right]\\varepsilon(t) = \\left(\\frac{3}{2}-2e^{-t}+\\frac{1}{2}e^{-2t}\\right)\\varepsilon(t)$$",
        "question_type": "subjective",
        "category_path": "信号与系统 / 第二章 连续时间系统的时域分析 / 冲激响应与阶跃响应",
        "tags": ["冲激平衡法", "冲激响应", "阶跃响应", "微分方程时域求解"]
    },
    {
        "id": 10,
        "stem": "试计算下列两信号的卷积积分 $f(t) = f_1(t) * f_2(t)$：\n(1) $f_1(t) = e^{-2t}\\varepsilon(t)$，$f_2(t) = e^{-3t}\\varepsilon(t)$\n(2) $f_1(t) = \\cos(t)\\varepsilon(t)$，$f_2(t) = \\varepsilon(t)$\n(3) $f_1(t) = \\delta(t-2)$，$f_2(t) = t^2\\varepsilon(t)$",
        "correct_answer": "(1) $f(t) = (e^{-2t}-e^{-3t})\\varepsilon(t)$；\n(2) $f(t) = \\sin(t)\\varepsilon(t)$；\n(3) $f(t) = (t-2)^2\\varepsilon(t-2)$。",
        "explanation": "【核心考点：常用信号卷积积分公式与时移性质】\n(1) 同指数衰减卷积公式：$e^{-a t}\\varepsilon(t) * e^{-b t}\\varepsilon(t) = \\frac{e^{-a t}-e^{-b t}}{b-a}\\varepsilon(t)$（$a \\neq b$）。\n    此处 $a=2, b=3 \\implies f(t) = \\frac{e^{-2t}-e^{-3t}}{3-2}\\varepsilon(t) = (e^{-2t}-e^{-3t})\\varepsilon(t)$。\n(2) 正弦余弦与阶跃卷积：\n    $$\\cos(t)\\varepsilon(t) * \\varepsilon(t) = \\int_0^t \\cos(\\tau)\\,\\mathrm{d}\\tau\\cdot\\varepsilon(t) = [\\sin\\tau]_0^t\\cdot\\varepsilon(t) = \\sin(t)\\varepsilon(t)$$\n(3) 冲激时移卷积性质：$f_2(t)*\\delta(t-t_0) = f_2(t-t_0)$。\n    故 $(t^2\\varepsilon(t)) * \\delta(t-2) = (t-2)^2\\varepsilon(t-2)$。",
        "question_type": "subjective",
        "category_path": "信号与系统 / 第二章 连续时间系统的时域分析 / 连续卷积积分",
        "tags": ["卷积性质", "指数卷积", "冲激时移"]
    }
]

for q in questions:
    file_name = f"{q['id']:04d}.json"
    file_path = os.path.join(base_dir, file_name)
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(q, f, ensure_ascii=False, indent=2)
    print(f"Generated {file_name} -> {q['category_path']}")

print(f"\nSuccessfully generated {len(questions)} standard Signal and System questions in {base_dir}")

export interface MathFormula {
  id: string
  subject: '高等数学' | '线性代数' | '概率统计'
  chapter: string
  topic: string
  title: string
  latex: string
  note?: string
  keywords: string[]
}

export const FORMULA_CHAPTERS = [
  { id: 'all', name: '全部公式', subject: '全部' },
  // 高等数学
  { id: 'limit', name: '极限与连续', subject: '高等数学' },
  { id: 'deriv_1', name: '一元微分与求导', subject: '高等数学' },
  { id: 'mvt', name: '微分中值定理与导数应用', subject: '高等数学' },
  { id: 'integral_1', name: '一元积分学与方法', subject: '高等数学' },
  { id: 'integral_app', name: '定积分几何与物理应用', subject: '高等数学' },
  { id: 'multivar_diff', name: '多元函数微分学', subject: '高等数学' },
  { id: 'multivar_int', name: '多元积分与三大定理', subject: '高等数学' },
  { id: 'diffeq', name: '常微分方程', subject: '高等数学' },
  { id: 'series', name: '无穷级数与傅里叶', subject: '高等数学' },
  // 线性代数
  { id: 'determinant', name: '行列式', subject: '线性代数' },
  { id: 'matrix', name: '矩阵与伴随/逆', subject: '线性代数' },
  { id: 'vector_rank', name: '向量组与矩阵的秩', subject: '线性代数' },
  { id: 'linear_sys', name: '线性方程组', subject: '线性代数' },
  { id: 'eigen_diag', name: '特征值与相似对角化', subject: '线性代数' },
  { id: 'quad_form', name: '二次型与正定性', subject: '线性代数' },
  // 概率统计
  { id: 'prob_basic', name: '随机事件与五大概率公式', subject: '概率统计' },
  { id: 'dist_1d', name: '一维常见分布与标准化', subject: '概率统计' },
  { id: 'dist_2d', name: '二维分布与独立性/卷积', subject: '概率统计' },
  { id: 'num_char', name: '数字特征 (期望/方差/协方差)', subject: '概率统计' },
  { id: 'law_large_clt', name: '大数定律与中心极限定理', subject: '概率统计' },
  { id: 'stat_sample', name: '三大抽样分布与四大定理', subject: '概率统计' },
  { id: 'param_est', name: '参数估计 (矩估计/MLE)', subject: '概率统计' },
]

export const FORMULA_LIBRARY: MathFormula[] = [
  // =========================================================================
  // 第一部分：高等数学 (Advanced Mathematics)
  // =========================================================================

  // 1. 极限与连续
  {
    id: 'limit-equiv-8',
    subject: '高等数学',
    chapter: 'limit',
    topic: '等价无穷小',
    title: '基础 8 组常用等价无穷小 (x → 0)',
    latex: `\\begin{aligned}
\\sin x &\\sim x, & \\tan x &\\sim x, & \\arcsin x &\\sim x, & \\arctan x &\\sim x \\\\[3pt]
e^x - 1 &\\sim x, & a^x - 1 &\\sim x\\ln a, & \\ln(1+x) &\\sim x, & \\log_a(1+x) &\\sim \\frac{x}{\\ln a} \\\\[3pt]
(1+x)^\\alpha - 1 &\\sim \\alpha x, & 1 - \\cos x &\\sim \\frac{1}{2}x^2, & 1 - \\cos^\\alpha x &\\sim \\frac{\\alpha}{2}x^2
\\end{aligned}`,
    note: '乘除因式可直接整体代换；加减运算中需展开至首个同阶非零项。',
    keywords: ['极限', '等价无穷小', '一元微分', '函数极限', '无穷小', '导数概念'],
  },
  {
    id: 'limit-equiv-diff-adv',
    subject: '高等数学',
    chapter: 'limit',
    topic: '等价无穷小',
    title: '高频加减差值等价无穷小 (x → 0)',
    latex: `\\begin{aligned}
x - \\sin x &\\sim \\frac{1}{6}x^3, & \\tan x - x &\\sim \\frac{1}{3}x^3 \\\\[3pt]
\\arcsin x - x &\\sim \\frac{1}{6}x^3, & x - \\arctan x &\\sim \\frac{1}{3}x^3 \\\\[3pt]
x - \\ln(1+x) &\\sim \\frac{1}{2}x^2, & e^x - (1+x) &\\sim \\frac{1}{2}x^2 \\\\[3pt]
\\tan x - \\sin x &\\sim \\frac{1}{2}x^3, & \\arcsin x - \\arctan x &\\sim \\frac{1}{2}x^3
\\end{aligned}`,
    note: '用于极限计算中消除 0/0 形式的加减抵消项，避免多次洛必达法则。',
    keywords: ['极限', '等价无穷小', '差值', '洛必达', '函数极限', '未定型'],
  },
  {
    id: 'limit-pow-1inf',
    subject: '高等数学',
    chapter: 'limit',
    topic: '重要极限',
    title: '重要极限与 1^∞ 型幂指函数极速公式',
    latex: `\\lim_{x\\to 0}(1+x)^{\\frac{1}{x}} = e, \\quad \\lim_{x\\to \\infty}\\left(1+\\frac{1}{x}\\right)^x = e \\\\[6pt]
\\text{若 } \\lim u(x) = 1, \\; \\lim v(x) = \\infty, \\text{ 则 } \\lim u(x)^{v(x)} = e^{\\lim [u(x)-1]v(x)}`,
    note: '底数减 1 乘指数：即 e^{\\lim(u-1)v}，做题最快捷稳定。',
    keywords: ['重要极限', '1^∞', '幂指函数', '指数极限', '未定型', '连续'],
  },
  {
    id: 'limit-continuity-gap',
    subject: '高等数学',
    chapter: 'limit',
    topic: '连续与间断点',
    title: '间断点分类与判别准则',
    latex: `\\begin{aligned}
\\text{第一类间断点 (左右极限均存在): } & \\begin{cases} \\text{可去间断点: } \\lim_{x\\to x_0^-} f(x) = \\lim_{x\\to x_0^+} f(x) \\ne f(x_0) \\\\[3pt] \\text{跳跃间断点: } \\lim_{x\\to x_0^-} f(x) \\ne \\lim_{x\\to x_0^+} f(x) \\end{cases} \\\\[6pt]
\\text{第二类间断点 (至少一侧极限不存在): } & \\begin{cases} \\text{无穷间断点: } \\lim_{x\\to x_0} f(x) = \\infty \\\\[3pt] \\text{振荡间断点: 如 } \\sin\\frac{1}{x} \\text{ 在 } x=0 \\end{cases}
\\end{aligned}`,
    note: '闭区间连续函数必满足：最值定理、有界性定理、介值定理与零点定理。',
    keywords: ['连续', '间断点', '第一类间断点', '第二类间断点', '零点定理', '介值定理'],
  },

  // 2. 一元微分与求导
  {
    id: 'deriv-definition',
    subject: '高等数学',
    chapter: 'deriv_1',
    topic: '导数定义',
    title: '导数定义式与左右导数充要条件',
    latex: `f'(x_0) = \\lim_{\\Delta x\\to 0} \\frac{f(x_0+\\Delta x) - f(x_0)}{\\Delta x} = \\lim_{x\\to x_0} \\frac{f(x) - f(x_0)}{x - x_0} \\\\[6pt]
f'(x_0) \\text{ 存在} \\iff f'_-(x_0) = f'_+(x_0) \\text{ 且均有限}`,
    note: '可导必连续，连续不一定可导。在分段点处求导优先使用导数定义。',
    keywords: ['导数概念', '导数定义', '左右导数', '可导', '连续', '一元微分'],
  },
  {
    id: 'deriv-leibniz-full',
    subject: '高等数学',
    chapter: 'deriv_1',
    topic: '高阶导数',
    title: '乘积高阶导莱布尼茨 (Leibniz) 公式',
    latex: `(uv)^{(n)} = \\sum_{k=0}^n C_n^k u^{(n-k)} v^{(k)} = u^{(n)}v + n u^{(n-1)}v' + \\frac{n(n-1)}{2}u^{(n-2)}v'' + \\dots + u v^{(n)}`,
    note: '多项式因式设为 v（求导数次后为 0），其余因式设为 u。',
    keywords: ['莱布尼茨', '高阶导', '导数计算', '一元微分', '乘积求导'],
  },
  {
    id: 'deriv-high-common',
    subject: '高等数学',
    chapter: 'deriv_1',
    topic: '高阶导数',
    title: '常用初等函数 n 阶导数通式',
    latex: `\\begin{aligned}
(e^{ax})^{(n)} &= a^n e^{ax}, & (a^x)^{(n)} &= a^x (\\ln a)^n \\\\[3pt]
(\\sin ax)^{(n)} &= a^n \\sin\\left(ax + n\\cdot\\frac{\\pi}{2}\\right), & (\\cos ax)^{(n)} &= a^n \\cos\\left(ax + n\\cdot\\frac{\\pi}{2}\\right) \\\\[3pt]
(\\ln(1+x))^{(n)} &= (-1)^{n-1}\\frac{(n-1)!}{(1+x)^n}, & \\left(\\frac{1}{x+a}\\right)^{(n)} &= (-1)^n \\frac{n!}{(x+a)^{n+1}} \\\\[3pt]
(x^m)^{(n)} &= m(m-1)\\dots(m-n+1)x^{m-n} = \\frac{m!}{(m-n)!}x^{m-n} \\quad (m\\ge n)
\\end{aligned}`,
    note: '分式高阶导常化为部分分式分解后套用 1/(x+a) 阶导公式。',
    keywords: ['高阶导', '导数计算', '一元微分', '通项公式'],
  },
  {
    id: 'deriv-param-polar',
    subject: '高等数学',
    chapter: 'deriv_1',
    topic: '求导法则',
    title: '参数方程、反函数与极坐标求导公式',
    latex: `\\text{参数方程 } \\begin{cases} x = \\varphi(t) \\\\ y = \\psi(t) \\end{cases}: \\quad \\frac{dy}{dx} = \\frac{\\psi'(t)}{\\varphi'(t)}, \\quad \\frac{d^2y}{dx^2} = \\frac{\\psi''(t)\\varphi'(t) - \\psi'(t)\\varphi''(t)}{[\\varphi'(t)]^3} \\\\[6pt]
\\text{反函数 } x = f^{-1}(y): \\quad \\frac{dx}{dy} = \\frac{1}{y'_x}, \\quad \\frac{d^2x}{dy^2} = -\\frac{y''_{xx}}{(y'_x)^3} \\\\[6pt]
\\text{极坐标方程 } r = r(\\theta): \\quad \\frac{dy}{dx} = \\frac{r'(\\theta)\\sin\\theta + r(\\theta)\\cos\\theta}{r'(\\theta)\\cos\\theta - r(\\theta)\\sin\\theta}`,
    note: '反函数二阶导有负号且分母为三次方；极坐标利用 x=r\\cos\\theta, y=r\\sin\\theta 转化为参数方程。',
    keywords: ['参数方程求导', '反函数求导', '极坐标', '导数计算', '高阶导'],
  },
  {
    id: 'taylor-maclaurin-all8',
    subject: '高等数学',
    chapter: 'deriv_1',
    topic: '泰勒与麦克劳林展开',
    title: '8 大常用麦克劳林展开式 (带佩亚诺余项)',
    latex: `\\begin{aligned}
e^x &= 1 + x + \\frac{x^2}{2!} + \\frac{x^3}{3!} + \\dots + \\frac{x^n}{n!} + o(x^n) \\\\[3pt]
\\sin x &= x - \\frac{x^3}{3!} + \\frac{x^5}{5!} - \\dots + (-1)^{n-1}\\frac{x^{2n-1}}{(2n-1)!} + o(x^{2n}) \\\\[3pt]
\\cos x &= 1 - \\frac{x^2}{2!} + \\frac{x^4}{4!} - \\dots + (-1)^n\\frac{x^{2n}}{(2n)!} + o(x^{2n+1}) \\\\[3pt]
\\ln(1+x) &= x - \\frac{x^2}{2} + \\frac{x^3}{3} - \\frac{x^4}{4} + \\dots + (-1)^{n-1}\\frac{x^n}{n} + o(x^n) \\\\[3pt]
(1+x)^\\alpha &= 1 + \\alpha x + \\frac{\\alpha(\\alpha-1)}{2!}x^2 + \\dots + \\frac{\\alpha(\\alpha-1)\\dots(\\alpha-n+1)}{n!}x^n + o(x^n) \\\\[3pt]
\\frac{1}{1-x} &= 1 + x + x^2 + x^3 + \\dots + x^n + o(x^n) \\\\[3pt]
\\arctan x &= x - \\frac{x^3}{3} + \\frac{x^5}{5} - \\dots + (-1)^{n-1}\\frac{x^{2n-1}}{2n-1} + o(x^{2n}) \\\\[3pt]
\\arcsin x &= x + \\frac{1}{6}x^3 + \\frac{3}{40}x^5 + o(x^5)
\\end{aligned}`,
    note: '展开阶数原则：求和差极限时展开到与分母同阶的首个非零项。',
    keywords: ['泰勒展开', '麦克劳林', '极限计算', '一元微分', '幂级数展开', '级数'],
  },

  // 3. 微分中值定理与导数应用
  {
    id: 'mvt-theorems-core',
    subject: '高等数学',
    chapter: 'mvt',
    topic: '中值定理',
    title: '四大微分中值定理与柯西定理',
    latex: `\\begin{aligned}
\\text{罗尔定理: } & f(a)=f(b) \\implies \\exists \\xi\\in(a,b), \\; f'(\\xi)=0 \\\\[3pt]
\\text{拉格朗日: } & f(b)-f(a) = f'(\\xi)(b-a) \\quad (\\xi\\in(a,b)) \\\\[3pt]
\\text{柯西定理: } & \\frac{f(b)-f(a)}{g(b)-g(a)} = \\frac{f'(\\xi)}{g'(\\xi)} \\quad (\\xi\\in(a,b)) \\\\[3pt]
\\text{泰勒中值定理: } & f(b) = \\sum_{k=0}^n \\frac{f^{(k)}(a)}{k!}(b-a)^k + \\frac{f^{(n+1)}(\\xi)}{(n+1)!}(b-a)^{n+1}
\\end{aligned}`,
    note: '若涉及导数与函数值关系用拉格朗日/罗尔；涉及两函数导数比值用柯西；涉及高阶导数用泰勒。',
    keywords: ['微分中值定理', '罗尔定理', '拉格朗日', '柯西', '泰勒中值定理', '中值定理证明'],
  },
  {
    id: 'mvt-auxiliary-fun',
    subject: '高等数学',
    chapter: 'mvt',
    topic: '中值定理辅助函数',
    title: '中值定理辅助函数构造全览',
    latex: `\\begin{aligned}
f'(\\xi) + k f(\\xi) = 0 &\\implies F(x) = e^{kx} f(x) \\\\[3pt]
f'(\\xi) + g(\\xi)f(\\xi) = 0 &\\implies F(x) = e^{\\int g(x)dx} f(x) \\\\[3pt]
\\xi f'(\\xi) + n f(\\xi) = 0 &\\implies F(x) = x^n f(x) \\\\[3pt]
f'(\\xi) g(\\xi) + f(\\xi) g'(\\xi) = 0 &\\implies F(x) = f(x) g(x) \\\\[3pt]
f'(\\xi) g(\\xi) - f(\\xi) g'(\\xi) = 0 &\\implies F(x) = \\frac{f(x)}{g(x)}
\\end{aligned}`,
    note: '构造辅助函数的本质是寻找将待证式化为零的原函数 [F(x)]\' = 0。',
    keywords: ['辅助函数', '中值定理证明', '罗尔定理', '微分中值定理', '大题'],
  },
  {
    id: 'deriv-app-asymptotes-curv',
    subject: '高等数学',
    chapter: 'mvt',
    topic: '导数应用',
    title: '渐近线方程与曲率公式',
    latex: `\\begin{aligned}
\\text{铅直渐近线: } & \\lim_{x\\to x_0} f(x) = \\infty \\implies x = x_0 \\\\[3pt]
\\text{水平渐近线: } & \\lim_{x\\to \\infty} f(x) = A \\implies y = A \\\\[3pt]
\\text{斜渐近线: } & k = \\lim_{x\\to \\infty} \\frac{f(x)}{x}, \\quad b = \\lim_{x\\to \\infty} [f(x) - kx] \\implies y = kx + b \\\\[6pt]
\\text{曲率与曲率半径: } & K = \\frac{|y''|}{(1+y'^2)^{\\frac{3}{2}}}, \\quad R = \\frac{1}{K}
\\end{aligned}`,
    note: '当 x->+inf 与 x->-inf 极限不同时需分别求左右两条斜/水平渐近线。',
    keywords: ['渐近线', '斜渐近线', '水平渐近线', '曲率', '曲率半径', '导数应用'],
  },

  // 4. 一元积分学与方法
  {
    id: 'integral-table-full',
    subject: '高等数学',
    chapter: 'integral_1',
    topic: '积分表',
    title: '常用基本不定积分公式全览',
    latex: `\\begin{aligned}
\\int \\frac{dx}{x^2+a^2} &= \\frac{1}{a}\\arctan\\frac{x}{a} + C, & \\int \\frac{dx}{x^2-a^2} &= \\frac{1}{2a}\\ln\\left|\\frac{x-a}{x+a}\\right| + C \\\\[4pt]
\\int \\frac{dx}{\\sqrt{a^2-x^2}} &= \\arcsin\\frac{x}{a} + C, & \\int \\frac{dx}{\\sqrt{x^2\\pm a^2}} &= \\ln\\left|x + \\sqrt{x^2\\pm a^2}\\right| + C \\\\[4pt]
\\int \\tan x\\,dx &= -\\ln|\\cos x| + C, & \\int \\cot x\\,dx &= \\ln|\\sin x| + C \\\\[4pt]
\\int \\sec x\\,dx &= \\ln|\\sec x + \\tan x| + C, & \\int \\csc x\\,dx &= \\ln|\\csc x - \\cot x| + C \\\\[4pt]
\\int \\sqrt{a^2-x^2}\\,dx &= \\frac{x}{2}\\sqrt{a^2-x^2} + \\frac{a^2}{2}\\arcsin\\frac{x}{a} + C
\\end{aligned}`,
    note: '分母含 \\sqrt{x^2\\pm a^2} 无 1/a 系数；分母为 x^2+a^2 含 1/a 系数。',
    keywords: ['一元积分', '积分表', '不定积分', '积分计算', '有理函数', '根式'],
  },
  {
    id: 'integral-parts-rule',
    subject: '高等数学',
    chapter: 'integral_1',
    topic: '分部积分',
    title: '分部积分法与「反对幂指三」口诀',
    latex: `\\int u\\,dv = uv - \\int v\\,du \\\\[4pt]
\\text{选 } u \\text{ 的优先级口诀（靠前者设为 } u\\text{）: } \\text{反三角} > \\text{对数} > \\text{幂函数} > \\text{指数} > \\text{三角}`,
    note: '多项式乘指数/正余弦时可使用表格分部积分法（对多项式连求导，对另一项连求积分交叉相乘加减）。',
    keywords: ['分部积分', '一元积分', '积分计算', '反对幂指三'],
  },
  {
    id: 'integral-universal-sub',
    subject: '高等数学',
    chapter: 'integral_1',
    topic: '换元代换',
    title: '三角有理式万能代换 (Weierstrass)',
    latex: `t = \\tan\\frac{x}{2} \\implies \\sin x = \\frac{2t}{1+t^2}, \\quad \\cos x = \\frac{1-t^2}{1+t^2}, \\quad dx = \\frac{2}{1+t^2}dt`,
    note: '若被积函数为 \\sin^2 x, \\cos^2 x 或 \\sin x\\cos x 的偶次函数，令 t=\\tan x 更简便 (dx=dt/(1+t^2))。',
    keywords: ['万能代换', '三角有理式', '换元法', '一元积分', '三角积分'],
  },
  {
    id: 'integral-var-upper-diff',
    subject: '高等数学',
    chapter: 'integral_1',
    topic: '变限积分',
    title: '变上限积分求导公式 (含参变量)',
    latex: `\\frac{d}{dx} \\int_{\\varphi(x)}^{\\psi(x)} f(t)\\,dt = f(\\psi(x))\\psi'(x) - f(\\varphi(x))\\varphi'(x) \\\\[6pt]
\\frac{d}{dx} \\int_a^x f(x,t)\\,dt = f(x,x) + \\int_a^x \\frac{\\partial f(x,t)}{\\partial x}\\,dt`,
    note: '若被积函数内部含 x，必须先换元（令 u=x-t 等）或将含 x 项提至积分号外再求导。',
    keywords: ['变限积分', '变上限积分', '积分求导', '导数计算', '含参量积分'],
  },
  {
    id: 'integral-wallis-symmetry',
    subject: '高等数学',
    chapter: 'integral_1',
    topic: '定积分性质',
    title: '点火公式 (Wallis) 与区间再现公式',
    latex: `I_n = \\int_0^{\\frac{\\pi}{2}} \\sin^n x\\,dx = \\int_0^{\\frac{\\pi}{2}} \\cos^n x\\,dx = \\begin{cases}
\\frac{n-1}{n} \\cdot \\frac{n-3}{n-2} \\dots \\frac{1}{2} \\cdot \\frac{\\pi}{2}, & n \\text{ 为正偶数} \\\\[4pt]
\\frac{n-1}{n} \\cdot \\frac{n-3}{n-2} \\dots \\frac{2}{3} \\cdot 1, & n \\text{ 为大于1奇数}
\\end{cases} \\\\[8pt]
\\text{区间再现公式: } \\int_a^b f(x)\\,dx = \\int_a^b f(a+b-x)\\,dx \\\\[4pt]
\\text{推论: } \\int_0^\\pi x f(\\sin x)\\,dx = \\frac{\\pi}{2} \\int_0^\\pi f(\\sin x)\\,dx`,
    note: '对称区间 [-a, a] 上奇函数积分为 0，偶函数积分为 2\\int_0^a。',
    keywords: ['点火公式', 'Wallis', '区间再现', '定积分性质', '对称性', '一元积分'],
  },

  // 5. 定积分几何与物理应用
  {
    id: 'integral-app-geom',
    subject: '高等数学',
    chapter: 'integral_app',
    topic: '几何应用',
    title: '平面面积、旋转体体积与弧长公式',
    latex: `\\begin{aligned}
\\text{极坐标面积: } & S = \\frac{1}{2}\\int_\\alpha^\\beta r^2(\\theta)\\,d\\theta \\\\[4pt]
\\text{绕 } x \\text{ 轴旋转体体积: } & V_x = \\pi \\int_a^b [y_2^2(x) - y_1^2(x)]\\,dx \\\\[4pt]
\\text{绕 } y \\text{ 轴旋转体 (柱壳法): } & V_y = 2\\pi \\int_a^b x |f(x)|\\,dx \\\\[4pt]
\\text{曲线弧长: } & s = \\int_a^b \\sqrt{1 + [y'(x)]^2}\\,dx = \\int_\\alpha^\\beta \\sqrt{x'^2(t) + y'^2(t)}\\,dt = \\int_\\alpha^\\beta \\sqrt{r^2 + r'^2}\\,d\\theta
\\end{aligned}`,
    note: '绕 y 轴旋转体用柱壳法 2\\pi\\int x y dx 无需反解函数 x=g(y)，最快。',
    keywords: ['定积分应用', '旋转体体积', '面积', '弧长', '柱壳法', '极坐标'],
  },
  {
    id: 'integral-app-phys',
    subject: '高等数学',
    chapter: 'integral_app',
    topic: '物理应用',
    title: '变力做功、水压力与质心形心坐标',
    latex: `\\begin{aligned}
\\text{变力做功: } & W = \\int_a^b F(x)\\,dx \\\\[4pt]
\\text{水压力 (深度 } h(x)\\text{): } & P = \\rho g \\int_a^b h(x) [b(x)-a(x)]\\,dx \\\\[4pt]
\\text{平面薄片形心 (均匀 } \\rho=1\\text{): } & \\bar{x} = \\frac{\\iint_D x\\,d\\sigma}{A}, \\quad \\bar{y} = \\frac{\\iint_D y\\,d\\sigma}{A}
\\end{aligned}`,
    note: '计算水压力时微元 dP = \\rho g h \\cdot dA。',
    keywords: ['物理应用', '变力做功', '水压力', '质心', '形心', '引力'],
  },

  // 6. 多元函数微分学
  {
    id: 'multivar-diff-relations',
    subject: '高等数学',
    chapter: 'multivar_diff',
    topic: '微分概念',
    title: '多元函数极限、连续、偏导、可微关系',
    latex: `\\begin{aligned}
&\\text{偏导数连续} \\implies \\text{函数可微} \\implies \\begin{cases} \\text{函数连续} \\\\[3pt] \\text{偏导数存在} \\end{cases} \\\\[6pt]
&\\text{全微分判定: } \\Delta z = A\\Delta x + B\\Delta y + o(\\rho), \\quad \\rho=\\sqrt{\\Delta x^2+\\Delta y^2} \\\\[3pt]
&\\iff \\lim_{(\\Delta x,\\Delta y)\\to(0,0)} \\frac{f(x_0+\\Delta x,y_0+\\Delta y) - f(x_0,y_0) - f'_x\\Delta x - f'_y\\Delta y}{\\sqrt{\\Delta x^2+\\Delta y^2}} = 0
\\end{aligned}`,
    note: '偏导数存在不能推出连续；连续不能推出可导；偏导数连续是可微的充分非必要条件。',
    keywords: ['多元微分', '可微', '偏导数', '全微分', '连续', '多元概念'],
  },
  {
    id: 'multivar-chain-implicit',
    subject: '高等数学',
    chapter: 'multivar_diff',
    topic: '偏导计算',
    title: '多元复合求导链式法则与隐函数存在定理',
    latex: `\\text{设 } z = f(u,v), \\; u=\\varphi(x,y), \\; v=\\psi(x,y): \\quad \\frac{\\partial z}{\\partial x} = \\frac{\\partial z}{\\partial u}\\frac{\\partial u}{\\partial x} + \\frac{\\partial z}{\\partial v}\\frac{\\partial v}{\\partial x} \\\\[6pt]
\\text{隐方程 } F(x,y,z)=0: \\quad \\frac{\\partial z}{\\partial x} = -\\frac{F'_x}{F'_z}, \\quad \\frac{\\partial z}{\\partial y} = -\\frac{F'_y}{F'_z} \\quad (F'_z \\ne 0)`,
    note: '隐函数二阶偏导可直接在 \\partial z/\\partial x 式两边对 x 或 y 继续求偏导（注意 z 是 x,y 的函数）。',
    keywords: ['多元复合求导', '链式法则', '隐函数求导', '偏导数', '全微分'],
  },
  {
    id: 'multivar-extrema-lagrange',
    subject: '高等数学',
    chapter: 'multivar_diff',
    topic: '多元极值',
    title: '二元极值充分条件 (AC - B²) 与拉格朗日乘数法',
    latex: `\\text{设 } A = f''_{xx}, \\; B = f''_{xy}, \\; C = f''_{yy}, \\; \\Delta = AC - B^2: \\\\[3pt]
\\begin{cases}
\\Delta > 0 \\text{ 且 } A < 0 \\implies \\text{极大值} \\\\
\\Delta > 0 \\text{ 且 } A > 0 \\implies \\text{极小值} \\\\
\\Delta < 0 \\implies \\text{非极值点} \\\\
\\Delta = 0 \\implies \\text{方法失效，需另行分析}
\\end{cases} \\\\[8pt]
\\text{条件极值拉格朗日函数: } L(x,y,\\lambda) = f(x,y) + \\lambda \\varphi(x,y), \\quad \\begin{cases} L'_x = 0 \\\\ L'_y = 0 \\\\ L'_\\lambda = 0 \\end{cases}`,
    note: '求驻点需联立一阶偏导 f\'_x=0, f\'_y=0；边界点最值需单独立式比较。',
    keywords: ['多元极值', '拉格朗日乘数法', '无条件极值', 'AC-B^2', '偏导数'],
  },
  {
    id: 'multivar-geom-space',
    subject: '高等数学',
    chapter: 'multivar_diff',
    topic: '空间几何与场论',
    title: '空间几何切法线、方向导数与梯度',
    latex: `\\text{曲面 } F(x,y,z)=0 \\text{ 的法向量: } \\mathbf{n} = (F'_x, F'_y, F'_z) \\\\[3pt]
\\text{切平面: } F'_x(x-x_0) + F'_y(y-y_0) + F'_z(z-z_0) = 0 \\\\[6pt]
\\text{梯度: } \\mathbf{grad}\\,f = \\nabla f = \\left(\\frac{\\partial f}{\\partial x}, \\frac{\\partial f}{\\partial y}, \\frac{\\partial f}{\\partial z}\\right) \\\\[4pt]
\\text{方向导数: } \\frac{\\partial f}{\\partial \\mathbf{l}} = \\mathbf{grad}\\,f \\cdot \\mathbf{l}^0 = |\\mathbf{grad}\\,f| \\cos\\theta \\le |\\mathbf{grad}\\,f|`,
    note: '梯度方向即为方向导数增加最快的方向，最大值即梯度的模长。',
    keywords: ['切平面', '法线', '方向导数', '梯度', '空间几何', '多元微分'],
  },

  // 7. 多元积分与三大定理 (数一专享核心)
  {
    id: 'double-integral-polar',
    subject: '高等数学',
    chapter: 'multivar_int',
    topic: '二重积分',
    title: '二重积分极坐标变换与对称性定理',
    latex: `\\iint_D f(x,y)\\,dx\\,dy = \\iint_{D^*} f(r\\cos\\theta, r\\sin\\theta)\\,r\\,dr\\,d\\theta \\\\[6pt]
\\text{普通对称性: } \\begin{cases} D \\text{ 关于 } y \\text{ 轴对称}, f(-x,y)=-f(x,y) \\implies \\iint_D f = 0 \\\\ D \\text{ 关于 } y \\text{ 轴对称}, f(-x,y)=f(x,y) \\implies \\iint_D f = 2\\iint_{D_1} f \\end{cases} \\\\[6pt]
\\text{轮换对称性: } D \\text{ 关于 } y=x \\text{ 对称} \\implies \\iint_D f(x,y)\\,d\\sigma = \\iint_D f(y,x)\\,d\\sigma = \\frac{1}{2}\\iint_D [f(x,y)+f(y,x)]\\,d\\sigma`,
    note: '极坐标面积微元别忘乘 r；含 x^2+y^2 或圆域优先用极坐标。',
    keywords: ['二重积分', '极坐标', '轮换对称性', '对称性', '多元积分'],
  },
  {
    id: 'triple-integral-cyl-sph',
    subject: '高等数学',
    chapter: 'multivar_int',
    topic: '三重积分',
    title: '三重积分柱面坐标与球面坐标变换',
    latex: `\\text{柱面坐标: } \\iiint_\\Omega f(x,y,z)\\,dV = \\iiint_{\\Omega^*} f(r\\cos\\theta, r\\sin\\theta, z)\\,r\\,dr\\,d\\theta\\,dz \\\\[6pt]
\\text{球面坐标: } \\iiint_\\Omega f(x,y,z)\\,dV = \\iiint_{\\Omega^*} f(r\\sin\\varphi\\cos\\theta, r\\sin\\varphi\\sin\\theta, r\\cos\\varphi)\\,r^2\\sin\\varphi\\,dr\\,d\\varphi\\,d\\theta`,
    note: '柱坐标微元为 r dr d\\theta dz；球坐标微元为 r^2\\sin\\varphi dr d\\varphi d\\theta（\\varphi 为与 z 轴正向夹角）。',
    keywords: ['三重积分', '柱面坐标', '球面坐标', '投影法', '截面法', '多元积分'],
  },
  {
    id: 'green-formula-path',
    subject: '高等数学',
    chapter: 'multivar_int',
    topic: '曲线积分与格林公式',
    title: '格林公式与曲线积分路径无关条件',
    latex: `\\oint_{L^+} P\\,dx + Q\\,dy = \\iint_D \\left(\\frac{\\partial Q}{\\partial x} - \\frac{\\partial P}{\\partial y}\\right)dx\\,dy \\\\[6pt]
\\text{单连通域路径无关 } \\iff \\frac{\\partial Q}{\\partial x} = \\frac{\\partial P}{\\partial y} \\iff \\oint_L P\\,dx+Q\\,dy = 0 \\iff P\\,dx+Q\\,dy = du`,
    note: '格林公式要求边界正向（逆时针，区域在左侧）；若区域含奇点需挖洞法。',
    keywords: ['格林公式', '曲线积分', '路径无关', '全微分', '第二类曲线积分'],
  },
  {
    id: 'gauss-stokes-vector',
    subject: '高等数学',
    chapter: 'multivar_int',
    topic: '高斯与斯托克斯公式',
    title: '高斯公式、斯托克斯公式与散度/旋度',
    latex: `\\text{高斯公式: } \\oiint_{\\Sigma^+} P\\,dy\\,dz + Q\\,dz\\,dx + R\\,dx\\,dy = \\iiint_\\Omega \\left(\\frac{\\partial P}{\\partial x} + \\frac{\\partial Q}{\\partial y} + \\frac{\\partial R}{\\partial z}\\right)dV \\\\[6pt]
\\text{散度: } \\text{div}\\,\\mathbf{F} = \\frac{\\partial P}{\\partial x} + \\frac{\\partial Q}{\\partial y} + \\frac{\\partial R}{\\partial z}, \\quad \\text{通量 } \\Phi = \\oiint_\\Sigma \\mathbf{F}\\cdot d\\mathbf{S} = \\iiint_\\Omega \\text{div}\\,\\mathbf{F}\\,dV \\\\[6pt]
\\text{斯托克斯公式: } \\oint_{L^+} P\\,dx+Q\\,dy+R\\,dz = \\iint_\\Sigma \\begin{vmatrix} dy\\,dz & dz\\,dx & dx\\,dy \\\\ \\frac{\\partial}{\\partial x} & \\frac{\\partial}{\\partial y} & \\frac{\\partial}{\\partial z} \\\\ P & Q & R \\end{vmatrix}, \\quad \\mathbf{rot}\\,\\mathbf{F} = \\nabla \\times \\mathbf{F}`,
    note: '高斯公式必须为闭合曲面外侧（不闭合需补面减面）；斯托克斯公式右手法则定向。',
    keywords: ['高斯公式', '斯托克斯公式', '曲面积分', '通量', '散度', '旋度', '环量'],
  },

  // 8. 常微分方程
  {
    id: 'diffeq-order1-linear',
    subject: '高等数学',
    chapter: 'diffeq',
    topic: '一阶微分方程',
    title: '一阶线性微分方程与伯努利方程通解',
    latex: `\\text{一阶线性 } y' + P(x)y = Q(x): \\quad y = e^{-\\int P(x)dx} \\left(\\int Q(x) e^{\\int P(x)dx}\\,dx + C\\right) \\\\[6pt]
\\text{伯努利方程 } y' + P(x)y = Q(x)y^n: \\quad \\text{令 } z = y^{1-n} \\implies \\frac{dz}{dx} + (1-n)P(x)z = (1-n)Q(x)`,
    note: '齐次解乘以常数变易因子即为非齐次解。',
    keywords: ['微分方程', '一阶线性', '常数变易法', '伯努利方程', '通解'],
  },
  {
    id: 'diffeq-order2-const-all',
    subject: '高等数学',
    chapter: 'diffeq',
    topic: '二阶常系数微分方程',
    title: '二阶常系数齐次与非齐次通解/特解',
    latex: `y'' + py' + qy = 0 \\implies r^2 + pr + q = 0: \\\\[3pt]
\\begin{cases}
\\Delta > 0: & y = C_1 e^{r_1 x} + C_2 e^{r_2 x} \\\\
\\Delta = 0: & y = (C_1 + C_2 x) e^{r x} \\\\
\\Delta < 0 \\; (r = \\alpha \\pm i\\beta): & y = e^{\\alpha x}(C_1\\cos\\beta x + C_2\\sin\\beta x)
\\end{cases} \\\\[8pt]
\\text{非齐次 } f(x) = e^{\\lambda x}P_m(x) \\implies y^* = x^k Q_m(x)e^{\\lambda x} \\quad (k \\text{ 为 } \\lambda \\text{ 作为特征根重数}) \\\\[4pt]
\\text{非齐次 } f(x) = e^{\\alpha x}[P_l\\cos\\beta x + P_n\\sin\\beta x] \\implies y^* = x^k e^{\\alpha x}[R_m\\cos\\beta x + S_m\\sin\\beta x]`,
    note: '若 \\alpha \\pm i\\beta 是特征根则 k=1，否则 k=0；m=\\max(l,n)。',
    keywords: ['微分方程', '二阶常系数', '特征方程', '特解', '齐次通解'],
  },
  {
    id: 'diffeq-euler-reduce',
    subject: '高等数学',
    chapter: 'diffeq',
    topic: '欧拉方程与可降阶',
    title: '欧拉方程与三种可降阶微分方程',
    latex: `\\text{欧拉方程 } x^2 y'' + pxy' + qy = f(x): \\quad \\text{令 } x = e^t \\implies xy' = \\frac{dy}{dt}, \\; x^2 y'' = \\frac{d^2y}{dt^2} - \\frac{dy}{dt} \\\\[6pt]
y'' = f(x, y') \\implies \\text{令 } p = y', \\; y'' = p' = \\frac{dp}{dx} \\\\[4pt]
y'' = f(y, y') \\implies \\text{令 } p = y', \\; y'' = p\\frac{dp}{dy}`,
    note: '不显含 x 的方程令 y\'\'=p dp/dy 可以消去自变量 x。',
    keywords: ['欧拉方程', '可降阶', '常微分方程', '微分方程'],
  },

  // 9. 无穷级数与傅里叶 (数一专享)
  {
    id: 'series-convergence-tests',
    subject: '高等数学',
    chapter: 'series',
    topic: '级数审敛法',
    title: '常数项级数核心审敛法则',
    latex: `\\begin{aligned}
p\\text{-级数: } & \\sum \\frac{1}{n^p} \\quad (p > 1 \\text{ 收敛}, p \\le 1 \\text{ 发散}) \\\\[3pt]
\\text{比较法极限形式: } & \\lim \\frac{u_n}{v_n} = l \\in (0,+\\infty) \\implies u_n \\text{ 与 } v_n \\text{ 同敛散} \\\\[3pt]
\\text{达朗贝尔比值法: } & \\lim \\frac{u_{n+1}}{u_n} = \\rho \\quad (\\rho < 1 \\text{ 收敛}, \\rho > 1 \\text{ 发散}) \\\\[3pt]
\\text{柯西根值法: } & \\lim \\sqrt[n]{u_n} = \\rho \\quad (\\rho < 1 \\text{ 收敛}, \\rho > 1 \\text{ 发散}) \\\\[3pt]
\\text{莱布尼茨交错级数: } & u_n \\ge u_{n+1} > 0 \\text{ 且 } \\lim u_n = 0 \\implies \\sum (-1)^n u_n \\text{ 收敛}
\\end{aligned}`,
    note: '反常积分审敛与级数审敛原理一致（积分审敛法）。',
    keywords: ['无穷级数', '审敛法', '比值法', '根值法', '莱布尼茨', 'p级数'],
  },
  {
    id: 'series-power-radius',
    subject: '高等数学',
    chapter: 'series',
    topic: '幂级数',
    title: '幂级数收敛半径与和函数求法',
    latex: `R = \\lim_{n\\to\\infty} \\left|\\frac{a_n}{a_{n+1}}\\right| = \\frac{1}{\\lim_{n\\to\\infty}\\sqrt[n]{|a_n|}} \\\\[6pt]
\\text{和函数逐项求导与积分: } S(x) = \\sum_{n=0}^\\infty a_n x^n \\implies S'(x) = \\sum_{n=1}^\\infty n a_n x^{n-1}, \\; \\int_0^x S(t)dt = \\sum_{n=0}^\\infty \\frac{a_n}{n+1}x^{n+1}`,
    note: '收敛区间端点敛散性需单独代入判别；缺项级数用比值判别法求收敛域。',
    keywords: ['幂级数', '收敛半径', '收敛域', '和函数', '逐项求导', '逐项积分'],
  },
  {
    id: 'series-fourier-full',
    subject: '高等数学',
    chapter: 'series',
    topic: '傅里叶级数',
    title: '傅里叶级数展开公式与狄利克雷定理',
    latex: `f(x) \\sim \\frac{a_0}{2} + \\sum_{n=1}^\\infty (a_n\\cos nx + b_n\\sin nx) \\\\[4pt]
a_n = \\frac{1}{\\pi}\\int_{-\\pi}^\\pi f(x)\\cos nx\\,dx, \\quad b_n = \\frac{1}{\\pi}\\int_{-\\pi}^\\pi f(x)\\sin nx\\,dx \\\\[6pt]
\\text{狄利克雷收敛点: } S(x) = \\frac{f(x^-) + f(x^+)}{2}`,
    note: '偶函数 bn=0（余弦级数）；奇函数 an=0（正弦级数）。端点处收敛于 [f(-pi+)+f(pi-)]/2。',
    keywords: ['傅里叶级数', '狄利克雷定理', '正弦级数', '余弦级数', '无穷级数'],
  },

  // =========================================================================
  // 第二部分：线性代数 (Linear Algebra)
  // =========================================================================

  // 10. 行列式
  {
    id: 'lin-det-properties',
    subject: '线性代数',
    chapter: 'determinant',
    topic: '行列式性质',
    title: '行列式展开定理、范德蒙德与克拉默法则',
    latex: `\\sum_{k=1}^n a_{ik} A_{jk} = \\begin{cases} |A|, & i = j \\\\ 0, & i \\ne j \\end{cases} \\\\[6pt]
\\text{范德蒙德行列式: } V_n(x_1,\\dots,x_n) = \\prod_{1\\le j < i \\le n} (x_i - x_j) \\\\[6pt]
\\text{克拉默法则: } |A| \\ne 0 \\implies x_i = \\frac{|A_i|}{|A|} \\quad (|A|=0 \\text{ 齐次方程有非零解})`,
    note: '异行元素与代数余子式乘积之和恒为 0。',
    keywords: ['行列式', '代数余子式', '范德蒙德', '克拉默法则', '行列式展开'],
  },

  // 11. 矩阵与伴随/逆
  {
    id: 'lin-adj-inverse-10',
    subject: '线性代数',
    chapter: 'matrix',
    topic: '伴随矩阵与逆矩阵',
    title: '伴随矩阵 A* 十大核心恒等式',
    latex: `\\begin{aligned}
AA^* &= A^*A = |A|E, & A^{-1} &= \\frac{1}{|A|}A^* \\quad (|A|\\ne 0) \\\\[3pt]
|A^*| &= |A|^{n-1}, & (A^*)^* &= |A|^{n-2}A \\quad (n\\ge 2) \\\\[3pt]
(A^*)^T &= (A^T)^*, & (A^*)^{-1} &= (A^{-1})^* = \\frac{1}{|A|}A \\\\[3pt]
(AB)^* &= B^*A^*, & (kA)^* &= k^{n-1}A^*
\\end{aligned}`,
    note: '伴随矩阵秩规律：rank(A)=n => rank(A*)=n；rank(A)=n-1 => rank(A*)=1；rank(A)<=n-2 => rank(A*)=0。',
    keywords: ['伴随矩阵', '逆矩阵', '矩阵', '行列式', '可逆', '秩'],
  },
  {
    id: 'lin-block-matrix',
    subject: '线性代数',
    chapter: 'matrix',
    topic: '分块矩阵',
    title: '分块矩阵求逆与分块行列式',
    latex: `\\begin{vmatrix} A & O \\\\ C & B \\end{vmatrix} = \\begin{vmatrix} A & C \\\\ O & B \\end{vmatrix} = |A||B|, \\quad \\begin{vmatrix} O & A \\\\ B & C \\end{vmatrix} = (-1)^{mn}|A||B| \\\\[6pt]
\\begin{pmatrix} A & O \\\\ O & B \\end{pmatrix}^{-1} = \\begin{pmatrix} A^{-1} & O \\\\ O & B^{-1} \\end{pmatrix}, \\quad \\begin{pmatrix} O & A \\\\ B & O \\end{pmatrix}^{-1} = \\begin{pmatrix} O & B^{-1} \\\\ A^{-1} & O \\end{pmatrix}`,
    note: '副对角分块行列式有系数 (-1)^{mn}（m, n 为 A, B 的阶数）。',
    keywords: ['分块矩阵', '分块行列式', '逆矩阵', '矩阵'],
  },

  // 12. 向量组与矩阵的秩
  {
    id: 'lin-rank-inequalities-full',
    subject: '线性代数',
    chapter: 'vector_rank',
    topic: '矩阵的秩',
    title: '矩阵的秩核心不等式体系',
    latex: `\\begin{aligned}
\\text{rank}(AB) &\\le \\min(\\text{rank}(A), \\text{rank}(B)) \\\\[3pt]
\\text{rank}(A+B) &\\le \\text{rank}(A) + \\text{rank}(B) \\\\[3pt]
\\text{rank}(AB) &\\ge \\text{rank}(A) + \\text{rank}(B) - n \\quad (A \\text{ 为 } m\\times n \\text{ 矩阵}) \\\\[3pt]
\\text{rank}(A^T A) &= \\text{rank}(A A^T) = \\text{rank}(A) = \\text{rank}(A^T) \\\\[3pt]
AB = O &\\implies \\text{rank}(A) + \\text{rank}(B) \\le n
\\end{aligned}`,
    note: '当 AB=O 时，B 的列向量全部为 Ax=0 的解，故 rank(B) <= n - rank(A)。',
    keywords: ['矩阵的秩', '秩', 'Sylvester不等式', '矩阵乘法', '向量组'],
  },
  {
    id: 'lin-vector-schmidt',
    subject: '线性代数',
    chapter: 'vector_rank',
    topic: '向量正交化',
    title: '施密特 (Schmidt) 正交化与正交矩阵',
    latex: `\\beta_1 = \\alpha_1, \\quad \\beta_2 = \\alpha_2 - \\frac{(\\alpha_2,\\beta_1)}{(\\beta_1,\\beta_1)}\\beta_1, \\quad \\beta_3 = \\alpha_3 - \\frac{(\\alpha_3,\\beta_1)}{(\\beta_1,\\beta_1)}\\beta_1 - \\frac{(\\alpha_3,\\beta_2)}{(\\beta_2,\\beta_2)}\\beta_2 \\\\[6pt]
\\text{单位化: } \\eta_i = \\frac{\\beta_i}{\\|\\beta_i\\|}, \\qquad Q^T Q = Q Q^T = E \\iff Q^{-1} = Q^T`,
    note: '正交矩阵各列向量为两两正交的单位向量，且 |Q| = 1 或 -1。',
    keywords: ['施密特正交化', '正交矩阵', '单位化', '内积', '向量组'],
  },

  // 13. 线性方程组
  {
    id: 'lin-sys-solution-struct',
    subject: '线性代数',
    chapter: 'linear_sys',
    topic: '线性方程组',
    title: '线性方程组 Ax = b 解的判定与结构定理',
    latex: `\\begin{cases}
\\text{rank}(A) < \\text{rank}(A,b) \\iff \\text{无解} \\\\
\\text{rank}(A) = \\text{rank}(A,b) = n \\iff \\text{有唯一解} \\\\
\\text{rank}(A) = \\text{rank}(A,b) = r < n \\iff \\text{有无穷多解 (自由变量 } n-r \\text{ 个)}
\\end{cases} \\\\[8pt]
\\text{非齐次通解: } x = k_1 \\xi_1 + k_2 \\xi_2 + \\dots + k_{n-r}\\xi_{n-r} + \\eta^*`,
    note: '基础解系 \\xi_1,...,\\xi_{n-r} 是 Ax=0 的极大线性无关解向量，\\eta^* 为 Ax=b 的一个特解。',
    keywords: ['线性方程组', '基础解系', '通解', '特解', '增广矩阵', '秩'],
  },

  // 14. 特征值与相似对角化
  {
    id: 'lin-eigen-properties',
    subject: '线性代数',
    chapter: 'eigen_diag',
    topic: '特征值与特征向量',
    title: '特征值性质与矩阵相似充要条件',
    latex: `\\sum_{i=1}^n \\lambda_i = \\text{tr}(A) = \\sum_{i=1}^n a_{ii}, \\qquad \\prod_{i=1}^n \\lambda_i = |A| \\\\[6pt]
A \\sim \\Lambda \\iff A \\text{ 有 } n \\text{ 个线性无关特征向量} \\iff \\forall \\lambda_i, \\; n - \\text{rank}(\\lambda_i E - A) = k_i (\\text{重数})`,
    note: '不同特征值对应的特征向量必线性无关；实对称矩阵必可正交相似对角化。',
    keywords: ['特征值', '特征向量', '相似对角化', '迹', '实对称矩阵'],
  },

  // 15. 二次型与正定性
  {
    id: 'lin-quadratic-form-pos',
    subject: '线性代数',
    chapter: 'quad_form',
    topic: '二次型',
    title: '二次型化标准形与正定矩阵等价判据',
    latex: `A \\text{ 正定} \\iff x^T A x > 0 \\;(\\forall x\\ne 0) \\iff \\lambda_i > 0 \\iff \\Delta_k > 0 \\; (k=1,\\dots,n) \\iff P^T A P = E`,
    note: '负定判据：奇数阶顺序主子式 < 0，偶数阶顺序主子式 > 0。',
    keywords: ['二次型', '正定矩阵', '顺序主子式', '正惯性指数', '合同', '标准形'],
  },

  // =========================================================================
  // 第三部分：概率论与数理统计 (Probability & Statistics)
  // =========================================================================

  // 16. 随机事件与五大概率公式
  {
    id: 'prob-5-fundamental-rules',
    subject: '概率统计',
    chapter: 'prob_basic',
    topic: '概率公式',
    title: '五大概率基本公式 (加法/乘法/全概/贝叶斯)',
    latex: `\\begin{aligned}
\\text{加法公式: } & P(A\\cup B) = P(A) + P(B) - P(AB) \\\\[3pt]
\\text{条件概率: } & P(A|B) = \\frac{P(AB)}{P(B)} \\iff P(AB) = P(B)P(A|B) \\\\[3pt]
\\text{全概率公式: } & P(B) = \\sum_{i=1}^n P(A_i)P(B|A_i) \\\\[4pt]
\\text{贝叶斯公式: } & P(A_k|B) = \\frac{P(A_k)P(B|A_k)}{\\sum_{i=1}^n P(A_i)P(B|A_i)}
\\end{aligned}`,
    note: '全概公式用于“由因求果”，贝叶斯公式用于“由果溯因”。',
    keywords: ['概率', '条件概率', '全概率公式', '贝叶斯公式', '独立性', '随机事件'],
  },

  // 17. 一维常见分布与标准化
  {
    id: 'prob-common-1d-table',
    subject: '概率统计',
    chapter: 'dist_1d',
    topic: '常见分布',
    title: '常见随机变量分布与期望方差速查',
    latex: `\\begin{aligned}
\\text{0-1 分布 } B(1,p): & \\quad E(X) = p, & D(X) = p(1-p) \\\\[3pt]
\\text{二项分布 } B(n,p): & \\quad E(X) = np, & D(X) = np(1-p) \\\\[3pt]
\\text{泊松分布 } P(\\lambda): & \\quad E(X) = \\lambda, & D(X) = \\lambda \\\\[3pt]
\\text{均匀分布 } U(a,b): & \\quad E(X) = \\frac{a+b}{2}, & D(X) = \\frac{(b-a)^2}{12} \\\\[3pt]
\\text{指数分布 } E(\\lambda): & \\quad E(X) = \\frac{1}{\\lambda}, & D(X) = \\frac{1}{\\lambda^2} \\quad (f(x)=\\lambda e^{-\\lambda x}) \\\\[3pt]
\\text{正态分布 } N(\\mu,\\sigma^2): & \\quad E(X) = \\mu, & D(X) = \\sigma^2 \\implies \\frac{X-\\mu}{\\sigma} \\sim N(0,1)
\\end{aligned}`,
    note: '指数分布无记忆性：P(X > s+t | X > s) = P(X > t) = e^{-\\lambda t}。',
    keywords: ['二项分布', '泊松分布', '均匀分布', '指数分布', '正态分布', '期望方差'],
  },

  // 18. 二维分布与独立性/卷积
  {
    id: 'prob-2d-convolution-maxmin',
    subject: '概率统计',
    chapter: 'dist_2d',
    topic: '二维分布',
    title: '独立变量和的卷积公式与最值分布',
    latex: `\\text{和的卷积公式 } Z = X+Y: \\quad f_Z(z) = \\int_{-\\infty}^{+\\infty} f(x, z-x)\\,dx = \\int_{-\\infty}^{+\\infty} f_X(x) f_Y(z-x)\\,dx \\\\[6pt]
\\text{最大值分布: } F_{\\max}(z) = P(\\max(X,Y)\\le z) = F_X(z)F_Y(z) \\\\[3pt]
\\text{最小值分布: } F_{\\min}(z) = P(\\min(X,Y)\\le z) = 1 - [1-F_X(z)][1-F_Y(z)]`,
    note: '最大值分布利用同时小于等于；最小值分布利用至少一个小于等于（对立事件全大于）。',
    keywords: ['二维随机变量', '卷积公式', '最大值分布', '最小值分布', '独立性'],
  },

  // 19. 数字特征 (期望/方差/协方差)
  {
    id: 'prob-cov-corr-properties',
    subject: '概率统计',
    chapter: 'num_char',
    topic: '数字特征',
    title: '协方差、相关系数与独立性充要条件',
    latex: `\\begin{aligned}
\\text{Cov}(X,Y) &= E(XY) - E(X)E(Y) = E[(X-E(X))(Y-E(Y))] \\\\[3pt]
D(aX \\pm bY) &= a^2 D(X) + b^2 D(Y) \\pm 2ab\\,\\text{Cov}(X,Y) \\\\[3pt]
\\rho_{XY} &= \\frac{\\text{Cov}(X,Y)}{\\sqrt{D(X)D(Y)}} \\quad (-1 \\le \\rho_{XY} \\le 1) \\\\[4pt]
X,Y \\text{ 独立} &\\implies \\text{Cov}(X,Y) = 0 \\iff \\rho_{XY} = 0 \\text{ (不相关)}
\\end{aligned}`,
    note: '不相关只代表无线性关系；但对于二维正态总体 (X, Y)，不相关与独立等价！',
    keywords: ['协方差', '相关系数', '独立性', '二维正态', '数字特征', '方差性质'],
  },
  {
    id: 'prob-chebyshev-ineq',
    subject: '概率统计',
    chapter: 'num_char',
    topic: '不等式',
    title: '切比雪夫不等式与马尔可夫不等式',
    latex: `P(|X - E(X)| \\ge \\varepsilon) \\le \\frac{D(X)}{\\varepsilon^2} \\iff P(|X - E(X)| < \\varepsilon) \\ge 1 - \\frac{D(X)}{\\varepsilon^2}`,
    note: '切比雪夫不等式无需知道具体分布，只需期望和方差即可估计概率界限。',
    keywords: ['切比雪夫不等式', '概率界限', '大数定律', '数字特征'],
  },

  // 20. 大数定律与中心极限定理
  {
    id: 'prob-law-clt-theorems',
    subject: '概率统计',
    chapter: 'law_large_clt',
    topic: '极限定理',
    title: '三大数定律与中心极限定理 (CLT)',
    latex: `\\begin{aligned}
\\text{辛钦大数定律: } & \\frac{1}{n}\\sum_{i=1}^n X_i \\xrightarrow{P} \\mu \\quad (X_i \\text{ 独立同分布且 } E(X_i)=\\mu) \\\\[4pt]
\\text{列维-林德伯格 CLT: } & \\lim_{n\\to\\infty} P\\left(\\frac{\\sum X_i - n\\mu}{\\sqrt{n}\\sigma} \\le x\\right) = \\Phi(x) \\\\[4pt]
\\text{棣莫弗-拉普拉斯: } & \\lim_{n\\to\\infty} P\\left(\\frac{Y_n - np}{\\sqrt{np(1-p)}} \\le x\\right) = \\Phi(x) \\quad (Y_n \\sim B(n,p))
\\end{aligned}`,
    note: '中心极限定理说明大量独立微小随机扰动之和渐近服从正态分布。',
    keywords: ['大数定律', '中心极限定理', '辛钦', '列维林德伯格', '正态近似'],
  },

  // 21. 三大抽样分布与四大定理 (数一专享)
  {
    id: 'stat-sampling-4theorems',
    subject: '概率统计',
    chapter: 'stat_sample',
    topic: '抽样分布',
    title: '三大抽样分布 (χ², t, F) 与正态四大抽样定理',
    latex: `\\begin{aligned}
\\chi^2(n): & \\quad \\sum_{i=1}^n X_i^2 \\quad (X_i \\sim N(0,1) \\text{ 独立}) \\\\[3pt]
t(n): & \\quad \\frac{X}{\\sqrt{Y/n}} \\quad (X\\sim N(0,1), Y\\sim\\chi^2(n) \\text{ 独立}) \\\\[3pt]
F(n_1,n_2): & \\quad \\frac{X/n_1}{Y/n_2} \\quad (X\\sim\\chi^2(n_1), Y\\sim\\chi^2(n_2) \\text{ 独立}) \\\\[6pt]
\\text{定理 1: } & \\bar{X} \\sim N\\left(\\mu, \\frac{\\sigma^2}{n}\\right), \\qquad \\text{定理 2: } \\frac{(n-1)S^2}{\\sigma^2} \\sim \\chi^2(n-1) \\\\[4pt]
\\text{定理 3: } & \\bar{X} \\text{ 与 } S^2 \\text{ 相互独立}, \\qquad \\text{定理 4: } \\frac{\\bar{X}-\\mu}{S/\\sqrt{n}} \\sim t(n-1)
\\end{aligned}`,
    note: '样本方差 S^2 分母为 n-1，是 \\sigma^2 的无偏估计。',
    keywords: ['数理统计', '抽样分布', '正态总体', '卡方分布', 't分布', 'F分布', '抽样定理'],
  },

  // 22. 参数估计 (矩估计/MLE) (数一专享)
  {
    id: 'stat-mle-mme-methods',
    subject: '概率统计',
    chapter: 'param_est',
    topic: '点估计',
    title: '矩估计法 (MME) 与极大似然估计 (MLE)',
    latex: `\\begin{aligned}
\\text{矩估计法: } & E(X^k) = A_k = \\frac{1}{n}\\sum_{i=1}^n X_i^k \\implies \\text{解出参数 } \\hat{\\theta} \\\\[6pt]
\\text{极大似然法: } & L(\\theta) = \\prod_{i=1}^n p(x_i; \\theta) \\text{ 或 } \\prod_{i=1}^n f(x_i; \\theta) \\\\[3pt]
& \\ln L(\\theta) = \\sum_{i=1}^n \\ln f(x_i;\\theta) \\implies \\frac{d\\ln L}{d\\theta} = 0 \\implies \\hat{\\theta}_{\\text{MLE}}
\\end{aligned}`,
    note: '若似然函数单调（如均匀分布 U(0,\\theta)），驻点无解，需取极值端点 \\hat{\\theta}=\\max(X_1,\\dots,X_n)。',
    keywords: ['参数估计', '极大似然估计', '矩估计', '似然函数', '点估计', '无偏估计'],
  },
  {
    id: 'stat-confidence-interval',
    subject: '概率统计',
    chapter: 'param_est',
    topic: '区间估计',
    title: '单个正态总体参数的置信区间',
    latex: `\\begin{aligned}
\\mu \\text{ 的区间 (}\\sigma^2 \\text{ 已知): } & \\left[ \\bar{X} - \\frac{\\sigma}{\\sqrt{n}} z_{\\frac{\\alpha}{2}}, \\; \\bar{X} + \\frac{\\sigma}{\\sqrt{n}} z_{\\frac{\\alpha}{2}} \\right] \\\\[4pt]
\\mu \\text{ 的区间 (}\\sigma^2 \\text{ 未知): } & \\left[ \\bar{X} - \\frac{S}{\\sqrt{n}} t_{\\frac{\\alpha}{2}}(n-1), \\; \\bar{X} + \\frac{S}{\\sqrt{n}} t_{\\frac{\\alpha}{2}}(n-1) \\right] \\\\[4pt]
\\sigma^2 \\text{ 的区间 (}\\mu \\text{ 未知): } & \\left[ \\frac{(n-1)S^2}{\\chi^2_{\\frac{\\alpha}{2}}(n-1)}, \\; \\frac{(n-1)S^2}{\\chi^2_{1-\\frac{\\alpha}{2}}(n-1)} \\right]
\\end{aligned}`,
    note: '置信水平 1-\\alpha 通常取 0.95 或 0.99。',
    keywords: ['置信区间', '区间估计', '参数估计', '显著性水平', '正态总体'],
  },
]

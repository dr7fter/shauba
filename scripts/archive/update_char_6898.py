import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

# Read current characteristic.md
with open(r"E:\刷吧\characteristic.md", "r", encoding="utf-8") as f:
    text = f.read()

# Update Level 1 error statuses
text = text.replace(
    "- **[E-012] 空间曲面切平面与法线方程公式盲区**\n  - 表现：`#2783` 看到曲面在点 $(1,1,1)$ 切平面未动笔。\n  - ⚡ 补丁：显式曲面 $z - z_0 = f_x(x_0,y_0)(x-x_0) + f_y(x_0,y_0)(y-y_0)$；隐式曲面 $F_x(x-x_0)+F_y(y-y_0)+F_z(z-z_0)=0$！\n  - 状态：`[🔴 待验证]`（排期 8-28 变式抽测）。",
    "- **[E-012] 空间曲面切平面与法线方程公式**\n  - 表现：`#2783` 曾遗漏公式；`#2758` 成功 100% 独立写出椭球面切平面方程 $\\frac{2}{a^2}x_0(x-x_0)+\\frac{2}{b^2}y_0(y-y_0)+\\frac{2}{c^2}z_0(z-z_0)=0$。\n  - ⚡ 补丁：显式 $z-z_0 = f_x(x-x_0)+f_y(y-y_0)$；隐式 $F_x(x-x_0)+F_y(y-y_0)+F_z(z-z_0)=0$；截距化简直接利用原曲面方程等于 1！\n  - 状态：`[🟡 2026-08-28 观察中 · 公式已掌握]`。"
)

text = text.replace(
    "- **[E-013] 拉格朗日乘数法构造与联立消元技巧盲区**\n  - 表现：`#10714` 看到单约束极值未设 $L = f - \\lambda \\varphi$。\n  - ⚡ 补丁：设 $L = f(x,y) - \\lambda \\varphi(x,y) \\implies$ 偏导令零 $L_x=0, L_y=0 \\implies$ 两式相减提取 $(x-y)$ 快速分类求解！\n  - 状态：`[🔴 待验证]`（排期 8-28 变式抽测）。",
    "- **[E-013] 拉格朗日乘数法构造与联立消元技巧**\n  - 表现：`#10714` 曾未设 $L$；`#2733` 成功构造 $L$ 并用相减法准确提取 $x=y$ 分支算出最小值 $-9$。\n  - ⚡ 补丁：设 $L = f - \\lambda \\varphi \\implies L_x=0, L_y=0 \\implies$ 相减与相加对称两分支全覆盖！\n  - 状态：`[🟡 2026-08-28 观察中 · 核心套路已成型]`。"
)

text = text.replace(
    "- **[E-014] 闭区域最值「边界一元化代换」临门一脚未闭环**\n  - 表现：`#2784`、`#2767` 内部驻点与 Hessian 判别全对，且边界已代换为 $g(y) = 3 - \\frac{5}{4}y^2$，但未标出 $y\\in[-2,2]$ 定出最大 3 最小 -2。\n  - ⚡ 补丁：边界化简为一元函数后，**必须第一步标出边界自变量闭区间 $[a,b]$**，求导求端点值直接闭环！\n  - 状态：`[🔴 待验证]`。",
    "- **[E-014] 闭区域最值「边界一元化代换」与分段边界**\n  - 表现：`#2768` 完美将圆弧边界代换为 $g(y)=y^4-3y^2+4(0\\leqslant y\\leqslant 2)$ 求导满分锁定最大值 $8$！\n  - ⚡ 补丁：分段边界（圆弧段 + 直线段 $y=0$）逐段代换求导并汇总端点值。\n  - 状态：`[🟡 2026-08-28 观察中 · 降维求导极佳]`。"
)

with open(r"E:\刷吧\characteristic.md", "w", encoding="utf-8") as f:
    f.write(text)

print("characteristic.md successfully updated after batch 6898!")

import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

# Read current characteristic.md
with open(r"E:\刷吧\characteristic.md", "r", encoding="utf-8") as f:
    text = f.read()

# Add to section 1 (Signature Strengths)
new_strengths = """10. ⚡ **二重积分交换积分次序与连续分部积分秒杀法**
    - **实战证据**：`#3005`（369秒满分，Rating 1.25）、`#2806`（306秒满分，Rating 1.30）、`#2932`（133秒秒杀）
    - **特征**：对 $e^{-y^2}$、$\frac{\sin y}{y}$ 等不可积因式的交换次序嗅觉极其敏锐，$X$ 型区域定限与连续分部积分计算零失误；反三角函数非单调区间定限无懈可击。
"""

text = text.replace(
    "## 一、学员专属实战风格与王牌武器库 (Signature Strengths)\n\n> 这是你在实战中已经得到多次数据验证、步骤极其扎实、甚至具备秒杀能力的**核心硬功**：",
    "## 一、学员专属实战风格与王牌武器库 (Signature Strengths)\n\n> 这是你在实战中已经得到多次数据验证、步骤极其扎实、甚至具备秒杀能力的**核心硬功**：\n\n" + new_strengths
)

with open(r"E:\刷吧\characteristic.md", "w", encoding="utf-8") as f:
    f.write(text)

print("characteristic.md successfully updated with double integrals strengths!")

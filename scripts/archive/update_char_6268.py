import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open(r"E:\刷吧\characteristic.md", "r", encoding="utf-8") as f:
    text = f.read()

# Add to section 1 (Signature Strengths)
new_strengths = """11. ⚡ **绝对值分段二重积分与 Riemann 双重和式极限定义法**
    - **实战证据**：`#2909`（330秒满分秒杀，Rating 1.30）、`#2986`（130秒满分秒杀，Rating 1.30）、`#2953`（140秒满分）
    - **特征**：面对圆域绝对值 $|r^2-4|$ 极坐标分段代数展开零笔误；面对考研压轴双重 Riemann 和式极限，敏锐提取 $\\frac{1}{n^2}\\to\\mathrm{d}\\sigma$ 瞬秒二重积分。
"""

text = text.replace(
    "## 一、学员专属实战风格与王牌武器库 (Signature Strengths)\n\n> 这是你在实战中已经得到多次数据验证、步骤极其扎实、甚至具备秒杀能力的**核心硬功**：\n\n",
    "## 一、学员专属实战风格与王牌武器库 (Signature Strengths)\n\n> 这是你在实战中已经得到多次数据验证、步骤极其扎实、甚至具备秒杀能力的**核心硬功**：\n\n" + new_strengths
)

with open(r"E:\刷吧\characteristic.md", "w", encoding="utf-8") as f:
    f.write(text)

print("characteristic.md successfully updated with latest double integral strengths!")

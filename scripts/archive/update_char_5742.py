import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open(r"E:\刷吧\characteristic.md", "r", encoding="utf-8") as f:
    text = f.read()

# Add new weapon 13
new_strengths = """13. ⚡ **Riemann和式极限转定积分、分部积分与有理分式长除法压轴通关**
    - **实战证据**：`#3839`（600秒压轴满分，Rating 1.45）、`#3718`（256秒满分，Rating 1.35）、`#4100`（248秒满分，Rating 1.35）、`#3616`（210秒满分）、`#3487`（133秒满分）
    - **特征**：和式极限结构精准识别为定积分；凑微分分部积分边界代入零失误；有理分式多项式长除法 $\\frac{t^4}{t^2+1}=t^2-1+\\frac{1}{t^2+1}$ 拆项极其娴熟；卷积变上限积分换元求导与保号性极值判定如臂使指。
"""

text = text.replace(
    "## 一、学员专属实战风格与王牌武器库 (Signature Strengths)\n\n> 这是你在实战中已经得到多次数据验证、步骤极其扎实、甚至具备秒杀能力的**核心硬功**：\n\n",
    "## 一、学员专属实战风格与王牌武器库 (Signature Strengths)\n\n> 这是你在实战中已经得到多次数据验证、步骤极其扎实、甚至具备秒杀能力的**核心硬功**：\n\n" + new_strengths
)

with open(r"E:\刷吧\characteristic.md", "w", encoding="utf-8") as f:
    f.write(text)

print("characteristic.md successfully updated with Weapon 13!")

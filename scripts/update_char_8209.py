import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open(r"E:\刷吧\characteristic.md", "r", encoding="utf-8") as f:
    text = f.read()

# Add to section 1 (Signature Strengths)
new_strengths = """12. ⚡ **分块矩阵待定求逆、一维外积内积化与伴随秩三段论**
    - **实战证据**：`#262`（203秒满分，Rating 1.30）、`#265`（524秒满分大题，Rating 1.25）、`#144`（218秒满分，Rating 1.35）、`#211`（272秒满分）、`#204`（191秒满分）、`#209`（191秒满分）
    - **特征**：副对角分块伴随求逆与行列式符号零失误；一维外积矩阵展开敏锐提标量内积 $\\alpha^T\\alpha$；伴随矩阵秩三段论与 Sylvester 秩不等式运用如臂使指。
"""

text = text.replace(
    "## 一、学员专属实战风格与王牌武器库 (Signature Strengths)\n\n> 这是你在实战中已经得到多次数据验证、步骤极其扎实、甚至具备秒杀能力的**核心硬功**：\n\n",
    "## 一、学员专属实战风格与王牌武器库 (Signature Strengths)\n\n> 这是你在实战中已经得到多次数据验证、步骤极其扎实、甚至具备秒杀能力的**核心硬功**：\n\n" + new_strengths
)

with open(r"E:\刷吧\characteristic.md", "w", encoding="utf-8") as f:
    f.write(text)

print("characteristic.md successfully updated with LA core strengths!")

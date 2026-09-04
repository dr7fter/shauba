import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open(r"E:\刷吧\characteristic.md", "r", encoding="utf-8") as f:
    text = f.read()

# Add to section 3.2
patch_text = """
- **[LA-012] 矩阵代数方程单变量消元与交换性判定** (`#278` [🟢 满分秒杀])
  - ⚡ **神经反射补丁**：$A(A-B)=E \implies B = A-A^{-1}$，代入多项式展开自然消去；或利用 $A$ 与 $A-B$ 互逆必可交换 $\implies AB=BA$，直接秒杀 $AB-BA=O$！
"""

text = text.replace(
    "### 3.2 线性代数 (LA-Series)\n",
    "### 3.2 线性代数 (LA-Series)\n" + patch_text
)

with open(r"E:\刷吧\characteristic.md", "w", encoding="utf-8") as f:
    f.write(text)

print("characteristic.md successfully updated with LA-012!")

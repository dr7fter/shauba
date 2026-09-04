import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open(r"E:\刷吧\characteristic.md", "r", encoding="utf-8") as f:
    text = f.read()

# Add to section 3 (Tactical Patches)
patch_text = """
- **[LA-010] 矩阵和的逆矩阵左右夹击提公因式法** (`#148`)
  - ⚡ **神经反射补丁**：求 $(A^{-1}+B^{-1})^{-1}$，切勿瞎凑！直接左提 $A^{-1}$、右提 $B^{-1}$：$A^{-1}+B^{-1} = A^{-1}(B+A)B^{-1}$，两边整体求逆颠倒顺序，秒出 $B(A+B)^{-1}A$（或 $A(A+B)^{-1}B$）！
- **[LA-011] 矩阵高次多项式待定系数降次求逆法** (`#149`)
  - ⚡ **神经反射补丁**：已知 $A^3=A^2+A$ 求 $(A^2+A+E)^{-1}$，放弃因式分解死胡同！直接设逆为 $xA+yE$，展开代入降次关系式对比系数，两元一次方程 30 秒秒解 $E-\\frac{1}{2}A$！
"""

text = text.replace(
    "### 3.2 线性代数 (LA-Series)\n",
    "### 3.2 线性代数 (LA-Series)\n" + patch_text
)

with open(r"E:\刷吧\characteristic.md", "w", encoding="utf-8") as f:
    f.write(text)

print("characteristic.md successfully updated with LA-010 and LA-011!")

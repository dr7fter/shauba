import sqlite3
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
db_path = os.path.expandvars(r'%APPDATA%\com.shuaba.math\shuaba.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

# 1. Search for non-explicit x reducible equation (不显含x降阶, 如 yy'' 或 y'' 与 y 关系)
print("=== Search Target 1: 不显含 x 可降阶 ===")
cursor.execute("""
    SELECT id, stem, correct_answer FROM questions 
    WHERE (stem LIKE '%y''''%' OR stem LIKE '%y"%' OR stem LIKE '%\frac{d^2y}{dx^2}%' OR stem LIKE '%d^2y%')
      AND (stem LIKE '%yy%' OR stem LIKE '%(y'')^2%' OR stem LIKE '%(y'')^2%' OR stem LIKE '%y''=%' OR stem LIKE '%y"=y%')
      AND id NOT IN (7654, 7655, 7647, 7597, 7629, 7639, 7660, 4437, 4491, 4451, 4464, 4520, 4518, 4519, 7603, 4524)
    LIMIT 10
""")
for r in cursor.fetchall():
    print(dict(r))

# 2. Search for Known solutions inverse differential equation (已知解/特解/通解反求微分方程)
print("\n=== Search Target 2: 已知解反求微分方程 ===")
cursor.execute("""
    SELECT id, stem, correct_answer FROM questions 
    WHERE (stem LIKE '%特解%' OR stem LIKE '%通解%' OR stem LIKE '%线性无关的解%')
      AND (stem LIKE '%反求%' OR stem LIKE '%求微分方程%' OR stem LIKE '%的一个解%' OR stem LIKE '%线性组合%')
      AND (stem LIKE '%y_1%' OR stem LIKE '%y_2%' OR stem LIKE '%y_3%' OR stem LIKE '%e^%' OR stem LIKE '%p(x)%')
      AND id NOT IN (7654, 7655, 7647, 7597, 7629, 7639, 7660, 4437, 4491, 4451, 4464, 4520, 4518, 4519, 7603, 4524)
    LIMIT 10
""")
for r in cursor.fetchall():
    print(dict(r))

# 3. Search for Differential Equation Geometry/Physics Application (几何应用/物理应用/切线/曲率/法线)
print("\n=== Search Target 3: 微分方程几何/物理应用 ===")
cursor.execute("""
    SELECT id, stem, correct_answer FROM questions 
    WHERE (stem LIKE '%曲线%' OR stem LIKE '%切线%' OR stem LIKE '%法线%' OR stem LIKE '%面积%' OR stem LIKE '%旋转体%')
      AND (stem LIKE '%微分方程%' OR stem LIKE '%满足%' OR stem LIKE '%方程%')
      AND (stem LIKE '%y(x)%' OR stem LIKE '%y=%' OR stem LIKE '%导数%')
      AND id NOT IN (7654, 7655, 7647, 7597, 7629, 7639, 7660, 4437, 4491, 4451, 4464, 4520, 4518, 4519, 7603, 4524)
    LIMIT 10
""")
for r in cursor.fetchall():
    print(dict(r))

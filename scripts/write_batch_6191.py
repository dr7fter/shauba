import json
import os
import sys

appdata = os.environ.get('APPDATA', r'C:\Users\86136\AppData\Roaming')
inbox_dir = os.path.join(appdata, 'com.shuaba.math', 'codex-inbox')
os.makedirs(inbox_dir, exist_ok=True)
target_file = os.path.join(inbox_dir, 'SB-BATCH-20260824-6191.json')

payload = {
  "schemaVersion": 1,
  "kind": "batch",
  "taskId": "SB-BATCH-20260824-6191",
  "summary": "【常微分方程进阶强化 8 题全景批改复盘】：整体展现出显著的战术进步与极高的执行力！在前次暴露出全微分与高阶方程短板后，本次全微分方程（#4518、#4519）判定与偏积分推导规范严密，欧拉方程（#7660）、二阶常系数共振特解（#7629）与特解结构选择（#7603）全部斩获高分！主要暴露两大致命隐患：1) **高阶非线性伪积分概念事故**（#7655 误写出 $\\int y'' dy = y'$ 违背复合求导链式法则，导致解出无 $x$ 的纯代数方程）；2) **逆向待定函数反射缺失**（#4524 面对'已知特解求待定系数方程'时卡题未动笔，遗漏了直接代入已知解定出 $p(x)$ 的第一反应）。",
  "errorTags": ["伪积分概念事故", "复合链式法则遗漏", "三角特解二次求导笔误", "已知解代入反射缺失"],
  "weaknessTags": ["不显含x可降阶微分方程", "两端同乘y'凑微分", "常系数非齐次三角求导", "已知解反求系数函数"],
  "confidence": 0.95,
  "recommendedQuestionIds": [],
  "batchAttempts": [
    {
      "questionId": 4518,
      "result": "correct",
      "selfRating": 3,
      "durationSeconds": 853,
      "summary": "全微分判定与势函数偏积分步骤完整严谨，成功求出 $\\varphi(y)=-y^2$ 并给出通解 $x^2e^y+x^3-x-y^2=C$；但耗时偏长（14分13秒），考场更推荐直接凑微分法秒杀。",
      "verdict": "correct",
      "earliestError": None,
      "errorTags": [],
      "weaknessTags": ["全微分直接凑微分"],
      "advice": "在确认全微分后，可直接观察各项凑微分：$d(x^2e^y) + d(x^3) - dx - d(y^2) = 0 \\implies x^2e^y+x^3-x-y^2=C$，15 秒即可写出通解，无需写出长篇偏积分。",
      "betterSolution": "检验全微分：$\\frac{\\partial P}{\\partial y} = 2xe^y = \\frac{\\partial Q}{\\partial x}$。\n直接凑微分：\n$$(2xe^y dx + x^2e^y dy) + 3x^2 dx - dx - 2y dy = 0$$\n$$d(x^2 e^y) + d(x^3) - d(x) - d(y^2) = 0 \\implies \\mathbf{x^2e^y + x^3 - x - y^2 = C}$$（极速 15 秒）。",
      "confidence": 0.99,
      "rating": 1.15,
      "ratingTier": "B",
      "difficultyMultiplier": 1.0,
      "dimensions": {
        "rigor": {
          "score": 95,
          "confidence": 0.95,
          "evidence": "草稿清晰写出偏导检验、不定积分与关于 $y$ 的待定函数 $\\varphi(y)$ 求解全过程。"
        },
        "computation": {
          "score": 92,
          "confidence": 0.95,
          "evidence": "偏导与一元积分计算准确无误。"
        },
        "modeling": {
          "score": 95,
          "confidence": 0.95,
          "evidence": "精准映射为全微分方程并建立势函数模型。"
        },
        "methodUse": {
          "score": 90,
          "confidence": 0.95,
          "evidence": "标准势函数偏积分法运用纯熟。"
        },
        "speed": {
          "score": 68,
          "confidence": 0.95,
          "evidence": "耗时 14分13秒，推导略显繁复拖沓。"
        },
        "strategyInsight": {
          "score": 82,
          "confidence": 0.9,
          "evidence": "全微分条件反射已建立，但未采用最速凑微分路径。",
          "techniqueLevel": 2,
          "independentDiscovery": "confirmed"
        }
      }
    },
    {
      "questionId": 4519,
      "result": "correct",
      "selfRating": 4,
      "durationSeconds": 538,
      "summary": "分式全微分方程检验精准，偏导化简与势函数构造一气呵成，顺利得出 $\\frac{x^2}{y^3} - \\frac{1}{y} = C$！",
      "verdict": "correct",
      "earliestError": None,
      "errorTags": [],
      "weaknessTags": [],
      "advice": "分式全微分中商的微分公式结构非常明显：$\\frac{2x y^3 dx - 3x^2 y^2 dy}{y^6} = d\\left(\\frac{x^2}{y^3}\\right)$，可配合商公式秒杀。",
      "betterSolution": "检验全微分：$\\frac{\\partial P}{\\partial y} = -\\frac{6x}{y^4} = \\frac{\\partial Q}{\\partial x}$。\n直接观察商微分：\n$$\\frac{2x dx}{y^3} - \\frac{3x^2 dy}{y^4} + \\frac{1}{y^2}dy = 0 \\implies d\\left(\\frac{x^2}{y^3}\\right) - d\\left(\\frac{1}{y}\\right) = 0 \\implies \\mathbf{\\frac{x^2}{y^3} - \\frac{1}{y} = C}$$。",
      "confidence": 0.99,
      "rating": 1.25,
      "ratingTier": "A",
      "difficultyMultiplier": 1.0,
      "dimensions": {
        "rigor": {
          "score": 95,
          "confidence": 0.95,
          "evidence": "草稿完整标明分式偏导 $\\frac{-6x}{y^4}$、积分与通解。"
        },
        "computation": {
          "score": 95,
          "confidence": 0.95,
          "evidence": "商式负幂次求导与积分计算极其准确。"
        },
        "modeling": {
          "score": 95,
          "confidence": 0.95,
          "evidence": "准确识别分式型全微分方程。"
        },
        "methodUse": {
          "score": 92,
          "confidence": 0.95,
          "evidence": "势函数法掌握规范。"
        },
        "speed": {
          "score": 85,
          "confidence": 0.95,
          "evidence": "耗时 8分58秒，节奏标准。"
        },
        "strategyInsight": {
          "score": 88,
          "confidence": 0.9,
          "evidence": "准确识别结构并完成积分。",
          "techniqueLevel": 2,
          "independentDiscovery": "confirmed"
        }
      }
    },
    {
      "questionId": 7655,
      "result": "wrong",
      "selfRating": 1,
      "durationSeconds": 106,
      "summary": "重大概念盲区！草稿写出'同时对 $y$ 积分'并得到 $2y' = y^3 + C_1$，混淆了自变量与因变量的微元积分（$\\int y'' dy = \\int y'' y' dx = \\frac{1}{2}(y')^2 \\neq y'$），导致最终导出无 $x$ 的纯 $y$ 代数多项式。",
      "verdict": "incorrect",
      "earliestError": "草稿第 2 行将 $2y'' = 3y^2$ 两端直接写成对 $y$ 积分得到 $2y' = y^3 + C_1$，漏乘了链式法则中的 $y'$（正确应为 $\\int 2y'' dy = \\int 2y'' y' dx = (y')^2$）。",
      "errorTags": ["概念盲区", "伪积分事故", "降阶法失效"],
      "weaknessTags": ["不显含x微分方程降阶", "两端同乘y'凑微分"],
      "advice": "牢记高阶不显含 $x$ 方程的唯二合法路径：1) **令 $y'=p(y), y''=p\\frac{dp}{dy}$**，代入得 $2p\\frac{dp}{dy}=3y^2 \\implies 2p dp = 3y^2 dy$；2) **两端同乘 $y'$ 凑微分**：$2y'y'' = 3y^2y' \\implies ((y')^2)' = (y^3)'$！绝对不能对 $y''$ 直接按 $y$ 积分！",
      "betterSolution": "方法一（同乘 $y'$ 极速凑微分）：\n原方程两端同乘 $y'$ 得：$2y'y'' = 3y^2y' \\implies ((y')^2)' = (y^3)'$；\n积分得：$(y')^2 = y^3 + C_1$；\n代入 $y(-2)=1, y'(-2)=1$ 得：$1^2 = 1^3 + C_1 \\implies C_1 = 0$；\n故 $(y')^2 = y^3 \\implies y' = y^{\\frac{3}{2}}$（因 $y'(-2)=1>0$）；\n分离变量：$y^{-\\frac{3}{2}}dy = dx \\implies -2y^{-\\frac{1}{2}} = x + C_2$；\n代入 $y(-2)=1$ 得：$-2 = -2 + C_2 \\implies C_2 = 0$；\n$\\therefore -2y^{-\\frac{1}{2}} = x \\implies y^{-\\frac{1}{2}} = -\\frac{x}{2} \\implies \\mathbf{y = \\frac{4}{x^2}}$。",
      "confidence": 0.99,
      "rating": 0.50,
      "ratingTier": "D",
      "difficultyMultiplier": 1.2,
      "dimensions": {
        "rigor": {
          "score": 20,
          "confidence": 0.95,
          "evidence": "推导中出现伪积分 $\\int y'' dy = y'$，核心数学逻辑断裂。"
        },
        "computation": {
          "score": 30,
          "confidence": 0.95,
          "evidence": "后续多项式常数代入虽然完成，但建立在错误的先验公式上。"
        },
        "modeling": {
          "score": 40,
          "confidence": 0.95,
          "evidence": "未识别出不显含 $x$ 二阶非线性微分方程的标准降阶路径。"
        },
        "methodUse": {
          "score": 20,
          "confidence": 0.95,
          "evidence": "使用了非法的伪积分操作。"
        },
        "speed": {
          "score": 90,
          "confidence": 0.95,
          "evidence": "耗时 1分46秒（由于使用错误伪积分迅速结束）。"
        },
        "strategyInsight": {
          "score": 25,
          "confidence": 0.9,
          "evidence": "缺乏对高阶导数积分微元 $dx$ 与 $dy$ 关系的本质理解。",
          "techniqueLevel": 3,
          "independentDiscovery": "uncertain"
        }
      }
    },
    {
      "questionId": 7629,
      "result": "correct",
      "selfRating": 4,
      "durationSeconds": 559,
      "summary": "二阶常系数线性非齐次共振型方程（$\\lambda=1$ 为单特征根），准确设特解 $y^* = (Ax^2+Bx)e^x$，两次求导与待定系数 $A=-1, B=-2$ 干净利落，通解完全正确！",
      "verdict": "correct",
      "earliestError": None,
      "errorTags": [],
      "weaknessTags": [],
      "advice": "共振特解设法掌握非常扎实，注意考场求导时多项式合并保持草稿区清晰。",
      "betterSolution": "1) 特征方程 $r^2-3r+2=0 \\implies r_1=1, r_2=2$；齐次解 $Y = C_1e^x + C_2e^{2x}$；\n2) 自由项 $f(x)=2xe^x$，$\\lambda=1$ 为单特征根（$k=1$），设特解 $y^* = x(Ax+B)e^x = (Ax^2+Bx)e^x$；\n3) 代入得 $A=-1, B=-2 \\implies y^* = -(x^2+2x)e^x$；\n4) $\\therefore \\mathbf{y = C_1e^x + C_2e^{2x} - (x^2+2x)e^x}$。",
      "confidence": 0.99,
      "rating": 1.25,
      "ratingTier": "A",
      "difficultyMultiplier": 1.1,
      "dimensions": {
        "rigor": {
          "score": 95,
          "confidence": 0.95,
          "evidence": "草稿完整标出特征根、特解结构式、一阶二阶导数与系数方程。"
        },
        "computation": {
          "score": 95,
          "confidence": 0.95,
          "evidence": "乘积求导与同类项合并计算零失误。"
        },
        "modeling": {
          "score": 95,
          "confidence": 0.95,
          "evidence": "准确识别共振单根 $k=1$ 并设 $x(Ax+B)e^x$。"
        },
        "methodUse": {
          "score": 95,
          "confidence": 0.95,
          "evidence": "待定系数法执行规范标准。"
        },
        "speed": {
          "score": 85,
          "confidence": 0.95,
          "evidence": "耗时 9分19秒，节奏平稳。"
        },
        "strategyInsight": {
          "score": 90,
          "confidence": 0.9,
          "evidence": "二阶非齐次特解标准反射。",
          "techniqueLevel": 2,
          "independentDiscovery": "confirmed"
        }
      }
    },
    {
      "questionId": 7639,
      "result": "wrong",
      "selfRating": 2,
      "durationSeconds": 728,
      "summary": "准确设出三角共振特解 $y^* = x(C\\cos 2x + D\\sin 2x)$；但在草稿第 4 行对第一项求二阶导时，误将外层导数直接抄写为原项，导致待定方程变为 $C+2D=1, D-2C=0$，算出错误系数 $C=1/5, D=2/5$（正确应为 $C=0, D=1/4$）。",
      "verdict": "partial",
      "earliestError": "草稿第 4 行求 $(y^*)''$ 时，中间交叉导数项未完成对 $(C\\cos 2x + D\\sin 2x)$ 的求导，误抄为 $(C\\cos 2x + D\\sin 2x)$ 而非 $(-2C\\sin 2x + 2D\\cos 2x)$。",
      "errorTags": ["计算笔误", "求导抄写失误"],
      "weaknessTags": ["乘积三角函数高阶求导", "微分算子法"],
      "advice": "1) 三角共振特解求导公式牢记：$[x \\cdot u(x)]'' = x u'' + 2u'$！代入 $y''+4y = x(u''+4u) + 2u' = \\cos 2x$；因 $u''+4u=0$，原方程直接化为 $2u' = \\cos 2x$，即 $2(-2C\\sin 2x + 2D\\cos 2x) = \\cos 2x \\implies C=0, D=1/4$！无需展开冗长的乘积二阶导；2) 掌握微分算子法 10 秒出答案。",
      "betterSolution": "【技巧一：公式 $[x u]'' + \omega^2 [x u] = 2u'$ 极速消项】：\n设 $y^* = x u(x)$，其中 $u(x) = C\\cos 2x + D\\sin 2x$ 满足 $u''+4u=0$。\n则 $(y^*)'' + 4y^* = (x u'' + 2u') + 4xu = x(u''+4u) + 2u' = 2u'$！\n直接得到：$2(-2C\\sin 2x + 2D\\cos 2x) = \\cos 2x \\implies -4C\\sin 2x + 4D\\cos 2x = \\cos 2x$\n$\\implies C = 0, D = \\frac{1}{4} \\implies \\mathbf{y^* = \\frac{x}{4}\\sin 2x}$！\n通解为 $\\mathbf{y = C_1\\cos 2x + C_2\\sin 2x + \\frac{x}{4}\\sin 2x}$。\n\n【技巧二：微分算子法（10 秒）】：\n$y^* = \\operatorname{Re}\\left(\\frac{1}{D^2+4} e^{i2x}\\right) = \\operatorname{Re}\\left(x \\frac{1}{2D} e^{i2x}\\right) = \\operatorname{Re}\\left(\\frac{x}{4i} e^{i2x}\\right) = \\operatorname{Re}\\left(-\\frac{ix}{4}(\\cos 2x + i\\sin 2x)\\right) = \\mathbf{\\frac{x}{4}\\sin 2x}$。",
      "confidence": 0.98,
      "rating": 0.78,
      "ratingTier": "C",
      "difficultyMultiplier": 1.2,
      "dimensions": {
        "rigor": {
          "score": 70,
          "confidence": 0.95,
          "evidence": "特解设法与方程代入框架完整，但二阶求导中间项笔误导致系数错误。"
        },
        "computation": {
          "score": 65,
          "confidence": 0.95,
          "evidence": "在展开 $x(C\\cos 2x + D\\sin 2x)$ 的二阶导时出现漏求导直接抄写的笔误。"
        },
        "modeling": {
          "score": 95,
          "confidence": 0.95,
          "evidence": "准确识别共振虚根 $\\pm 2i$ 并设 $x(C\\cos 2x + D\\sin 2x)$。"
        },
        "methodUse": {
          "score": 85,
          "confidence": 0.95,
          "evidence": "待定系数法思路清晰。"
        },
        "speed": {
          "score": 68,
          "confidence": 0.95,
          "evidence": "耗时 12分08秒，在复杂求导化简上耗时较长。"
        },
        "strategyInsight": {
          "score": 75,
          "confidence": 0.9,
          "evidence": "未使用 $[xu]''+\\omega^2 xu = 2u'$ 降维技巧，硬算展开二阶导。",
          "techniqueLevel": 3,
          "independentDiscovery": "confirmed"
        }
      }
    },
    {
      "questionId": 7603,
      "result": "correct",
      "selfRating": 4,
      "durationSeconds": 168,
      "summary": "准确利用非齐次叠加原理，拆分 $e^x$（单特征根 $k=1 \\implies axe^x$）与常数项 $1$（非特征根 $k=0 \\implies b$），准确锁定特解形式 $axe^x + b$，秒杀选 B！",
      "verdict": "correct",
      "earliestError": None,
      "errorTags": [],
      "weaknessTags": [],
      "advice": "叠加原理识别精准，继续保持对复合右端项的逐项特征根重数判断。",
      "betterSolution": "1) 特征方程 $r^2-1=0 \\implies r=\\pm 1$；\n2) 右端 $f(x)=e^x+1$：\n- 对于 $e^x$，$\\lambda=1$ 为单特征根，特解形式为 $x^1(a e^x) = a x e^x$；\n- 对于 $1=1\\cdot e^{0x}$，$\\lambda=0$ 不是特征根，特解形式为 $x^0(b) = b$；\n3) 由叠加原理，特解形式为 $\\mathbf{axe^x + b}$，故选 **B**。",
      "confidence": 0.99,
      "rating": 1.20,
      "ratingTier": "A",
      "difficultyMultiplier": 1.0,
      "dimensions": {
        "rigor": {
          "score": 95,
          "confidence": 0.95,
          "evidence": "草稿完整标出特征根 $\\pm 1$ 以及对应 $\\lambda=1, k=1$ 和 $\\lambda=0, k=0$ 的特解项。"
        },
        "computation": {
          "score": 95,
          "confidence": 0.95,
          "evidence": "特征根与重数判定准确。"
        },
        "modeling": {
          "score": 95,
          "confidence": 0.95,
          "evidence": "精准映射非齐次项线性叠加定理。"
        },
        "methodUse": {
          "score": 95,
          "confidence": 0.95,
          "evidence": "待定特解形式判定法运用娴熟。"
        },
        "speed": {
          "score": 92,
          "confidence": 0.95,
          "evidence": "耗时 2分48秒，在单选基准时间内。"
        },
        "strategyInsight": {
          "score": 90,
          "confidence": 0.9,
          "evidence": "重数判定标准反射。",
          "techniqueLevel": 1,
          "independentDiscovery": "confirmed"
        }
      }
    },
    {
      "questionId": 7660,
      "result": "correct",
      "selfRating": 4,
      "durationSeconds": 379,
      "summary": "欧拉方程标准变换 $x=e^t$ 与微分算子 $(D^2-4)y=0$ 运用极其熟练，准确求出通解 $y = C_1x^2 + C_2x^{-2}$，代入初值求得 $C_1=1, C_2=0 \\implies y=x^2$，解题如行云流水！",
      "verdict": "correct",
      "earliestError": None,
      "errorTags": [],
      "weaknessTags": [],
      "advice": "欧拉方程也可以直接设 $y = x^r$，代入得特征方程 $r(r-1) + r - 4 = 0 \\implies r^2 - 4 = 0 \\implies r = \\pm 2$，10 秒直接写出通解 $y = C_1x^2 + C_2x^{-2}$。",
      "betterSolution": "【欧拉特征方程极速法（10 秒）】：\n对齐次欧拉方程 $x^2 y'' + x y' - 4y = 0$，设 $y = x^r$：\n$$r(r-1) + r - 4 = 0 \\implies r^2 - 4 = 0 \\implies r = \\pm 2$$\n通解为 $y = C_1 x^2 + C_2 x^{-2}$。\n由 $y(1)=1 \\implies C_1+C_2=1$；$y'(1)=2 \\implies 2C_1-2C_2=2$；\n解得 $C_1=1, C_2=0 \\implies \\mathbf{y = x^2}$。",
      "confidence": 0.99,
      "rating": 1.25,
      "ratingTier": "A",
      "difficultyMultiplier": 1.0,
      "dimensions": {
        "rigor": {
          "score": 95,
          "confidence": 0.95,
          "evidence": "草稿清晰写出变换 $x=e^t$、算子转换、特征根、换回 $t=\\ln x$ 及初值定解方程组。"
        },
        "computation": {
          "score": 95,
          "confidence": 0.95,
          "evidence": "算子因式分解与待定系数二元一次方程组求解无误。"
        },
        "modeling": {
          "score": 95,
          "confidence": 0.95,
          "evidence": "准确识别欧拉方程标准型。"
        },
        "methodUse": {
          "score": 95,
          "confidence": 0.95,
          "evidence": "变量代换与微分算子法掌握扎实。"
        },
        "speed": {
          "score": 90,
          "confidence": 0.95,
          "evidence": "耗时 6分19秒，远快于 10分基准。"
        },
        "strategyInsight": {
          "score": 90,
          "confidence": 0.9,
          "evidence": "欧拉方程标准求解路径。",
          "techniqueLevel": 2,
          "independentDiscovery": "confirmed"
        }
      }
    },
    {
      "questionId": 4524,
      "result": "wrong",
      "selfRating": 1,
      "durationSeconds": 85,
      "summary": "卡题未动笔（草稿标注'有点识别不出这个题'）。本题核心考点为'已知特解反求未知系数方程'，只需将 $y=e^x$ 代入原方程即可定出 $p(x) = x(e^{-x}-1)$，进而求出齐次解与满足初值的特解。",
      "verdict": "incorrect",
      "earliestError": "未能在看到'设 $y=e^x$ 是方程的一个解'时触发'代入解求系数函数 $p(x)$'的第一反应，草稿完全空白。",
      "errorTags": ["概念盲区", "已知解代入反射缺失"],
      "weaknessTags": ["已知解反求系数函数", "一阶线性方程特解与通解结构"],
      "advice": "牢记题眼反射：**只要题干出现'已知 $y=y_1(x)$ 是方程的解'，第一反应永远是把 $y_1$ 代入原方程定出待定函数/参数**！求出 $p(x)$ 后方程即完全确定。",
      "betterSolution": "1) 将已知解 $y = e^x$ 代入方程 $x y' + p(x) y = x$：\n$$x e^x + p(x) e^x = x \\implies p(x) = x(e^{-x} - 1)$$\n2) 原方程化为：$y' + (e^{-x}-1)y = 1$；\n3) 因已知特解 $y^* = e^x$，对应齐次方程 $Y' + (e^{-x}-1)Y = 0$ 的通解为：\n$$\\frac{dY}{Y} = (1 - e^{-x})dx \\implies Y = C e^{x + e^{-x}}$$\n故原方程通解为 $y = e^x + C e^{x + e^{-x}}$；\n4) 代入初值 $y(\\ln 2) = 0$：\n$$0 = e^{\\ln 2} + C e^{\\ln 2 + e^{-\\ln 2}} = 2 + C e^{\\ln 2 + 1/2} = 2 + 2C e^{1/2} \\implies C = -e^{-1/2}$$\n5) $\\therefore \\mathbf{y = e^x - e^{x + e^{-x} - 1/2}}$。",
      "confidence": 0.98,
      "rating": 0.50,
      "ratingTier": "D",
      "difficultyMultiplier": 1.3,
      "dimensions": {
        "rigor": {
          "score": 0,
          "confidence": 0.95,
          "evidence": "草稿未写出任何推导，标注识别不出题目。"
        },
        "computation": {
          "score": None,
          "confidence": 0,
          "evidence": "uncertain"
        },
        "modeling": {
          "score": 20,
          "confidence": 0.95,
          "evidence": "未建立'解满足方程代入定系数'的基础建模意识。"
        },
        "methodUse": {
          "score": 20,
          "confidence": 0.95,
          "evidence": "未能触发一阶线性微分方程反求与齐次特解结构法。"
        },
        "speed": {
          "score": 90,
          "confidence": 0.95,
          "evidence": "耗时 1分25秒卡题跳过。"
        },
        "strategyInsight": {
          "score": 20,
          "confidence": 0.9,
          "evidence": "缺乏对'已知特解'这一先验条件的战术提取能力。",
          "techniqueLevel": 3,
          "independentDiscovery": "uncertain"
        }
      }
    }
  ]
}

with open(target_file, 'w', encoding='utf-8') as f:
    json.dump(payload, f, ensure_ascii=False, indent=2)

print(f"Successfully wrote batch correction JSON to {target_file}")

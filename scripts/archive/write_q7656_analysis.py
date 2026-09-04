import json
import os
import sys

appdata = os.environ.get('APPDATA', r'C:\Users\86136\AppData\Roaming')
inbox_dir = os.path.join(appdata, 'com.shuaba.math', 'codex-inbox')
os.makedirs(inbox_dir, exist_ok=True)
target_file = os.path.join(inbox_dir, 'SB-20260824-7656-2358.json')

payload = {
  "schemaVersion": 1,
  "kind": "analysis",
  "taskId": "SB-20260824-7656-2358",
  "questionId": 7656,
  "summary": "【靶向通关 · 完美纠偏】：彻底肃清了上轮测试中的伪积分错误！准确运用不显含 $x$ 可降阶代换 $y'=p(y), y''=p\\frac{dp}{dy}$，两次分离变量与微元积分推导严密，待定常数计算精准，顺利得出特解 $y = \\frac{1}{2}x^2 - 2x + \\frac{5}{2}$，锁定正确答案 A！",
  "verdict": "correct",
  "earliestError": None,
  "errorTags": [],
  "weaknessTags": [],
  "advice": "在求得一阶关系式 $y = (p^2+1)e^{C_1}$ 后，**建议立即代入初始条件 $y(1)=1, p(1)=-1$ 提前定出 $C_1=\\frac{1}{2}$**！提前定常数可避免将未定常数带入二次积分与代数配方中，节省一半的草稿计算量。",
  "betterSolution": "【技巧一：分步定初值（极速化简）】：\n1) 设 $y'=p(y), y''=p\\frac{dp}{dy}$，方程化为 $2yp\\frac{dp}{dy} = 1+p^2 \\implies \\frac{2p}{1+p^2}dp = \\frac{dy}{y}$；\n2) 积分得 $1+p^2 = C_1 y$。**此时立即代入 $y(1)=1, p(1)=-1$**：$1+(-1)^2 = C_1(1) \\implies C_1 = 2$；\n3) 则 $p^2 = 2y-1 \\implies p = \\frac{dy}{dx} = -\\sqrt{2y-1}$（因 $y'(1)=-1<0$）；\n4) 分离变量：$\\frac{dy}{\\sqrt{2y-1}} = -dx \\implies \\sqrt{2y-1} = -x + C_2$；\n5) 代入 $x=1, y=1$ 得 $\\sqrt{1} = -1 + C_2 \\implies C_2 = 2$；\n6) $\\therefore 2y-1 = (2-x)^2 = x^2-4x+4 \\implies \\mathbf{y = \\frac{1}{2}(x^2-4x+5)}$（选 A）。\n\n【技巧二：选择题极速代选项（15 秒）】：\n对选项 A $y=\\frac{1}{2}(x^2-4x+5)$：$y'=x-2, y''=1$。\n验证：$1+(y')^2 = 1+(x-2)^2 = x^2-4x+5$；$2yy'' = 2\\cdot \\frac{1}{2}(x^2-4x+5)\\cdot 1 = x^2-4x+5$；初值 $y(1)=1, y'(1)=-1$ 全部吻合，秒选 A。",
  "confidence": 0.99,
  "rating": 1.30,
  "ratingTier": "A",
  "difficultyMultiplier": 1.0,
  "dimensions": {
    "rigor": {
      "score": 95,
      "confidence": 0.95,
      "evidence": "草稿规范写出 $y'=p(y), y''=p\\frac{dp}{dy}$，两端变量分离、两次积分与常数联立求解步骤完整严谨。"
    },
    "computation": {
      "score": 95,
      "confidence": 0.95,
      "evidence": "根式积分 $\\int (C_1' y - 1)^{-1/2} dy$ 换元与常数方程组求解计算精准。"
    },
    "modeling": {
      "score": 95,
      "confidence": 0.95,
      "evidence": "精准映射为二阶不显含 $x$ 可降阶非线性微分方程。"
    },
    "methodUse": {
      "score": 95,
      "confidence": 0.95,
      "evidence": "标准降阶法运用熟练，微元跟踪毫无混淆。"
    },
    "speed": {
      "score": 88,
      "confidence": 0.95,
      "evidence": "推导平稳流畅。"
    },
    "strategyInsight": {
      "score": 90,
      "confidence": 0.9,
      "evidence": "成功攻克高阶不显含 $x$ 变量代换盲区。",
      "techniqueLevel": 2,
      "independentDiscovery": "confirmed"
    }
  },
  "recommendedQuestionIds": [],
  "recommendationReason": None
}

with open(target_file, 'w', encoding='utf-8') as f:
    json.dump(payload, f, ensure_ascii=False, indent=2)

print(f"Successfully wrote single analysis JSON to {target_file}")

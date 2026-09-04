import json
import os

target_file = r"C:\Users\86136\AppData\Roaming\com.shuaba.math\codex-inbox\SB-AI-202608260929-1347.json"

payload = {
  "schemaVersion": 2,
  "kind": "recommendation",
  "taskId": "SB-AI-202608260929-1347",
  "questionId": None,
  "summary": "线性代数矩阵模块 · 逆矩阵、伴随矩阵、秩与分块矩阵核心考法精练",
  "goal": "诊断并攻克抽象逆矩阵待定构造、伴随矩阵核心性质、解空间与伴随秩推演及分块矩阵伴随公式的综合解题能力",
  "estimatedMinutes": 35,
  "recommendedQuestionIds": [155, 141, 159, 168, 192, 244, 264],
  "recommendationOrder": [155, 141, 159, 168, 192, 244, 264],
  "questionRoles": {
    "155": "diagnosis",
    "141": "method_choice",
    "159": "consolidate",
    "168": "diagnosis",
    "192": "method_choice",
    "244": "consolidate",
    "264": "integration"
  },
  "coverage": [
    {
      "knowledge": "抽象矩阵多项式因式分解与可逆性判定",
      "questionIds": [155, 141],
      "priority": "high"
    },
    {
      "knowledge": "秩一修正阵求逆与向量内外积运算",
      "questionIds": [159],
      "priority": "high"
    },
    {
      "knowledge": "伴随矩阵四大恒等性质与行列式提系数",
      "questionIds": [168],
      "priority": "high"
    },
    {
      "knowledge": "齐次解系维数与伴随矩阵秩三段论",
      "questionIds": [192],
      "priority": "medium"
    },
    {
      "knowledge": "初等变换与初等矩阵右乘位置对应",
      "questionIds": [244],
      "priority": "medium"
    },
    {
      "knowledge": "分块上三角矩阵伴随与求逆综合推演",
      "questionIds": [264],
      "priority": "high"
    }
  ],
  "noveltyPlan": [
    "条件变式：从单矩阵代数多项式因式分解（#155, #141）变更为向量内外积构造（#159）",
    "方法切换：从伴随矩阵代数恒等式（#168）切换为方程组解空间与伴随矩阵秩的三段论推导（#192）",
    "结构升级：从单矩阵初等变换（#244）升级为分块矩阵伴随与逆的结构综合（#264）"
  ],
  "successCriteria": [
    "熟练运用待定系数法 $(E+A)(aE+bA)=E$ 在 60 秒内求出抽象逆矩阵",
    "准确掌握伴随矩阵秩的三段论判定定理（$r(A)=n \\implies r(A^*)=n$; $r(A)=n-1 \\implies r(A^*)=1$; $r(A)<n-1 \\implies r(A^*)=0$）",
    "熟练掌握分块伴随矩阵公式 $M^* = |M|M^{-1}$ 并准确计算分块求逆"
  ],
  "recommendationReason": "依据题库候选题分布，针对矩阵逆、伴随矩阵、秩与分块矩阵四大核心主干，按『概念诊断 ➔ 待定系数方法 ➔ 秩与伴随结合 ➔ 分块综合』由浅入深设计自适应梯次，在 35 分钟内精准覆盖考研矩阵高频命题形式。",
  "sourceEvidenceIds": [],
  "excludedQuestionIds": [],
  "fallbackPlan": "若分块伴随矩阵综合题难度偏高，降级为常规数值分块求逆或基础初等行变换单选题。",
  "confidence": 0.95
}

with open(target_file, "w", encoding="utf-8") as f:
    json.dump(payload, f, ensure_ascii=False, indent=2)

print(f"Successfully generated AI adaptive recommendation JSON: {target_file}")

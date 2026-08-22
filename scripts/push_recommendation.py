import json
import os
import sys

appdata = os.environ.get('APPDATA', r'C:\Users\86136\AppData\Roaming')
inbox_dir = os.path.join(appdata, 'com.shuaba.math', 'codex-inbox')
os.makedirs(inbox_dir, exist_ok=True)

rec_file = os.path.join(inbox_dir, 'SB-REC-20260820-integ04.json')

payload = {
    "schemaVersion": 1,
    "kind": "recommendation",
    "taskId": "SB-REC-20260820-integ04",
    "questionId": None,
    "summary": "一元积分进阶四重奏权威题组：两函数相乘(分部与递推) 4题 + 三角函数(有理化/线性组合/半角) 4题 + 分段与绝对值取整 4题 + 定积分特殊技巧(区间再现/奇偶抵消/变限次序) 4题",
    "verdict": None,
    "earliestError": None,
    "errorTags": [],
    "weaknessTags": ["两函数相乘", "三角函数积分", "分段函数", "定积分特殊题型"],
    "advice": "按四大部分渐进推进，重点体会：1) 两函数相乘的导数反向构造与递推；2) 三角线性组合设未知数与半角降幂；3) 分段与绝对值/取整的交界点连续性；4) 区间再现与对称抵消的秒杀化简。",
    "confidence": 0.98,
    "recommendedQuestionIds": [
        1041, 1157, 7114, 10553,
        1008, 7160, 1005, 7168,
        7173, 7179, 10563, 7218,
        7206, 2002, 7209, 7219
    ],
    "recommendationReason": "一元积分高分进阶四重奏：覆盖两函数相乘(分部/递推)、三角有理化线性组合、分段与绝对值取整、定积分区间再现与对称抵消全部数一130+权威母题。"
}

with open(rec_file, 'w', encoding='utf-8') as f:
    json.dump(payload, f, ensure_ascii=False, indent=2)

print(f"Successfully generated recommendation file: {rec_file}")
print(f"File exists: {os.path.exists(rec_file)}, size: {os.path.getsize(rec_file)} bytes")

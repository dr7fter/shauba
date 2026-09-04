import json
import os

appdata = os.environ.get('APPDATA', r'C:\Users\86136\AppData\Roaming')
inbox_dir = os.path.join(appdata, 'com.shuaba.math', 'codex-inbox')
os.makedirs(inbox_dir, exist_ok=True)

rec_file = os.path.join(inbox_dir, 'SB-REC-20260821-geo01.json')

payload = {
    "schemaVersion": 1,
    "kind": "recommendation",
    "taskId": "SB-REC-20260821-geo01",
    "questionId": None,
    "summary": "【第一批次：定积分几何应用权威题组】心形线/双纽线极坐标面积、柱壳法/绕斜线旋转体体积、曲线弧长、旋转曲面侧面积全覆盖(6题)",
    "verdict": None,
    "earliestError": None,
    "errorTags": [],
    "weaknessTags": ["定积分几何应用", "极坐标面积", "旋转体体积", "曲线弧长", "旋转曲面侧面积"],
    "advice": "几何应用核心心法：1) 极坐标面积 $dA=\\frac{1}{2}r^2 d\\theta$；2) 绕 $y$ 轴体积柱壳法 $dV = 2\\pi x y dx$；3) 弧长微元 $ds = \\sqrt{1+(y')^2}dx = \\sqrt{(x'_t)^2+(y'_t)^2}dt$；4) 绕 $x$ 轴侧面积 $dS = 2\\pi y ds$。",
    "confidence": 0.98,
    "recommendedQuestionIds": [10655, 10654, 10644, 10649, 10634, 7732],
    "recommendationReason": "一元积分几何应用全考法精炼题组：覆盖极坐标面积、旋转体体积(含柱壳法与绕斜线)、曲线弧长与旋转曲面侧面积全部数一130+母题。"
}

with open(rec_file, 'w', encoding='utf-8') as f:
    json.dump(payload, f, ensure_ascii=False, indent=2)

print(f"Successfully generated Batch 1 recommendation file: {rec_file}")

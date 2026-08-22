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
    "summary": "【第一批次：定积分几何应用全景权威题组】函数平均值(具体与方程未知)、参数/极坐标/切线最值面积、柱壳法/绕斜线体积、弧长与旋转侧面积(8题全覆盖)",
    "verdict": None,
    "earliestError": None,
    "errorTags": [],
    "weaknessTags": ["函数平均值", "直角与参数面积", "极坐标面积", "旋转体体积", "旋转曲面侧面积"],
    "advice": "几何应用五大核心公式：1) 平均值 $\\bar{y}=\\frac{1}{b-a}\\int_a^b f(x)dx$；2) 面积直角 $\\int |y_1-y_2|dx$ / 参数 $\\int y(t)x'(t)dt$ / 极坐标 $\\frac{1}{2}\\int r^2 d\\theta$；3) 体积截面 $\\pi\\int y^2 dx$ / 柱壳 $2\\pi\\int x y dx$ / 绕斜线 $\\pi\\int r^2 dl$；4) 弧长 $ds = \\sqrt{1+(y')^2}dx$；5) 侧面积 $dS = 2\\pi y ds$。",
    "confidence": 0.98,
    "recommendedQuestionIds": [10633, 2288, 2340, 7264, 10655, 10644, 10649, 7732],
    "recommendationReason": "一元积分几何应用全景母题题组：8题无死角覆盖函数平均值(具体函数与积分方程)、直角切线最值与参数摆线面积、极坐标面积、柱壳法与绕斜线体积、旋转曲面侧面积全部数一考点。"
}

with open(rec_file, 'w', encoding='utf-8') as f:
    json.dump(payload, f, ensure_ascii=False, indent=2)

print(f"Updated Batch 1 recommendation file: {rec_file}")

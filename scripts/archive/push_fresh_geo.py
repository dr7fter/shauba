import json
import os
import sys

appdata = os.environ.get('APPDATA', r'C:\Users\86136\AppData\Roaming')
inbox_dir = os.path.join(appdata, 'com.shuaba.math', 'codex-inbox')
os.makedirs(inbox_dir, exist_ok=True)

rec_file = os.path.join(inbox_dir, 'SB-REC-20260821-geo02.json')

payload = {
    "schemaVersion": 1,
    "kind": "recommendation",
    "taskId": "SB-REC-20260821-geo02",
    "questionId": None,
    "summary": "【真题精炼 · 定积分几何应用8题全景母题】函数平均值(具体与方程未知)、参数/极坐标/切线最值面积、柱壳法/绕斜线体积、旋转曲面侧面积(紧扣数一考纲，拒绝偏难怪)",
    "verdict": None,
    "earliestError": None,
    "errorTags": [],
    "weaknessTags": ["函数平均值", "直角与参数面积", "极坐标面积", "旋转体体积", "旋转曲面侧面积"],
    "advice": "8道核心真题母题，牢记几何五大考场公式：1) 平均值 $\\bar{y}=\\frac{1}{b-a}\\int_a^b f(x)dx$；2) 面积直角 $\\int |y_1-y_2|dx$ / 参数 $\\int y(t)x'(t)dt$ / 极坐标 $\\frac{1}{2}\\int r^2 d\\theta$；3) 绕 $y$ 轴柱壳体积 $2\\pi\\int x y dx$ / 绕斜线体积；4) 旋转曲面侧面积 $dS = 2\\pi y ds$。",
    "confidence": 0.99,
    "recommendedQuestionIds": [10633, 2288, 2340, 7264, 10655, 10644, 10649, 7732],
    "recommendationReason": "精选8道数一真题高频母题，紧扣考纲标准考法，难度适中、模型纯正，覆盖平均值、参数面积、极坐标面积、柱壳与绕斜线体积、侧面积全部题型。"
}

with open(rec_file, 'w', encoding='utf-8') as f:
    json.dump(payload, f, ensure_ascii=False, indent=2)

print(f"Created fresh recommendation file: {rec_file}")

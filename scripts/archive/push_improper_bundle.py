import json
import os

appdata = os.environ.get('APPDATA', r'C:\Users\86136\AppData\Roaming')
inbox_dir = os.path.join(appdata, 'com.shuaba.math', 'codex-inbox')
os.makedirs(inbox_dir, exist_ok=True)

rec_file = os.path.join(inbox_dir, 'SB-REC-20260821-imp01.json')

payload = {
    "schemaVersion": 1,
    "kind": "recommendation",
    "taskId": "SB-REC-20260821-imp01",
    "questionId": None,
    "summary": "【反常积分核心母题全景题组 (8题)】纯幂双奇点、对数双奇点、三角瑕点、p-q基准、含参消除发散项、倒代换对称性、微分方程反常积分全覆盖(90%考法)",
    "verdict": None,
    "earliestError": None,
    "errorTags": [],
    "weaknessTags": ["反常积分敛散性", "双奇点拆分", "p-积分基准", "含参反常积分", "微分方程与反常积分"],
    "advice": "反常积分四大核心解题模型：1) 双奇点拆为 $\\int_0^1 + \\int_1^{+\\infty}$ 分别判敛；2) 瑕点 $x\\to 0$ 要求阶数 $<1$，无穷限 $x\\to+\\infty$ 要求阶数 $>1$；3) 无穷限含参有理分式消除最高次发散项；4) 微分方程反常积分两边直接积分秒杀。",
    "confidence": 0.99,
    "recommendedQuestionIds": [1245, 2157, 2153, 2164, 2160, 2169, 10566, 4618],
    "recommendationReason": "精选8道数一真题高频母题，100%覆盖反常积分全部考法：包含双奇点拆分、对数/三角瑕点阶数分析、p-q基准、含参有理式消除发散项、倒代换对称性及微分方程与反常积分综合大题。"
}

with open(rec_file, 'w', encoding='utf-8') as f:
    json.dump(payload, f, ensure_ascii=False, indent=2)

print(f"Successfully generated Improper Integrals recommendation file: {rec_file}")

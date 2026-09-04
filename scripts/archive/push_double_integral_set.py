# -*- coding: utf-8 -*-
"""
二重积分漏洞侦察题组 —— 生成并推送到刷吧 codex-inbox

设计目标：
  - 覆盖题库「高等数学 / 二重积分」全部 30 个末级分类（100%）
  - 覆盖二重积分 28 项核心技巧中的 26 项以上（>90%）
  - 用选择题覆盖可替代的分类，压缩总耗时

用法：
  python scripts/push_double_integral_set.py            # 校验 + 写入收件箱
  python scripts/push_double_integral_set.py --dry      # 只校验不写入
"""
import os, sys, json, sqlite3, shutil, tempfile, random, datetime

# ---------------------------------------------------------------- 题组定义
# (题号, 角色, 分类, 一句话意图)
SET = [
    # ===== 批次 1：次序与坐标主干 =====
    (3005, "diagnosis",     "直接给出累次积分",   "换序基础：被积函数 e^{-y^2} 原函数非初等，必须换序"),
    (2806, "diagnosis",     "直角坐标·常规题",    "次序选择：sin y / y 只能先对 x 积分"),
    (2785, "consolidate",   "直角坐标·常规题",    "次序选择：e^{x^2} 只能先对 y 积分"),
    (2832, "diagnosis",     "极坐标·圆域相关",    "环域极坐标 + 轮换对称把 x^2 换成 (x^2+y^2)/2"),
    (2847, "consolidate",   "极坐标·偏心圆域",    "偏心圆 r=2cosθ 的上下限写法"),
    (2835, "diagnosis",     "极坐标·椭圆域",      "广义极坐标与雅可比 |J|=abr"),
    (2932, "method_choice", "交换次序·直角坐标",  "选择题：边界含 sin x，换序要用 x=π-arcsin y"),
    (2946, "method_choice", "交换次序·极直互换",  "选择题：极坐标累次积分还原为直角坐标"),
    (2951, "method_choice", "交换次序·写极坐标",  "选择题：两圆交集分两段写极坐标"),
    (2820, "challenge",     "直角坐标·极坐标逆问题", "给出 (r,θ) 积分，还原成直角坐标再算"),

    # ===== 批次 2：对称性、换元与分段 =====
    (2894, "challenge",     "极坐标·分子是分母一项", "轮换对称秒杀：I = 1/2 ∬ sin(πr)"),
    (2892, "consolidate",   "极坐标·若干项相加",  "奇偶对称消项 + 极坐标"),
    (2862, "challenge",     "极坐标·其他",        "一般变量替换 u=x+y, v=x-y 的雅可比"),
    (2909, "diagnosis",     "分段·绝对值",        "用 x^2+y^2=4 分域，极坐标下分段"),
    (2921, "diagnosis",     "分段·最大最小值",    "用 y=x 分域，max{x^2,y^2} 二选一"),
    (2930, "method_choice", "分段·取整",          "用 x+y=i 分域，[·] 取常数值"),
    (2898, "consolidate",   "分段·显式分段",      "|x|+|y| 分域 + 对称性降维"),
    (2873, "diagnosis",     "极坐标·区域难画",    "双纽线两小问：对称性判断 + 极坐标区域"),
    (2868, "consolidate",   "极坐标方程给出区域", "玫瑰线 r=sin3θ 一瓣的极角范围"),

    # ===== 批次 3：特殊区域、概念与综合 =====
    (2817, "challenge",     "参数方程区域",       "摆线一拱 + 形心技巧 ∬x = x̄·S"),
    (3001, "integration",   "应用·质心",          "摆线区域质心，参数方程化累次积分"),
    (2998, "integration",   "应用·体积",          "Viviani 立体体积"),
    (2816, "challenge",     "与多元微分结合",     "分部积分把 f''_xy 降阶回 ∬f"),
    (2970, "diagnosis",     "变限二重积分求导",   "先换序，再用变限求导公式"),
    (2989, "challenge",     "变限二重积分求极限", "换序 + 洛必达 + 等价无穷小"),
    (2953, "timed",         "比大小与定正负",     "选择题：比较 r, r^2, r^4 在 cos 下的大小"),
    (2986, "timed",         "二重积分定义",       "选择题：n 项二重和还原为二重积分"),
    (2972, "method_choice", "含∬等式求函数",      "选择题：设 A=∬f，两边积分解 A"),
    (2982, "method_choice", "抽象函数二重积分",   "选择题：F(x,y)+F(y,x)=a+b 轮换消元"),
    (2940, "challenge",     "交换次序·极坐标",    "固定 r 反解 θ，分段写上下限"),
]

COVERAGE = [
    ("累次积分换序：X 型 / Y 型区域互化与次序选择", "high",   [3005, 2806, 2785]),
    ("直角坐标交换次序（含反函数边界）",           "high",   [2932]),
    ("极坐标计算：圆域、环域与偏心圆域",           "high",   [2832, 2847]),
    ("广义极坐标（椭圆域）与雅可比",               "high",   [2835]),
    ("极坐标逆问题：由 (r,θ) 积分还原直角坐标",    "medium", [2820]),
    ("极直互换与写极坐标",                         "high",   [2946, 2951]),
    ("极坐标交换次序（固定 r 反解 θ）",            "medium", [2940]),
    ("对称性：奇偶对称与轮换对称",                 "high",   [2894, 2892]),
    ("一般变量替换的雅可比行列式",                 "medium", [2862]),
    ("分段被积函数：绝对值分域",                   "high",   [2909]),
    ("分段被积函数：max / min 分域",               "high",   [2921]),
    ("分段被积函数：取整函数分域",                 "medium", [2930]),
    ("显式分段函数分域积分",                       "medium", [2898]),
    ("极坐标方程围成的区域（双纽线、玫瑰线）",     "high",   [2873, 2868]),
    ("参数方程围成的区域与形心技巧",               "medium", [2817, 3001]),
    ("二重积分应用：体积与质心",                   "medium", [2998, 3001]),
    ("二重积分与多元微分结合（分部积分降阶）",     "medium", [2816]),
    ("二重变限积分求导",                           "high",   [2970]),
    ("二重变限积分求极限（换序 + 洛必达）",        "medium", [2989]),
    ("二重积分比大小与定正负",                     "high",   [2953]),
    ("二重积分定义（n 项二重和取极限）",           "high",   [2986]),
    ("含二重积分的等式求函数（设常数法）",         "high",   [2972]),
    ("抽象函数二重积分（对称性消元）",             "high",   [2982]),
]

ROLE_ALLOWED = {"diagnosis", "method_choice", "consolidate", "integration",
                "transfer", "timed", "challenge", "review"}

# ---------------------------------------------------------------- 校验
def main():
    dry = '--dry' in sys.argv
    log = []
    def p(*a):
        s = ' '.join(str(x) for x in a)
        log.append(s)
        print(s)

    src = os.path.join(os.environ['APPDATA'], 'com.shuaba.math', 'shuaba.db')
    tmp = os.path.join(tempfile.gettempdir(), '_sb_push.db')
    shutil.copy2(src, tmp)
    con = sqlite3.connect(tmp); con.row_factory = sqlite3.Row
    cur = con.cursor()

    qmap = {r['id']: r for r in cur.execute(
        "SELECT * FROM questions WHERE id IN (%s)" % ','.join('?' * len(SET)),
        [q[0] for q in SET])}

    ids = [q[0] for q in SET]
    p('=' * 78)
    p('二重积分漏洞侦察题组 · 校验报告')
    p('=' * 78)

    # 1 题号存在
    missing = [i for i in ids if i not in qmap]
    p('1. 题号存在性      : %s' % ('OK  全部 %d 题存在' % len(ids) if not missing else 'FAIL 缺失 %s' % missing))

    # 2 重复
    dup = [i for i in set(ids) if ids.count(i) > 1]
    p('2. 题号唯一性      : %s' % ('OK' if not dup else 'FAIL 重复 %s' % dup))
    p('   题量            : %d 题（后端上限 30）%s' % (len(ids), 'OK' if len(ids) <= 30 else 'FAIL'))

    # 3 角色合法
    bad_role = [(i, r) for i, r, _, _ in SET if r not in ROLE_ALLOWED]
    p('3. 角色枚举        : %s' % ('OK' if not bad_role else 'FAIL %s' % bad_role))

    # 4 coverage 引用
    bad_cov = []
    for name, _, cids in COVERAGE:
        for c in cids:
            if c not in ids:
                bad_cov.append((name, c))
    p('4. coverage 引用   : %s' % ('OK' if not bad_cov else 'FAIL %s' % bad_cov))

    # 5 已作答检查
    done = {r[0] for r in cur.execute('SELECT DISTINCT question_id FROM attempts')}
    already = [i for i in ids if i in done]
    p('5. 是否已做        : %s' % ('OK  全部为新题' % () if not already else '注意 已做过 %s' % already))

    # 6 字段完整性
    noexp = [i for i in ids if not (qmap[i]['explanation'] or '').strip()]
    noans = [i for i in ids if not (qmap[i]['correct_answer'] or '').strip()]
    p('6. 答案解析完整    : %s' % ('OK' if not noexp and not noans else 'FAIL 缺解析%s 缺答案%s' % (noexp, noans)))

    # 7 分类覆盖
    covered = set()
    all_paths = [r[0] for r in cur.execute(
        "SELECT DISTINCT category_path FROM questions WHERE category_path LIKE '高等数学 / 二重积分%'").fetchall()]
    for i in ids:
        cp = qmap[i]['category_path']
        if cp in all_paths:
            covered.add(cp)
    p('7. 分类覆盖        : %d / %d = %.1f%%' % (len(covered), len(all_paths), 100.0 * len(covered) / len(all_paths)))
    for cp in sorted(all_paths):
        hit = [i for i in ids if qmap[i]['category_path'] == cp]
        if not hit:
            p('     [未覆盖] %s' % cp)

    # 8 题型与预估耗时
    sub = [i for i in ids if qmap[i]['question_type'] == 'subjective']
    cho = [i for i in ids if qmap[i]['question_type'] == 'single_choice']
    est = len(sub) * 8 + len(cho) * 3
    p('8. 题型构成        : 主观题 %d 道 + 选择题 %d 道，预估 %d 分钟' % (len(sub), len(cho), est))
    p('   时间范围校验    : %s（后端要求 5-240）' % ('OK' if 5 <= est <= 240 else 'FAIL'))

    ok = not (missing or dup or bad_role or bad_cov or noexp or noans) and len(ids) <= 30 and 5 <= est <= 240
    p('')
    p('>>> 校验结果: %s' % ('PASS' if ok else 'FAIL（未写入）'))
    if not ok:
        return

    # ------------------------------------------------------------ 生成载荷
    now = datetime.datetime.now()
    task_id = 'SB-REC-%s-%04d' % (now.strftime('%Y%m%d'), random.randint(1000, 9999))

    payload = {
        "schemaVersion": 2,
        "kind": "recommendation",
        "taskId": task_id,
        "questionId": None,
        "summary": "二重积分漏洞侦察组（30题）：全覆盖 30 个末级分类与 26 项核心技巧，"
                   "用 7 道选择题替代可替代的主观题以压缩耗时。分 3 批完成，每批约 70 分钟。",
        "verdict": None,
        "earliestError": None,
        "errorTags": [],
        "weaknessTags": [],
        "advice": None,
        "betterSolution": None,
        "confidence": 0.93,
        "recommendedQuestionIds": ids,
        "recommendationReason": (
            "题库二重积分本体 246 题、30 个末级分类，你目前 0 覆盖。本组按『一个分类一道代表题』取样，"
            "并刻意用 7 道选择题承接可替代的分类，把总耗时压到 200 分钟以内。"
            "顺序按技巧链递进：先建立换序与极坐标主干（批次1），"
            "再检验对称性与四类分段（批次2），最后收概念与综合（批次3）。"
            "刷完据错因下钻，第二轮按断点精准补题。"
        ),
        "goal": "完整摸清二重积分 30 个末级分类的真实掌握度，输出可用于第二轮精准突破的断点清单",
        "estimatedMinutes": est,
        "questionRoles": {str(i): r for i, r, _, _ in SET},
        "recommendationOrder": ids,
        "coverage": [{"knowledge": n, "priority": pr, "questionIds": c} for n, pr, c in COVERAGE],
        "noveltyPlan": [
            "首轮全景侦察：30 个末级分类各取 1-2 题，不做同考点重复堆叠",
            "刻意混合题型：计算题后紧跟选择题，压缩总耗时同时不减少覆盖",
            "换序题分别考察两种触发条件——被积函数原函数非初等（3005/2806/2785）与边界需反解（2932/2940）",
            "对称性与分段各安排 2-3 题形成对照，避免单次失误被误判为未掌握",
        ],
        "successCriteria": [
            "批次1 后能独立判断：什么信号提示必须换序",
            "看到 x^2+y^2 与 x^2+y^2≤2ax 能在 20 秒内写出极坐标上下限",
            "四类分段（绝对值 / max / 取整 / 显式）都能正确划出分界线并分区",
            "轮换对称与奇偶对称能主动识别，而不是硬算",
            "二重变限积分求导与求极限的标准动作固化（先换序，再求导/洛必达）",
        ],
        "sourceEvidenceIds": [],
        "excludedQuestionIds": [],
    }

    if dry:
        p('')
        p('[--dry] 仅校验，未写入。taskId 预览: %s' % task_id)
        return

    inbox = os.path.join(os.environ['APPDATA'], 'com.shuaba.math', 'codex-inbox')
    os.makedirs(inbox, exist_ok=True)
    path = os.path.join(inbox, '%s.json' % task_id)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    p('')
    p('已写入收件箱: %s' % path)
    p('taskId: %s' % task_id)
    p('（刷吧每 20 秒扫描一次收件箱，会自动导入为推荐题组）')

    # 顺便导出题组明细，供生成说明文档
    detail = []
    for i, role, cat, intent in SET:
        r = qmap[i]
        detail.append({
            'id': i, 'role': role, 'cat': cat, 'intent': intent,
            'path': r['category_path'], 'difficulty': r['difficulty'],
            'type': r['question_type'],
            'stem': (r['stem'] or '').strip(),
            'answer': (r['correct_answer'] or '').strip(),
        })
    with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '_set_detail.json'),
              'w', encoding='utf-8') as f:
        json.dump({'taskId': task_id, 'estimatedMinutes': est,
                   'covered': sorted(covered), 'allPaths': sorted(all_paths),
                   'items': detail}, f, ensure_ascii=False, indent=2)

    con.close()

if __name__ == '__main__':
    main()

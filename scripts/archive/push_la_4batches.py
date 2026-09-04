# -*- coding: utf-8 -*-
"""
线代 20 题 · 四批推送（2026-08-31）

批次分工（选题原则不同，勿混用）：
  B1 修复卷 —— 已知断点 E-016「矩阵代数式先化简再动笔」，每题都要「不化简做不动」
  B2 侦察卷 —— 线性方程组，用户 0/3，零底数，按主干叶子各取 1 题
  B3 侦察卷 —— 特征值与相似对角化，用户 1/3，主干叶子各取 1 题
  B4 侦察卷 —— 二次型 + 数一专项（二次曲面 / 基变换 / 三平面），零覆盖

用法：
  python scripts/push_la_4batches.py 1        # 推送批次 1
  python scripts/push_la_4batches.py 2 --dry  # 只校验批次 2
"""
import os, sys, json, sqlite3, shutil, tempfile, random, datetime

# ---------------------------------------------------------------- 批次定义
# (题号, 角色, 一句话意图)
BATCHES = {
    1: {
        "name": "B1 · 矩阵 E-016 收口（先化简，再动笔）",
        "kind": "修复卷",
        "est": 30,
        "set": [
            (148, "diagnosis",  "$A^{-1}+B^{-1}$：先通分再取逆，禁止分别求逆"),
            (149, "consolidate","$A^3=A^2+A$ 求 $(A^2+A+E)^{-1}$：待定系数降次，禁止凑"),
            (145, "transfer",   "$[E-(E-A)^{-1}]B=A$：把 $E$ 写成 $(E-A)^{-1}(E-A)$ 提公因式"),
            (135, "review",     "$B=(E+A)^{-1}(E-A)$ 具体 4 阶：先化 $E+B=2(E+A)^{-1}$，禁止硬算"),
            (278, "challenge",  "$A^2-AB=E$：由 $A(A-B)=E$ 直接读 $A$ 可逆且 $AB=BA$"),
        ],
        "coverage": [
            ("提取公因式后再求逆：$E=(E\\pm A)^{-1}(E\\pm A)$", "high", [148, 145, 135]),
            ("多项式关系降次与待定系数法构造逆元", "high", [149]),
            ("由 $A\\cdot(\\cdot)=E$ 直接读可逆性、逆元与交换性", "high", [278]),
        ],
        "goal": "把 8/30 唯一未修的断点 E-016『矩阵代数式先化简再动笔』练成条件反射",
        "reason": ("8/30 专项组 10 题里，#143 与 #147 挂在同一个断点上——都是动笔前没对代数式做化简。"
                   "本组 5 题全部满足『不预化简就做不动』：#148 通分、#149 待定系数降次、"
                   "#145 提 $(E-A)^{-1}$、#135 是 #147 的同构变式（4 阶具体数字，专门用来检验"
                   "你会不会又去硬算 $(E+A)^{-1}$）、#278 由 $A(A-B)=E$ 一步读出 $AB=BA$。"
                   "顺序按化简动作从单步到多步递进。"),
        "criteria": [
            "每题动笔前能写出『这一步要化简什么』，而不是直接展开",
            "全程不出现 3 阶及以上的矩阵乘法或求逆（出现即路走错）",
            "#135 若仍去算 $(E+A)^{-1}$，说明 #147 未修复，需回到 #147 重做",
        ],
        "novelty": [
            "#135 刻意用具体 4 阶数字制造『硬算诱惑』，检验化简习惯是否真的建立",
            "5 题的化简动作互不重复（通分 / 降次 / 提公因式 / 恒等变形 / 读可逆性）",
            "不提供任何公式速查表——8/30 已验证『把公式摆在眼前也调不出来』，"
            "本组改用否定式禁令拦截旧路径",
        ],
    },
    2: {
        "name": "B2 · 线性方程组侦察",
        "kind": "侦察卷",
        "est": 30,
        "set": [
            (525, "diagnosis",  "解向量的线性组合：系数和为 0 即齐次解"),
            (454, "diagnosis",  "范德蒙型行列式认形，$a,d\\in\\Omega$ 一步到位"),
            (520, "method_choice","把 $\\beta=\\alpha_1+\\alpha_2+\\alpha_3+\\alpha_4$ 直接读成特解"),
            (565, "consolidate","两齐次组同解：先判 (I) 必有非零解，再反求参数"),
            (555, "consolidate","公共解：把 (II) 的通解代入 (I) 的方程定 $k_1,k_2$"),
        ],
        "coverage": [
            ("已知解向量的线性组合求通解（系数和为 0 构造齐次解）", "high", [525]),
            ("已知解的情况确定参数（范德蒙型行列式）", "high", [454]),
            ("由向量关系直接读特解与齐次解", "high", [520]),
            ("两个方程组同解：反求参数", "high", [565]),
            ("两个方程组的公共解", "high", [555]),
        ],
        "goal": "拿到线性方程组这一数一最大分值板块的第一份正确率基线（当前 0/3，无底数）",
        "reason": ("线代 958 题你只做过 24 题，方程组只做过 3 题且全错或半对（#446 半对、"
                   "#514 错、#533 错），是六大板块里成绩最差、但考试分值最大的一块（约 25%）。"
                   "本组按侦察卷取样：5 个主干叶子分类各取 1 道中等档代表题，"
                   "优先用选择题压缩耗时。不预设断点，用正确率三档定位。"),
        "criteria": [
            "≥4/5：方程组板块可直接进入强化档，下轮不再侦察",
            "2–3/5：按错题分类做一轮修复卷",
            "≤1/5：说明抽象方程组的『读系数』动作整体缺失，需回讲义重建",
        ],
        "novelty": [
            "5 题分属 5 个不同末级分类，避免同考点重复堆叠",
            "2 道选择题承接参数判定类，把总耗时压到 30 分钟内",
            "不给答案：侦察卷给答案会污染诊断",
        ],
    },
    3: {
        "name": "B3 · 特征值与相似对角化侦察",
        "kind": "侦察卷",
        "est": 40,
        "set": [
            (749, "diagnosis",  "秩一矩阵 $A=\\alpha\\beta^T$：特征值秒答 $0$ 与 $\\beta^T\\alpha$"),
            (705, "diagnosis",  "二重特征值是否可对角化：看 $r(\\lambda E-A)$ 是否等于 $n-2$"),
            (735, "consolidate","相似不变量（迹 / 行列式 / 特征多项式）反求参数再求 $P$"),
            (768, "transfer",   "实对称 $\\Rightarrow$ 不同特征值特征向量正交，据此补全特征向量"),
            (744, "challenge",  "4 阶块上三角对角化，并用对角化求 $(2E-A^2)^{-1}$"),
        ],
        "coverage": [
            ("秩一矩阵 $\\alpha\\beta^T$ 的特征值", "high", [749]),
            ("二重特征值可对角化的判定", "high", [705]),
            ("相似不变量反求参数并求 $P^{-1}AP=\\Lambda$", "high", [735]),
            ("实对称矩阵特征向量的正交性", "high", [768]),
            ("块上三角矩阵的特征值与 4 阶对角化", "medium", [744]),
        ],
        "goal": "拿到特征值与相似对角化板块的正确率基线（当前 1/3，#664 与 #687 均错）",
        "reason": ("特征值与二次型是数一线代大题的两大常客，合计约 40% 分值，而你一共只做过 5 题。"
                   "本组按侦察卷取样：从『秒答型』（秩一矩阵）起步建立手感，"
                   "经二重根判定与相似不变量，最后用 4 阶块上三角压轴。"
                   "#768 刻意选入——它的关键动作『实对称则不同特征值的特征向量正交』"
                   "正是 8/28 侦察卷 #664 挂掉的那一条，可在真实难度下复查。"),
        "criteria": [
            "≥4/5：特征值与对角化主干已通，下轮转二次型",
            "2–3/5：按错题分类做修复卷",
            "≤1/5：特征值计算本身有问题，需先补基础计算量",
        ],
        "novelty": [
            "第 1 题刻意设为『认出即秒杀』的秩一矩阵，用于区分『不会』与『检索慢』",
            "5 题分属 5 个不同末级分类",
            "#744 的 (II) 与 B1 的化简主线呼应，可跨批观察习惯是否迁移",
        ],
    },
    4: {
        "name": "B4 · 二次型 + 数一专项侦察",
        "kind": "侦察卷",
        "est": 25,
        "set": [
            (889, "diagnosis",  "全 1 矩阵 = 秩一，特征值 $4,0,0,0$ $\\Rightarrow$ 相似且合同"),
            (770, "transfer",   "正交变换标准形系数即特征值，$Q$ 的列即单位特征向量"),
            (955, "diagnosis",  "三平面交一线 $\\Rightarrow$ $r(A)=r(\\bar A)=2$"),
            (944, "diagnosis",  "过渡矩阵：$(\\text{新基})=(\\text{旧基})C$"),
            (946, "consolidate","二次曲面标准形系数即特征值，用 $|A|=0$ 反求 $a$"),
        ],
        "coverage": [
            ("实对称矩阵相似与合同的判定", "high", [889]),
            ("正交变换化标准形与反求实对称矩阵 $A$", "high", [770]),
            ("三平面位置关系与系数矩阵 / 增广矩阵秩", "high", [955]),
            ("基变换与过渡矩阵", "high", [944]),
            ("二次曲面方程经正交变换化标准形", "high", [946]),
        ],
        "goal": "补齐数一专属考点（二次曲面 / 基变换过渡矩阵 / 三平面）的零覆盖，并复查二次型",
        "reason": ("题库『线性代数 / 数学一专项』29 题是数一独有考点，你 0 覆盖，"
                   "而这三类题型（二次曲面、过渡矩阵、三平面位置关系）在数一真题里年年各出一道小题，"
                   "每题只值 5 分但全是『识别即秒杀』——性价比最高的补缺。 "
                   "二次型只给 2 题是因为 #808（正交对角化）你已拿满分、属已固化，"
                   "本组只用 #770 在真题难度下复查同一动作。"),
        "criteria": [
            "≥4/5：数一专项三类小题已通，后续靠真题维持即可",
            "2–3/5：把错的那类单独补 3–5 题",
            "≤1/5：数一专属几何直觉缺失，需专门过一遍向量空间与二次曲面",
        ],
        "novelty": [
            "3 道选择题全是数一真题原卷，单题 2–3 分钟，补 3 个零覆盖考点只要 8 分钟",
            "刻意把二次型压到 2 题，把名额让给零覆盖且年年考的数一专项",
            "#946 与 #770 共用『标准形系数即特征值』这一动作，形成对照",
        ],
    },
}

ROLE_ALLOWED = {"diagnosis", "method_choice", "consolidate", "integration",
                "transfer", "timed", "challenge", "review"}

DONE = {143, 144, 147, 177, 198, 204, 209, 211, 254, 262, 265, 274, 370, 395,
        446, 514, 533, 664, 675, 687, 808, 837, 5566, 5615}


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    dry = '--dry' in sys.argv
    if not args:
        print("用法: python scripts/push_la_4batches.py <1|2|3|4> [--dry]")
        return
    bno = int(args[0])
    if bno not in BATCHES:
        print("批次只能是 1/2/3/4")
        return
    B = BATCHES[bno]
    SET = B["set"]

    log = []
    def p(*a):
        s = ' '.join(str(x) for x in a)
        log.append(s); print(s)

    src = os.path.join(os.environ['APPDATA'], 'com.shuaba.math', 'shuaba.db')
    tmp = os.path.join(tempfile.gettempdir(), '_sb_la_push.db')
    shutil.copy2(src, tmp)
    con = sqlite3.connect(tmp); con.row_factory = sqlite3.Row
    cur = con.cursor()

    qmap = {r['id']: r for r in cur.execute(
        "SELECT * FROM questions WHERE id IN (%s)" % ','.join('?' * len(SET)),
        [q[0] for q in SET])}
    ids = [q[0] for q in SET]

    p('=' * 78)
    p('线代 20 题 · %s · 校验报告' % B["name"])
    p('=' * 78)
    p('卷型            : %s' % B["kind"])

    missing = [i for i in ids if i not in qmap]
    p('1. 题号存在性    : %s' % ('OK 全部 %d 题存在' % len(ids) if not missing else 'FAIL 缺失 %s' % missing))

    dup = [i for i in set(ids) if ids.count(i) > 1]
    p('2. 题号唯一性    : %s' % ('OK' if not dup else 'FAIL 重复 %s' % dup))
    p('   题量          : %d 题（后端上限 30）%s' % (len(ids), 'OK' if len(ids) <= 30 else 'FAIL'))

    bad_role = [(i, r) for i, r, _ in SET if r not in ROLE_ALLOWED]
    p('3. 角色枚举      : %s' % ('OK' if not bad_role else 'FAIL %s' % bad_role))

    bad_cov = []
    for name, _, cids in B["coverage"]:
        for c in cids:
            if c not in ids:
                bad_cov.append((name, c))
    p('4. coverage 引用 : %s' % ('OK' if not bad_cov else 'FAIL %s' % bad_cov))

    already = sorted(set(ids) & DONE)
    p('5. 是否已做      : %s' % ('OK 全部新题' if not already else '注意 已做过 %s' % already))

    noexp = [i for i in ids if not (qmap[i]['explanation'] or '').strip()]
    noans = [i for i in ids if not (qmap[i]['correct_answer'] or '').strip()]
    p('6. 答案解析完整  : %s' % ('OK' if not noexp and not noans else 'FAIL 缺解析%s 缺答案%s' % (noexp, noans)))

    sub = [i for i in ids if qmap[i]['question_type'] == 'subjective']
    cho = [i for i in ids if qmap[i]['question_type'] == 'single_choice']
    est = B["est"]
    p('7. 题型构成      : 主观题 %d + 选择题 %d，预估 %d 分钟' % (len(sub), len(cho), est))
    p('   时间范围校验  : %s（后端要求 5-240）' % ('OK' if 5 <= est <= 240 else 'FAIL'))
    p('   难度分布      : %s' % {i: qmap[i]['difficulty'] for i in ids})

    ok = (not (missing or dup or bad_role or bad_cov or noexp or noans)
          and len(ids) <= 30 and 5 <= est <= 240)
    p('')
    p('>>> 校验结果: %s' % ('PASS' if ok else 'FAIL（未写入）'))
    if not ok:
        con.close(); return

    now = datetime.datetime.now()
    task_id = 'SB-REC-%s-%04d' % (now.strftime('%Y%m%d'), random.randint(1000, 9999))

    payload = {
        "schemaVersion": 2,
        "kind": "recommendation",
        "taskId": task_id,
        "questionId": None,
        "summary": "线代 20 题四批计划之%s，共 %d 题，预估 %d 分钟。" % (B["name"], len(ids), est),
        "verdict": None,
        "earliestError": None,
        "errorTags": [],
        "weaknessTags": [],
        "advice": None,
        "betterSolution": None,
        "confidence": 0.9 if B["kind"] == "修复卷" else 0.85,
        "recommendedQuestionIds": ids,
        "recommendationReason": B["reason"],
        "goal": B["goal"],
        "estimatedMinutes": est,
        "questionRoles": {str(i): r for i, r, _ in SET},
        "recommendationOrder": ids,
        "coverage": [{"knowledge": n, "priority": pr, "questionIds": c}
                     for n, pr, c in B["coverage"]],
        "noveltyPlan": B["novelty"],
        "successCriteria": B["criteria"],
        "sourceEvidenceIds": [],
        "excludedQuestionIds": [],
    }

    if dry:
        p('')
        p('[--dry] 仅校验，未写入。taskId 预览: %s' % task_id)
        con.close(); return

    inbox = os.path.join(os.environ['APPDATA'], 'com.shuaba.math', 'codex-inbox')
    os.makedirs(inbox, exist_ok=True)
    path = os.path.join(inbox, '%s.json' % task_id)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    p('')
    p('已写入收件箱: %s' % path)
    p('taskId: %s' % task_id)

    detail = []
    for i, role, intent in SET:
        r = qmap[i]
        detail.append({
            'id': i, 'role': role, 'intent': intent,
            'path': r['category_path'], 'difficulty': r['difficulty'],
            'type': r['question_type'], 'source': r['source'],
            'stem': (r['stem'] or '').strip(),
            'answer': (r['correct_answer'] or '').strip(),
        })
    outp = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                        '_la_batch%d_detail.json' % bno)
    with open(outp, 'w', encoding='utf-8') as f:
        json.dump({'taskId': task_id, 'batch': bno, 'name': B['name'],
                   'kind': B['kind'], 'estimatedMinutes': est,
                   'items': detail}, f, ensure_ascii=False, indent=2)
    p('明细导出: %s' % outp)
    con.close()


if __name__ == '__main__':
    main()

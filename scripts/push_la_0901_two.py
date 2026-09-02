# -*- coding: utf-8 -*-
"""
2026-09-01 · 线代两组推送

  G1 验收卷 —— 8 个到期复习位 + 1 个分块秩变式哨兵
               覆盖 E-016/E-017/E-018/E-020/E-023/E-025/E-028/E-029
  G2 侦察卷 —— 相似对角化 + 二次型（零覆盖 99 个叶子里分值最重的一块）
               零底数，主干叶子各 1 题，不给答案

用法：
  python scripts/push_la_0901_two.py 1 --dry   # 只校验
  python scripts/push_la_0901_two.py 1         # 推送组 1
"""
import os, sys, json, sqlite3, shutil, tempfile, random, datetime

ROLE_ALLOWED = {"diagnosis", "method_choice", "consolidate", "integration",
                "transfer", "timed", "challenge", "review"}

# ---------------------------------------------------------------- 组定义
GROUPS = {
    1: {
        "name": "G1 · 线代到期断点验收卷",
        "kind": "验收卷",
        "est": 50,
        "set": [
            (148, "review",      "$A^{-1}+B^{-1}$：先造公分母 $A^{-1}(A+B)B^{-1}$，禁止分别求逆"),
            (149, "review",      "$A^3=A^2+A$ 求 $(A^2+A+E)^{-1}$：设 $x_0E+x_1A+x_2A^2$ 待定系数降次，禁止凑"),
            (395, "review",      "提取 $T=A^2-A$，对线性组合依次作用 $T^2,T$ 消元，验收 E-016 算子链"),
            (514, "review",      "非齐次方程组线性无关解最大个数：$(n-r(A))+1$，多出的 $1$ 是特解"),
            (533, "review",      "$Ax=v+w$（$v,w$ 为特征向量）：特解直接线性叠加 $v/3+w/5$"),
            (837, "review",      "正交谱分解前先把每个特征向量单位化，再用 $A=Q\\Lambda Q^T$"),
            (565, "review",      "齐次方程组同解：求出基础解后直接代入另一组，禁止拼 5 行大矩阵"),
            (446, "review",      "推导结束后用 2 秒核对命题序号与最终选项，验收 E-023"),
            (267, "transfer",    "分块秩变式哨兵：从列空间关系判断 $r(A,AB)$，复查 E-025 的方向感"),
        ],
        "coverage": [
            ("造公分母：$A^{-1}+B^{-1}=A^{-1}(A+B)B^{-1}$，取逆后顺序反转", "high", [148]),
            ("已知矩阵多项式方程求逆：待定系数降次，禁止凑", "high", [149]),
            ("抽象算子链：提取 $T=A^2-A$ 后逐级作用消元", "high", [395]),
            ("非齐次方程组线性无关解最大个数：$(n-r(A))+1$", "high", [514]),
            ("特征向量构造非齐次特解：$A\\xi=\\lambda\\xi\\Rightarrow A(\\xi/\\lambda)=\\xi$", "high", [533]),
            ("正交谱分解：$Q$ 的列向量必须先单位化", "high", [837]),
            ("齐次方程组同解：基础解系直接代入另一组", "high", [565]),
            ("选择题末步核对选项序号", "medium", [446]),
            ("分块矩阵秩与列空间包含关系", "high", [267]),
        ],
        "goal": "用 8 个到期复习位验收线代未修断点，并以 1 道新变式确认分块秩方向是否迁移",
        "reason": ("v4 要求复习债务优先。本组先放 8 个真实错题复习位：#148/#149 验收 E-028，"
                   "#395 验收 E-016，#514 验收 E-017，#533 验收 E-018，#837 验收 E-020，"
                   "#565 验收 E-029，#446 验收 E-023；再用从未做过的 #267 作为 E-025 分块秩变式哨兵。"
                   "9 题覆盖 8 个末级叶子，只有题池为 15 题的抽象逆叶子取 2 题，占本卷 22.2%，"
                   "符合单叶子不超过 25% 与题数/叶子数不超过 2.5 的限制。"),
        "criteria": [
            "#148 判据 <140s：一分钟内写出 $(A^{-1}+B^{-1})^{-1}=B(A+B)^{-1}A$。用数字 $\\frac1a+\\frac1b=\\frac{a+b}{ab}$ 自检顺序",
            "#149 判据 <243s：写下 $(A^2+A+E)^{-1}=x_0E+x_1A+x_2A^2$ 后，用 $A^3=A^2+A$ 把 $A^3,A^4$ 全降回 $\\{E,A,A^2\\}$",
            "#395 在 30 秒内定义 $T=A^2-A$，证明中不得机械展开 $A$ 的高次幂",
            "#565 在 20 秒内决定先求基础解并代入另一组，禁止拼接大矩阵",
            "#837 写 $A=Q\\Lambda Q^T$ 前逐列检查 $\\lVert q_i\\rVert=1$",
            "8 个复习题至少 7 题独立通过，且 #267 能在 30 秒内说清列空间包含关系；否则对应断点继续保持红色",
        ],
        "novelty": [
            "严格执行 8 个复习位，先清债务再扩新题",
            "#148/#149 保留为原题验收，按首次耗时的三分之一设置通过线",
            "#267 是唯一新题，用不同外观复查 E-025，而不是再次背诵 #274",
            "8 个末级叶子交错排列，避免同构题堆叠造成虚假熟练",
        ],
    },
    2: {
        "name": "G2 · 相似对角化与二次型侦察卷",
        "kind": "侦察卷",
        "est": 34,
        "set": [
            (722,  "diagnosis",     "不能相似对角化的快筛：看特征值重数与 $r(\\lambda E-A)$"),
            (717,  "diagnosis",     "$A$ 可对角化 与 $A^2$ 可对角化 的充分必要方向"),
            (7360, "diagnosis",     "实对称 $A^2-2A=O$ 且 $r(A)=1$：由特征值推 $A-E$ 的特征值"),
            (874,  "diagnosis",     "正惯性指数：配方法 vs 矩阵特征值法，选快的那个"),
            (895,  "diagnosis",     "合同判定：惯性指数相同即合同"),
            (729,  "method_choice", "含参矩阵相似对角化：先由 $\\lambda$ 的重数定 $a$，再求 $P$"),
            (705,  "method_choice", "特征方程有二重根：求 $a$ 后讨论 $r(\\lambda E-A)$ 判定可对角化"),
            (756,  "method_choice", "实对称各行元素之和为 3 $\\Rightarrow$ 一个特征值与特征向量直接读出"),
            (767,  "method_choice", "实对称不同特征值的特征向量正交，据此补全第三个向量反求 $A$"),
        ],
        "coverage": [
            ("判断是否可以相似对角化", "high", [722]),
            ("相似对角化的充要条件与方向辨析", "high", [717]),
            ("抽象矩阵的特征值推理（实对称 + 幂等型方程）", "high", [7360]),
            ("二次型的正负惯性指数", "high", [874]),
            ("矩阵的合同判定", "high", [895]),
            ("含参矩阵求 $P$ 使 $P^{-1}AP=\\Lambda$", "high", [729]),
            ("二重特征值可否对角化的讨论", "high", [705]),
            ("实对称矩阵求正交矩阵 $Q$", "high", [756]),
            ("由特征值与部分特征向量反求实对称矩阵 $A$", "high", [767]),
        ],
        "goal": "拿到相似对角化 + 二次型这一数一线代最大分值块的第一份正确率基线（当前 2/101 叶子，纯零覆盖）",
        "reason": ("线代 124 个叶子你只覆盖 25 个（20.2%），零覆盖 99 个。"
                   "相似对角化与二次型是线代两大出题板块（合计约占线代 60% 分值），"
                   "而你只做过 #808（正交对角化满分）与 #837（规范形 partial）两题，其余全部没碰。"
                   "本组按侦察卷取样：9 个零覆盖主干叶子各取 1 道中等档代表题，"
                   "先 5 道单选快筛建立手感，再 4 道主观大题测真实难度。"
                   "不预设断点，用正确率三档定位。"),
        "criteria": [
            "≥7/9：本块已通，下轮直接进强化档（真题难度），不再侦察",
            "4–6/9：按错题所在叶子做一轮修复卷，每叶子补 3–5 题",
            "≤3/9：特征值/对角化的基础计算链有问题，需先回讲义重建再侦察",
            "附加观察：主观题若在 5 分钟内做不完，记录卡在哪一步（计算 vs 入口）",
        ],
        "novelty": [
            "9 题分属 9 个不同末级分类，题数/叶子数 = 1.0，无取样塌缩",
            "单选 5 题全部 d1（选择题库无 d2 档，这是结构限制），主观 4 题全部 d2 中等档",
            "#895 用 d3 单选制造难度梯度，避免整卷偏易导致正确率虚高",
            "不给答案：侦察卷给答案会污染诊断",
        ],
    },
}


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    dry = '--dry' in sys.argv
    if not args:
        print("用法: python scripts/push_la_0901_two.py <1|2> [--dry]")
        return
    gno = int(args[0])
    if gno not in GROUPS:
        print("组号只能是 1/2")
        return
    G = GROUPS[gno]
    SET = G["set"]

    log = []
    def p(*a):
        s = ' '.join(str(x) for x in a)
        log.append(s); print(s)

    src = os.path.join(os.environ['APPDATA'], 'com.shuaba.math', 'shuaba.db')
    tmp = os.path.join(tempfile.gettempdir(), '_sb_la0901.db')
    shutil.copy2(src, tmp)
    con = sqlite3.connect(tmp); con.row_factory = sqlite3.Row
    cur = con.cursor()

    ids = [q[0] for q in SET]
    qmap = {r['id']: r for r in cur.execute(
        "SELECT * FROM questions WHERE id IN (%s)" % ','.join('?' * len(ids)), ids)}

    p('=' * 78)
    p('2026-09-01 线代两组 · %s · 校验报告' % G["name"])
    p('=' * 78)
    p('卷型            : %s' % G["kind"])

    missing = [i for i in ids if i not in qmap]
    p('1. 题号存在性    : %s' % ('OK 全部 %d 题存在' % len(ids) if not missing else 'FAIL 缺失 %s' % missing))

    dup = [i for i in set(ids) if ids.count(i) > 1]
    p('2. 题号唯一性    : %s' % ('OK' if not dup else 'FAIL 重复 %s' % dup))
    p('   题量          : %d 题（后端上限 30）%s' % (len(ids), 'OK' if len(ids) <= 30 else 'FAIL'))

    bad_role = [(i, r) for i, r, _ in SET if r not in ROLE_ALLOWED]
    p('3. 角色枚举      : %s' % ('OK' if not bad_role else 'FAIL %s' % bad_role))

    bad_cov = []
    for name, _, cids in G["coverage"]:
        for c in cids:
            if c not in ids:
                bad_cov.append((name, c))
    okcov = not bad_cov
    p('4. coverage 引用 : %s' % ('OK' if okcov else 'FAIL %s' % bad_cov))

    done = set(r[0] for r in cur.execute(
        "select distinct question_id from attempts where question_id in (%s)"
        % ','.join('?' * len(ids)), ids))
    p('5. 是否已做      : %s' % ('OK 全部新题' if not done else '注意 已做过 %s（review/diagnosis 角色为刻意安排）' % sorted(done)))

    noexp = [i for i in ids if len((qmap[i]['explanation'] or '').strip()) < 50]
    noans = [i for i in ids if not (qmap[i]['correct_answer'] or '').strip()]
    p('6. 答案解析完整  : %s' % ('OK' if not noexp and not noans else 'FAIL 缺/短解析%s 缺答案%s' % (noexp, noans)))

    deletemark = [i for i in ids if '待统一删除' in (qmap[i]['stem'] or '')]
    p('   待删除标记    : %s' % ('OK 无' if not deletemark else 'FAIL %s' % deletemark))

    leaves = {}
    for i in ids:
        leaves.setdefault(qmap[i]['category_path'], []).append(i)
    p('7. 叶子覆盖      : %d 题 / %d 叶子 = %.2f（>2.5 即取样塌缩）%s'
      % (len(ids), len(leaves), len(ids) / len(leaves), 'OK' if len(ids) / len(leaves) <= 2.5 else 'FAIL'))
    leaf_violations = {}
    for path, leaf_ids in leaves.items():
        pool_size = cur.execute(
            "SELECT COUNT(*) FROM questions WHERE category_path = ?", (path,)
        ).fetchone()[0]
        max_count = 1 if pool_size < 10 else 2
        if len(leaf_ids) > max_count or len(leaf_ids) / len(ids) > 0.25:
            leaf_violations[path] = {
                'ids': leaf_ids, 'pool': pool_size, 'max': max_count,
                'share': round(len(leaf_ids) / len(ids), 3),
            }
    p('   单叶子上限    : %s' % ('OK' if not leaf_violations else 'FAIL %s' % leaf_violations))

    sub = [i for i in ids if qmap[i]['question_type'] == 'subjective']
    cho = [i for i in ids if qmap[i]['question_type'] == 'single_choice']
    est = G["est"]
    p('8. 题型构成      : 主观 %d + 单选 %d，预估 %d 分钟（后端要求 5-240）%s'
      % (len(sub), len(cho), est, 'OK' if 5 <= est <= 240 else 'FAIL'))
    dd = {}
    for i in ids:
        dd.setdefault(qmap[i]['question_type'], {}).setdefault(qmap[i]['difficulty'], 0)
        dd[qmap[i]['question_type']][qmap[i]['difficulty']] += 1
    p('   难度分布      : %s' % dd)

    p('')
    p('--- 明细 ---')
    for i, role, intent in SET:
        r = qmap[i]
        p('#%-6d %-9s d%d %-13s %s' % (i, r['question_type'], r['difficulty'], role, r['category_path']))
        p('        意图: %s' % intent)

    ok = (not (missing or dup or bad_role or bad_cov or noexp or noans or deletemark or leaf_violations)
          and len(ids) <= 30 and 5 <= est <= 240 and len(ids) / len(leaves) <= 2.5)
    p('')
    p('>>> 校验结果: %s' % ('PASS' if ok else 'FAIL（未写入）'))
    if not ok or dry:
        if dry:
            p('[--dry] 仅校验，未写入。')
        con.close(); return

    now = datetime.datetime.now()
    task_id = 'SB-REC-%s-%04d' % (now.strftime('%Y%m%d'), random.randint(1000, 9999))

    payload = {
        "schemaVersion": 2,
        "kind": "recommendation",
        "taskId": task_id,
        "questionId": None,
        "summary": "2026-09-01 线代两组之%s，共 %d 题，预估 %d 分钟。" % (G["name"], len(ids), est),
        "verdict": None,
        "earliestError": None,
        "errorTags": [],
        "weaknessTags": [],
        "advice": None,
        "betterSolution": None,
        "confidence": 0.9 if G["kind"] == "修复卷" else 0.8,
        "recommendedQuestionIds": ids,
        "recommendationReason": G["reason"],
        "goal": G["goal"],
        "estimatedMinutes": est,
        "questionRoles": {str(i): r for i, r, _ in SET},
        "recommendationOrder": ids,
        "coverage": [{"knowledge": n, "priority": pr, "questionIds": c}
                     for n, pr, c in G["coverage"]],
        "noveltyPlan": G["novelty"],
        "successCriteria": G["criteria"],
        "sourceEvidenceIds": [],
        "excludedQuestionIds": [],
    }

    inbox = os.path.join(os.environ['APPDATA'], 'com.shuaba.math', 'codex-inbox')
    os.makedirs(inbox, exist_ok=True)
    path = os.path.join(inbox, '%s.json' % task_id)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

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
    outp = os.path.join(r"E:\刷吧\.workbuddy\tmp", '_g%d_detail.json' % gno)
    with open(outp, 'w', encoding='utf-8') as f:
        json.dump({'taskId': task_id, 'group': gno, 'name': G['name'],
                   'kind': G['kind'], 'estimatedMinutes': est,
                   'items': detail}, f, ensure_ascii=False, indent=2)
    p('明细导出: %s' % outp)
    con.close()


if __name__ == '__main__':
    main()

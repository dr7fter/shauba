# -*- coding: utf-8 -*-
"""
叶子级优先级分（用 gemini 第三轮标注）

优先级分 = 真题出现次数 × (1 − 该叶子是否已覆盖)
输出：未覆盖且真题高频的叶子清单 = 最该练的题

用法：python scripts/analyze_leaf_priority.py
"""
import json, io, os, csv, sqlite3, shutil, collections

ROOT = 'E:/刷吧'
D = ROOT + '/协作区/产出/分析数据/'
SRC = os.path.expanduser('~') + '/AppData/Roaming/com.shuaba.math/shuaba.db'


def main():
    ALL = [json.loads(l) for l in io.open(D + '叶子标注-全量.jsonl', encoding='utf-8') if l.strip()]
    tmp = ROOT + '/.workbuddy/tmp/lp'
    os.makedirs(tmp, exist_ok=True)
    for ext in ['', '-wal', '-shm']:
        p = SRC + ext
        if os.path.exists(p):
            shutil.copy(p, tmp + '/shuaba.db' + ext)
    con = sqlite3.connect(tmp + '/shuaba.db')
    con.row_factory = sqlite3.Row
    cur = con.cursor()

    # 每个叶子的：题库题量 / 已做题量 / 已做对
    leaf_stat = {}
    for r in cur.execute("""SELECT category_path cp, COUNT(*) n,
        SUM(CASE WHEN id IN (SELECT question_id FROM attempts) THEN 1 ELSE 0 END) done
        FROM questions WHERE category_path NOT LIKE '历年真题%' GROUP BY category_path"""):
        leaf_stat[r['cp']] = {'n': r['n'], 'done': r['done'] or 0}

    # 真题叶子频次
    freq = collections.Counter()
    yrs = collections.defaultdict(set)
    for r in ALL:
        lf = r.get('leaf')
        if lf:
            freq[lf] += 1
            yrs[lf].add(str(r.get('year')))

    rows = []
    for lf, n in freq.items():
        st = leaf_stat.get(lf, {'n': 0, 'done': 0})
        covered = st['done'] > 0
        rows.append({
            '叶子': lf,
            '真题出现次数': n,
            '真题出现年份数': len(yrs[lf]),
            '题库题量': st['n'],
            '题库已做': st['done'],
            '是否已覆盖': '是' if covered else '否',
            '优先级分': round(n * (0 if covered else 1), 2),
        })
    rows.sort(key=lambda x: (-x['优先级分'], -x['真题出现次数']))

    outp = D + '叶子级优先级分.json'
    json.dump(rows, io.open(outp, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    with io.open(D + '叶子级优先级分.csv', 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)

    # 盲区统计（无 leaf 的题）
    blind = collections.Counter(r.get('chapter') for r in ALL if not r.get('leaf'))

    print("=" * 88)
    print("叶子级优先级分")
    print("=" * 88)
    print()
    print("有叶子标注的题：%d / %d（%.1f%%）" % (len(ALL) - sum(blind.values()), len(ALL),
          (len(ALL) - sum(blind.values())) / len(ALL) * 100))
    print("落到 %d 个不同叶子" % len(rows))
    n_un = sum(1 for r in rows if r['是否已覆盖'] == '否')
    print("其中 **未覆盖** 的叶子：%d 个" % n_un)
    print()
    print("★ 未覆盖 × 真题高频 —— 最该练的 TOP 25")
    print("-" * 88)
    print("%-3s %-58s %5s %5s %s" % ('#', '叶子', '真题', '年份', '题库题量'))
    k = 0
    for r in rows:
        if r['是否已覆盖'] == '否':
            k += 1
            if k <= 25:
                lv = r['叶子'].replace('高等数学 / ', '').replace('线性代数 / ', '').replace('概率统计 / ', '')
                print("%-3d %-58s %5d %5d %s" % (k, lv[:56], r['真题出现次数'], r['真题出现年份数'],
                                                 r['题库题量']))

    print()
    print("★ 题库盲区（真题考了但题库无对应叶子，无法归类）")
    print("-" * 88)
    tot_blind = sum(blind.values())
    for ch, n in blind.most_common():
        print("   %-24s %3d 题  (%.1f%%)" % (ch, n, n / len(ALL) * 100))
    print("   %-24s %3d 题  (%.1f%%)" % ('合计', tot_blind, tot_blind / len(ALL) * 100))

    con.close()
    for f in os.listdir(tmp):
        try: os.remove(os.path.join(tmp, f))
        except Exception: pass
    os.rmdir(tmp)
    print()
    print("输出: %s" % outp)


if __name__ == '__main__':
    main()

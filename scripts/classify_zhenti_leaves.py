# -*- coding: utf-8 -*-
"""
把真题归类到项目既有的 679 个知识点叶子（两阶段匹配）

阶段1：定章节  —— gemini 精标注优先，无标注则用关键词表
阶段2：在章节内的叶子池里，用 TF-IDF 余弦相似度选最优叶子

为什么这么做：
  项目已有成熟的叶子体系（高数483+线代124+概率72=679），
  我的覆盖度统计就是基于它。真题若也带叶子，优先级分可从
  章节级精确到叶子级，且不需要维护额外的标签体系。

输入：协作区/产出/gemini/真题考点标注-批次N.jsonl + 库内真题文本
输出：协作区/产出/分析数据/真题叶子映射.jsonl / .csv

用法：python scripts/classify_zhenti_leaves.py
"""
import json, io, os, re, csv, sqlite3, shutil, math, collections

ROOT = 'E:/刷吧'
BASE = ROOT + '/协作区/产出/gemini/'
OUTD = ROOT + '/协作区/产出/分析数据/'
SRC = os.path.expanduser('~') + '/AppData/Roaming/com.shuaba.math/shuaba.db'

# 章节 → 库内叶子前缀
SEC_PREFIX = {
 '高数·极限与连续': '高等数学 / 极限', '高数·一元微分': '高等数学 / 一元微分',
 '高数·一元积分': '高等数学 / 一元积分', '高数·多元微分': '高等数学 / 多元微分',
 '高数·二重积分': '高等数学 / 二重积分', '高数·常微分方程': '高等数学 / 微分方程',
 '高数·级数': '高等数学 / 级数', '高数·数项级数': '高等数学 / 级数',
 '高数·幂级数': '高等数学 / 级数', '高数·傅里叶级数': '高等数学 / 级数',
 '线代·行列式': '线性代数 / 行列式', '线代·矩阵': '线性代数 / 矩阵',
 '线代·向量': '线性代数 / 向量', '线代·线性方程组': '线性代数 / 线性方程组',
 '线代·特征值与特征向量': '线性代数 / 特征值与特征向量', '线代·二次型': '线性代数 / 二次型',
 '概率·事件与概率': '概率统计 / 事件与概率', '概率·一维随机变量': '概率统计 / 一维随机变量',
 '概率·二维随机变量': '概率统计 / 二维随机变量', '概率·数字特征': '概率统计 / 数字特征',
 '概率·参数估计': '概率统计 / 统计初步', '概率·区间估计与假设检验': '概率统计 / 统计初步',
 '概率·统计量分布': '概率统计 / 统计初步',
 '概率·大数定律与中心极限定理': '概率统计 / 大数定律中心极限定理',
}

# 关键词 → 章节（无 gemini 标注时的兜底）
KW = [
 ('三重积分','高数·多重积分'),('曲线积分','高数·曲线积分'),('曲面积分','高数·曲面积分'),
 ('二重积分','高数·二重积分'),('高斯','高数·曲面积分'),('格林','高数·曲线积分'),
 ('斯托克斯','高数·曲面积分'),('偏导','高数·多元微分'),('全微分','高数·多元微分'),
 ('梯度','高数·多元微分'),('隐函数','高数·多元微分'),('傅里叶','高数·傅里叶级数'),
 ('幂级数','高数·幂级数'),('收敛域','高数·幂级数'),('和函数','高数·幂级数'),
 ('级数','高数·数项级数'),('敛散','高数·数项级数'),('微分方程','高数·常微分方程'),
 ('定积分','高数·一元积分'),('反常积分','高数·一元积分'),('变限积分','高数·一元积分'),
 ('旋转体','高数·一元积分'),('积分','高数·一元积分'),('中值定理','高数·一元微分'),
 ('泰勒','高数·一元微分'),('拐点','高数·一元微分'),('极值','高数·一元微分'),
 ('导数','高数·一元微分'),('极限','高数·极限与连续'),('渐近线','高数·极限与连续'),
 ('行列式','线代·行列式'),('正交','线代·二次型'),('二次型','线代·二次型'),
 ('特征值','线代·特征值与特征向量'),('特征向量','线代·特征值与特征向量'),
 ('相似','线代·特征值与特征向量'),('方程组','线代·线性方程组'),('通解','线代·线性方程组'),
 ('线性无关','线代·向量'),('线性相关','线代·向量'),('向量','线代·向量'),
 ('矩阵','线代·矩阵'),('秩','线代·矩阵'),
 ('随机变量','概率·一维随机变量'),('分布函数','概率·一维随机变量'),
 ('正态','概率·一维随机变量'),('密度','概率·一维随机变量'),
 ('二维','概率·二维随机变量'),('联合分布','概率·二维随机变量'),
 ('期望','概率·数字特征'),('方差','概率·数字特征'),('协方差','概率·数字特征'),
 ('相关系数','概率·数字特征'),('最大似然','概率·参数估计'),('矩估计','概率·参数估计'),
 ('估计','概率·参数估计'),('置信区间','概率·区间估计与假设检验'),
 ('假设检验','概率·区间估计与假设检验'),('统计量','概率·统计量分布'),
 ('中心极限','概率·大数定律与中心极限定理'),('大数定律','概率·大数定律与中心极限定理'),
 ('切比雪夫','概率·大数定律与中心极限定理'),('概率','概率·事件与概率'),
 ('贝叶斯','概率·事件与概率'),('全概率','概率·事件与概率'),
]

STOP = set('的是在为与和及或则若求设已由可知因此所以其中下列的是我们可得故有且'
           '于当从到对能可需要使得证明计算下列各题本题满分每小题'.replace('的', ''))


def ngrams(text, n=2):
    """中文 n-gram 特征"""
    if not text:
        return set()
    t = re.sub(r'[^\u4e00-\u9fa5A-Za-z0-9]+', '', text)
    out = set()
    for i in range(len(t) - n + 1):
        g = t[i:i + n]
        if g not in STOP:
            out.add(g)
    return out


def main():
    os.makedirs(OUTD, exist_ok=True)
    tmp = ROOT + '/.workbuddy/tmp/cl'
    os.makedirs(tmp, exist_ok=True)
    for ext in ['', '-wal', '-shm']:
        p = SRC + ext
        if os.path.exists(p):
            shutil.copy(p, tmp + '/shuaba.db' + ext)
    con = sqlite3.connect(tmp + '/shuaba.db')
    con.row_factory = sqlite3.Row
    cur = con.cursor()

    # ---- 叶子池：每个叶子 = 其下题目的文本拼接 ----
    leaf_q = collections.defaultdict(list)
    for r in cur.execute("""SELECT category_path cp, stem, explanation, correct_answer
                            FROM questions WHERE category_path NOT LIKE '历年真题%'"""):
        leaf_q[r['cp']].append(" ".join([str(r['stem'] or ''), str(r['explanation'] or '')]))
    leaves = sorted(leaf_q)

    # 章节 → 叶子列表
    sec_leaves = collections.defaultdict(list)
    for lv in leaves:
        for sec, pre in SEC_PREFIX.items():
            if lv.startswith(pre + ' /') or lv.startswith(pre):
                sec_leaves[sec].append(lv)
                break

    # ---- 叶子向量（TF-IDF）----
    leaf_tf = {}
    df = collections.Counter()
    for lv in leaves:
        c = collections.Counter()
        for txt in leaf_q[lv][:60]:
            c.update(ngrams(txt))
        leaf_tf[lv] = c
        for g in c:
            df[g] += 1
    N = len(leaves)

    def vec(tf):
        v = {}
        for g, f in tf.items():
            idf = math.log((N + 1) / (df.get(g, 0) + 1)) + 1
            v[g] = (1 + math.log(f)) * idf
        return v

    leaf_vec = {lv: vec(tf) for lv, tf in leaf_tf.items()}
    leaf_norm = {lv: math.sqrt(sum(x * x for x in v.values())) or 1.0
                 for lv, v in leaf_vec.items()}

    # ---- 载入真题 ----
    gem = {}
    for n in range(1, 7):
        fp = BASE + '真题考点标注-批次%d.jsonl' % n
        if os.path.exists(fp):
            for l in io.open(fp, encoding='utf-8'):
                if l.strip():
                    o = json.loads(l)
                    gem[o['question_id']] = o

    rows = cur.execute("""SELECT id, category_path cp, stem, explanation, options_json, correct_answer
                           FROM questions WHERE category_path LIKE '历年真题 / 数一%'""").fetchall()

    results = []
    for r in rows:
        qid = r['id']
        y = r['cp'].split(' / ')[-1][:4]
        is_img = 'asset://' in str(r['stem'] or '')
        g = gem.get(qid)
        text = " ".join([str(r['stem'] or ''), str(r['explanation'] or ''),
                         str(r['options_json'] or ''), str(r['correct_answer'] or '')])
        # 阶段1：定章节
        if g and g.get('chapters'):
            cand_sec = list(g['chapters'])
            # 图片题：用 core_method + topics 作为匹配文本
            text = " ".join([str(g.get('core_method') or ''),
                             " ".join(g.get('topics') or []), text])
        else:
            cand_sec = []
            for kw, sec in KW:
                if kw in text:
                    cand_sec.append(sec)
            if not cand_sec:
                cand_sec = ['高数·一元微分']
        # 阶段2：在章节叶子池内做余弦相似度
        pool = []
        for s in cand_sec:
            pool.extend(sec_leaves.get(s, []))
        if not pool:
            pool = leaves
        qv = vec(collections.Counter(ngrams(text)))
        qn = math.sqrt(sum(x * x for x in qv.values())) or 1.0
        best, bs = None, 0.0
        for lv in pool:
            lv_v = leaf_vec[lv]
            dot = 0.0
            smaller, bigger = (qv, lv_v) if len(qv) < len(lv_v) else (lv_v, qv)
            for g_, x in smaller.items():
                yv = bigger.get(g_)
                if yv:
                    dot += x * yv
            sim = dot / (qn * leaf_norm[lv])
            if sim > bs:
                bs, best = sim, lv
        results.append({
            'question_id': qid, 'year': y,
            '是否图片题': is_img,
            '章节': cand_sec[0] if cand_sec else None,
            '章节候选': cand_sec,
            '叶子': best,
            '相似度': round(bs, 4),
            'core_method': (g or {}).get('core_method'),
            'topics': (g or {}).get('topics'),
            '来源': 'gemini标注' if g else '关键词兜底',
        })

    with io.open(OUTD + '真题叶子映射.jsonl', 'w', encoding='utf-8') as f:
        for x in results:
            f.write(json.dumps(x, ensure_ascii=False) + '\n')
    with io.open(OUTD + '真题叶子映射.csv', 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.DictWriter(f, fieldnames=['question_id', 'year', '是否图片题', '章节', '叶子', '相似度', 'core_method', '来源'],
                           extrasaction='ignore')
        w.writeheader()
        w.writerows(results)

    # ---- 统计 ----
    print("=" * 78)
    print("真题 → 叶子 归类结果")
    print("=" * 78)
    print("总题数 %d（图片题 %d / 文本题 %d）" % (
        len(results), sum(1 for x in results if x['是否图片题']),
        sum(1 for x in results if not x['是否图片题'])))
    ss = [x['相似度'] for x in results]
    import statistics
    print("相似度：均值 %.3f 中位 %.3f 最低 %.3f" % (
        statistics.mean(ss), statistics.median(ss), min(ss)))
    print()
    print("相似度分档（<0.05 视为不可信，需复核）：")
    for lo, hi, tag in [(0, 0.03, '❌ 极低'), (0.03, 0.05, '⚠️ 偏低'),
                        (0.05, 0.10, '🟡 中等'), (0.10, 1, '🟢 良好')]:
        n = sum(1 for x in results if lo <= x['相似度'] < hi)
        print("   %s [%.2f,%.2f): %3d 题" % (tag, lo, hi, n))
    print()
    low = sorted([x for x in results if x['相似度'] < 0.05], key=lambda x: x['相似度'])
    print("需复核的题（相似度 <0.05，共 %d）前 12：" % len(low))
    for x in low[:12]:
        print("   #%-6d %s %s → %s (%.3f)" % (
            x['question_id'], x['year'], '图' if x['是否图片题'] else '文',
            (x['叶子'] or '').split(' / ')[-1], x['相似度']))

    print()
    print("叶子覆盖：%d 个真题落到了 %d 个不同叶子" % (
        len(results), len(set(x['叶子'] for x in results))))

    con.close()
    for f_ in os.listdir(tmp):
        try: os.remove(os.path.join(tmp, f_))
        except Exception: pass
    os.rmdir(tmp)


if __name__ == '__main__':
    main()

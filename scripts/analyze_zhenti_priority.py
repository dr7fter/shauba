# -*- coding: utf-8 -*-
"""
数一真题优先级分分析（可复现）

输入：
  1) 协作区/产出/gemini/真题考点标注-批次N.jsonl   —— gemini 图片题精标注（含准确 score）
  2) 刷吧数据库（只读快照）                        —— 文本题 + 我的作答记录
输出：
  协作区/产出/分析数据/真题优先级分.{json,csv}
  协作区/产出/分析数据/会做但慢.json
  协作区/产出/分析数据/真题考点标注-全量.jsonl

用法：python scripts/analyze_zhenti_priority.py
"""
import json, io, os, csv, sqlite3, shutil, collections, statistics

ROOT = 'E:/刷吧'
BASE = ROOT + '/协作区/产出/gemini/'
OUTD = ROOT + '/协作区/产出/分析数据/'
SRC = os.path.expanduser('~') + '/AppData/Roaming/com.shuaba.math/shuaba.db'

# 受控词表 → 我的板块路径（用于算覆盖度）
COV_MAP = {
 '高数·一元微分': '高等数学 / 一元微分', '高数·一元积分': '高等数学 / 一元积分',
 '高数·多元微分': '高等数学 / 多元微分', '高数·二重积分': '高等数学 / 二重积分',
 '高数·极限与连续': '高等数学 / 极限',
 '高数·数项级数': '高等数学 / 级数', '高数·幂级数': '高等数学 / 级数',
 '高数·傅里叶级数': '高等数学 / 级数', '高数·常微分方程': '高等数学 / 微分方程',
 '高数·三重积分': None, '高数·曲线积分': None, '高数·曲面积分': None,
 '高数·空间解析几何': None,
 '线代·行列式': '线性代数 / 行列式', '线代·矩阵': '线性代数 / 矩阵',
 '线代·向量': '线性代数 / 向量', '线代·线性方程组': '线性代数 / 线性方程组',
 '线代·特征值与特征向量': '线性代数 / 特征值与特征向量', '线代·二次型': '线性代数 / 二次型',
 '概率·事件与概率': '概率统计 / 事件与概率', '概率·一维随机变量': '概率统计 / 一维随机变量',
 '概率·二维随机变量': '概率统计 / 二维随机变量', '概率·数字特征': '概率统计 / 数字特征',
 '概率·大数定律与中心极限定理': '概率统计 / 大数定律中心极限定理',
 '概率·参数估计': '概率统计 / 统计初步', '概率·区间估计与假设检验': '概率统计 / 统计初步',
 '概率·统计量分布': '概率统计 / 统计初步',
}

# 文本题的关键词 → 受控词表（长词优先，避免"积分"吃掉"二重积分"）
KW = [
 ('三重积分','高数·三重积分'),('曲线积分','高数·曲线积分'),('曲面积分','高数·曲面积分'),
 ('二重积分','高数·二重积分'),('高斯公式','高数·曲面积分'),('格林公式','高数·曲线积分'),
 ('斯托克斯','高数·曲面积分'),('散度','高数·曲面积分'),('旋度','高数·曲面积分'),
 ('方向导数','高数·多元微分'),('梯度','高数·多元微分'),('条件极值','高数·多元微分'),
 ('拉格朗日乘数','高数·多元微分'),('偏导','高数·多元微分'),('全微分','高数·多元微分'),
 ('隐函数','高数·多元微分'),('傅里叶','高数·傅里叶级数'),('傅立叶','高数·傅里叶级数'),
 ('幂级数','高数·幂级数'),('收敛域','高数·幂级数'),('和函数','高数·幂级数'),
 ('收敛半径','高数·幂级数'),('级数','高数·数项级数'),('敛散','高数·数项级数'),
 ('交错级数','高数·数项级数'),('微分方程','高数·常微分方程'),('欧拉方程','高数·常微分方程'),
 ('旋转体','高数·一元积分'),('反常积分','高数·一元积分'),('变限积分','高数·一元积分'),
 ('定积分','高数·一元积分'),('弧长','高数·一元积分'),('积分','高数·一元积分'),
 ('中值定理','高数·一元微分'),('罗尔','高数·一元微分'),('泰勒','高数·一元微分'),
 ('拐点','高数·一元微分'),('凹凸','高数·一元微分'),('渐近线','高数·极限与连续'),
 ('洛必达','高数·极限与连续'),('间断点','高数·极限与连续'),('无穷小','高数·极限与连续'),
 ('极限','高数·极限与连续'),('二次型','线代·二次型'),('正定','线代·二次型'),
 ('合同','线代·二次型'),('特征向量','线代·特征值与特征向量'),('特征值','线代·特征值与特征向量'),
 ('对角化','线代·特征值与特征向量'),('基础解系','线代·线性方程组'),
 ('线性方程组','线代·线性方程组'),('方程组','线代·线性方程组'),('通解','线代·线性方程组'),
 ('线性无关','线代·向量'),('线性相关','线代·向量'),('线性表示','线代·向量'),
 ('极大无关组','线代·向量'),('行列式','线代·行列式'),('伴随矩阵','线代·矩阵'),
 ('逆矩阵','线代·矩阵'),('初等变换','线代·矩阵'),('矩阵的秩','线代·矩阵'),('矩阵','线代·矩阵'),
 ('最大似然','概率·参数估计'),('似然估计','概率·参数估计'),('矩估计','概率·参数估计'),
 ('置信区间','概率·区间估计与假设检验'),('假设检验','概率·区间估计与假设检验'),
 ('显著性','概率·区间估计与假设检验'),('统计量','概率·统计量分布'),('卡方','概率·统计量分布'),
 ('中心极限定理','概率·大数定律与中心极限定理'),('大数定律','概率·大数定律与中心极限定理'),
 ('切比雪夫','概率·大数定律与中心极限定理'),('协方差','概率·数字特征'),
 ('相关系数','概率·数字特征'),('数学期望','概率·数字特征'),('方差','概率·数字特征'),
 ('期望','概率·数字特征'),('条件概率密度','概率·二维随机变量'),('联合分布','概率·二维随机变量'),
 ('边缘分布','概率·二维随机变量'),('二维随机变量','概率·二维随机变量'),('二维','概率·二维随机变量'),
 ('随机变量','概率·一维随机变量'),('分布函数','概率·一维随机变量'),
 ('密度函数','概率·一维随机变量'),('正态分布','概率·一维随机变量'),('泊松','概率·一维随机变量'),
 ('全概率','概率·事件与概率'),('贝叶斯','概率·事件与概率'),('条件概率','概率·事件与概率'),
]
FULL_YEARS = {'2009', '2010', '2011', '2012', '2014', '2015'}   # 有准确分值的完整卷
BUD = {1: 3.2, 2: 4.7, 3: 6.4}                                  # 预期耗时（分）


def main():
    os.makedirs(OUTD, exist_ok=True)
    tmp = ROOT + '/.workbuddy/tmp/an'
    os.makedirs(tmp, exist_ok=True)
    for ext in ['', '-wal', '-shm']:
        p = SRC + ext
        if os.path.exists(p):
            shutil.copy(p, tmp + '/shuaba.db' + ext)
    con = sqlite3.connect(tmp + '/shuaba.db')
    con.row_factory = sqlite3.Row
    cur = con.cursor()

    # ---------- 1. gemini 精标注 ----------
    gem = []
    for n in range(1, 7):
        fp = BASE + '真题考点标注-批次%d.jsonl' % n
        if os.path.exists(fp):
            gem.extend(json.loads(l) for l in io.open(fp, encoding='utf-8') if l.strip())
    with io.open(OUTD + '真题考点标注-全量.jsonl', 'w', encoding='utf-8') as f:
        for r in gem:
            f.write(json.dumps(r, ensure_ascii=False) + '\n')

    # ---------- 2. 文本题 ----------
    txt_rows = cur.execute(
        "SELECT id, category_path cp, stem, explanation, options_json, correct_answer "
        "FROM questions WHERE category_path LIKE '历年真题 / 数一%' "
        "AND (stem IS NULL OR stem NOT LIKE '%asset://%')").fetchall()

    stat = collections.defaultdict(lambda: collections.defaultdict(lambda: {'n': 0, 'score': 0}))
    allyears = set()
    for r in gem:
        y = str(r.get('year', ''))[:4]
        if not y.isdigit():
            continue
        allyears.add(y)
        for c in r.get('chapters', []):
            s = r.get('score')
            stat[c][y]['n'] += 1
            stat[c][y]['score'] += (s if isinstance(s, (int, float)) else 0)
    for r in txt_rows:
        y = r['cp'].split(' / ')[-1][:4]
        if not y.isdigit():
            continue
        allyears.add(y)
        t = " ".join([str(r['stem'] or ''), str(r['explanation'] or ''),
                      str(r['options_json'] or ''), str(r['correct_answer'] or '')])
        for kw, tag in KW:
            if kw in t:
                stat[tag][y]['n'] += 1
                break_only = None
        # 一题可多标签：单独再跑一次收集全部
        for kw, tag in KW:
            if kw in t:
                pass  # 已计入（去重由下面的 set 处理）
    # 上面的写法会重复计数，重新用 set 精确统计
    stat = collections.defaultdict(lambda: collections.defaultdict(lambda: {'n': 0, 'score': 0}))
    for r in gem:
        y = str(r.get('year', ''))[:4]
        if not y.isdigit():
            continue
        for c in set(r.get('chapters', [])):
            s = r.get('score')
            stat[c][y]['n'] += 1
            stat[c][y]['score'] += (s if isinstance(s, (int, float)) else 0)
    for r in txt_rows:
        y = r['cp'].split(' / ')[-1][:4]
        if not y.isdigit():
            continue
        t = " ".join([str(r['stem'] or ''), str(r['explanation'] or ''),
                      str(r['options_json'] or ''), str(r['correct_answer'] or '')])
        for tag in set(tag for kw, tag in KW if kw in t):
            stat[tag][y]['n'] += 1

    NY = len([y for y in allyears if y.isdigit()])

    # ---------- 3. 我的覆盖度 ----------
    cov = {}
    for tag, prefix in COV_MAP.items():
        if prefix is None:
            cov[tag] = None
            continue
        lv = cur.execute("SELECT COUNT(DISTINCT category_path) c FROM questions "
                         "WHERE category_path LIKE ?", (prefix + '%',)).fetchone()['c']
        cl = cur.execute("SELECT COUNT(DISTINCT q.category_path) c FROM questions q "
                         "JOIN attempts a ON a.question_id=q.id "
                         "WHERE q.category_path LIKE ?", (prefix + '%',)).fetchone()['c']
        cov[tag] = (cl, lv)

    # ---------- 4. 优先级分 ----------
    rows = []
    for c, yd in stat.items():
        years_hit = [y for y in yd if y.isdigit()]
        n_years = len(years_hit)
        tot_n = sum(v['n'] for v in yd.values())
        fy = [y for y in years_hit if y in FULL_YEARS]
        avg_score = sum(stat[c][y]['score'] for y in fy) / len(FULL_YEARS) if fy else 0.0
        rate = n_years / NY
        cv = cov.get(c)
        if cv is None:
            cov_pct, cov_str, gap = None, '题库0题', 1.0
        else:
            cl, lv = cv
            cov_pct = (cl / lv) if lv else 0.0
            cov_str = '%d/%d' % (cl, lv)
            gap = 1 - cov_pct
        rows.append({
            '章节': c, '题库叶子': (cov.get(c) or (0, 0))[1],
            '已覆盖叶子': (cov.get(c) or (0, 0))[0],
            '覆盖率': round(cov_pct, 3) if cov_pct is not None else None,
            '真题题数': tot_n, '出现年份数': n_years, '总年份数': NY,
            '出现率': round(rate, 3), '年均分值': round(avg_score, 2),
            '优先级分': round(rate * avg_score * gap, 2),
            '数据可信度': '高' if fy else '中（无分值标注）',
        })
    rows.sort(key=lambda r: -r['优先级分'])

    with io.open(OUTD + '真题优先级分.json', 'w', encoding='utf-8') as f:
        json.dump({'样本题数': len(gem) + len(txt_rows), '年份数': NY,
                   '生成时间': '2026-09-10', '章节': rows}, f,
                  ensure_ascii=False, indent=2)
    with io.open(OUTD + '真题优先级分.csv', 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)

    # ---------- 5. 会做但慢 ----------
    att = cur.execute(
        "SELECT q.category_path cp, a.outcome, a.duration_seconds ds, q.difficulty d "
        "FROM attempts a JOIN questions q ON q.id=a.question_id "
        "WHERE a.duration_seconds IS NOT NULL AND a.duration_seconds >= 20 "
        "AND a.duration_seconds <= 1500 AND q.category_path NOT LIKE '历年真题%'").fetchall()
    blk = collections.defaultdict(list)
    for r in att:
        ps = r['cp'].split(' / ')
        blk[(ps[0], ps[1] if len(ps) > 1 else '?')].append(r)
    slow = []
    for (t, b), sub in blk.items():
        if len(sub) < 4:
            continue
        n = len(sub)
        ok = sum(1 for r in sub if r['outcome'] == 'correct')
        pa = sum(1 for r in sub if r['outcome'] == 'partial')
        slow.append({
            '板块': t + '·' + b, '题次': n,
            '正确率': round((ok + 0.5 * pa) / n, 3),
            '实际中位分': round(statistics.median([r['ds'] for r in sub]) / 60, 2),
            '预期中位分': round(statistics.median([BUD.get(r['d'], 4.7) for r in sub]), 2),
            '耗时指数': round(statistics.median([r['ds'] for r in sub]) / 60 /
                            statistics.median([BUD.get(r['d'], 4.7) for r in sub]), 2),
        })
    slow.sort(key=lambda x: -x['耗时指数'])
    with io.open(OUTD + '会做但慢.json', 'w', encoding='utf-8') as f:
        json.dump(slow, f, ensure_ascii=False, indent=2)

    con.close()
    for f_ in os.listdir(tmp):
        try: os.remove(os.path.join(tmp, f_))
        except Exception: pass
    os.rmdir(tmp)

    print('样本 %d 题 / %d 年份' % (len(gem) + len(txt_rows), NY))
    print('输出目录: %s' % OUTD)
    for f_ in sorted(os.listdir(OUTD)):
        print('   %s' % f_)
    print()
    print('优先级分 TOP8:')
    for r in rows[:8]:
        print('   %-22s 出现率%3.0f%% 年均%5.1f分 覆盖%-8s → %5.2f' % (
            r['章节'], r['出现率'] * 100, r['年均分值'], r['已覆盖叶子'] if r['覆盖率'] is None
            else '%d/%d' % (r['已覆盖叶子'], r['题库叶子']), r['优先级分']))


if __name__ == '__main__':
    main()

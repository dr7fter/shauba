# -*- coding: utf-8 -*-
"""
刷吧 · 做题数据体检工具（只读）

用法:
    python scripts/analyze_progress.py
    python scripts/analyze_progress.py --out docs/体检报告.txt

安全约定:
  - 复制 shuaba.db (+ -wal/-shm) 到临时目录后再读，绝不直接打开运行中的数据库
  - 全程只读，不写入任何业务表
  - 不触碰题库源目录 E:\\考研资料\\题库-大观园

输出维度:
  1 总量与正确率      2 按日期趋势        3 按章节表现
  4 题型与耗时结构    5 六维能力          6 ELO 轨迹与失真检测
  7 错题回头率        8 技能点证据密度    9 考纲覆盖缺口
  10 错因分类         11 错题欠账清单
"""

import os
import sys
import json
import shutil
import sqlite3
import tempfile
import statistics
import argparse
from collections import Counter, defaultdict
from datetime import datetime, date

# 题型基准耗时（秒），与 AGENTS.md 第四节一致
BASE_SEC = {'single_choice': 180, 'multiple_choice': 240, 'fill': 300, 'subjective': 600}

# 耗时有效性区间：低于 0.2 倍基准视为秒交/异常，高于 3 倍视为挂机
VALID_LO, VALID_HI = 0.2, 3.0


def snapshot():
    """复制数据库快照到临时目录，避免干扰运行中的 App"""
    src_dir = os.path.join(os.environ.get('APPDATA', ''), 'com.shuaba.math')
    snap = os.path.join(tempfile.gettempdir(), 'shuaba_analyze_snap.db')
    found = False
    for suffix in ('', '-wal', '-shm'):
        src = os.path.join(src_dir, 'shuaba.db' + suffix)
        if os.path.exists(src):
            shutil.copy2(src, snap + suffix)
            found = True
    if not found:
        raise SystemExit('未找到数据库: %s' % src_dir)
    return snap


def norm_outcome(o):
    """归一化结果：wrong 与 incorrect 都算错"""
    if o == 'correct':
        return 'correct'
    if o in ('wrong', 'incorrect'):
        return 'wrong'
    return o or 'uncertain'


def load(con):
    rows = [dict(r) for r in con.execute('SELECT * FROM attempts ORDER BY id')]
    qmap = {r['id']: dict(r) for r in con.execute(
        'SELECT id, question_type, category_path, is_core FROM questions')}
    for r in rows:
        q = qmap.get(r['question_id'], {})
        r['qt'] = q.get('question_type') or 'subjective'
        r['cp'] = q.get('category_path') or ''
        r['base'] = BASE_SEC.get(r['qt'], 600)
        r['ratio'] = (r['duration_seconds'] or 0) / r['base']
        r['valid'] = VALID_LO <= r['ratio'] <= VALID_HI
        r['o'] = norm_outcome(r['outcome'])
        r['date'] = (r['attempted_at'] or '')[:10]
        parts = r['cp'].split(' / ')
        r['chap'] = parts[1] if len(parts) > 1 else (parts[0] if parts else '未知')
        r['root'] = parts[0] if parts else '未知'
    return rows, qmap


def pct(n, d):
    return (n / d * 100) if d else 0.0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=None, help='输出文件路径，默认打印到 stdout')
    ap.add_argument('--today', default=None, help='基准日期 YYYY-MM-DD，默认取系统当天')
    args = ap.parse_args()

    con = sqlite3.connect(snapshot())
    con.row_factory = sqlite3.Row
    cur = con.cursor()
    rows, qmap = load(con)
    today = datetime.fromisoformat(args.today).date() if args.today else date.today()

    out = []
    W = out.append
    W('刷吧 · 做题数据体检报告')
    W('生成时间: %s' % datetime.now().strftime('%Y-%m-%d %H:%M'))
    W('=' * 70)

    if not rows:
        W('无答题记录')
        con.close()
        emit(out, args.out)
        return

    # ── 1 总量 ──────────────────────────────────────────────
    W('')
    W('【1】总量与正确率')
    W('  总作答 %d 次 / %d 道不同题 / %d 个活跃日' % (
        len(rows), len({r['question_id'] for r in rows}), len({r['date'] for r in rows})))
    W('  结果: ' + '  '.join('%s=%d(%.1f%%)' % (k, v, pct(v, len(rows)))
                          for k, v in Counter(r['o'] for r in rows).most_common()))
    latest = {}
    for r in rows:
        latest[r['question_id']] = r
    W('  去重(每题取最新): %d 题  ' % len(latest) + '  '.join(
        '%s=%d(%.1f%%)' % (k, v, pct(v, len(latest))) for k, v in Counter(
            r['o'] for r in latest.values()).most_common()))
    redo = Counter(r['question_id'] for r in rows)
    W('  重做: 1次=%d题 2次=%d题 3次+=%d题' % (
        sum(1 for v in redo.values() if v == 1),
        sum(1 for v in redo.values() if v == 2),
        sum(1 for v in redo.values() if v >= 3)))

    # ── 2 按日期 ────────────────────────────────────────────
    W('')
    W('【2】按日期趋势')
    W('  %-12s %5s %7s %8s %9s' % ('日期', '题数', '正确率', '均耗时', '均rating'))
    byday = defaultdict(list)
    for r in rows:
        byday[r['date']].append(r)
    for d in sorted(byday):
        g = byday[d]
        c = sum(1 for r in g if r['o'] == 'correct')
        dur = statistics.mean([r['duration_seconds'] or 0 for r in g])
        rat = [r['ai_rating'] for r in g if r['ai_rating']]
        W('  %-12s %5d %6.1f%% %8.0fs %9s' % (
            d, len(g), pct(c, len(g)), dur, '%.2f' % statistics.mean(rat) if rat else '-'))

    # ── 3 按章节 ────────────────────────────────────────────
    W('')
    W('【3】按章节表现')
    W('  %-14s %6s %8s %9s' % ('章节', '题数', '正确率', '均rating'))
    bychap = defaultdict(list)
    for r in rows:
        bychap[r['chap']].append(r)
    for k, g in sorted(bychap.items(), key=lambda x: -len(x[1])):
        c = sum(1 for r in g if r['o'] == 'correct')
        rat = [r['ai_rating'] for r in g if r['ai_rating']]
        W('  %-14s %6d %7.1f%% %9s' % (
            k[:14], len(g), pct(c, len(g)), '%.2f' % statistics.mean(rat) if rat else '-'))

    # ── 4 题型与耗时 ────────────────────────────────────────
    W('')
    W('【4】题型与耗时结构')
    valid = [r for r in rows if r['valid']]
    W('  有效耗时样本 %d / %d (%.0f%%)  [剔除 <%.1fx 或 >%.1fx 基准]' % (
        len(valid), len(rows), pct(len(valid), len(rows)), VALID_LO, VALID_HI))
    byqt = defaultdict(list)
    for r in valid:
        byqt[r['qt']].append(r)
    for k, g in sorted(byqt.items(), key=lambda x: -len(x[1])):
        c = sum(1 for r in g if r['o'] == 'correct')
        med = statistics.median([r['duration_seconds'] for r in g])
        W('  %-16s 题数=%-4d 正确率=%5.1f%%  中位耗时=%.0fs / 基准%ds (%.2fx)' % (
            k, len(g), pct(c, len(g)), med, g[0]['base'], med / g[0]['base']))
    okv = [r['ratio'] for r in valid if r['o'] == 'correct']
    badv = [r['ratio'] for r in valid if r['o'] == 'wrong']
    if okv and badv:
        W('  做对中位 %.2fx (n=%d)   做错中位 %.2fx (n=%d)' % (
            statistics.median(okv), len(okv), statistics.median(badv), len(badv)))
        W('  ※ 做错比做对更慢 → 在错误方向上硬磨，而非"想清了算错"'
          if statistics.median(badv) > statistics.median(okv) else
          '  ※ 做错比做对更快 → 可能是秒交/放弃')

    # ── 5 六维 ──────────────────────────────────────────────
    W('')
    W('【5】六维能力（AI 评分样本）')
    dims = ['dim_rigor', 'dim_computation', 'dim_modeling',
            'dim_method_use', 'dim_speed', 'dim_strategy_insight']
    scored = [r for r in rows if r['dim_rigor'] is not None]
    if scored:
        W('  有效样本 %d / %d' % (len(scored), len(rows)))
        W('  %-18s %8s %8s %8s %8s' % ('维度', '均值', '做对时', '做错时', '差值'))
        for d in dims:
            v = [r[d] for r in scored if r[d] is not None]
            ok = [r[d] for r in scored if r[d] is not None and r['o'] == 'correct']
            bad = [r[d] for r in scored if r[d] is not None and r['o'] == 'wrong']
            W('  %-18s %8.1f %8.1f %8.1f %8.1f' % (
                d.replace('dim_', ''), statistics.mean(v),
                statistics.mean(ok) if ok else 0,
                statistics.mean(bad) if bad else 0,
                (statistics.mean(ok) - statistics.mean(bad)) if ok and bad else 0))

    # ── 6 ELO ───────────────────────────────────────────────
    W('')
    W('【6】ELO 轨迹与失真检测')
    ev = [dict(r) for r in cur.execute('SELECT * FROM elo_events ORDER BY id')]
    if ev:
        W('  结算 %d 次   起点 %.0f → 当前 %.0f   峰值 %.0f' % (
            len(ev), ev[0]['rating_after'], ev[-1]['rating_after'],
            max(e['rating_after'] for e in ev)))
        W('  平均 performance=%.3f  expected=%.3f' % (
            statistics.mean([e['performance'] for e in ev if e['performance']]),
            statistics.mean([e['expected'] for e in ev if e['expected']])))
        W('  正delta=%d  负delta=%d  零=%d' % (
            sum(1 for e in ev if e['delta'] > 0),
            sum(1 for e in ev if e['delta'] < 0),
            sum(1 for e in ev if e['delta'] == 0)))
        # 失真检测：ELO 方向与正确率方向是否相悖
        rated = [r for r in rows if r['ai_rating']]
        if len(rated) >= 10:
            half = len(rated) // 2
            r1 = statistics.mean([r['ai_rating'] for r in rated[:half]])
            r2 = statistics.mean([r['ai_rating'] for r in rated[half:]])
            elo_up = ev[-1]['rating_after'] > ev[0]['rating_after']
            if elo_up and r2 < r1:
                W('  ⚠ 失真：ELO 上涨 %.0f 分，但 AI 评分从 %.2f 跌到 %.2f' % (
                    ev[-1]['rating_after'] - ev[0]['rating_after'], r1, r2))
                W('    原因：expected 被难度系数与低 mastery 压低，刷难题反而更易涨分')

    # ── 7 错题回头率 ────────────────────────────────────────
    W('')
    W('【7】错题回头率')
    byq = defaultdict(list)
    for r in rows:
        byq[r['question_id']].append(r)
    wrong_ids = {q for q, g in byq.items() if g[-1]['o'] in ('wrong', 'partial')}
    retried = {q for q in wrong_ids if len(byq[q]) > 1}
    W('  最终仍错/半对: %d 道   曾重做: %d 道 (%.1f%%)   从未回头: %d 道' % (
        len(wrong_ids), len(retried), pct(len(retried), len(wrong_ids)),
        len(wrong_ids) - len(retried)))
    ages = []
    for q in wrong_ids:
        try:
            ages.append((today - datetime.fromisoformat(byq[q][-1]['date']).date()).days)
        except Exception:
            pass
    if ages:
        W('  积压: 中位 %d 天  最老 %d 天  >3天 %d 道 (%.0f%%)' % (
            statistics.median(ages), max(ages),
            sum(1 for a in ages if a > 3), pct(sum(1 for a in ages if a > 3), len(ages))))
    W('  复习模式占比: %.1f%% (%d/%d)' % (
        pct(sum(1 for r in rows if r['mode'] == 'review'), len(rows)),
        sum(1 for r in rows if r['mode'] == 'review'), len(rows)))

    # ── 8 技能点证据 ────────────────────────────────────────
    W('')
    W('【8】技能点证据密度')
    ss = [dict(r) for r in cur.execute('SELECT * FROM skill_states')]
    if ss:
        W('  技能点 %d 个   证据<=2条: %d (%.0f%%)   证据>=5条: %d' % (
            len(ss), sum(1 for r in ss if r['evidence_count'] <= 2),
            pct(sum(1 for r in ss if r['evidence_count'] <= 2), len(ss)),
            sum(1 for r in ss if r['evidence_count'] >= 5)))
        W('  mastery 中位=%.2f 最高=%.2f   <0.35 的: %d 个' % (
            statistics.median([r['mastery'] for r in ss]),
            max(r['mastery'] for r in ss),
            sum(1 for r in ss if r['mastery'] < 0.35)))
        W('  retention/transfer 双 0: %d / %d  → 从未做延迟复查' % (
            sum(1 for r in ss if r['retention'] == 0 and r['transfer'] == 0), len(ss)))

    # ── 9 覆盖缺口 ──────────────────────────────────────────
    W('')
    W('【9】考纲覆盖缺口（数一）')
    pool = defaultdict(lambda: [0, 0])      # chap -> [总题, 核心题]
    for q in qmap.values():
        cp = q.get('category_path') or ''
        if not cp:
            continue
        parts = cp.split(' / ')
        key = parts[1] if len(parts) > 1 else parts[0]
        pool[key][0] += 1
        if q.get('is_core'):
            pool[key][1] += 1
    done = defaultdict(set)
    for r in rows:
        done[r['chap']].add(r['question_id'])
    W('  %-14s %8s %8s %8s %8s' % ('章节', '题库量', '核心题', '已练', '覆盖率'))
    for k in sorted(pool, key=lambda x: -pool[x][0]):
        tot, core = pool[k]
        d = len(done.get(k, ()))
        W('  %-14s %8d %8d %8d %7.1f%%%s' % (
            k[:14], tot, core, d, pct(d, tot), '   ← 零覆盖' if d == 0 else ''))
    W('  合计覆盖 %d / %d = %.1f%%' % (
        len({r['question_id'] for r in rows}),
        sum(v[0] for v in pool.values()),
        pct(len({r['question_id'] for r in rows}), sum(v[0] for v in pool.values()))))

    # ── 10 错因分类 ─────────────────────────────────────────
    W('')
    W('【10】错因分类')
    dg = [dict(r) for r in cur.execute('SELECT * FROM learning_diagnoses')]
    if dg:
        W('  normalized_error_class: ' + '  '.join(
            '%s=%d' % (k, v) for k, v in Counter(
                r['normalized_error_class'] for r in dg).most_common()))
        tags = Counter()
        for r in dg:
            try:
                tags.update(json.loads(r['error_tags_json'] or '[]'))
            except Exception:
                pass
        if tags:
            W('  error_tags: ' + '  '.join('%s=%d' % (k, v) for k, v in tags.most_common(8)))
        # 放弃型检测
        kw = ('不会', '没见过', '力竭', '没思路', '没有思路', '这题有问题')
        give, tried_ = [], []
        for r in dg:
            if r['normalized_error_class'] not in ('concept', 'tactics', 'aiming'):
                continue
            ee = r['earliest_error'] or ''
            early = ('第 1 行' in ee) or ('第1行' in ee)
            (give if (early and any(k in ee for k in kw)) else tried_).append(r)
        tot = len(give) + len(tried_)
        if tot:
            W('  动手了但断在某步: %d (%.0f%%)   第1行就放弃: %d (%.0f%%)' % (
                len(tried_), pct(len(tried_), tot), len(give), pct(len(give), tot)))
            if give:
                W('  放弃型集中在: ' + '  '.join(
                    '%s=%d' % (k, v) for k, v in Counter(
                        (r['category_key'] or '').split(' / ')[1]
                        if (r['category_key'] or '').count(' / ') >= 1
                        else r['category_key'] for r in give).most_common()))

    # ── 11 欠账清单 ─────────────────────────────────────────
    W('')
    W('【11】错题欠账清单（最终仍错 + 从未重做 + 积压>3天）')
    cand = []
    for q, g in byq.items():
        last = g[-1]
        if last['o'] not in ('wrong', 'partial') or len(g) > 1:
            continue
        try:
            age = (today - datetime.fromisoformat(last['date']).date()).days
        except Exception:
            age = 0
        if age > 3:
            cand.append((q, last['cp'], age))
    W('  共 %d 道' % len(cand))
    for k, v in Counter(c[1].split(' / ')[1] if c[1].count(' / ') >= 1 else c[1]
                        for c in cand).most_common():
        W('    %-14s %d 道' % (k[:14], v))

    con.close()
    emit(out, args.out)


def emit(out, path):
    text = '\n'.join(out)
    if path:
        os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(text)
        print('已写入: %s' % os.path.abspath(path))
    else:
        print(text)


if __name__ == '__main__':
    main()

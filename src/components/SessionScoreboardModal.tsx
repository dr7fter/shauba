import { motion } from 'framer-motion'
import { Flame, Timer, Trophy, X, Zap } from 'lucide-react'
import { csRatingTone } from '../utils'
import { MathText } from './MathText'
import type { SessionScoreboard } from '../types'

/** CS 赛后计分板风格的战绩面板：WE 评分、MVP、连胜、秒杀与本场 ELO。 */
export function SessionScoreboardModal({
  scoreboard,
  onClose,
}: {
  scoreboard: SessionScoreboard
  onClose: () => void
}) {
  const eloTone = scoreboard.eloDelta >= 0 ? '#4CC38A' : '#E5534B'
  return (
    <div className="ui-overlay" style={{ position: 'fixed', inset: 0, zIndex: 150, background: 'rgba(12,15,20,0.55)', display: 'grid', placeItems: 'center' }} onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 24, stiffness: 300 }}
        style={{ width: 'min(560px, calc(100vw - 32px))', maxHeight: '82vh', overflow: 'auto', background: 'var(--surface-card, #fff)', borderRadius: 18, padding: 22, boxShadow: '0 24px 60px rgba(10,14,20,0.35)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 18 }}>本场战绩</h3>
          <button type="button" className="qtimer-btn" onClick={onClose} aria-label="关闭"><X size={14} /></button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
          <div style={{ textAlign: 'center', padding: '10px 4px', borderRadius: 12, background: 'var(--surface-muted, #f3f4f6)' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#315E9E' }}>{scoreboard.weScore ?? '—'}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>WE 评分</div>
          </div>
          <div style={{ textAlign: 'center', padding: '10px 4px', borderRadius: 12, background: 'var(--surface-muted, #f3f4f6)' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: eloTone }}>
              {scoreboard.eloDelta >= 0 ? '+' : ''}{Math.round(scoreboard.eloDelta)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>本场 ELO</div>
          </div>
          <div style={{ textAlign: 'center', padding: '10px 4px', borderRadius: 12, background: 'var(--surface-muted, #f3f4f6)' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#E87722' }}>{scoreboard.correctCount}/{scoreboard.totalCount}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>正确</div>
          </div>
          <div style={{ textAlign: 'center', padding: '10px 4px', borderRadius: 12, background: 'var(--surface-muted, #f3f4f6)' }}>
            <div style={{ fontSize: 24, fontWeight: 800 }}>{scoreboard.longestStreak}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>最长连胜</div>
          </div>
        </div>

        {scoreboard.mvpQuestionId !== null && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 12px', borderRadius: 12, background: '#FFF7EA', marginBottom: 12 }}>
            <Trophy size={18} color="#D9A62E" />
            <div>
              <b>MVP · 第 {scoreboard.mvpQuestionId} 题</b>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>影响力最高的制胜一击</div>
            </div>
            {scoreboard.fastestKillQuestionId !== null && (
              <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 4, alignItems: 'center', fontSize: 12, color: '#267655' }}>
                <Zap size={13} /> 秒杀 #{scoreboard.fastestKillQuestionId}
              </span>
            )}
          </div>
        )}

        <div style={{ borderTop: '1px solid var(--line)', paddingTop: 10 }}>
          {scoreboard.questions.map((q) => (
            <div key={q.questionId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 2px', fontSize: 13 }}>
              <span style={{ width: 56, color: 'var(--muted)' }}>#{q.questionId}</span>
              <span style={{ width: 30 }}>{q.outcome === 'correct' ? '✓' : q.outcome === 'partial' ? '半' : '✗'}</span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--muted)' }}><MathText value={q.stem} /></span>
              {q.impact !== null && <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center', color: '#E87722', fontSize: 12 }}><Flame size={12} />{Math.round(q.impact)}</span>}
              <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center', width: 62, justifyContent: 'flex-end', color: 'var(--muted)' }}><Timer size={12} />{Math.round(q.durationSeconds / 60)}:{String(q.durationSeconds % 60).padStart(2, '0')}</span>
              <span style={{ width: 40, textAlign: 'right', fontWeight: 700 }} className={`rating-${csRatingTone(q.rating)}`}>{q.rating.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}

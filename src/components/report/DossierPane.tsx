import { MathText } from '../MathText'
import type { BreakpointGroup } from '../../domain/reportViewModel'

const SEVERITY_ORDER: Record<string, number> = { L1: 0, L2: 1, L3: 2 }

/**
 * 「档案」视图：断点跨题目的聚合与验收判据。
 *
 * 修复时间线这类"历史回看"内容也放这里，不进复盘主屏——
 * 复盘当下要做的是决定下一次怎么落笔，不是回看自己错几次。
 */
export function DossierPane({ groups }: { groups: BreakpointGroup[] }) {
  const relapseCount = groups.filter((group) => group.state === 'relapse').length
  const unencoded = groups.filter((group) => !group.errorCode).length

  const sorted = [...groups].sort((a, b) => {
    if (a.state !== b.state) return a.state === 'relapse' ? -1 : 1
    const sa = SEVERITY_ORDER[a.severity ?? 'L3'] ?? 3
    const sb = SEVERITY_ORDER[b.severity ?? 'L3'] ?? 3
    if (sa !== sb) return sa - sb
    return b.questionIds.length - a.questionIds.length
  })

  return (
    <div className="rp-view">
      <div className="insight-summary">
        <div>
          <span>断点总数</span>
          <strong>{groups.length}</strong>
          <small>按入口归并</small>
        </div>
        <div>
          <span>复发</span>
          <strong className="rp-danger">{relapseCount}</strong>
          <small>同一入口再次命中</small>
        </div>
        <div>
          <span>未编码</span>
          <strong>{unencoded}</strong>
          <small>批改回传时可补 errorCode</small>
        </div>
      </div>

      <div className="rp-h">断点聚合</div>
      {sorted.length === 0 ? (
        <div className="empty-state">本场没有产生断点，全部通过。</div>
      ) : (
        sorted.map((group) => {
          const codeTone =
            group.state === 'relapse' || group.severity === 'L1'
              ? 'rp-danger'
              : group.severity === 'L2'
                ? 'rp-warn'
                : ''
          return (
            <div className="ui-card rp-bp-card" key={group.key}>
              <div className="rp-bp-top">
                <span className={`rp-bp-code ${codeTone}`}>{group.errorCode ?? '未编码'}</span>
                <span className="rp-bp-t">{group.title ?? '待命名断点'}</span>
                <span
                  className={
                    group.state === 'relapse'
                      ? 'reason-chip yesterday_wrong'
                      : 'reason-chip retest'
                  }
                >
                  {group.state === 'relapse' ? '复发' : '新增'}
                </span>
                {group.severity ? (
                  <span className="question-id-badge">{group.severity}</span>
                ) : null}
                {group.questionIds.length > 1 ? (
                  <span className="question-id-badge">{group.questionIds.length} 题命中</span>
                ) : null}
              </div>
              <div className="rp-bp-m">
                {group.questionIds.map((id) => `#${id}`).join(' · ')}
                {group.historyTotal > 0
                  ? ` · 历史 ${group.historyTotal} 次作答，其中 ${group.historyWrong} 次错误`
                  : ' · 首次作答'}
              </div>
              {group.acceptance ? (
                <div className="rp-bp-m rp-bp-accept">
                  验收：<MathText value={group.acceptance} />
                </div>
              ) : null}
            </div>
          )
        })
      )}

      <div className="rp-h">验收判据</div>
      {sorted.length === 0 ? (
        <div className="empty-state">暂无验收判据。</div>
      ) : (
        <table className="rp-tbl">
          <thead>
            <tr>
              <th className="rp-c76">编码</th>
              <th>判据</th>
              <th className="rp-c78">状态</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((group) => (
              <tr key={`gate-${group.key}`}>
                <td className="rp-mono">{group.errorCode ?? '未编码'}</td>
                <td>
                  {group.acceptance ?? (
                    <span className="rp-quiet">
                      合上报告独立重做：不翻解法、不用提示，结果正确才算闭合。
                    </span>
                  )}
                </td>
                <td>
                  <span
                    className={
                      group.state === 'relapse'
                        ? 'reason-chip yesterday_wrong'
                        : 'reason-chip retest'
                    }
                  >
                    {group.state === 'relapse' ? '待验证' : '观察中'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

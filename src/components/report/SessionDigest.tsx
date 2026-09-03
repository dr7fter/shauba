import { MathText } from '../MathText'
import type { SessionDigest } from '../../domain/reportViewModel'

/**
 * 报告顶部「总诊断」：分布 → 聚类 → 本次只带走一件事。
 * 聚类与一件事凑不出可靠内容时整卡不渲染（不硬凑）——
 * 分布信息状态栏已有兜底，这里只呈现增量洞察。
 */
export function SessionDigestView({ digest }: { digest: SessionDigest }) {
  if (!digest.clusterLine && !digest.oneThingLine) return null
  return (
    <div className="rp-digest" role="note" aria-label="本场总诊断">
      <div className="rp-digest-row">
        <span className="rp-digest-k">分布</span>
        <span>{digest.distribution}</span>
      </div>
      {digest.clusterLine ? (
        <div className="rp-digest-row">
          <span className="rp-digest-k">聚类</span>
          <span>
            <MathText value={digest.clusterLine} />
          </span>
        </div>
      ) : null}
      {digest.oneThingLine ? (
        <div className="rp-digest-row rp-digest-key">
          <span className="rp-digest-k">带走</span>
          <span>
            <MathText value={digest.oneThingLine} />
          </span>
        </div>
      ) : null}
    </div>
  )
}

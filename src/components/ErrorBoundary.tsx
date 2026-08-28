import { AlertTriangle, RotateCcw } from 'lucide-react'
import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * 兜底渲染边界。此前任意子树抛错都会导致整个应用白屏且无从恢复，
 * 只能靠重启 App。这里把异常收敛到一块可恢复的提示面板：
 * 「重试」重新渲染子树，「重启应用」用于状态已损坏的情况。
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[刷吧] 界面渲染异常', error, info.componentStack)
  }

  private handleReset = (): void => this.setState({ error: null })

  private handleReload = (): void => window.location.reload()

  render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="empty-state" role="alert">
        <AlertTriangle size={28} />
        <h3>界面出了点问题</h3>
        <p>{error.message || '渲染时发生了未知异常'}</p>
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <button
            type="button"
            onClick={this.handleReset}
            style={{
              padding: '6px 16px',
              borderRadius: 'var(--r-md)',
              border: '1px solid var(--line-strong)',
              background: 'var(--surface)',
              color: 'var(--ink)',
              fontSize: 'var(--fs-base)',
              cursor: 'pointer',
            }}
          >
            重试
          </button>
          <button
            type="button"
            onClick={this.handleReload}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 16px',
              borderRadius: 'var(--r-md)',
              border: '1px solid var(--line-strong)',
              background: 'var(--surface)',
              color: 'var(--ink)',
              fontSize: 'var(--fs-base)',
              cursor: 'pointer',
            }}
          >
            <RotateCcw size={14} />
            重启应用
          </button>
        </div>
      </div>
    )
  }
}

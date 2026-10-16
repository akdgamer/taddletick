import type { ReactNode } from 'react'

/** Grey shapes where project tiles will appear, so the page doesn't jump when data lands */
export function SkeletonTiles({ count = 2 }: { count?: number }) {
  return (
    <div className="tiles" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="tile skeleton-tile">
          <div className="skeleton" style={{ width: '45%', height: 16 }} />
          <div className="skeleton" style={{ width: '30%', height: 12 }} />
          {[0, 1, 2].map((r) => (
            <div key={r} className="skeleton-row">
              <div className="skeleton" style={{ width: 96, height: 22, borderRadius: 999 }} />
              <div className="skeleton" style={{ width: `${55 - r * 10}%`, height: 12 }} />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

/** Placeholder rows for list pages */
export function SkeletonRows({ count = 3 }: { count?: number }) {
  return (
    <div className="card skeleton-list" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="skeleton-item">
          <div className="skeleton" style={{ width: `${40 - i * 6}%`, height: 14 }} />
          <div className="skeleton" style={{ width: `${25 + i * 5}%`, height: 11 }} />
        </div>
      ))}
    </div>
  )
}

interface EmptyProps {
  icon: ReactNode
  title: string
  children?: ReactNode
  action?: ReactNode
}

/** What a page says when there is nothing in it yet, and how to start */
export function EmptyState({ icon, title, children, action }: EmptyProps) {
  return (
    <div className="empty-state">
      <span className="empty-icon" aria-hidden>
        {icon}
      </span>
      <h2>{title}</h2>
      {children && <p className="muted">{children}</p>}
      {action}
    </div>
  )
}

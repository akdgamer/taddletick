import { useState } from 'react'

import { useActivity } from '../api/hooks'
import { ActivityList } from './ActivityList'

/** A project's history on its card; only loaded once opened. */
export function HistorySection({ projectId }: { projectId: number }) {
  const [open, setOpen] = useState(false)
  const history = useActivity({ project_id: projectId }, open)
  const items = history.data?.pages.flatMap((p) => p.items) ?? []

  return (
    <details className="tile-section" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>History</summary>
      {history.isPending && open && <p className="muted">Loading…</p>}
      {history.error && <p className="error">{history.error.message}</p>}
      {history.isSuccess && items.length === 0 && <p className="muted">No changes recorded yet.</p>}
      {items.length > 0 && <ActivityList items={items} />}
      {history.hasNextPage && (
        <button className="link-button" onClick={() => history.fetchNextPage()} disabled={history.isFetchingNextPage}>
          {history.isFetchingNextPage ? 'Loading…' : 'Show older'}
        </button>
      )}
    </details>
  )
}

import { useState } from 'react'

import { useActivity, useCan, useMe, useUsers } from '../api/hooks'
import type { ActivityItem } from '../api/types'
import { ActivityList } from './ActivityList'
import { ListCheckIcon } from './Icons'
import { EmptyState, SkeletonRows } from './Placeholders'

/** Everything recently changed on the projects you can see, newest first, grouped by day. */
export function ActivityPage() {
  const [person, setPerson] = useState<number | undefined>(undefined)
  const activity = useActivity({ user_id: person })
  const items = activity.data?.pages.flatMap((p) => p.items) ?? []

  return (
    <main className="page narrow">
      <header className="page-header">
        <div>
          <h1>Activity</h1>
          <p className="page-summary">Who changed what, on the projects you can see.</p>
        </div>
        <PersonFilter value={person} onChange={setPerson} />
      </header>

      {activity.isPending && <SkeletonRows count={5} />}
      {activity.error && <p className="error">{activity.error.message}</p>}
      {activity.isSuccess && items.length === 0 && (
        <EmptyState icon={<ListCheckIcon />} title="Nothing here yet">
          Changes to projects, stages, payments, files and notes will show up here.
        </EmptyState>
      )}

      {byDay(items).map(([day, dayItems]) => (
        <section key={day} className="card activity-day">
          <h2>{day}</h2>
          <ActivityList items={dayItems} showProject />
        </section>
      ))}

      {activity.hasNextPage && (
        <div className="load-more">
          <button onClick={() => activity.fetchNextPage()} disabled={activity.isFetchingNextPage}>
            {activity.isFetchingNextPage ? 'Loading…' : 'Show older'}
          </button>
        </div>
      )}
    </main>
  )
}

/** Admins can pick anyone; everyone else can narrow it to their own changes */
function PersonFilter({ value, onChange }: { value: number | undefined; onChange: (id: number | undefined) => void }) {
  const isAdmin = useCan('is_admin')
  const { data: me } = useMe()
  const { data: users = [] } = useUsers(isAdmin)
  const people = isAdmin ? users : me ? [me] : []

  return (
    <select
      aria-label="Whose changes"
      className="filter-select"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
    >
      <option value="">Everyone</option>
      {people.map((u) => (
        <option key={u.id} value={u.id}>
          {u.id === me?.id ? `${u.display_name} (you)` : u.display_name}
        </option>
      ))}
    </select>
  )
}

function byDay(items: ActivityItem[]): [string, ActivityItem[]][] {
  const today = new Date().toDateString()
  const yesterday = new Date(Date.now() - 86_400_000).toDateString()
  const groups = new Map<string, ActivityItem[]>()
  for (const a of items) {
    const d = new Date(a.at)
    const key =
      d.toDateString() === today
        ? 'Today'
        : d.toDateString() === yesterday
          ? 'Yesterday'
          : d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
    groups.set(key, [...(groups.get(key) ?? []), a])
  }
  return [...groups]
}

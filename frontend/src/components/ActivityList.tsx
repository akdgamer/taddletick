import type { ReactNode } from 'react'

import type { ActivityItem } from '../api/types'
import { timeAgo } from '../format'
import { CoinIcon, FileIcon, FolderIcon, ListCheckIcon, NoteIcon } from './Icons'

const KIND_ICONS: Record<ActivityItem['kind'], ReactNode> = {
  project: <FolderIcon />,
  stage: <ListCheckIcon />,
  payment: <CoinIcon />,
  file: <FileIcon />,
  note: <NoteIcon />,
}

interface Props {
  items: ActivityItem[]
  /** On the Activity page each line says which project; on a project card it's obvious */
  showProject?: boolean
}

/** History lines: "Ashish Kumar · Software: In progress → Done · 2 hours ago" */
export function ActivityList({ items, showProject = false }: Props) {
  return (
    <ol className="activity-list">
      {items.map((a) => (
        <li key={a.id} className={`activity kind-${a.kind}`}>
          <span className="activity-icon" aria-hidden>
            {KIND_ICONS[a.kind] ?? KIND_ICONS.project}
          </span>
          <div className="activity-main">
            <p>
              <strong>{a.user?.display_name ?? 'Someone'}</strong> {a.summary}
              {showProject && (
                <>
                  {' '}
                  <span className="muted">on</span> <span className="activity-project">{a.project_name}</span>
                </>
              )}
            </p>
            <time dateTime={a.at} title={new Date(a.at).toLocaleString()}>
              {timeAgo(a.at)}
            </time>
          </div>
        </li>
      ))}
    </ol>
  )
}

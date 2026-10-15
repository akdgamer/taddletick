import { Fragment, useState } from 'react'

import { useDashboard } from '../api/hooks'
import { plural } from '../format'
import { CompletedList } from './CompletedList'
import { ChasePanel, TodayPanel } from './DashboardPanels'
import { NewProjectForm } from './NewProjectForm'
import { ProjectTile } from './ProjectTile'

type View = 'active' | 'completed'

export function DashboardPage() {
  const [view, setView] = useState<View>('active')
  const [creating, setCreating] = useState(false)

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <h1>Projects</h1>
          <Summary />
        </div>
        <div className="header-actions">
          <div className="segmented" role="group" aria-label="View">
            {(['active', 'completed'] as const).map((v) => (
              <button key={v} aria-pressed={view === v} onClick={() => setView(v)}>
                {v === 'active' ? 'Active' : 'Completed'}
              </button>
            ))}
          </div>
          {view === 'active' && !creating && (
            <button className="primary" onClick={() => setCreating(true)}>
              New project
            </button>
          )}
        </div>
      </header>

      {view === 'active' ? (
        <>
          {creating && <NewProjectForm onDone={() => setCreating(false)} />}
          <div className="panels">
            <TodayPanel />
            <ChasePanel />
          </div>
          <ActiveProjects hideEmptyMessage={creating} />
        </>
      ) : (
        <CompletedList />
      )}
    </main>
  )
}

function ActiveProjects({ hideEmptyMessage }: { hideEmptyMessage: boolean }) {
  const { data: projects, isPending, error } = useDashboard()

  return (
    <>
      {isPending && <p className="muted">Loading…</p>}
      {error && <p className="error">Couldn't load the dashboard: {error.message}. Is the API running?</p>}
      {projects?.length === 0 && !hideEmptyMessage && (
        <p className="muted">No active projects. Create one to get started.</p>
      )}

      <section className="tiles">
        {/* Order comes from the API; personal projects are already last */}
        {projects?.map((project, i) => (
          <Fragment key={project.id}>
            {project.label === 'personal' && projects[i - 1]?.label !== 'personal' && (
              <h2 className="section-divider">Personal</h2>
            )}
            <ProjectTile project={project} />
          </Fragment>
        ))}
      </section>
    </>
  )
}

/** One line under the title: how much is going on and how much needs attention */
function Summary() {
  const { data: projects } = useDashboard()
  if (!projects?.length) return null
  const red = projects.filter((p) => p.flag === 'red').length
  const amber = projects.filter((p) => p.flag === 'amber').length
  return (
    <p className="page-summary">
      {plural(projects.length, 'active project')}
      {red > 0 && <span className="summary-red"> · {red} overdue</span>}
      {amber > 0 && <span className="summary-amber"> · {amber} need attention soon</span>}
    </p>
  )
}

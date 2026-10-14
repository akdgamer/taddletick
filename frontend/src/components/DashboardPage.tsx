import { Fragment, useState } from 'react'

import { useDashboard } from '../api/hooks'
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
        <h1>Projects</h1>
        <div className="header-actions">
          <div className="view-switch" role="group" aria-label="View">
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
          <div className="panels">
            <TodayPanel />
            <ChasePanel />
          </div>
          {creating && <NewProjectForm onDone={() => setCreating(false)} />}
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

import { Fragment, useState } from 'react'

import { useDashboard } from '../api/hooks'
import { NewProjectForm } from './NewProjectForm'
import { ProjectTile } from './ProjectTile'

export function DashboardPage() {
  const { data: projects, isPending, error } = useDashboard()
  const [creating, setCreating] = useState(false)

  return (
    <main className="page">
      <header className="page-header">
        <h1>Projects</h1>
        {!creating && (
          <button className="primary" onClick={() => setCreating(true)}>
            New project
          </button>
        )}
      </header>

      {creating && <NewProjectForm onDone={() => setCreating(false)} />}

      {isPending && <p className="muted">Loading…</p>}
      {error && <p className="error">Couldn't load the dashboard: {error.message}. Is the API running?</p>}
      {projects?.length === 0 && !creating && <p className="muted">No active projects. Create one to get started.</p>}

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
    </main>
  )
}

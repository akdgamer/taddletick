import { Fragment, useState } from 'react'

import { useDashboard } from '../api/hooks'
import { revealProject, useCommand } from '../commands'
import { plural } from '../format'
import { applyFilters, NO_FILTERS, useFilters, type Filters } from '../projectFilters'
import { CompletedList } from './CompletedList'
import { ChasePanel, TodayPanel } from './DashboardPanels'
import { FolderIcon } from './Icons'
import { NewProjectForm } from './NewProjectForm'
import { EmptyState, SkeletonTiles } from './Placeholders'
import { ProjectFilters } from './ProjectFilters'
import { ProjectTile } from './ProjectTile'

type View = 'active' | 'completed'

export function DashboardPage() {
  const [view, setView] = useState<View>('active')
  const [creating, setCreating] = useState(false)
  const [filters, setFilters] = useFilters()

  useCommand((command) => {
    if (command.type === 'new-project') {
      setView('active')
      setCreating(true)
    } else if (command.type === 'show-project') {
      setView('active')
      setFilters(NO_FILTERS) // the project may be filtered out
      // Wait a frame in case the active list is only now rendering
      requestAnimationFrame(() => revealProject(command.id))
    }
  })

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
          <ActiveProjects
            hideEmptyMessage={creating}
            onCreate={() => setCreating(true)}
            filters={filters}
            onFiltersChange={setFilters}
          />
        </>
      ) : (
        <CompletedList />
      )}
    </main>
  )
}

interface ActiveProps {
  hideEmptyMessage: boolean
  onCreate: () => void
  filters: Filters
  onFiltersChange: (filters: Filters) => void
}

function ActiveProjects({ hideEmptyMessage, onCreate, filters, onFiltersChange }: ActiveProps) {
  const { data: all, isPending, error } = useDashboard()
  const projects = all && applyFilters(all, filters)

  return (
    <>
      {isPending && <SkeletonTiles />}
      {error && <p className="error">Couldn't load the dashboard: {error.message}. Is the API running?</p>}
      {all && all.length > 1 && (
        <ProjectFilters projects={all} filters={filters} onChange={onFiltersChange} shown={projects?.length ?? 0} />
      )}
      {all && all.length > 0 && projects?.length === 0 && (
        <EmptyState icon={<FolderIcon />} title="No projects match these filters">
          <button className="link-button" onClick={() => onFiltersChange(NO_FILTERS)}>
            Clear filters
          </button>
        </EmptyState>
      )}
      {all?.length === 0 && !hideEmptyMessage && (
        <EmptyState
          icon={<FolderIcon />}
          title="No active projects"
          action={
            <button className="primary" onClick={onCreate}>
              New project
            </button>
          }
        >
          Add a machine build or a personal project to start tracking its stages and deadlines.
        </EmptyState>
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

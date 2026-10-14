import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from './client'
import type { ProjectCreate, ProjectStageCreate, ProjectStageUpdate, ProjectUpdate } from './types'

const keys = {
  dashboard: ['dashboard'] as const,
  projects: ['projects'] as const,
  stageTypes: ['stage-types'] as const,
}

export const useDashboard = () => useQuery({ queryKey: keys.dashboard, queryFn: api.dashboard })

export const useCompletedProjects = () =>
  useQuery({ queryKey: [...keys.projects, { completed: true }], queryFn: () => api.projects(true) })

export const useStageTypes = () => useQuery({ queryKey: keys.stageTypes, queryFn: api.stageTypes })

/**
 * Every change goes to the backend, then the project views are refetched so the
 * backend re-applies its urgency rules. React never recomputes flags or order.
 */
function useProjectMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: keys.dashboard }),
        queryClient.invalidateQueries({ queryKey: keys.projects }),
      ]),
  })
}

export const useCreateProject = () => useProjectMutation((body: ProjectCreate) => api.createProject(body))

export const useUpdateProject = () =>
  useProjectMutation(({ id, body }: { id: number; body: ProjectUpdate }) => api.updateProject(id, body))

export const useDeleteProject = () => useProjectMutation((id: number) => api.deleteProject(id))

export const useAddStage = () =>
  useProjectMutation(({ projectId, body }: { projectId: number; body: ProjectStageCreate }) =>
    api.addStage(projectId, body),
  )

export const useUpdateStage = () =>
  useProjectMutation(({ id, body }: { id: number; body: ProjectStageUpdate }) => api.updateStage(id, body))

export const useDeleteStage = () => useProjectMutation((id: number) => api.deleteStage(id))

export function useCreateStageType() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: api.createStageType,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.stageTypes }),
  })
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from './client'
import type { ProjectCreate, ProjectStageCreate, ProjectStageUpdate, ProjectUpdate } from './types'

const keys = {
  dashboard: ['dashboard'] as const,
  stageTypes: ['stage-types'] as const,
}

export const useDashboard = () => useQuery({ queryKey: keys.dashboard, queryFn: api.dashboard })

export const useStageTypes = () => useQuery({ queryKey: keys.stageTypes, queryFn: api.stageTypes })

/**
 * Every change goes to the backend, then the dashboard is refetched so the
 * backend re-applies its urgency rules. React never recomputes flags or order.
 */
function useDashboardMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.dashboard }),
  })
}

export const useCreateProject = () => useDashboardMutation((body: ProjectCreate) => api.createProject(body))

export const useUpdateProject = () =>
  useDashboardMutation(({ id, body }: { id: number; body: ProjectUpdate }) => api.updateProject(id, body))

export const useDeleteProject = () => useDashboardMutation((id: number) => api.deleteProject(id))

export const useAddStage = () =>
  useDashboardMutation(({ projectId, body }: { projectId: number; body: ProjectStageCreate }) =>
    api.addStage(projectId, body),
  )

export const useUpdateStage = () =>
  useDashboardMutation(({ id, body }: { id: number; body: ProjectStageUpdate }) => api.updateStage(id, body))

export const useDeleteStage = () => useDashboardMutation((id: number) => api.deleteStage(id))

export function useCreateStageType() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: api.createStageType,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.stageTypes }),
  })
}

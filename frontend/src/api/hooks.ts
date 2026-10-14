import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from './client'
import type {
  ClientFields,
  ContactFields,
  ProjectCreate,
  ProjectStageCreate,
  ProjectStageUpdate,
  ProjectUpdate,
} from './types'

const keys = {
  dashboard: ['dashboard'] as const,
  projects: ['projects'] as const,
  stageTypes: ['stage-types'] as const,
  clients: ['clients'] as const,
  contacts: ['contacts'] as const,
}

export const useDashboard = () => useQuery({ queryKey: keys.dashboard, queryFn: api.dashboard })

export const useCompletedProjects = () =>
  useQuery({ queryKey: [...keys.projects, { completed: true }], queryFn: () => api.projects(true) })

export const useClients = () => useQuery({ queryKey: keys.clients, queryFn: api.clients })

export const useContacts = (q = '') =>
  useQuery({ queryKey: [...keys.contacts, q], queryFn: () => api.contacts(q) })

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

export const useAddStakeholder = () =>
  useProjectMutation(({ stageId, contactId }: { stageId: number; contactId: number }) =>
    api.addStakeholder(stageId, contactId),
  )

export const useRemoveStakeholder = () =>
  useProjectMutation(({ stageId, contactId }: { stageId: number; contactId: number }) =>
    api.removeStakeholder(stageId, contactId),
  )

/**
 * Client and contact names show up on project tiles and stages too,
 * so a change to either refreshes every view that might display them.
 */
function usePeopleMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () =>
      Promise.all(
        [keys.clients, keys.contacts, keys.dashboard, keys.projects].map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      ),
  })
}

export const useCreateClient = () => usePeopleMutation((body: ClientFields) => api.createClient(body))

export const useUpdateClient = () =>
  usePeopleMutation(({ id, body }: { id: number; body: Partial<ClientFields> }) => api.updateClient(id, body))

export const useDeleteClient = () => usePeopleMutation((id: number) => api.deleteClient(id))

export const useCreateContact = () => usePeopleMutation((body: ContactFields) => api.createContact(body))

export const useUpdateContact = () =>
  usePeopleMutation(({ id, body }: { id: number; body: Partial<ContactFields> }) => api.updateContact(id, body))

export const useDeleteContact = () => usePeopleMutation((id: number) => api.deleteContact(id))

export function useCreateStageType() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: api.createStageType,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.stageTypes }),
  })
}

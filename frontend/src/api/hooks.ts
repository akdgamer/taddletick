import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from './client'
import type {
  Permission,
  RoleFields,
  UserCreate,
  UserUpdate,
  ClientFields,
  PaymentFields,
  TaskFields,
  ContactFields,
  ProjectCreate,
  ProjectStageCreate,
  ProjectStageUpdate,
  ProjectUpdate,
} from './types'

const keys = {
  me: ['me'] as const,
  setup: ['setup'] as const,
  users: ['users'] as const,
  roles: ['roles'] as const,
  dashboard: ['dashboard'] as const,
  projects: ['projects'] as const,
  stageTypes: ['stage-types'] as const,
  clients: ['clients'] as const,
  contacts: ['contacts'] as const,
  payments: ['payments'] as const,
  tasks: ['tasks'] as const,
  google: ['google'] as const,
}

// --- Login -------------------------------------------------------------------

export const useSetupNeeded = () => useQuery({ queryKey: keys.setup, queryFn: api.setupNeeded })

/** The logged-in user; errors with status 401 when nobody is logged in. */
export const useMe = () =>
  useQuery({
    queryKey: keys.me,
    queryFn: api.me,
    retry: false,
    staleTime: 5 * 60_000,
  })

/** Whether the logged-in user's role allows something (admins: everything). */
export function useCan(permission: Permission | 'is_admin'): boolean {
  const role = useMe().data?.role
  return !!role && (role.is_admin || role[permission])
}

/** After logging in or out, every cached answer belonged to someone else: start over. */
function useSessionChange<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => queryClient.resetQueries(),
  })
}

export const useLogin = () =>
  useSessionChange(({ username, password }: { username: string; password: string }) => api.login(username, password))
export const useLogout = () => useSessionChange(() => api.logout())
export const useSetup = () => useSessionChange(api.setup)
export const useChangePassword = () =>
  useMutation({
    mutationFn: ({ current, next }: { current: string; next: string }) => api.changePassword(current, next),
  })

// --- Users and roles (admin page) ----------------------------------------------

export const useUsers = () => useQuery({ queryKey: keys.users, queryFn: api.users })
export const useRoles = () => useQuery({ queryKey: keys.roles, queryFn: api.roles })

function useAdminMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    // Role changes can change what the current user sees too
    onSuccess: () =>
      Promise.all(
        [keys.users, keys.roles, keys.me, keys.dashboard, keys.projects, keys.payments].map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      ),
  })
}

export const useCreateUser = () => useAdminMutation((body: UserCreate) => api.createUser(body))
export const useUpdateUser = () =>
  useAdminMutation(({ id, body }: { id: number; body: UserUpdate }) => api.updateUser(id, body))
export const useCreateRole = () => useAdminMutation((body: RoleFields) => api.createRole(body))
export const useUpdateRole = () =>
  useAdminMutation(({ id, body }: { id: number; body: Partial<RoleFields> }) => api.updateRole(id, body))
export const useDeleteRole = () => useAdminMutation((id: number) => api.deleteRole(id))

// --- Projects ------------------------------------------------------------------

export const useDashboard = () => useQuery({ queryKey: keys.dashboard, queryFn: api.dashboard })

export const useCompletedProjects = () =>
  useQuery({
    queryKey: [...keys.projects, { completed: true }],
    queryFn: () => api.projects(true),
  })

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
      Promise.all(
        [keys.dashboard, keys.projects, keys.payments].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      ),
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

export const useOutstandingPayments = () =>
  useQuery({ queryKey: keys.payments, queryFn: api.outstandingPayments })

export const useAddPayment = () =>
  useProjectMutation(({ projectId, body }: { projectId: number; body: PaymentFields }) =>
    api.addPayment(projectId, body),
  )

export const useUpdatePayment = () =>
  useProjectMutation(({ id, body }: { id: number; body: Partial<PaymentFields> }) => api.updatePayment(id, body))

export const useDeletePayment = () => useProjectMutation((id: number) => api.deletePayment(id))

export const useUploadFile = () =>
  useProjectMutation(({ projectId, file }: { projectId: number; file: File }) => api.uploadFile(projectId, file))

export const useDeleteFile = () => useProjectMutation((id: number) => api.deleteFile(id))

export const useTasks = () => useQuery({ queryKey: [...keys.tasks, 'all'], queryFn: api.tasks })
export const useTodayTasks = () => useQuery({ queryKey: [...keys.tasks, 'today'], queryFn: api.todayTasks })

function useTaskMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.tasks }),
  })
}

export const useCreateTask = () =>
  useTaskMutation((body: Partial<TaskFields> & { title: string }) => api.createTask(body))
export const useUpdateTask = () =>
  useTaskMutation(({ id, body }: { id: number; body: Partial<TaskFields & { is_archived: boolean }> }) =>
    api.updateTask(id, body),
  )
export const useDeleteTask = () => useTaskMutation((id: number) => api.deleteTask(id))
export const useSetTaskDone = () =>
  useTaskMutation(({ id, done }: { id: number; done: boolean }) => api.setTaskDone(id, done))

export const useGoogleStatus = () => useQuery({ queryKey: keys.google, queryFn: api.googleStatus })

function useGoogleMutation<TResult>(fn: () => Promise<TResult>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.google }),
  })
}

export const useGoogleSync = () => useGoogleMutation(api.googleSync)
export const useGoogleDisconnect = () => useGoogleMutation(api.googleDisconnect)

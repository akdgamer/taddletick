import type {
  Client,
  ClientFields,
  Contact,
  ContactFields,
  DashboardProject,
  GoogleStatus,
  Role,
  RoleFields,
  User,
  UserCreate,
  UserUpdate,
  OutstandingPayment,
  Payment,
  PaymentFields,
  ProjectFile,
  ProjectNote,
  DisplayData,
  ActivityPage,
  Task,
  TaskFields,
  TodayTask,
  Project,
  ProjectCreate,
  ProjectStage,
  ProjectStageCreate,
  ProjectStageUpdate,
  ProjectUpdate,
  StageType,
} from './types'

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function check(response: Response): Promise<Response> {
  if (!response.ok) {
    // FastAPI puts the reason in "detail" (a string, or a list for validation errors)
    const data = await response.json().catch(() => null)
    const detail = typeof data?.detail === 'string' ? data.detail : response.statusText
    throw new ApiError(response.status, detail)
  }
  return response
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    credentials: 'include', // send the login cookie (the dev API is on another port)
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  await check(response)
  return response.status === 204 ? (undefined as T) : response.json()
}

export const api = {
  activity: (params: { project_id?: number; user_id?: number; before?: number; limit?: number }) => {
    const q = new URLSearchParams(
      Object.entries(params).flatMap(([k, v]) => (v === undefined ? [] : [[k, String(v)]])),
    )
    return request<ActivityPage>('GET', `/activity${q.size ? `?${q}` : ''}`)
  },
  displayData: () => request<DisplayData>('GET', '/display/data'),
  displayPair: (code: string) => request<void>('POST', '/display/pair', { code }),
  displayTick: (taskId: number, done: boolean) =>
    request<void>(done ? 'POST' : 'DELETE', `/display/tasks/${taskId}/done`),
  pairedDisplays: () => request<{ count: number }>('GET', '/display/paired'),
  unpairDisplays: () => request<void>('DELETE', '/display/paired'),
  setupNeeded: () => request<{ needed: boolean }>('GET', '/auth/setup'),
  setup: (body: { username: string; display_name: string; password: string }) =>
    request<User>('POST', '/auth/setup', body),
  login: (username: string, password: string) => request<User>('POST', '/auth/login', { username, password }),
  logout: () => request<void>('POST', '/auth/logout'),
  me: () => request<User>('GET', '/auth/me'),
  changePassword: (current_password: string, new_password: string) =>
    request<void>('POST', '/auth/password', { current_password, new_password }),

  users: () => request<User[]>('GET', '/users'),
  createUser: (body: UserCreate) => request<User>('POST', '/users', body),
  updateUser: (id: number, body: UserUpdate) => request<User>('PATCH', `/users/${id}`, body),
  roles: () => request<Role[]>('GET', '/roles'),
  createRole: (body: RoleFields) => request<Role>('POST', '/roles', body),
  updateRole: (id: number, body: Partial<RoleFields>) => request<Role>('PATCH', `/roles/${id}`, body),
  deleteRole: (id: number) => request<void>('DELETE', `/roles/${id}`),

  dashboard: () => request<DashboardProject[]>('GET', '/dashboard'),

  stageTypes: () => request<StageType[]>('GET', '/stage-types'),
  createStageType: (name: string) => request<StageType>('POST', '/stage-types', { name }),

  projects: (completed: boolean) => request<Project[]>('GET', `/projects?completed=${completed}`),
  createProject: (body: ProjectCreate) => request<Project>('POST', '/projects', body),
  updateProject: (id: number, body: ProjectUpdate) => request<Project>('PATCH', `/projects/${id}`, body),
  deleteProject: (id: number) => request<void>('DELETE', `/projects/${id}`),

  addStage: (projectId: number, body: ProjectStageCreate) =>
    request<ProjectStage>('POST', `/projects/${projectId}/stages`, body),
  updateStage: (id: number, body: ProjectStageUpdate) => request<ProjectStage>('PATCH', `/stages/${id}`, body),
  deleteStage: (id: number) => request<void>('DELETE', `/stages/${id}`),
  addStakeholder: (stageId: number, contactId: number) =>
    request<ProjectStage>('POST', `/stages/${stageId}/contacts/${contactId}`),
  removeStakeholder: (stageId: number, contactId: number) =>
    request<ProjectStage>('DELETE', `/stages/${stageId}/contacts/${contactId}`),

  clients: () => request<Client[]>('GET', '/clients'),
  createClient: (body: ClientFields) => request<Client>('POST', '/clients', body),
  updateClient: (id: number, body: Partial<ClientFields>) => request<Client>('PATCH', `/clients/${id}`, body),
  deleteClient: (id: number) => request<void>('DELETE', `/clients/${id}`),

  contacts: (q = '') => request<Contact[]>('GET', `/contacts${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  createContact: (body: ContactFields) => request<Contact>('POST', '/contacts', body),
  updateContact: (id: number, body: Partial<ContactFields>) => request<Contact>('PATCH', `/contacts/${id}`, body),
  deleteContact: (id: number) => request<void>('DELETE', `/contacts/${id}`),

  addPayment: (projectId: number, body: PaymentFields) =>
    request<Payment>('POST', `/projects/${projectId}/payments`, body),
  updatePayment: (id: number, body: Partial<PaymentFields>) => request<Payment>('PATCH', `/payments/${id}`, body),
  deletePayment: (id: number) => request<void>('DELETE', `/payments/${id}`),
  outstandingPayments: () => request<OutstandingPayment[]>('GET', '/payments/outstanding'),

  uploadFile: async (projectId: number, file: File) => {
    const form = new FormData()
    form.append('upload', file)
    const response = await fetch(`${API_URL}/projects/${projectId}/files`, {
      method: 'POST',
      credentials: 'include',
      body: form,
    })
    return (await check(response)).json() as Promise<ProjectFile>
  },
  fileUrl: (id: number) => `${API_URL}/files/${id}`,
  deleteFile: (id: number) => request<void>('DELETE', `/files/${id}`),

  addNote: (projectId: number, body: string) => request<ProjectNote>('POST', `/projects/${projectId}/notes`, { body }),
  updateNote: (id: number, body: string) => request<ProjectNote>('PATCH', `/notes/${id}`, { body }),
  deleteNote: (id: number) => request<void>('DELETE', `/notes/${id}`),

  tasks: () => request<Task[]>('GET', '/tasks'),
  todayTasks: () => request<TodayTask[]>('GET', '/tasks/today'),
  createTask: (body: Partial<TaskFields> & { title: string }) => request<Task>('POST', '/tasks', body),
  updateTask: (id: number, body: Partial<TaskFields & { is_archived: boolean }>) =>
    request<Task>('PATCH', `/tasks/${id}`, body),
  deleteTask: (id: number) => request<void>('DELETE', `/tasks/${id}`),
  setTaskDone: (id: number, done: boolean) => request<void>(done ? 'POST' : 'DELETE', `/tasks/${id}/done`),

  googleStatus: () => request<GoogleStatus>('GET', '/google/status'),
  googleConnectUrl: () => `${API_URL}/google/connect`,
  googleSync: () => request<unknown>('POST', '/google/sync'),
  googleDisconnect: () => request<void>('POST', '/google/disconnect'),
}

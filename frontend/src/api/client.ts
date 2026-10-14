import type {
  DashboardProject,
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

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!response.ok) {
    // FastAPI puts the reason in "detail" (a string, or a list for validation errors)
    const data = await response.json().catch(() => null)
    const detail = typeof data?.detail === 'string' ? data.detail : response.statusText
    throw new ApiError(response.status, detail)
  }
  return response.status === 204 ? (undefined as T) : response.json()
}

export const api = {
  dashboard: () => request<DashboardProject[]>('GET', '/dashboard'),

  stageTypes: () => request<StageType[]>('GET', '/stage-types'),
  createStageType: (name: string) => request<StageType>('POST', '/stage-types', { name }),

  createProject: (body: ProjectCreate) => request<Project>('POST', '/projects', body),
  updateProject: (id: number, body: ProjectUpdate) => request<Project>('PATCH', `/projects/${id}`, body),
  deleteProject: (id: number) => request<void>('DELETE', `/projects/${id}`),

  addStage: (projectId: number, body: ProjectStageCreate) =>
    request<ProjectStage>('POST', `/projects/${projectId}/stages`, body),
  updateStage: (id: number, body: ProjectStageUpdate) => request<ProjectStage>('PATCH', `/stages/${id}`, body),
  deleteStage: (id: number) => request<void>('DELETE', `/stages/${id}`),
}

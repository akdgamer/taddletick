// Mirrors backend/app/schemas.py — the API contract.

export type ProjectLabel = 'company' | 'personal'
export type StageStatus = 'not_started' | 'in_progress' | 'blocked' | 'done'
export type Flag = 'red' | 'amber' | 'none'

export interface StageType {
  id: number
  name: string
  sort_order: number
}

export interface ProjectStage {
  id: number
  stage_type_id: number
  name: string
  status: StageStatus
  due_date: string | null // ISO date, e.g. "2026-03-10"
  notes: string
  position: number
}

export interface ProjectFields {
  name: string
  client_name: string | null
  po_number: string | null
  label: ProjectLabel
  is_p0: boolean
  dispatch_date: string | null
  notes: string
}

export interface Project extends ProjectFields {
  id: number
  is_completed: boolean
  stages: ProjectStage[]
}

export interface ProjectCreate extends ProjectFields {
  stage_type_ids: number[]
}

export type ProjectUpdate = Partial<ProjectFields & { is_completed: boolean }>

export interface ProjectStageCreate {
  stage_type_id: number
  status?: StageStatus
  due_date?: string | null
  notes?: string
}

export type ProjectStageUpdate = Partial<Pick<ProjectStage, 'status' | 'due_date' | 'notes' | 'position'>>

export interface DashboardStage extends ProjectStage {
  flag: Flag
}

export interface DashboardProject extends ProjectFields {
  id: number
  flag: Flag
  dispatch_flag: Flag
  days_to_dispatch: number | null
  stages: DashboardStage[]
}

// Mirrors backend/app/schemas.py — the API contract.

export type ProjectLabel = 'company' | 'personal'
export type StageStatus = 'not_started' | 'in_progress' | 'blocked' | 'done'
export type Flag = 'red' | 'amber' | 'none'

export type Permission = 'can_edit' | 'can_delete' | 'can_view_payments' | 'can_edit_payments'

export interface RoleFields {
  name: string
  is_admin: boolean
  can_edit: boolean
  can_delete: boolean
  can_view_payments: boolean
  can_edit_payments: boolean
}

export interface Role extends RoleFields {
  id: number
}

export interface UserRef {
  id: number
  display_name: string
}

export interface User {
  id: number
  username: string
  display_name: string
  role: Role
  is_active: boolean
}

export interface UserCreate {
  username: string
  display_name: string
  password: string
  role_id: number
}

export type UserUpdate = Partial<
  Pick<User, 'display_name' | 'is_active'> & {
    role_id: number
    password: string
  }
>

/** What the logged-in user may do on one project (worked out by the API). */
export type ProjectAccess = Record<Permission, boolean>

export interface ClientRef {
  id: number
  name: string
}

export interface ContactFields {
  name: string
  client_id: number | null
  role: string
  phone: string
  email: string
  notes: string
}

export interface Contact extends ContactFields {
  id: number
  client: ClientRef | null
}

export interface ClientFields {
  name: string
  address: string
  notes: string
}

export interface Client extends ClientFields {
  id: number
  contacts: Contact[]
}

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
  contacts: Contact[]
}

export interface PaymentFields {
  label: string
  expected_amount: number
  due_date: string | null
  received_amount: number
  received_date: string | null
  notes: string
}

export interface Payment extends PaymentFields {
  id: number
  project_id: number
  is_paid: boolean
}

export interface DashboardPayment extends Payment {
  flag: Flag
}

export interface ProjectRef {
  id: number
  name: string
  is_completed: boolean
}

export interface OutstandingPayment extends DashboardPayment {
  project: ProjectRef
  client: ClientRef | null
  contacts: Contact[]
}

export interface ProjectFile {
  id: number
  filename: string
  content_type: string
  size: number
  uploaded_at: string
}

export type Recurrence = 'none' | 'daily' | 'weekdays' | 'weekly'

export interface TaskFields {
  title: string
  notes: string
  project_id: number | null
  recurrence: Recurrence
  start_date: string
}

export interface Task extends TaskFields {
  id: number
  project: ProjectRef | null
  is_archived: boolean
}

export interface TodayTask extends Task {
  done: boolean
  days_overdue: number
}

export interface GoogleStatus {
  configured: boolean
  connected: boolean
  last_sync_at: string | null
  last_error: string | null
  redirect_uri: string
}

export interface ProjectFields {
  name: string
  client_id: number | null
  po_number: string | null
  label: ProjectLabel
  is_p0: boolean
  dispatch_date: string | null
  notes: string
}

export interface Project extends ProjectFields {
  id: number
  client: ClientRef | null
  owner: UserRef | null
  allowed_role_ids: number[] // empty = every role can see it
  access: ProjectAccess
  is_completed: boolean
  stages: ProjectStage[]
  payments: Payment[]
  files: ProjectFile[]
}

export interface ProjectCreate extends ProjectFields {
  stage_type_ids: number[]
  allowed_role_ids?: number[]
}

export type ProjectUpdate = Partial<ProjectFields & { is_completed: boolean; allowed_role_ids: number[] }>

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

export interface ProjectNote {
  id: number
  project_id: number
  body: string
  author: UserRef | null
  created_at: string
  edited_at: string | null
}

export interface DashboardProject extends ProjectFields {
  id: number
  client: ClientRef | null
  owner: UserRef | null
  allowed_role_ids: number[]
  access: ProjectAccess
  flag: Flag
  dispatch_flag: Flag
  days_to_dispatch: number | null
  stages: DashboardStage[]
  payments: DashboardPayment[]
  files: ProjectFile[]
  log: ProjectNote[]
}

// Desk display (the Pi's touch screen)

export interface DisplayData {
  name: string
  today: string
  tasks: { id: number; title: string; done: boolean; days_overdue: number; project: string | null }[]
  alerts: { project_id: number; project: string; flag: Flag; reason: string }[]
  next_dispatch: { project: string; date: string; days: number } | null
  active_projects: number
  health: {
    backup_at: string | null
    google: 'off' | 'ok' | 'error'
    google_at: string | null
    temp_c: number | null
    disk_free_pct: number
  }
}

// Activity history

export interface ActivityItem {
  id: number
  at: string
  kind: 'project' | 'stage' | 'payment' | 'file' | 'note'
  summary: string
  project_id: number | null
  project_name: string
  user: UserRef | null
}

export interface ActivityPage {
  items: ActivityItem[]
  next_before: number | null
}

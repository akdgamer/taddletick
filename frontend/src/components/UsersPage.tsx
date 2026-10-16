import { useState, type FormEvent } from 'react'

import {
  useCreateRole,
  useCreateUser,
  useDeleteRole,
  useMe,
  useRoles,
  useUpdateRole,
  useUpdateUser,
  useUsers,
} from '../api/hooks'
import type { Role, RoleFields, User } from '../api/types'
import { IconButton, KeyIcon, TrashIcon, UserOffIcon, UserOnIcon } from './Icons'
import { SkeletonRows } from './Placeholders'
import { useToast } from './useToast'

const FLAGS: {
  key: keyof Omit<RoleFields, 'name'>
  label: string
  hint: string
}[] = [
  {
    key: 'is_admin',
    label: 'Admin',
    hint: 'Everything, incl. users and restricted projects',
  },
  {
    key: 'can_edit',
    label: 'Edit',
    hint: 'Create and edit company projects, clients, contacts',
  },
  {
    key: 'can_delete',
    label: 'Delete',
    hint: 'Delete projects, stages, files, clients, contacts',
  },
  {
    key: 'can_view_payments',
    label: 'See payments',
    hint: 'See amounts and the payments-to-chase list',
  },
  {
    key: 'can_edit_payments',
    label: 'Record payments',
    hint: 'Add payments and mark them received',
  },
]

export function UsersPage() {
  return (
    <main className="page narrow">
      <header className="page-header">
        <h1>Users</h1>
      </header>
      <PeopleSection />
      <RolesSection />
    </main>
  )
}

function PeopleSection() {
  const { data: users = [], isPending } = useUsers()
  const [adding, setAdding] = useState(false)

  return (
    <section className="card">
      <header className="page-header">
        <h2>People</h2>
        {!adding && (
          <button className="primary" onClick={() => setAdding(true)}>
            Add person
          </button>
        )}
      </header>
      <p className="muted">
        Everyone sees company projects (unless a project is restricted to some roles). Personal projects are only ever
        visible to the person who created them.
      </p>
      {adding && <NewUserForm onDone={() => setAdding(false)} />}
      {isPending && <SkeletonRows />}
      <ul className="contact-list">
        {users.map((u) => (
          <UserRow key={u.id} user={u} />
        ))}
      </ul>
    </section>
  )
}

function NewUserForm({ onDone }: { onDone: () => void }) {
  const { data: roles = [] } = useRoles()
  const createUser = useCreateUser()
  const [f, setF] = useState({
    display_name: '',
    username: '',
    password: '',
    role_id: '',
  })
  const set = (key: keyof typeof f, value: string) => setF({ ...f, [key]: value })
  const roleId = f.role_id || String(roles.find((r) => r.name === 'Member')?.id ?? roles[0]?.id ?? '')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    createUser.mutate(
      {
        display_name: f.display_name.trim(),
        username: f.username.trim(),
        password: f.password,
        role_id: Number(roleId),
      },
      { onSuccess: onDone },
    )
  }

  return (
    <form className="stack-form" onSubmit={submit}>
      <div className="form-grid">
        <label>
          Name
          <input required autoFocus value={f.display_name} onChange={(e) => set('display_name', e.target.value)} />
        </label>
        <label>
          Username
          <input
            required
            autoComplete="off"
            pattern="[A-Za-z0-9_.\-]{2,}"
            title="At least 2 characters: letters, numbers, . _ -"
            value={f.username}
            onChange={(e) => set('username', e.target.value)}
          />
        </label>
        <label>
          First password <span className="muted">(8+ characters)</span>
          <input
            required
            minLength={8}
            autoComplete="new-password"
            value={f.password}
            onChange={(e) => set('password', e.target.value)}
          />
        </label>
        <label>
          Role
          <select value={roleId} onChange={(e) => set('role_id', e.target.value)}>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="muted">Give them the password yourself; they can change it under Settings.</p>
      {createUser.error && <p className="error">{createUser.error.message}</p>}
      <div className="form-actions">
        <button type="button" onClick={onDone}>
          Cancel
        </button>
        <button type="submit" className="primary" disabled={createUser.isPending}>
          Add person
        </button>
      </div>
    </form>
  )
}

function UserRow({ user }: { user: User }) {
  const { data: me } = useMe()
  const { data: roles = [] } = useRoles()
  const updateUser = useUpdateUser()
  const toast = useToast()
  const [resetting, setResetting] = useState(false)
  const [password, setPassword] = useState('')
  const isMe = me?.id === user.id

  const update = (body: Parameters<typeof updateUser.mutate>[0]['body'], onSuccess?: () => void) =>
    updateUser.mutate({ id: user.id, body }, { onSuccess })

  return (
    <li className="contact-item">
      <div>
        <strong>{user.display_name}</strong>
        {isMe && <span className="muted"> (you)</span>}
        {!user.is_active && <span className="badge"> Deactivated</span>}
        <div className="muted">{user.username}</div>
        {resetting && (
          <div className="inline-add">
            <input
              aria-label={`New password for ${user.display_name}`}
              placeholder="New password (8+ characters)"
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              disabled={password.length < 8}
              onClick={() =>
                update({ password }, () => {
                  setResetting(false)
                  setPassword('')
                  toast({ message: `Password reset for ${user.display_name}` })
                })
              }
            >
              Set
            </button>
            <button onClick={() => setResetting(false)}>Cancel</button>
          </div>
        )}
        {updateUser.error && <p className="error">{updateUser.error.message}</p>}
      </div>
      <div className="row-actions">
        <select
          aria-label={`Role of ${user.display_name}`}
          value={user.role.id}
          disabled={isMe}
          title={isMe ? "You can't change your own role" : undefined}
          onChange={(e) => update({ role_id: Number(e.target.value) })}
        >
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        {!resetting && (
          <IconButton label="Reset password" tone="accent" icon={<KeyIcon />} onClick={() => setResetting(true)} />
        )}
        {!isMe &&
          (user.is_active ? (
            <IconButton
              label="Deactivate"
              tone="danger"
              icon={<UserOffIcon />}
              onClick={() =>
                update({ is_active: false }, () =>
                  toast({
                    message: `${user.display_name} can no longer log in`,
                    action: { label: 'Undo', run: () => update({ is_active: true }) },
                  }),
                )
              }
            />
          ) : (
            <IconButton label="Reactivate" tone="ok" icon={<UserOnIcon />} onClick={() => update({ is_active: true })} />
          ))}
      </div>
    </li>
  )
}

function RolesSection() {
  const { data: roles = [] } = useRoles()
  const createRole = useCreateRole()
  const [name, setName] = useState('')

  const add = () => {
    if (!name.trim()) return
    createRole.mutate(
      {
        name: name.trim(),
        is_admin: false,
        can_edit: false,
        can_delete: false,
        can_view_payments: false,
        can_edit_payments: false,
      },
      { onSuccess: () => setName('') },
    )
  }

  return (
    <section className="card">
      <h2>Roles</h2>
      <p className="muted">
        Tick what each role may do. Changes apply straight away. A person's own personal projects ignore these: they can
        always do everything there.
      </p>
      <div className="table-scroll">
        <table className="role-table">
          <thead>
            <tr>
              <th>Role</th>
              {FLAGS.map((f) => (
                <th key={f.key} title={f.hint}>
                  {f.label}
                </th>
              ))}
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {roles.map((r) => (
              <RoleRow key={r.id} role={r} />
            ))}
          </tbody>
        </table>
      </div>
      <div className="inline-add">
        <input
          aria-label="New role name"
          placeholder="New role, e.g. Accounts"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <button onClick={add} disabled={!name.trim()}>
          Add role
        </button>
      </div>
      {createRole.error && <p className="error">{createRole.error.message}</p>}
      <ul className="muted">
        {FLAGS.map((f) => (
          <li key={f.key}>
            <strong>{f.label}</strong>: {f.hint}
          </li>
        ))}
      </ul>
    </section>
  )
}

function RoleRow({ role }: { role: Role }) {
  const updateRole = useUpdateRole()
  const deleteRole = useDeleteRole()
  const error = updateRole.error ?? deleteRole.error

  return (
    <>
      <tr>
        <td>{role.name}</td>
        {FLAGS.map((f) => (
          <td key={f.key}>
            <input
              type="checkbox"
              aria-label={`${role.name}: ${f.label}`}
              checked={role[f.key]}
              // Admin implies everything; the other boxes don't matter for admin roles
              disabled={f.key !== 'is_admin' && role.is_admin}
              onChange={(e) =>
                updateRole.mutate({
                  id: role.id,
                  body: { [f.key]: e.target.checked },
                })
              }
            />
          </td>
        ))}
        <td>
          <IconButton
            label={`Delete role ${role.name}`}
            tone="danger"
            icon={<TrashIcon />}
            onClick={() => deleteRole.mutate(role.id)}
          />
        </td>
      </tr>
      {error && (
        <tr>
          <td colSpan={FLAGS.length + 2} className="error">
            {error.message}
          </td>
        </tr>
      )}
    </>
  )
}

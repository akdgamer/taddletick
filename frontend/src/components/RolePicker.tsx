import { useRoles } from '../api/hooks'

/** Admins only: limit a company project to some roles. Nothing ticked = everyone sees it. */
export function RolePicker({ value, onChange }: { value: number[]; onChange: (ids: number[]) => void }) {
  const { data: roles = [] } = useRoles()
  const choosable = roles.filter((r) => !r.is_admin) // admins always see everything

  return (
    <fieldset className="stage-picker">
      <legend>Who can see it</legend>
      <div className="role-picker">
        {choosable.map((r) => (
          <label key={r.id} className="checkbox">
            <input
              type="checkbox"
              checked={value.includes(r.id)}
              onChange={(e) => onChange(e.target.checked ? [...value, r.id] : value.filter((id) => id !== r.id))}
            />
            {r.name}
          </label>
        ))}
      </div>
      <p className="muted">
        {value.length === 0
          ? 'Everyone. Tick roles to restrict it to them (admins always see it).'
          : 'Only the ticked roles and admins.'}
      </p>
    </fieldset>
  )
}

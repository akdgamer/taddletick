import { useState } from 'react'

import { useAddStakeholder, useContacts, useRemoveStakeholder } from '../api/hooks'
import type { Contact } from '../api/types'

/** The people involved in one project stage, with a picker to add more. */
interface Props {
  stageId: number
  stageName: string
  contacts: Contact[]
  readOnly?: boolean
}

export function Stakeholders({ stageId, stageName, contacts, readOnly = false }: Props) {
  const { data: allContacts = [] } = useContacts()
  const addStakeholder = useAddStakeholder()
  const removeStakeholder = useRemoveStakeholder()
  const [openId, setOpenId] = useState<number | null>(null)

  const linked = new Set(contacts.map((c) => c.id))
  const available = allContacts.filter((c) => !linked.has(c.id))
  const open = contacts.find((c) => c.id === openId)
  const error = addStakeholder.error ?? removeStakeholder.error

  return (
    <div className="stakeholders">
      {contacts.map((c) => (
        <span key={c.id} className={`chip${c.id === openId ? ' chip-open' : ''}`}>
          <button
            className="chip-name"
            aria-expanded={c.id === openId}
            onClick={() => setOpenId(c.id === openId ? null : c.id)}
          >
            {c.name}
            {c.client && <span className="muted"> · {c.client.name}</span>}
          </button>
          {!readOnly && (
            <button
              className="icon-button"
              aria-label={`Remove ${c.name} from ${stageName}`}
              onClick={() => removeStakeholder.mutate({ stageId, contactId: c.id })}
            >
              ×
            </button>
          )}
        </span>
      ))}

      {!readOnly && available.length > 0 && (
        <select
          className="add-person"
          aria-label={`Add person to ${stageName}`}
          value=""
          onChange={(e) => addStakeholder.mutate({ stageId, contactId: Number(e.target.value) })}
        >
          <option value="">+ Person</option>
          {available.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.client ? ` (${c.client.name})` : c.role ? ` (${c.role})` : ''}
            </option>
          ))}
        </select>
      )}

      {open && <ContactCard contact={open} />}
      {error && <span className="error">{error.message}</span>}
    </div>
  )
}

export function ContactCard({ contact }: { contact: Contact }) {
  const lines = [contact.role, contact.client?.name].filter(Boolean).join(' · ')
  return (
    <div className="contact-card">
      <strong>{contact.name}</strong>
      {lines && <span className="muted"> — {lines}</span>}
      <div className="contact-links">
        {contact.phone && <a href={`tel:${contact.phone.replace(/\s/g, '')}`}>{contact.phone}</a>}
        {contact.email && <a href={`mailto:${contact.email}`}>{contact.email}</a>}
        {!contact.phone && !contact.email && <span className="muted">No phone or email saved</span>}
      </div>
      {contact.notes && <p className="muted">{contact.notes}</p>}
    </div>
  )
}

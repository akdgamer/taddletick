import { useState, type FormEvent } from 'react'

import {
  useClients,
  useContacts,
  useCan,
  useCreateClient,
  useCreateContact,
  useDeleteClient,
  useDeleteContact,
  useUpdateClient,
  useUpdateContact,
} from '../api/hooks'
import type { Client, ClientFields, Contact, ContactFields } from '../api/types'
import { ContactCard } from './Stakeholders'

const EMPTY_CLIENT: ClientFields = { name: '', address: '', notes: '' }
const emptyContact = (client_id: number | null): ContactFields => ({
  name: '',
  client_id,
  role: '',
  phone: '',
  email: '',
  notes: '',
})

export function ContactsPage() {
  const { data: clients = [], isPending, error } = useClients()
  const { data: allContacts = [] } = useContacts()
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState<'client' | 'contact' | null>(null)
  const canEdit = useCan('can_edit')

  const noCompany = allContacts.filter((c) => c.client === null)

  return (
    <main className="page">
      <header className="page-header">
        <h1>Contacts</h1>
        <div className="header-actions">
          <input
            type="search"
            aria-label="Search contacts"
            placeholder="Search name, role or company"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {canEdit && (
            <>
              <button onClick={() => setAdding('client')}>New client</button>
              <button className="primary" onClick={() => setAdding('contact')}>
                New contact
              </button>
            </>
          )}
        </div>
      </header>

      {adding === 'client' && (
        <section className="card">
          <h2>New client</h2>
          <ClientForm onDone={() => setAdding(null)} />
        </section>
      )}
      {adding === 'contact' && (
        <section className="card">
          <h2>New contact</h2>
          <ContactForm initial={emptyContact(null)} onDone={() => setAdding(null)} />
        </section>
      )}

      {isPending && <p className="muted">Loading…</p>}
      {error && <p className="error">Couldn't load contacts: {error.message}</p>}

      {search.trim() ? (
        <SearchResults q={search.trim()} />
      ) : (
        <div className="client-list">
          {clients.map((client) => (
            <ClientSection key={client.id} client={client} />
          ))}
          {noCompany.length > 0 && (
            <section className="card">
              <h2>No company</h2>
              <p className="muted">Suppliers and other people not tied to a client.</p>
              <ContactList contacts={noCompany} />
            </section>
          )}
          {!isPending && clients.length === 0 && noCompany.length === 0 && (
            <p className="muted">No clients or contacts yet.</p>
          )}
        </div>
      )}
    </main>
  )
}

function SearchResults({ q }: { q: string }) {
  const { data: results, isPending } = useContacts(q)
  if (isPending) return <p className="muted">Searching…</p>
  if (!results?.length) return <p className="muted">No contacts match “{q}”.</p>
  return (
    <section className="card">
      <ContactList contacts={results} />
    </section>
  )
}

function ClientSection({ client }: { client: Client }) {
  const deleteClient = useDeleteClient()
  const canEdit = useCan('can_edit')
  const canDelete = useCan('can_delete')
  const [editing, setEditing] = useState(false)
  const [addingContact, setAddingContact] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  return (
    <section className="card" aria-label={client.name}>
      {editing ? (
        <ClientForm client={client} onDone={() => setEditing(false)} />
      ) : (
        <header className="tile-header">
          <div>
            <h2>{client.name}</h2>
            {client.address && <p className="tile-meta">{client.address}</p>}
            {client.notes && <p className="tile-meta">{client.notes}</p>}
          </div>
          <div className="row-actions">
            {canEdit && (
              <button className="link-button" onClick={() => setEditing(true)}>
                Edit
              </button>
            )}
            {canDelete &&
              (confirmingDelete ? (
                <>
                  <button className="danger" onClick={() => deleteClient.mutate(client.id)}>
                    Confirm delete
                  </button>
                  <button onClick={() => setConfirmingDelete(false)}>Cancel</button>
                </>
              ) : (
                <button onClick={() => setConfirmingDelete(true)}>Delete</button>
              ))}
          </div>
        </header>
      )}
      {deleteClient.error && <p className="error">{deleteClient.error.message}</p>}

      <ContactList contacts={client.contacts} />

      {addingContact ? (
        <ContactForm initial={emptyContact(client.id)} onDone={() => setAddingContact(false)} />
      ) : (
        canEdit && (
          <button className="link-button" onClick={() => setAddingContact(true)}>
            + Add contact
          </button>
        )
      )}
    </section>
  )
}

function ContactList({ contacts }: { contacts: Contact[] }) {
  if (contacts.length === 0) return <p className="muted">No contacts.</p>
  return (
    <ul className="contact-list">
      {contacts.map((c) => (
        <ContactItem key={c.id} contact={c} />
      ))}
    </ul>
  )
}

function ContactItem({ contact }: { contact: Contact }) {
  const deleteContact = useDeleteContact()
  const canEdit = useCan('can_edit')
  const canDelete = useCan('can_delete')
  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  if (editing) {
    return (
      <li>
        <ContactForm contactId={contact.id} initial={contact} onDone={() => setEditing(false)} />
      </li>
    )
  }

  return (
    <li className="contact-item" aria-label={contact.name}>
      <ContactCard contact={contact} />
      <div className="row-actions">
        {canEdit && (
          <button className="link-button" onClick={() => setEditing(true)}>
            Edit
          </button>
        )}
        {canDelete &&
          (confirmingDelete ? (
            <>
              <button className="danger" onClick={() => deleteContact.mutate(contact.id)}>
                Confirm delete
              </button>
              <button onClick={() => setConfirmingDelete(false)}>Cancel</button>
            </>
          ) : (
            <button onClick={() => setConfirmingDelete(true)}>Delete</button>
          ))}
      </div>
      {deleteContact.error && <p className="error">{deleteContact.error.message}</p>}
    </li>
  )
}

function ClientForm({ client, onDone }: { client?: Client; onDone: () => void }) {
  const createClient = useCreateClient()
  const updateClient = useUpdateClient()
  const [fields, setFields] = useState<ClientFields>(client ?? EMPTY_CLIENT)
  const mutation = client ? updateClient : createClient

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const body = {
      name: fields.name.trim(),
      address: fields.address,
      notes: fields.notes,
    }
    if (client) updateClient.mutate({ id: client.id, body }, { onSuccess: onDone })
    else createClient.mutate(body, { onSuccess: onDone })
  }

  return (
    <form className="stack-form" onSubmit={submit}>
      <div className="form-grid">
        <label>
          Company name
          <input required value={fields.name} onChange={(e) => setFields({ ...fields, name: e.target.value })} />
        </label>
        <label>
          Address
          <input value={fields.address} onChange={(e) => setFields({ ...fields, address: e.target.value })} />
        </label>
      </div>
      <label>
        Notes
        <textarea rows={2} value={fields.notes} onChange={(e) => setFields({ ...fields, notes: e.target.value })} />
      </label>
      {mutation.error && <p className="error">{mutation.error.message}</p>}
      <div className="form-actions">
        <button type="button" onClick={onDone}>
          Cancel
        </button>
        <button type="submit" className="primary" disabled={mutation.isPending}>
          {client ? 'Save' : 'Create client'}
        </button>
      </div>
    </form>
  )
}

function ContactForm({
  contactId,
  initial,
  onDone,
}: {
  contactId?: number
  initial: ContactFields
  onDone: () => void
}) {
  const { data: clients = [] } = useClients()
  const createContact = useCreateContact()
  const updateContact = useUpdateContact()
  const [fields, setFields] = useState<ContactFields>({
    name: initial.name,
    client_id: initial.client_id,
    role: initial.role,
    phone: initial.phone,
    email: initial.email,
    notes: initial.notes,
  })
  const mutation = contactId ? updateContact : createContact
  const set = <K extends keyof ContactFields>(key: K, value: ContactFields[K]) => setFields({ ...fields, [key]: value })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const body = { ...fields, name: fields.name.trim() }
    if (contactId) updateContact.mutate({ id: contactId, body }, { onSuccess: onDone })
    else createContact.mutate(body, { onSuccess: onDone })
  }

  return (
    <form className="stack-form" onSubmit={submit}>
      <div className="form-grid">
        <label>
          Name
          <input required value={fields.name} onChange={(e) => set('name', e.target.value)} />
        </label>
        <label>
          Company
          <select
            value={fields.client_id ?? ''}
            onChange={(e) => set('client_id', e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">No company</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Role
          <input placeholder="e.g. Purchase, Valve supplier" value={fields.role} onChange={(e) => set('role', e.target.value)} />
        </label>
        <label>
          Phone
          <input type="tel" value={fields.phone} onChange={(e) => set('phone', e.target.value)} />
        </label>
        <label>
          Email
          <input type="email" value={fields.email} onChange={(e) => set('email', e.target.value)} />
        </label>
      </div>
      <label>
        Notes
        <textarea rows={2} value={fields.notes} onChange={(e) => set('notes', e.target.value)} />
      </label>
      {mutation.error && <p className="error">{mutation.error.message}</p>}
      <div className="form-actions">
        <button type="button" onClick={onDone}>
          Cancel
        </button>
        <button type="submit" className="primary" disabled={mutation.isPending}>
          {contactId ? 'Save' : 'Add contact'}
        </button>
      </div>
    </form>
  )
}

import { useState } from 'react'

import { useClients, useCreateClient } from '../api/hooks'

const NEW = 'new'

interface Props {
  value: string // client id as a string, '' for none
  onChange: (value: string) => void
}

/** Pick a client, or create one on the spot and select it. */
export function ClientSelect({ value, onChange }: Props) {
  const { data: clients = [] } = useClients()
  const createClient = useCreateClient()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')

  const add = () => {
    if (!name.trim()) return
    createClient.mutate(
      { name: name.trim(), address: '', notes: '' },
      {
        onSuccess: (client) => {
          onChange(String(client.id))
          setAdding(false)
          setName('')
        },
      },
    )
  }

  if (adding) {
    return (
      <span className="inline-add">
        <input
          autoFocus
          aria-label="New client name"
          placeholder="New client name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault() // don't submit the surrounding form
              add()
            }
            if (e.key === 'Escape') setAdding(false)
          }}
        />
        <button type="button" onClick={add} disabled={!name.trim() || createClient.isPending}>
          Add
        </button>
        <button type="button" onClick={() => setAdding(false)}>
          Cancel
        </button>
        {createClient.error && <span className="error">{createClient.error.message}</span>}
      </span>
    )
  }

  return (
    <select
      aria-label="Client"
      value={value}
      onChange={(e) => (e.target.value === NEW ? setAdding(true) : onChange(e.target.value))}
    >
      <option value="">No client</option>
      {clients.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
      <option value={NEW}>+ New client…</option>
    </select>
  )
}

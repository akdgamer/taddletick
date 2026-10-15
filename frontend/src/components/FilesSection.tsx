import { useRef } from 'react'

import { api } from '../api/client'
import { useDeleteFile, useUploadFile } from '../api/hooks'
import type { ProjectFile } from '../api/types'
import { formatSize } from '../format'

interface Props {
  projectId: number
  files: ProjectFile[]
  canUpload: boolean
  canDelete: boolean
}

export function FilesSection({ projectId, files, canUpload, canDelete }: Props) {
  const uploadFile = useUploadFile()
  const deleteFile = useDeleteFile()
  const input = useRef<HTMLInputElement>(null)
  const error = uploadFile.error ?? deleteFile.error

  const upload = async (list: FileList | null) => {
    for (const file of Array.from(list ?? [])) {
      await uploadFile.mutateAsync({ projectId, file }).catch(() => {}) // error shown below
    }
    if (input.current) input.current.value = ''
  }

  return (
    <details className="tile-section">
      <summary>
        Files
        {files.length > 0 && <span className="section-summary">{files.length}</span>}
      </summary>
      {files.length > 0 && (
        <ul className="file-list">
          {files.map((f) => (
            <li key={f.id}>
              <a href={api.fileUrl(f.id)} target="_blank" rel="noreferrer">
                {f.filename}
              </a>
              <span className="muted">{formatSize(f.size)}</span>
              {canDelete && (
                <button
                  className="icon-button"
                  aria-label={`Delete ${f.filename}`}
                  onClick={() => deleteFile.mutate(f.id)}
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {files.length === 0 && !canUpload && <p className="muted">No files.</p>}
      {canUpload && (
        <label className="upload">
          <input ref={input} type="file" multiple onChange={(e) => upload(e.target.files)} />
          {uploadFile.isPending ? 'Uploading…' : '+ Upload files'}
        </label>
      )}
      {error && <p className="error">{error.message}</p>}
    </details>
  )
}

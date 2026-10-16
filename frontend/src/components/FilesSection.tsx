import { useRef, useState } from 'react'

import { api } from '../api/client'
import { useDeleteFile, useUploadFile } from '../api/hooks'
import type { ProjectFile } from '../api/types'
import { formatSize } from '../format'
import { badgeOf, hasThumbnail } from '../fileKinds'
import { FileViewer } from './FileViewer'
import { FileIcon, IconButton, TrashIcon } from './Icons'

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
  const [viewing, setViewing] = useState<number | null>(null)
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
        <ul className="file-grid">
          {files.map((f, i) => (
            <li key={f.id} className="file-card">
              <button className="file-open" onClick={() => setViewing(i)} aria-label={`Open ${f.filename}`}>
                <FileThumb file={f} />
                <span className="file-name" title={f.filename}>
                  {f.filename}
                </span>
                <span className="file-size">{formatSize(f.size)}</span>
              </button>
              {canDelete && (
                <IconButton
                  label={`Delete ${f.filename}`}
                  tone="danger"
                  icon={<TrashIcon />}
                  onClick={() => deleteFile.mutate(f.id)}
                />
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
      {viewing !== null && files[viewing] && (
        <FileViewer files={files} index={viewing} onIndex={setViewing} onClose={() => setViewing(null)} />
      )}
    </details>
  )
}

/** A photo's thumbnail, or a coloured label saying what kind of file it is */
function FileThumb({ file }: { file: ProjectFile }) {
  const [failed, setFailed] = useState(false)
  if (hasThumbnail(file) && !failed) {
    return (
      <span className="file-thumb">
        <img src={api.fileThumbnailUrl(file.id)} alt="" loading="lazy" onError={() => setFailed(true)} />
      </span>
    )
  }
  const badge = badgeOf(file)
  return (
    <span className={`file-thumb file-badge tone-${badge.tone}`}>
      <FileIcon />
      <span>{badge.label}</span>
    </span>
  )
}

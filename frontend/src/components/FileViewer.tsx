import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

import { api } from '../api/client'
import type { ProjectFile } from '../api/types'
import { previewOf } from '../fileKinds'
import { formatSize } from '../format'
import { ChevronIcon } from './Menu'
import { XIcon } from './Icons'

interface Props {
  files: ProjectFile[]
  index: number
  onIndex: (i: number) => void
  onClose: () => void
}

/** Full-screen preview of a project's files: ← → to step through, Esc to close. */
export function FileViewer({ files, index, onIndex, onClose }: Props) {
  const file = files[index]
  const many = files.length > 1
  const go = (step: number) => onIndex((index + step + files.length) % files.length)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (many && e.key === 'ArrowRight') go(1)
      if (many && e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    // The page behind shouldn't scroll while the viewer is open
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  })

  // Rendered at the end of <body>: a tile's <details> mustn't clip or style it
  return createPortal(
    <div className="viewer" role="dialog" aria-modal="true" aria-label={file.filename}>
      <header className="viewer-bar">
        <div className="viewer-title">
          <strong title={file.filename}>{file.filename}</strong>
          <span>
            {formatSize(file.size)}
            {many && ` · ${index + 1} of ${files.length}`}
          </span>
        </div>
        <div className="viewer-actions">
          <a className="button" href={api.fileUrl(file.id)} target="_blank" rel="noreferrer">
            Open
          </a>
          <a className="button primary" href={api.fileDownloadUrl(file.id)}>
            Download
          </a>
          <button className="viewer-close" aria-label="Close" onClick={onClose}>
            <XIcon />
          </button>
        </div>
      </header>

      <div className="viewer-stage" onClick={(e) => e.target === e.currentTarget && onClose()}>
        {many && (
          <button className="viewer-nav prev" aria-label="Previous file" onClick={() => go(-1)}>
            <span className="flip">
              <ChevronIcon open={false} />
            </span>
          </button>
        )}
        <Preview key={file.id} file={file} />
        {many && (
          <button className="viewer-nav next" aria-label="Next file" onClick={() => go(1)}>
            <ChevronIcon open={false} />
          </button>
        )}
      </div>
    </div>,
    document.body,
  )
}

function Preview({ file }: { file: ProjectFile }) {
  const url = api.fileUrl(file.id)
  switch (previewOf(file)) {
    case 'image':
      return <img className="viewer-image" src={url} alt={file.filename} />
    case 'pdf':
      return <iframe className="viewer-frame" src={url} title={file.filename} />
    case 'video':
      return <video className="viewer-media" src={url} controls autoPlay />
    case 'audio':
      return <audio src={url} controls autoPlay />
    case 'text':
      return <TextPreview url={url} />
    default:
      return (
        <div className="viewer-none">
          <p>This kind of file can't be previewed here.</p>
          <a className="button primary" href={api.fileDownloadUrl(file.id)}>
            Download {file.filename}
          </a>
        </div>
      )
  }
}

const TEXT_LIMIT = 200_000 // characters; enough for any notes or CSV worth reading on screen

function TextPreview({ url }: { url: string }) {
  const [text, setText] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let live = true
    fetch(url, { credentials: 'include' })
      .then((r) => (r.ok ? r.text() : Promise.reject(r)))
      .then((t) => live && setText(t.length > TEXT_LIMIT ? `${t.slice(0, TEXT_LIMIT)}\n\n… (shortened; download for the rest)` : t))
      .catch(() => live && setFailed(true))
    return () => {
      live = false
    }
  }, [url])
  if (failed) return <p className="viewer-none">Couldn't load this file.</p>
  return <pre className="viewer-text">{text ?? 'Loading…'}</pre>
}

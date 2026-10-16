import type { ProjectFile } from './api/types'

/** How a file is shown: the server decides what may open in the browser; this mirrors it for the UI. */
export type Preview = 'image' | 'pdf' | 'video' | 'audio' | 'text' | 'none'

// Must match INLINE_TYPES / THUMBNAIL_TYPES in backend/app/routers/files.py
const IMAGES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif', 'image/bmp']
const THUMBNAILS = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/bmp']

export function previewOf(f: ProjectFile): Preview {
  const type = f.content_type
  if (IMAGES.includes(type)) return 'image'
  if (type === 'application/pdf') return 'pdf'
  if (type.startsWith('video/')) return 'video'
  if (type.startsWith('audio/')) return 'audio'
  if (type === 'text/plain' || type === 'text/csv') return 'text'
  return 'none'
}

export const hasThumbnail = (f: ProjectFile) => THUMBNAILS.includes(f.content_type)

/** The coloured label on a file card: what kind of file it is at a glance */
export function badgeOf(f: ProjectFile): { label: string; tone: string } {
  const ext = f.filename.includes('.') ? f.filename.split('.').pop()!.toLowerCase() : ''
  const groups: [string[], string, string][] = [
    [['pdf'], 'PDF', 'red'],
    [['dwg', 'dxf', 'step', 'stp', 'iges', 'igs', 'stl', 'sldprt', 'sldasm', 'slddrw', 'f3d', '3mf', 'obj'], 'CAD', 'accent'],
    [['xls', 'xlsx', 'csv', 'ods', 'numbers'], 'Sheet', 'green'],
    [['doc', 'docx', 'odt', 'pages', 'rtf', 'txt', 'md'], 'Doc', 'accent'],
    [['zip', 'rar', '7z', 'tar', 'gz'], 'Zip', 'amber'],
    [['mp4', 'mov', 'webm', 'mkv', 'avi'], 'Video', 'amber'],
    [['mp3', 'wav', 'm4a', 'ogg'], 'Audio', 'amber'],
  ]
  for (const [exts, label, tone] of groups) if (exts.includes(ext)) return { label, tone }
  if (f.content_type.startsWith('image/')) return { label: 'Image', tone: 'green' }
  return { label: ext ? ext.slice(0, 4).toUpperCase() : 'File', tone: 'neutral' }
}

import type { ReactNode } from 'react'

type Tone = 'accent' | 'danger' | 'warn' | 'ok' | 'neutral'

interface Props {
  /** Shown as a tooltip on hover/focus and used as the accessible name */
  label: string
  icon: ReactNode
  tone?: Tone
  onClick: () => void
  disabled?: boolean
}

/** A row action shown as a coloured icon; the label appears as a tooltip. */
export function IconButton({ label, icon, tone = 'neutral', onClick, disabled }: Props) {
  return (
    <button
      type="button"
      className={`action-icon tone-${tone}`}
      aria-label={label}
      data-tip={label}
      onClick={onClick}
      disabled={disabled}
    >
      {icon}
    </button>
  )
}

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  )
}

export const EditIcon = () => (
  <Svg>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </Svg>
)

export const TrashIcon = () => (
  <Svg>
    <path d="M3 6h18" />
    <path d="M8 6V4h8v2" />
    <path d="M19 6l-1 14H6L5 6" />
    <path d="M10 11v6M14 11v6" />
  </Svg>
)

export const ArchiveIcon = () => (
  <Svg>
    <rect x="3" y="4" width="18" height="4" rx="1" />
    <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" />
    <path d="M10 12h4" />
  </Svg>
)

export const RestoreIcon = () => (
  <Svg>
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
    <path d="M3 3v5h5" />
  </Svg>
)

export const CheckIcon = () => (
  <Svg>
    <path d="M20 6 9 17l-5-5" />
  </Svg>
)

export const KeyIcon = () => (
  <Svg>
    <circle cx="7.5" cy="15.5" r="4.5" />
    <path d="m10.7 12.3 9.3-9.3M17 6l3 3M15 8l2 2" />
  </Svg>
)

export const UserOffIcon = () => (
  <Svg>
    <circle cx="9" cy="8" r="4" />
    <path d="M2 21v-1a6 6 0 0 1 9.5-4.9" />
    <path d="m16 16 5 5M21 16l-5 5" />
  </Svg>
)

export const UserOnIcon = () => (
  <Svg>
    <circle cx="9" cy="8" r="4" />
    <path d="M2 21v-1a6 6 0 0 1 9.5-4.9" />
    <path d="m15 19 2 2 4-4" />
  </Svg>
)

export const XIcon = () => (
  <Svg>
    <path d="M18 6 6 18M6 6l12 12" />
  </Svg>
)

import type { ReactNode } from 'react'

interface RoundButtonProps {
  onClick: () => void
  variant: 'red' | 'green'
  /** aria-label — round buttons carry icons, not visible text. */
  label: string
  children?: ReactNode
}

/** Themed circular icon button. */
export function RoundButton({ onClick, variant, label, children }: RoundButtonProps) {
  return (
    <button
      type="button"
      className={`round-btn${variant === 'green' ? ' round-btn--green' : ''}`}
      aria-label={label}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

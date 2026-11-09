import type { ReactNode } from 'react'

interface ConnectChoiceProps {
  title: string
  sub?: string
  icon?: ReactNode
  primary?: boolean
  disabled?: boolean
  onClick: () => void
}

/**
 * The one shared choice button for sign-in flows (ConnectScreen + guest
 * popover). Identical shell in every use — `primary` only swaps the wood
 * background for the orange button gradient.
 */
export function ConnectChoice({ title, sub, icon, primary = false, disabled = false, onClick }: ConnectChoiceProps) {
  return (
    <button
      type="button"
      className={`wood-panel connect-choice${primary ? ' connect-choice--primary' : ''}`}
      disabled={disabled}
      onClick={onClick}
    >
      {icon && <span className="connect-choice__icon" aria-hidden>{icon}</span>}
      <span className="connect-choice__copy">
        <span className="connect-choice__title">{title}</span>
        {sub && <span className="connect-choice__sub">{sub}</span>}
      </span>
    </button>
  )
}

interface WoodPanelProps {
  className?: string
  children?: React.ReactNode
}

/** Themed wood-grain panel — visual only, holds any children. */
export function WoodPanel({ className, children }: WoodPanelProps) {
  return <div className={`wood-panel ${className ?? ''}`}>{children}</div>
}

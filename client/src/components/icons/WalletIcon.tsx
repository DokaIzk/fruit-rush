import type { SVGProps } from 'react'

export function WalletIcon({ size = 22, ...rest }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
      {...rest}
    >
      <rect x="3.5" y="6.5" width="17" height="12" rx="2.5" />
      <path d="M16.25 12.5h.01" />
      <path d="M20.5 10.5v4" />
    </svg>
  )
}

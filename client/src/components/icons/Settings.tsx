import type { SVGProps } from 'react'

export function Settings({ size = 22, ...rest }: SVGProps<SVGSVGElement> & { size?: number }) {
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
      <circle cx="12" cy="12" r="3.25" />
      <path d="M12 2.9v2.3M12 18.8v2.3M2.9 12h2.3M18.8 12h2.3M5.35 5.35l1.63 1.63M17.02 17.02l1.63 1.63M18.65 5.35l-1.63 1.63M6.98 17.02l-1.63 1.63" />
    </svg>
  )
}

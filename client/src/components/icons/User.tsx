import type { SVGProps } from 'react'

export function User({ size = 22, ...rest }: SVGProps<SVGSVGElement> & { size?: number }) {
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
      <circle cx="12" cy="8.75" r="3.5" />
      <path d="M5.5 19.5c1.5-3.2 4-4.75 6.5-4.75s5 1.55 6.5 4.75" />
    </svg>
  )
}

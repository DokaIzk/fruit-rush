import type { SVGProps } from 'react'

export function Mail({ size = 22, ...rest }: SVGProps<SVGSVGElement> & { size?: number }) {
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
      <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
      <path d="M4.5 8l7.5 5 7.5-5" />
    </svg>
  )
}

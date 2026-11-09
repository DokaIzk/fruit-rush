import type { SVGProps } from 'react'

export function Volume({ size = 22, ...rest }: SVGProps<SVGSVGElement> & { size?: number }) {
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
      <path d="M4 9.5h3.25L12 5.25v13.5L7.25 14.5H4z" />
      <path d="M15.5 9.25a4 4 0 010 5.5M18 7a7.25 7.25 0 010 10" />
    </svg>
  )
}

import type { SVGProps } from 'react'

export function Ghost({ size = 22, ...rest }: SVGProps<SVGSVGElement> & { size?: number }) {
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
      <path d="M5.5 20v-8.5a6.5 6.5 0 0113 0V20l-2.17-1.5-2.16 1.5-2.17-1.5L9.83 20l-2.16-1.5z" />
      <path d="M10 10.75h.01M14 10.75h.01" />
    </svg>
  )
}

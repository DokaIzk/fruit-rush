import type { SVGProps } from 'react'

export function Crown({ size = 22, ...rest }: SVGProps<SVGSVGElement> & { size?: number }) {
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
      <path d="M4.5 17l-1.5-9 4.75 3L12 4.5l4.25 6.25L21 8l-1.5 9z" />
      <path d="M4.5 20h15" />
    </svg>
  )
}

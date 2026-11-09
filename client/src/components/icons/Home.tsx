import type { SVGProps } from 'react'

export function Home({ size = 22, ...rest }: SVGProps<SVGSVGElement> & { size?: number }) {
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
      <path d="M5 11 12 4l7 7" />
      <path d="M6.5 10.5V20h4.5v-5h2v5h4.5v-9.5" />
    </svg>
  )
}

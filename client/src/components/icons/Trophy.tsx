import type { SVGProps } from 'react'

export function Trophy({ size = 22, ...rest }: SVGProps<SVGSVGElement> & { size?: number }) {
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
      <path d="M8 4h8v4.5a4 4 0 01-8 0z" />
      <path d="M8 6H5.25A2.5 2.5 0 008 9.4M16 6h2.75A2.5 2.5 0 0116 9.4" />
      <path d="M12 12.5V16" />
      <path d="M9 20h6" />
      <path d="M10 20c0-2.4 4-2.4 4 0" />
    </svg>
  )
}

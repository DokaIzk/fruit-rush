import type { SVGProps } from 'react'

export function Flame({ size = 22, ...rest }: SVGProps<SVGSVGElement> & { size?: number }) {
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
      <path d="M12 3c.5 3-1 4.5-2.5 6-1.5 1.5-2.5 3-2.5 5a5.75 5.75 0 0011.5 0c0-2.5-1-4-2.5-5.5C14.5 7 12.5 5.5 12 3z" />
      <path d="M12 20a3 3 0 01-3-3c0-2 2-3 3-4.5 1 1.5 3 2.5 3 4.5a3 3 0 01-3 3z" />
    </svg>
  )
}

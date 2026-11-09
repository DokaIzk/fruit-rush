import type { SVGProps } from 'react'

export function ShoppingBag({ size = 22, ...rest }: SVGProps<SVGSVGElement> & { size?: number }) {
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
      <path d="M5.5 8.5h13l-1 11.5h-11z" />
      <path d="M9 8.5V6.75a3 3 0 016 0V8.5" />
    </svg>
  )
}

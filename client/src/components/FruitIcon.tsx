export type FruitKind = 'watermelon' | 'orange' | 'kiwi' | 'mango'

const FILL: Record<FruitKind, { outer: string; inner: string }> = {
  watermelon: { outer: '#2e8b2e', inner: '#e53b3b' },
  orange: { outer: '#2e7d1a', inner: '#ff8c1a' },
  kiwi: { outer: '#5a3b1d', inner: '#8fd13e' },
  mango: { outer: '#d9561a', inner: '#ffb733' },
}

interface FruitIconProps {
  kind: FruitKind
  size?: number
}

/** Stacked-circle fruit icon, pure inline SVG — no emoji, no images. */
export function FruitIcon({ kind, size = 48 }: FruitIconProps) {
  const { outer, inner } = FILL[kind]
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden
      focusable="false"
    >
      <circle cx="24" cy="24" r="21" fill={outer} />
      <circle cx="24" cy="24" r="15" fill={inner} />
      <circle cx="21.5" cy="21.5" r="4.5" fill="#f4efe2" />
    </svg>
  )
}

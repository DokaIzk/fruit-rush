import { useState } from 'react'
import { BottomNav } from '../components/BottomNav'
import { FruitIcon } from '../components/FruitIcon'
import { COSMETICS } from '../data/mock'
import { uiArt } from '../assets/designs'
import { ArrowLeft } from '../components/icons'
import type { CosmeticCategory, ScreenId } from '../types/game'
import type { CSSProperties } from 'react'

import '../styles/shop.css'

const woodBg = { '--screen-bg': `url(${uiArt.woodBg})` } as CSSProperties

interface ShopScreenProps {
  onBuy: (name: string) => void
  onNavigate: (screen: ScreenId) => void
}

const FILTERS: { label: string; value: CosmeticCategory | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Blades', value: 'knife' },
  { label: 'Fruit', value: 'fruit' },
  { label: 'Trails', value: 'trail' },
  { label: 'Backdrops', value: 'background' },
]

/** Pure-SVG category visual — a blade is a rotated rounded rect, everything else a fruit. */
function ItemVisual({ category }: { category: CosmeticCategory }) {
  if (category === 'knife') {
    return (
      <svg width="56" height="56" viewBox="0 0 56 56" fill="none" aria-hidden focusable="false">
        <g transform="rotate(-35 28 28)">
          <rect x="25" y="6" width="6" height="26" rx="3" fill="#d7d2c4" />
          <rect x="23" y="32" width="10" height="16" rx="4" fill="#5a3b1d" />
        </g>
      </svg>
    )
  }
  const kind = category === 'fruit' ? 'watermelon' : category === 'trail' ? 'orange' : 'mango'
  return <FruitIcon kind={kind} size={56} />
}

export function ShopScreen({ onBuy, onNavigate }: ShopScreenProps) {
  const [filter, setFilter] = useState<CosmeticCategory | 'all'>('all')
  const items = filter === 'all' ? COSMETICS : COSMETICS.filter((item) => item.category === filter)

  return (
    <main className="app-screen shop" style={woodBg}>
      <header className="app-screen__header">
        <button
          type="button"
          className="round-btn round-btn--sm"
          aria-label="Back"
          onClick={() => onNavigate('home')}
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <span className="app-screen__eyebrow">Cosmetics</span>
          <h1 className="app-screen__title">Armory</h1>
        </div>
        <span className="app-screen__chip app-screen__chip--gold" aria-label="Coin balance">0 ★</span>
      </header>

      <div className="shop-filters" role="tablist" aria-label="Shop categories">
        {FILTERS.map((option) => (
          <button
            type="button"
            role="tab"
            aria-selected={filter === option.value}
            className={`pill shop-filters__chip${filter === option.value ? '' : ' pill--ghost'}`}
            key={option.value}
            onClick={() => setFilter(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <section className="armory-grid" aria-live="polite">
        {items.map((item) => (
          <article
            className={`wood-panel armory-card rarity-${item.rarity.toLowerCase()}`}
            key={item.id}
          >
            <span className={`ribbon rarity-${item.rarity.toLowerCase()}`}>{item.rarity}</span>
            <div className="armory-card__visual">
              <ItemVisual category={item.category} />
            </div>
            <div className="armory-card__copy">
              <strong className="display">{item.name}</strong>
              <p>{item.blurb}</p>
              {item.owned ? (
                <button type="button" className="wood-panel armory-card__owned" disabled>
                  {item.equipped ? 'Equipped' : 'Owned'}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn--orange armory-card__buy"
                  onClick={() => onBuy(item.name)}
                >
                  {item.priceCusd.toFixed(2)} cUSD
                </button>
              )}
            </div>
          </article>
        ))}
      </section>

      <BottomNav active="shop" onNavigate={onNavigate} />
    </main>
  )
}

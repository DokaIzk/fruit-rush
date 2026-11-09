import { BottomNav } from '../components/BottomNav'
import { FruitIcon } from '../components/FruitIcon'
import { MOCK_PLAYER } from '../data/mock'
import { uiArt } from '../assets/designs'
import type { ScreenId } from '../types/game'
import type { CSSProperties } from 'react'

interface ProfileScreenProps {
  onPlay: () => void
  onNavigate: (screen: ScreenId) => void
}

const woodBg = { '--screen-bg': `url(${uiArt.woodBg})` } as CSSProperties

export function ProfileScreen({ onPlay, onNavigate }: ProfileScreenProps) {
  return (
    <main className="app-screen profile" style={woodBg}>
      <header className="app-screen__header">
        <div>
          <span className="app-screen__eyebrow">Player profile</span>
          <h1 className="app-screen__title">{MOCK_PLAYER.displayName}</h1>
        </div>
        <span className="app-screen__chip app-screen__chip--gold">2322 ★</span>
      </header>

      <section className="tiles tiles--2" aria-label="Progress">
        <div className="wood-panel tile">
          <span>Level 12</span>
          <div className="xpbar"><i style={{ width: '68%' }} /></div>
          <small>680 / 1,000 XP</small>
        </div>
        <div className="wood-panel tile">
          <span>Personal best</span>
          <strong>{MOCK_PLAYER.personalBest.toLocaleString()}</strong>
        </div>
      </section>

      <section className="tiles tiles--3" aria-label="Career statistics">
        <div className="wood-panel tile">
          <strong>42</strong>
          <span>Runs</span>
        </div>
        <div className="wood-panel tile">
          <strong>68%</strong>
          <span>Accuracy</span>
        </div>
        <div className="wood-panel tile">
          <strong>x18</strong>
          <span>Best combo</span>
        </div>
      </section>

      <section className="profile-loadout" aria-label="Loadout">
        <div className="section-heading">
          <h2>Loadout</h2>
          <button type="button" onClick={() => onNavigate('shop')}>Edit</button>
        </div>
        <article className="wood-panel loadout-row">
          <span className="profile-blade" aria-hidden />
          <div>
            <small>Blade</small>
            <strong>Reed Blade</strong>
          </div>
        </article>
        <article className="wood-panel loadout-row">
          <FruitIcon kind="orange" size={40} />
          <div>
            <small>Fruit</small>
            <strong>Classic Grove</strong>
          </div>
        </article>
      </section>

      <button type="button" className="btn btn--orange" onClick={onPlay}>Jump back in</button>
      <BottomNav active="profile" onNavigate={onNavigate} />
    </main>
  )
}

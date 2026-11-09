import { audio } from '../audio'
import { uiArt } from '../assets/designs'
import { ArrowLeft } from '../components/icons'
import type { GameMode } from '../types/game'

interface ModesScreenProps {
  guest?: boolean
  onBack: () => void
  onSelect: (mode: GameMode) => void
}

const MODES: { mode: GameMode; title: string; rule: string }[] = [
  { mode: 'Classic', title: 'Classic', rule: 'Endless · 3 lives · Bombs' },
  { mode: 'Zen', title: 'Zen', rule: '90 seconds · No bombs' },
  { mode: 'Arcade', title: 'Arcade', rule: '2 minutes · Frenzy' },
]

export function ModesScreen({ guest = false, onBack, onSelect }: ModesScreenProps) {
  const pick = (mode: GameMode) => {
    void audio.unlock().then(() => audio.enterGameplay())
    onSelect(mode)
  }

  return (
    <main className="modes-screen" style={{ backgroundImage: `url(${uiArt.woodBg})` }}>
      <header className="app-screen__header">
        <button
          type="button"
          className="round-btn round-btn--sm"
          aria-label="Back"
          onClick={() => {
            void audio.unlock().then(() => audio.playUi('close'))
            onBack()
          }}
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <span className="app-screen__eyebrow">Choose a run</span>
          <h1 className="app-screen__title">Choose your cut</h1>
        </div>
      </header>

      <div className="modes-screen__list">
        {MODES.map((m) => (
          <button
            key={m.mode}
            type="button"
            className="wood-panel modes-screen__sign"
            onClick={() => pick(m.mode)}
          >
            <div>
              <h2 className="display">{m.title}</h2>
              <span className="pill">{m.rule}</span>
            </div>
          </button>
        ))}
      </div>

      {guest && (
        <p className="modes-screen__guest" role="note">
          Playing as guest. Sign in to shop, compete, and keep rewards.
        </p>
      )}
    </main>
  )
}

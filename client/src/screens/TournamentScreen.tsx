import { BottomNav } from '../components/BottomNav'
import { TOURNAMENTS } from '../data/mock'
import { uiArt } from '../assets/designs'
import { ArrowRight } from '../components/icons'
import type { ScreenId } from '../types/game'
import type { CSSProperties } from 'react'

interface TournamentScreenProps {
  onEnter: (id: string) => void
  onNavigate: (screen: ScreenId) => void
}

const woodBg = { '--screen-bg': `url(${uiArt.woodBg})` } as CSSProperties

function formatTime(seconds: number) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${hours}h ${minutes.toString().padStart(2, '0')}m`
}

export function TournamentScreen({ onEnter, onNavigate }: TournamentScreenProps) {
  return (
    <main className="app-screen tournaments" style={woodBg}>
      <header className="app-screen__header">
        <div>
          <span className="app-screen__eyebrow">Live events</span>
          <h1 className="app-screen__title">Compete</h1>
        </div>
        <span className="app-screen__chip"><i className="live-dot" aria-hidden /> Live</span>
      </header>

      <section className="wood-panel tn-feature" aria-label="Featured tournament">
        <div className="tn-feature__top">
          <span>Featured</span>
          <strong>{formatTime(TOURNAMENTS[0].endsInSeconds)} left</strong>
        </div>
        <h2 className="display">{TOURNAMENTS[0].name}</h2>
        <div className="tiles tiles--3">
          <div className="tile"><span>Prize pool</span><strong>{TOURNAMENTS[0].prizePoolCusd} cUSD</strong></div>
          <div className="tile"><span>Entry</span><strong>{TOURNAMENTS[0].entryFeeCusd} cUSD</strong></div>
          <div className="tile"><span>Players</span><strong>{TOURNAMENTS[0].entrants}</strong></div>
        </div>
        <button type="button" className="btn btn--orange" onClick={() => onEnter(TOURNAMENTS[0].id)}>
          Enter tournament
        </button>
      </section>

      <section className="tournament-list" aria-label="Other tournaments">
        <div className="section-heading"><h2>Upcoming</h2><span>Prize pools</span></div>
        {TOURNAMENTS.slice(1).map((tournament) => (
          <article className="wood-panel tn-row" key={tournament.id}>
            <div>
              <strong className="display">{tournament.name}</strong>
              <span>{tournament.entrants} players · {formatTime(tournament.endsInSeconds)}</span>
            </div>
            <div className="tn-row__pool">
              <strong>{tournament.prizePoolCusd}</strong>
              <span>cUSD</span>
            </div>
            <button
              type="button"
              className="round-btn round-btn--sm"
              aria-label={`Enter ${tournament.name}`}
              onClick={() => onEnter(tournament.id)}
            >
              <ArrowRight size={20} />
            </button>
          </article>
        ))}
      </section>

      <BottomNav active="tournaments" onNavigate={onNavigate} />
    </main>
  )
}

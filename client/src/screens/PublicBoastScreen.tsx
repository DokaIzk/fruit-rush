import { useEffect, useState, type CSSProperties } from 'react'
import { fetchPublicBoast, type PublicBoast } from '../api'
import { uiArt } from '../assets/designs'
import '../styles/boast.css'

/**
 * Public share page for a minted boast — /boast/:id.
 * No wallet, no onboarding: anyone opening a shared link lands here and sees
 * score, mode, date, and the Celoscan transaction. Missing/unreachable
 * records degrade to "Boast not found".
 */
export function PublicBoastScreen({ boastId }: { boastId: string }) {
  const [boast, setBoast] = useState<PublicBoast | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void fetchPublicBoast(boastId).then((record) => {
      if (cancelled) return
      setBoast(record)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [boastId])

  // Production boasts mint on Celo mainnet; dev boasts land on Alfajores.
  const celoscanBase = import.meta.env.PROD ? 'https://celoscan.io' : 'https://alfajores.celoscan.io'
  const celoscanTx = boast ? `${celoscanBase}/tx/${boast.transactionHash}` : ''

  return (
    <main className="app-screen public-boast" style={{ '--screen-bg': `url(${uiArt.woodBg})` } as CSSProperties}>
      <header className="app-screen__header">
        <div>
          <span className="app-screen__eyebrow">On-chain record</span>
          <h1 className="app-screen__title">Fruit Rush boast</h1>
        </div>
      </header>

      {loading ? (
        <section className="wood-panel public-boast__card" aria-busy="true">
          <p className="public-boast__hint">Loading boast…</p>
        </section>
      ) : boast ? (
        <section className="wood-panel public-boast__card" aria-live="polite">
          <img className="public-boast__logo" src={uiArt.logo} alt="Fruit Rush" />
          <strong className="display public-boast__score">{boast.score.toLocaleString()}</strong>
          <span className="public-boast__meta">
            {boast.gameMode} · {new Date(boast.timestamp * 1000).toLocaleDateString()}
          </span>
          <a className="btn public-boast__tx" href={celoscanTx} target="_blank" rel="noreferrer">
            View on Celoscan
          </a>
        </section>
      ) : (
        <section className="wood-panel public-boast__card" role="alert">
          <img className="public-boast__logo" src={uiArt.logo} alt="Fruit Rush" />
          <strong className="display public-boast__score">Boast not found</strong>
          <span className="public-boast__meta">No on-chain record for boast #{boastId}</span>
        </section>
      )}

      <p className="public-boast__hint public-boast__foot">
        Attested on the FruitRushBoast contract · Celo
      </p>
    </main>
  )
}

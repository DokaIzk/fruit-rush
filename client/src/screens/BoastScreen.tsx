import { uiArt } from '../assets/designs'
import { Close } from '../components/icons'
import type { CSSProperties } from 'react'
import '../styles/boast.css'

export type MintStep = 'idle' | 'signing' | 'approving' | 'minting'

interface BoastScreenProps {
  onMint: () => void
  onShare: () => void
  onDismiss: () => void
  /** On-chain boast ID once minted (null until the BoastMinted receipt lands). */
  mintedId?: number | null
  /** Verified score of the run being boasted. */
  score?: number | null
  mintStep?: MintStep
  /** Contract fee formatted in cUSD, e.g. "0.99" (null when unreadable). */
  feeCusd?: string | null
  /** Mint transaction Celoscan URL — "View tx" link. */
  txUrl?: string | null
}

const STEP_LABELS: Record<MintStep, string> = {
  idle: 'Mint boast',
  signing: 'Signing run…',
  approving: 'Approving cUSD…',
  minting: 'Minting boast…',
}

export function BoastScreen({
  onMint,
  onShare,
  onDismiss,
  mintedId = null,
  score = null,
  mintStep = 'idle',
  feeCusd = null,
  txUrl = null,
}: BoastScreenProps) {
  const minting = mintStep !== 'idle'
  const hasMinted = mintedId != null

  return (
    <main className="app-screen boast" style={{ '--screen-bg': `url(${uiArt.woodBg})` } as CSSProperties}>
      <header className="app-screen__header">
        <button type="button" className="round-btn" onClick={onDismiss} aria-label="Close">
          <Close size={20} />
        </button>
        <div style={{ flex: 1 }}>
          <span className="app-screen__eyebrow">On-chain record</span>
          <h1 className="app-screen__title">Boast</h1>
        </div>
      </header>

      <section className="wood-panel boast__card">
        <img className="boast__logo" src={uiArt.logo} alt="Fruit Rush" />
        <p className="boast__hint">Fruit Rush score</p>
        <strong className="display boast__score">
          {score != null ? score.toLocaleString() : 'New high score'}
        </strong>
        {hasMinted ? (
          <a
            className="boast__verified"
            href={txUrl ?? undefined}
            target={txUrl ? '_blank' : undefined}
            rel={txUrl ? 'noreferrer' : undefined}
            onClick={(e) => !txUrl && e.preventDefault()}
          >
            {txUrl ? `Boast #${mintedId} · View tx` : `Minted · Boast #${mintedId}`}
          </a>
        ) : (
          <span className="boast__verified">Verified run</span>
        )}
      </section>

      <section className="boast__actions">
        {!hasMinted && (
          <button type="button" className="btn btn--orange" disabled={minting} onClick={onMint}>
            {STEP_LABELS[mintStep]}
          </button>
        )}
        {!hasMinted && feeCusd && (
          <p className="boast__fee">Fee {feeCusd} cUSD + gas in CELO · saved forever on Celo</p>
        )}
        {hasMinted ? (
          <button type="button" className="btn btn--orange" onClick={onShare}>
            Share boast
          </button>
        ) : (
          <button type="button" className="btn boast__share--locked" disabled>
            Mint to share
          </button>
        )}
      </section>
    </main>
  )
}

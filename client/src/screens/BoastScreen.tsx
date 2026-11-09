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
    <main className="built-screen boast-screen">
      <header className="built-screen__header">
        <button type="button" className="icon-button" onClick={onDismiss} aria-label="Close">×</button>
        <div>
          <p className="eyebrow">On-chain record</p>
          <h1>Boast</h1>
        </div>
      </header>

      <section className="boast-card">
        <div className="boast-card__mark" aria-hidden>FR</div>
        <p>Fruit Rush score</p>
        <strong>{score != null ? score.toLocaleString() : 'New high score'}</strong>
        {hasMinted ? (
          <a
            className="boast-card__verified boast-card__link"
            href={txUrl ?? undefined}
            target={txUrl ? '_blank' : undefined}
            rel={txUrl ? 'noreferrer' : undefined}
          >
            {txUrl ? `Boast #${mintedId} · View tx` : `Minted · Boast #${mintedId}`}
          </a>
        ) : (
          <span className="boast-card__verified">Verified run</span>
        )}
      </section>

      <section className="boast-actions">
        <button
          type="button"
          className="btn-primary"
          disabled={minting}
          onClick={hasMinted ? onShare : onMint}
        >
          {hasMinted ? 'Share boast' : STEP_LABELS[mintStep]}
        </button>
        {!hasMinted && feeCusd && (
          <p className="boast-actions__fee">Fee {feeCusd} cUSD + gas in CELO · saved forever on Celo</p>
        )}
        <button type="button" className="btn-secondary" onClick={onShare}>Share card</button>
        <button type="button" className="btn-ghost" onClick={onDismiss}>{hasMinted ? 'Done' : 'Not now'}</button>
      </section>
    </main>
  )
}

import { useEffect, useState } from 'react'
import { ConnectChoice } from '../components/ConnectChoice'
import { Mail, WalletIcon, Ghost } from '../components/icons'
import { ArrowLeft } from '../components/icons'
import { audio } from '../audio'
import { uiArt } from '../assets/designs'
import { EmailAuthForm } from '../components/EmailAuthForm'
import { WalletOptions } from '../components/WalletOptions'
import type { WalletState } from '../state/useWallet'
import type { CSSProperties } from 'react'

interface ConnectScreenProps {
  wallet: WalletState
  onDone: () => void
  onGuest: () => void
}

type ConnectPanel = 'choices' | 'email' | 'wallet'

const woodBg = { '--screen-bg': `url(${uiArt.woodBg})` } as CSSProperties

/**
 * First commit screen — three clear paths.
 * Wallet list stays collapsed until “Connect wallet” is tapped.
 */
export function ConnectScreen({ wallet, onDone, onGuest }: ConnectScreenProps) {
  const [panel, setPanel] = useState<ConnectPanel>('choices')

  useEffect(() => {
    if (wallet.status === 'connected') onDone()
  }, [wallet.status, onDone])

  const miniPay = wallet.inMiniPay
  const busy = wallet.status === 'connecting'

  return (
    <section className="app-screen connect" style={woodBg}>
      <img className="connect__logo" src={uiArt.logo} alt="Fruit Rush" draggable={false} />

      <header className="app-screen__header connect__header">
        {panel !== 'choices' && (
          <button
            type="button"
            className="round-btn round-btn--sm"
            aria-label="Back"
            onClick={() => setPanel('choices')}
          >
            <ArrowLeft size={20} />
          </button>
        )}
        <h1 className="app-screen__title">
          {miniPay ? 'Almost ready' : 'Welcome to Fruit Rush'}
        </h1>
      </header>
      <p className="connect__hint">
        {miniPay
          ? wallet.status === 'connecting' || wallet.status === 'disconnected'
            ? 'Linking your MiniPay so shop, tournaments, and boasts stay with you…'
            : 'You’re in — let’s rush.'
          : 'Play first. Sign in when you’re ready to save progress.'}
      </p>

      {miniPay ? (
        <p className="wallet-options__status" aria-live="polite">
          {wallet.status === 'connected'
            ? 'Connected'
            : wallet.error
              ? wallet.error
              : 'Opening MiniPay…'}
        </p>
      ) : panel === 'email' ? (
        <div className="connect-panel">
          <EmailAuthForm wallet={wallet} />
        </div>
      ) : panel === 'wallet' ? (
        <div className="connect-panel">
          <p className="connect-screen__section">Choose a wallet</p>
          <WalletOptions wallet={wallet} />
        </div>
      ) : (
        <div className="connect-opts">
          <ConnectChoice
            primary
            disabled={busy}
            icon={<Mail />}
            title="Continue with email"
            sub="Create a secure wallet automatically"
            onClick={() => {
              void audio.unlock().then(() => audio.playUi('pop'))
              setPanel('email')
            }}
          />
          <ConnectChoice
            disabled={busy}
            icon={<WalletIcon />}
            title="Connect wallet"
            sub="MetaMask and other browsers"
            onClick={() => {
              void audio.unlock().then(() => audio.playUi('pop'))
              setPanel('wallet')
            }}
          />
          <ConnectChoice
            disabled={busy}
            icon={<Ghost />}
            title="Play as guest"
            sub="Progress won’t be saved"
            onClick={() => {
              void audio.unlock().then(() => audio.playUi('pop'))
              onGuest()
            }}
          />
        </div>
      )}

      {!miniPay && panel === 'choices' && (
        <p className="connect__fine">
          Guests can play Classic, Zen and Arcade. On Celo, MiniPay connects automatically when
          you open Fruit Rush inside the app. Shop and tournaments need a linked account.
        </p>
      )}
    </section>
  )
}

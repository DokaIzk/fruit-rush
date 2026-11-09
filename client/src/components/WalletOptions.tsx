import { hasWalletConnectProjectId, openWalletConnectModal } from '../wallet/config'
import type { WalletState } from '../state/useWallet'

interface WalletOptionsProps {
  wallet: WalletState
}

/**
 * Account picker for browsers outside MiniPay.
 * MiniPay never appears here — it only injects inside the MiniPay app and auto-connects.
 */
export function WalletOptions({ wallet }: WalletOptionsProps) {
  const { options, connect, status, pendingWallet, error, inMiniPay } = wallet

  // Coinbase / Base announce a connector even with no wallet installed —
  // those are QR / deep-link options, not an installed injected wallet.
  const hasInjectedConnector = options.some(
    (o) =>
      o.connector.type === 'injected' &&
      o.connector.id !== 'injected' &&
      !/coinbase|base/i.test(o.connector.id),
  )

  if (inMiniPay) return null

  if (options.length === 0 && !hasWalletConnectProjectId) {
    return (
      <p className="wallet-options__empty">
        No browser wallet found. For the smoothest Celo play, open Fruit Rush inside{' '}
        <strong>MiniPay</strong> — it connects automatically. Or install MetaMask / Valora.
      </p>
    )
  }

  return (
    <div className="wallet-options">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          className="wallet-option"
          disabled={status === 'connecting'}
          onClick={() => connect(option)}
        >
          {option.icon ? (
            <img className="wallet-option__icon" src={option.icon} alt="" aria-hidden />
          ) : (
            <span className="wallet-option__icon wallet-option__icon--fallback" aria-hidden>
              ◈
            </span>
          )}
          <span className="wallet-option__name">{option.name}</span>
          {status === 'connecting' && pendingWallet === option.name && (
            <span className="wallet-option__spinner" aria-hidden />
          )}
        </button>
      ))}

      {hasWalletConnectProjectId && !hasInjectedConnector && (
        <button type="button" className="wallet-option" onClick={openWalletConnectModal}>
          <span className="wallet-option__icon wallet-option__icon--fallback" aria-hidden>
            Ξ
          </span>
          <span className="wallet-option__name">WalletConnect</span>
          <span className="wallet-option__hint">QR code / deep link</span>
        </button>
      )}

      {status === 'connecting' && pendingWallet && pendingWallet !== 'Email' && (
        <p className="wallet-options__status">Approve in {pendingWallet}…</p>
      )}
      {error && status !== 'connecting' && (
        <p className="wallet-options__error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

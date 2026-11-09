import { createAppKit, type AppKit } from '@reown/appkit/react'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { createConfig, http, type Config, type CreateConfigParameters } from 'wagmi'
import { celo, celoAlfajores } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'

/**
 * WalletConnect (Reown) connector support.
 *
 * With a project id, mobile browsers get a QR / deep-link picker via the
 * Reown modal. Injected wallets (MetaMask, MiniPay, Valora) and Magic email
 * sign-in keep working exactly as before in both cases.
 *
 * Get a free project id at https://cloud.reown.com and add it as
 * VITE_WALLETCONNECT_PROJECT_ID in Vercel (Production + Preview).
 */
const walletConnectProjectId = (
  import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string | undefined
)?.trim()

/** True when a Reown project id is configured and WalletConnect is usable. */
export const hasWalletConnectProjectId = Boolean(walletConnectProjectId)

const networks: [typeof celo, typeof celoAlfajores] = [celo, celoAlfajores]

const transports: CreateConfigParameters['transports'] = {
  [celo.id]: http(),
  [celoAlfajores.id]: http(),
}

/** Reown modal — only created alongside the adapter, below. */
let appKit: AppKit | null = null

/**
 * App-wide wagmi config. With a project id this is the AppKit adapter's
 * config (injected connectors stay wallet-first; the adapter appends its
 * WalletConnect connector last). Without one it is an injected-only config,
 * matching the previous behaviour exactly.
 */
export const wagmiConfig: Config = (() => {
  if (walletConnectProjectId) {
    // AppKit adapter owns the single wagmi config the app consumes, so
    // injected wallets and modal-driven connections share one source of truth.
    const wagmiAdapter = new WagmiAdapter({
      projectId: walletConnectProjectId,
      networks,
      transports,
    })

    appKit = createAppKit({
      adapters: [wagmiAdapter],
      networks,
      projectId: walletConnectProjectId,
      metadata: {
        name: 'Fruit Rush',
        description: 'Slash fruit, stack combos, win rewards.',
        url:
          typeof window !== 'undefined' ? window.location.origin : 'https://www.fruit-rush.xyz',
        icons:
          typeof window !== 'undefined' ? [`${window.location.origin}/favicon.svg`] : [],
      },
      // Magic owns email / social sign-in in Fruit Rush — the modal is
      // wallet-only so the two paths never compete.
      features: { analytics: false, email: false, socials: false },
    })

    return wagmiAdapter.wagmiConfig
  }

  // Single warning — QR / deep-link connections are disabled.
  console.warn(
    '[wallet] VITE_WALLETCONNECT_PROJECT_ID is not set — WalletConnect is disabled. ' +
      'Injected wallets and Magic email sign-in are unaffected.',
  )

  return createConfig({
    chains: networks,
    connectors: [injected()],
    transports,
  })
})()

export function openWalletConnectModal(): void {
  if (!appKit) return
  appKit.open()
}

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig
  }
}

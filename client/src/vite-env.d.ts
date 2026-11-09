/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MAGIC_PUBLISHABLE_KEY?: string
  readonly VITE_MAGIC_PUBLIC_KEY?: string
  readonly VITE_WALLETCONNECT_PROJECT_ID?: string
  readonly VITE_CELO_RPC_URL?: string
  readonly VITE_CELO_TESTNET_RPC_URL?: string
  /** FruitRushBoast override (Celo mainnet). Defaults to the deployed address. */
  readonly VITE_BOAST_ADDRESS?: string
  /** FruitRushBoast on Alfajores — mainnet default does not apply on testnet. */
  readonly VITE_BOAST_ALFAJORES_ADDRESS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

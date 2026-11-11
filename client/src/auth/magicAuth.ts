/**
 * Magic.link embedded wallet for Fruit Rush (Celo).
 *
 * Pin: `magic-sdk@^33` + `@magic-ext/oauth2` for social.
 * Keys stay in Magic’s non-custodial KMS — never extract or log private keys.
 *
 * Gas note: Magic does not natively pay gas in cUSD (fee abstraction).
 * Native CELO (or a separate paymaster) is still required for transfers.
 * // TODO: integrate paymaster
 *
 * Alternatives worth a spike for gas sponsorship: Privy, Dynamic, Openfort.
 */

import { OAuthExtension } from '@magic-ext/oauth2'
import { Magic } from 'magic-sdk'
import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  parseUnits,
  type EIP1193Provider,
  type TransactionReceipt,
} from 'viem'
import { celo, celoAlfajores } from 'viem/chains'
import {
  CELO_ALFAJORES_CHAIN_ID,
  CELO_MAINNET_CHAIN_ID,
  CUSD_ALFAJORES,
  CUSD_MAINNET,
  DEFAULT_CELO_RPC,
  DEFAULT_CELO_TESTNET_RPC,
} from './constants'

export type SocialProvider = 'google' | 'apple' | 'twitter'

export interface WalletSession {
  address: `0x${string}`
  /** Magic DID token — send as `Authorization: Bearer` to the game backend. */
  token: string
  provider: EIP1193Provider
  email?: string | null
}

type MagicWithOAuth = Magic<{ oauth2: OAuthExtension }>

let magicSingleton: MagicWithOAuth | null = null

const ERC20_TRANSFER_ABI = [
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

function magicPublishableKey(): string | undefined {
  return (
    import.meta.env.VITE_MAGIC_PUBLISHABLE_KEY?.trim() ||
    import.meta.env.VITE_MAGIC_PUBLIC_KEY?.trim()
  ) || undefined
}

/** True when either the canonical publishable-key variable or its legacy alias is set. */
export function isMagicConfigured(): boolean {
  return Boolean(magicPublishableKey())
}

/**
 * Production (`import.meta.env.PROD`) → Celo mainnet.
 * Dev / preview → Alfajores (matches wagmi config).
 */
export function getMagicNetwork() {
  const useMainnet = import.meta.env.PROD
  const rpcUrl = useMainnet
    ? (import.meta.env.VITE_CELO_RPC_URL?.trim() || DEFAULT_CELO_RPC)
    : (import.meta.env.VITE_CELO_TESTNET_RPC_URL?.trim() || DEFAULT_CELO_TESTNET_RPC)
  const chainId = useMainnet ? CELO_MAINNET_CHAIN_ID : CELO_ALFAJORES_CHAIN_ID
  return { rpcUrl, chainId, useMainnet }
}

function requirePublishableKey(): string {
  const key = magicPublishableKey()
  if (!key) {
    throw new Error('Missing Magic publishable key — set VITE_MAGIC_PUBLISHABLE_KEY in client/.env or Vercel')
  }
  return key
}

/** Lazy Magic singleton pointed at Celo. */
export function getMagic(): MagicWithOAuth {
  if (magicSingleton) return magicSingleton

  const { rpcUrl, chainId } = getMagicNetwork()
  magicSingleton = new Magic(requirePublishableKey(), {
    network: { rpcUrl, chainId },
    extensions: [new OAuthExtension()],
  }) as MagicWithOAuth

  return magicSingleton
}

/** @internal — resets singleton between unit tests. */
export function __resetMagicForTests(): void {
  magicSingleton = null
}

function asAddress(value: string | null | undefined): `0x${string}` {
  if (!value || !/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new Error('Magic session has no Celo address yet')
  }
  return value as `0x${string}`
}

async function sessionFromMagic(magic: MagicWithOAuth, token: string): Promise<WalletSession> {
  const info = await magic.user.getInfo()
  const address = asAddress(info.wallets?.ethereum?.publicAddress)
  return {
    address,
    token,
    provider: magic.rpcProvider as EIP1193Provider,
    email: info.email,
  }
}

/**
 * Email OTP login. Magic shows its OTP modal (`showUI: true`) and provisions
 * an embedded Celo wallet on first success — no seed phrase.
 */
export async function loginWithEmail(email: string): Promise<WalletSession> {
  const trimmed = email.trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    throw new Error('Enter a valid email address')
  }

  const magic = getMagic()
  const token = await magic.auth.loginWithEmailOTP({ email: trimmed, showUI: true })
  if (!token) throw new Error('Email sign-in was cancelled')
  return sessionFromMagic(magic, token)
}

/**
 * Social login via OAuth popup (Google / Apple / Twitter).
 * Providers must be enabled in the Magic dashboard.
 */
export async function loginWithSocial(provider: SocialProvider): Promise<WalletSession> {
  const magic = getMagic()
  const result = await magic.oauth2.loginWithPopup({ provider })
  const address = asAddress(result.magic.userMetadata.wallets?.ethereum?.publicAddress)
  return {
    address,
    token: result.magic.idToken,
    provider: magic.rpcProvider as EIP1193Provider,
    email: result.magic.userMetadata.email ?? result.oauth.userInfo.email ?? null,
  }
}

/**
 * Decode a Magic DID token's claim segment (proof.claim.signature base64url
 * triple) and return its expiry as epoch ms, or null when unreadable.
 * Used to catch a stale cached token client-side — Magic's admin SDK rejects
 * expired tokens with a 401, so an expired token must never be sent.
 */
export function didTokenExpiryMs(token: string): number | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const claim = JSON.parse(atob(parts[1])) as { ext?: number }
    return typeof claim.ext === 'number' ? claim.ext * 1000 : null
  } catch {
    return null
  }
}

/** Current Magic DID token for authenticated backend requests. */
export async function getMagicIdToken(): Promise<string | null> {
  if (!isMagicConfigured()) return null
  // The Magic SDK iframe can hang indefinitely (HMR re-init, blocked network);
  // a wedged call must surface as "not signed in" rather than stall validation.
  const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T | null> =>
    Promise.race([
      promise,
      new Promise<null>((resolve) => globalThis.setTimeout(() => resolve(null), ms)),
    ])
  try {
    const magic = getMagic()
    const loggedIn = await withTimeout(magic.user.isLoggedIn(), 5_000)
    if (!loggedIn) return null
    const token = await withTimeout(magic.user.getIdToken(), 10_000)
    if (!token) {
      console.log('[auth] getIdToken returned nothing — treating player as signed out')
      return null
    }
    // A cached token past its `ext` claim gets a 401 from the backend. Refresh
    // with a short hard timeout (4s) so a hung refresh call can never stall a
    // downstream fetch (e.g. /session/validate) past its watchdog. On timeout
    // or failure, fall back to the cached token if still unexpired — otherwise
    // treat the player as signed out so the email sign-in prompt shows.
    const expiry = didTokenExpiryMs(token)
    if (expiry != null && expiry <= Date.now()) {
      console.log(`[auth] Magic DID token expired at ${new Date(expiry).toISOString()} — refreshing silently`)
      let fresh: string | null = null
      try {
        // Regenerates a fresh DID token from the persisted session (no OTP UI).
        fresh = await withTimeout(magic.user.generateIdToken({ lifespan: 1_800 }), 4_000)
      } catch {
        fresh = null
      }
      if (fresh) {
        console.log('[auth] silent token refresh succeeded')
        return fresh
      }
      // The cached token is expired by definition on this branch — no safe
      // fallback. Treat as signed out.
      console.log('[auth] silent token refresh timed out or failed — treating player as signed out')
      return null
    }
    return token
  } catch {
    return null
  }
}

/** Active Magic Celo address, or throws if logged out. */
export async function getWalletAddress(): Promise<string> {
  const magic = getMagic()
  const loggedIn = await magic.user.isLoggedIn()
  if (!loggedIn) throw new Error('Not signed in with Magic')
  const info = await magic.user.getInfo()
  return asAddress(info.wallets?.ethereum?.publicAddress)
}

/**
 * Magic's embedded Celo provider + address, for on-chain writes
 * (boast minting). Returns null when signed out or unconfigured.
 */
export async function getMagicBoastProvider(): Promise<{
  provider: EIP1193Provider
  address: `0x${string}`
} | null> {
  if (!isMagicConfigured()) return null
  try {
    const magic = getMagic()
    if (!(await magic.user.isLoggedIn())) return null
    const address = (await getWalletAddress()) as `0x${string}`
    return { provider: magic.rpcProvider as EIP1193Provider, address }
  } catch {
    return null
  }
}

/** Personal_sign via the Magic EIP-1193 provider (Boast attestations, etc.). */
export async function signMessage(message: string): Promise<string> {
  const magic = getMagic()
  const address = (await getWalletAddress()) as `0x${string}`
  const { useMainnet } = getMagicNetwork()
  const chain = useMainnet ? celo : celoAlfajores

  const client = createWalletClient({
    account: address,
    chain,
    transport: custom(magic.rpcProvider as EIP1193Provider),
  })

  return client.signMessage({ message })
}

/**
 * ERC-20 cUSD transfer from the Magic wallet.
 *
 * // TODO: integrate paymaster — Magic does not sponsor gas in cUSD; the
 * player still needs native CELO (or a paymaster) to cover gas.
 */
export async function sendCUSD(to: string, amountUSD: string): Promise<TransactionReceipt> {
  if (!/^0x[a-fA-F0-9]{40}$/.test(to)) throw new Error('Invalid recipient address')
  const amount = Number(amountUSD)
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Amount must be a positive USD value')

  const magic = getMagic()
  const address = (await getWalletAddress()) as `0x${string}`
  const { useMainnet, rpcUrl } = getMagicNetwork()
  const chain = useMainnet ? celo : celoAlfajores
  const cusd = useMainnet ? CUSD_MAINNET : CUSD_ALFAJORES
  const provider = magic.rpcProvider as EIP1193Provider

  const wallet = createWalletClient({
    account: address,
    chain,
    transport: custom(provider),
  })
  const publicClient = createPublicClient({
    chain,
    transport: http(rpcUrl),
  })

  // TODO: integrate paymaster — fee abstraction / gas in cUSD not available via Magic alone.
  const hash = await wallet.writeContract({
    address: cusd,
    abi: ERC20_TRANSFER_ABI,
    functionName: 'transfer',
    args: [to as `0x${string}`, parseUnits(amountUSD, 18)],
  })

  return publicClient.waitForTransactionReceipt({ hash })
}

export async function logout(): Promise<void> {
  if (!isMagicConfigured()) return
  const magic = getMagic()
  const loggedIn = await magic.user.isLoggedIn()
  if (loggedIn) await magic.user.logout()
}

/** Restore an existing Magic session after refresh (or return null). */
export async function restoreSession(): Promise<WalletSession | null> {
  if (!isMagicConfigured()) return null
  try {
    const magic = getMagic()
    const loggedIn = await magic.user.isLoggedIn()
    if (!loggedIn) return null
    const token = await magic.user.getIdToken()
    return sessionFromMagic(magic, token)
  } catch {
    return null
  }
}

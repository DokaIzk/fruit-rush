/**
 * On-chain boast minting (client-side).
 *
 * Flow for a verified run:
 *   1. Backend signs the session → POST /boast/sign (see api.ts `signBoast`)
 *   2. Player approves cUSD for the FruitRushBoast contract (skipped when the
 *      allowance already covers the fee)
 *   3. Player calls `mintBoast(player, score, gameMode, nonce, signature)` —
 *      the contract pulls the cUSD fee and records the attestation
 *
 * Gas note: wallets (Magic included) still need native CELO for gas —
 * see the paymaster TODO in auth/magicAuth.ts.
 */

import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  decodeEventLog,
  type EIP1193Provider,
} from 'viem'
import { celo, celoAlfajores } from 'viem/chains'
import {
  CUSD_ALFAJORES,
  CUSD_MAINNET,
  DEFAULT_CELO_RPC,
  DEFAULT_CELO_TESTNET_RPC,
} from '../auth/constants'

/** FruitRushBoast — Celo mainnet (non-upgradeable deployment). */
export const BOAST_MAINNET = '0xAc9C17Eed06D935C255E5E5c668C5EF07EC79181' as const

export interface BoastNetwork {
  useMainnet: boolean
  chain: typeof celo | typeof celoAlfajores
  rpcUrl: string
  boastAddress: `0x${string}`
  cusdAddress: `0x${string}`
}

/**
 * Resolve the boast network the same way auth/magicAuth does:
 * production builds → Celo mainnet, dev/preview → Alfajores.
 * Alfajores needs an explicit VITE_BOAST_ALFAJORES_ADDRESS deployment.
 */
export function resolveBoastNetwork(): BoastNetwork {
  const useMainnet = import.meta.env.PROD
  const chain = useMainnet ? celo : celoAlfajores
  const rpcUrl = useMainnet
    ? (import.meta.env.VITE_CELO_RPC_URL?.trim() || DEFAULT_CELO_RPC)
    : (import.meta.env.VITE_CELO_TESTNET_RPC_URL?.trim() || DEFAULT_CELO_TESTNET_RPC)
  const boastAddress = (
    useMainnet
      ? (import.meta.env.VITE_BOAST_ADDRESS?.trim() || BOAST_MAINNET)
      : import.meta.env.VITE_BOAST_ALFAJORES_ADDRESS?.trim()
  ) as `0x${string}` | undefined
  if (!boastAddress) {
    throw new Error('Boast isn’t live on Celo testnet yet — mint on mainnet')
  }
  return {
    useMainnet,
    chain,
    rpcUrl,
    boastAddress,
    cusdAddress: useMainnet ? CUSD_MAINNET : CUSD_ALFAJORES,
  }
}

/** Celoscan link for a boast transaction. */export function celoscanTxUrl(txHash: string): string {
  const { useMainnet } = resolveBoastNetwork()
  const base = useMainnet ? 'https://celoscan.io' : 'https://alfajores.celoscan.io'
  return `${base}/tx/${txHash}`
}

/** Minimal FruitRushBoast ABI — the pieces the client needs. */
export const BOAST_ABI = [
  {
    type: 'function',
    name: 'mintBoast',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'player', type: 'address' },
      { name: 'score', type: 'uint256' },
      { name: 'gameMode', type: 'string' },
      { name: 'nonce', type: 'uint256' },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [{ name: 'boastId', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'boastFee',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'event',
    name: 'BoastMinted',
    inputs: [
      { name: 'boastId', type: 'uint256', indexed: true },
      { name: 'player', type: 'address', indexed: true },
      { name: 'score', type: 'uint256', indexed: false },
      { name: 'gameMode', type: 'string', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
] as const

/** Minimal ERC-20 ABI — approval reads/writes against cUSD. */
export const ERC20_ABI = [
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

/** Backend response from POST /boast/sign (matches contract expectations). */
export interface BoastSignature {
  signature: string
  playerAddress: string
  score: number
  gameMode: string
  nonce: number
}

export type BoastMintStep = 'idle' | 'approving' | 'minting'

export interface MintBoastOptions {
  /** EIP-1193 wallet provider — Magic's embedded provider or a wagmi connector. */
  provider: EIP1193Provider
  /** Account executing the transactions (must hold the cUSD). */
  account: `0x${string}`
  /** Signed payload from the game backend. */
  sig: BoastSignature
  /** Callback so the UI can surface approve → mint progress. */
  onStep?: (step: BoastMintStep) => void
}

export interface MintBoastResult {
  txHash: `0x${string}`
  approveTxHash: `0x${string}` | null
  /** boastId parsed from BoastMinted (null when the log could not be decoded). */
  boastId: number | null
}

/** Current mint fee in cUSD wei, straight from the contract. */
export async function readBoastFee(): Promise<bigint> {
  const { chain, rpcUrl, boastAddress } = resolveBoastNetwork()
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) })
  return publicClient.readContract({
    address: boastAddress,
    abi: BOAST_ABI,
    functionName: 'boastFee',
  })
}

/** Read the player's cUSD balance (wei). Throws on RPC/network failure. */
export async function readCusdBalance(account: `0x${string}`): Promise<bigint> {
  const { chain, rpcUrl, cusdAddress } = resolveBoastNetwork()
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) })
  return publicClient.readContract({
    address: cusdAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [account],
  })
}

/** Format a cUSD wei value for display, e.g. 0.99e18 → "0.99". */
export function formatCusd(wei: bigint): string {
  return (Number(wei) / 1e18).toLocaleString('en-US', { maximumFractionDigits: 4 })
}

/**
 * Approve (if needed) + mint the boast attestation, waiting for each receipt.
 * Throws with friendly, player-facing messages — run through describeBoastError.
 */
export async function mintBoastOnChain(options: MintBoastOptions): Promise<MintBoastResult> {
  const { chain, rpcUrl, boastAddress, cusdAddress } = resolveBoastNetwork()
  const walletClient = createWalletClient({
    account: options.account,
    chain,
    transport: custom(options.provider),
  })
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) })

  const fee = await publicClient.readContract({
    address: boastAddress,
    abi: BOAST_ABI,
    functionName: 'boastFee',
  })

  const balance = await publicClient.readContract({
    address: cusdAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [options.account],
  })
  if (balance < fee) {
    throw new Error(`Not enough cUSD — the boast fee is ${formatCusd(fee)} cUSD`)
  }

  // Approve exactly the fee (not a blanket allowance).
  const allowance = await publicClient.readContract({
    address: cusdAddress,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [options.account, boastAddress],
  })
  let approveTxHash: `0x${string}` | null = null
  if (allowance < fee) {
    options.onStep?.('approving')
    approveTxHash = await walletClient.writeContract({
      address: cusdAddress,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [boastAddress, fee],
    })
    await publicClient.waitForTransactionReceipt({ hash: approveTxHash })
  }

  options.onStep?.('minting')
  const txHash = await walletClient.writeContract({
    address: boastAddress,
    abi: BOAST_ABI,
    functionName: 'mintBoast',
    args: [
      options.sig.playerAddress as `0x${string}`,
      BigInt(options.sig.score),
      options.sig.gameMode,
      BigInt(options.sig.nonce),
      options.sig.signature as `0x${string}`,
    ],
  })

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })
  if (receipt.status !== 'success') {
    throw new Error('The boast transaction failed on-chain')
  }

  return {
    txHash,
    approveTxHash,
    boastId: parseBoastId(receipt.logs),
  }
}

/** Extract `boastId` from a BoastMinted event log, null when not present. */
export function parseBoastId(
  logs: Array<{ data: `0x${string}`; topics: readonly `0x${string}`[] }>,
): number | null {
  for (const log of logs) {
    try {
      const decoded = decodeEventLog({
        abi: BOAST_ABI,
        data: log.data,
        // Transaction log topics — viem's stricter event-topics typing is
        // satisfied because persisted logs always start with the event signature.
        topics: log.topics as unknown as Parameters<typeof decodeEventLog>[0]['topics'],
      })
      if (decoded.eventName === 'BoastMinted') {
        return Number((decoded.args as { boastId: bigint }).boastId)
      }
    } catch {
      // Not a BoastMinted log (or unrelated topic) — keep scanning.
    }
  }
  return null
}

/** Turn contract / wallet noise into short, player-facing copy. */
export function describeBoastError(error: unknown): string {
  const raw = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
  const message = error instanceof Error ? error.message : String(error)

  if (/rejected|denied|refused|declined/i.test(raw)) return 'Request cancelled'
  if (raw.includes('NonceAlreadyUsed')) return 'That boast was already minted'
  if (raw.includes('InvalidSignature')) return 'Signature rejected by the contract'
  if (raw.includes('InsufficientFee')) return 'The boast fee changed — try minting again'
  if (/already signed|already generated|already issued/i.test(message)) {
    return 'This run’s boast was already signed — play a new run to mint another'
  }
  // Preflight message from mintBoastOnChain — already player-facing.
  if (/the boast fee is/i.test(message)) return message
  if (/transfer amount exceeds|insufficient allowance|allowance/i.test(raw)) {
    return 'cUSD allowance too low — approve the fee and try again'
  }
  if (/exceeds balance|insufficient.{0,24}balance|not enough/i.test(raw)) {
    return 'Not enough cUSD in this wallet'
  }
  if (/eth_unrecognizedChain|switch|chainId/i.test(raw)) {
    return 'Wrong network — switch your wallet to Celo'
  }
  return message.split('\n')[0].slice(0, 140) || 'Could not mint the boast'
}

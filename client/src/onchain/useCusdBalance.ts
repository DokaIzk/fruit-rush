import { useEffect, useState } from 'react'
import { readCusdBalance } from '../onchain/boast'

export interface CusdBalanceState {
  /** cUSD wei balance, or null when unknown (no wallet, RPC failure, testnet without this wallet). */
  cusdWei: bigint | null
  /** True while the balance read is in flight. */
  loading: boolean
}

/**
 * Live cUSD balance for the connected wallet (or null / never loads for
 * guests). Gold chip consumers show the value only when it resolves.
 */
export function useCusdBalance(address: string | null): CusdBalanceState {
  const [cusdWei, setCusdWei] = useState<bigint | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      setCusdWei(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    readCusdBalance(address as `0x${string}`)
      .then((wei) => {
        if (!cancelled) setCusdWei(wei)
      })
      .catch(() => {
        if (!cancelled) setCusdWei(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [address])

  return { cusdWei, loading }
}

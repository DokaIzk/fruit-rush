/** MiniPay injects window.ethereum with an `isMiniPay` flag. */
export interface MiniPayEthereum {
  isMiniPay?: boolean
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
}

/**
 * Global `window.ethereum` is typed by @reown/appkit as
 * `Record<string, unknown> | undefined` — MiniPay reads it through a
 * compatibility cast instead of re-declaring the property with a narrower type.
 */
function miniPayEthereum(): MiniPayEthereum | undefined {
  if (typeof window === 'undefined') return undefined
  return window.ethereum as MiniPayEthereum | undefined
}

/** True when Fruit Rush is opened inside the MiniPay in-app browser. */
export function isMiniPay(): boolean {
  try {
    return Boolean(miniPayEthereum()?.isMiniPay)
  } catch {
    return false
  }
}

/** True when any injected wallet provider is present (MiniPay, MetaMask, …). */
export function hasInjectedProvider(): boolean {
  try {
    return Boolean(miniPayEthereum())
  } catch {
    return false
  }
}

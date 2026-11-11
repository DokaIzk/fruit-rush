import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockLoginWithEmailOTP,
  mockLoginWithPopup,
  mockGetInfo,
  mockIsLoggedIn,
  mockLogout,
  mockGetIdToken,
  mockGenerateIdToken,
  mockWriteContract,
  mockWaitForReceipt,
  mockSignMessage,
} = vi.hoisted(() => ({
  mockLoginWithEmailOTP: vi.fn(),
  mockLoginWithPopup: vi.fn(),
  mockGetInfo: vi.fn(),
  mockIsLoggedIn: vi.fn(),
  mockLogout: vi.fn(),
  mockGetIdToken: vi.fn(),
  mockGenerateIdToken: vi.fn(),
  mockWriteContract: vi.fn(),
  mockWaitForReceipt: vi.fn(),
  mockSignMessage: vi.fn(),
}))

vi.mock('magic-sdk', () => {
  class Magic {
    auth = { loginWithEmailOTP: mockLoginWithEmailOTP }
    oauth2 = { loginWithPopup: mockLoginWithPopup }
    user = {
      getInfo: mockGetInfo,
      isLoggedIn: mockIsLoggedIn,
      logout: mockLogout,
      getIdToken: mockGetIdToken,
      generateIdToken: mockGenerateIdToken,
    }
    rpcProvider = { request: vi.fn() }
    constructor(_key: string, _opts?: unknown) {}
  }
  return { Magic }
})

vi.mock('@magic-ext/oauth2', () => ({
  OAuthExtension: class OAuthExtension {},
}))

vi.mock('viem', async () => {
  const actual = await vi.importActual<typeof import('viem')>('viem')
  return {
    ...actual,
    createWalletClient: () => ({
      signMessage: mockSignMessage,
      writeContract: mockWriteContract,
    }),
    createPublicClient: () => ({
      waitForTransactionReceipt: mockWaitForReceipt,
    }),
  }
})

import {
  __resetMagicForTests,
  didTokenExpiryMs,
  getMagicIdToken,
  getWalletAddress,
  isMagicConfigured,
  loginWithEmail,
  loginWithSocial,
  logout,
  restoreSession,
  sendCUSD,
  signMessage,
} from '../magicAuth'

/** Builds a Magic DID-shaped token whose ext claim is `epochSeconds`. */
function didTokenWithExpiry(epochSeconds: number): string {
  const seg = (bytes: Uint8Array) =>
    btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const claim = JSON.stringify({ iss: 'did:ethr:0xabc', aud: 'pk', sub: '0xabc', iat: 1, ext: epochSeconds })
  return `${seg(new TextEncoder().encode('proof'))}.${seg(new TextEncoder().encode(claim))}.${seg(new TextEncoder().encode('sig'))}`
}

describe('magicAuth token refresh hang', () => {
  beforeEach(() => {
    __resetMagicForTests()
    vi.clearAllMocks()
    vi.stubEnv('VITE_MAGIC_PUBLISHABLE_KEY', 'pk_test_fruit_rush')
    vi.stubEnv('PROD', false)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('didTokenExpiryMs reads the ext claim', () => {
    const token = didTokenWithExpiry(1_700_000_000)
    expect(didTokenExpiryMs(token)).toBe(1_700_000_000_000)
    expect(didTokenExpiryMs('garbage')).toBeNull()
  })

  it('returns null within ~4s when generateIdToken hangs forever on an expired token', async () => {
    vi.useFakeTimers()
    const expired = didTokenWithExpiry(Math.floor(Date.now() / 1000) - 60)
    mockIsLoggedIn.mockResolvedValue(true)
    mockGetIdToken.mockResolvedValue(expired)
    // Never resolves — the hang scenario.
    mockGenerateIdToken.mockReturnValue(new Promise(() => {}))

    const started = Date.now()
    const pending = getMagicIdToken()

    // Advance past the 4s refresh timeout; the watchdog-busting hang must not
    // keep the promise pending past this point.
    await vi.advanceTimersByTimeAsync(4_100)
    const result = await pending

    expect(result).toBeNull()
    expect(Date.now() - started).toBeLessThan(5_000)
    expect(mockGenerateIdToken).toHaveBeenCalledTimes(1)
  })

  it('returns the refreshed token when generateIdToken resolves quickly', async () => {
    vi.useFakeTimers()
    const expired = didTokenWithExpiry(Math.floor(Date.now() / 1000) - 60)
    mockIsLoggedIn.mockResolvedValue(true)
    mockGetIdToken.mockResolvedValue(expired)
    mockGenerateIdToken.mockResolvedValue('did:fresh')

    const pending = getMagicIdToken()
    await vi.advanceTimersByTimeAsync(100)
    await expect(pending).resolves.toBe('did:fresh')
  })

  it('passes an unexpired cached token through without refreshing', async () => {
    vi.useFakeTimers()
    const valid = didTokenWithExpiry(Math.floor(Date.now() / 1000) + 3_600)
    mockIsLoggedIn.mockResolvedValue(true)
    mockGetIdToken.mockResolvedValue(valid)

    const pending = getMagicIdToken()
    await vi.advanceTimersByTimeAsync(100)
    await expect(pending).resolves.toBe(valid)
    expect(mockGenerateIdToken).not.toHaveBeenCalled()
  })
})

describe('magicAuth', () => {
  beforeEach(() => {
    __resetMagicForTests()
    vi.clearAllMocks()
    vi.stubEnv('VITE_MAGIC_PUBLISHABLE_KEY', 'pk_test_fruit_rush')
    vi.stubEnv('PROD', false)
  })

  it('reports configured when publishable key is set', () => {
    expect(isMagicConfigured()).toBe(true)
    vi.stubEnv('VITE_MAGIC_PUBLISHABLE_KEY', '')
    vi.stubEnv('VITE_MAGIC_PUBLIC_KEY', '')
    __resetMagicForTests()
    expect(isMagicConfigured()).toBe(false)
  })

  it('supports the legacy Magic public-key variable', () => {
    vi.stubEnv('VITE_MAGIC_PUBLISHABLE_KEY', '')
    vi.stubEnv('VITE_MAGIC_PUBLIC_KEY', 'pk_test_legacy')
    expect(isMagicConfigured()).toBe(true)
  })

  it('loginWithEmail returns address, DID token, and provider', async () => {
    mockLoginWithEmailOTP.mockResolvedValue('did:token:abc')
    mockGetInfo.mockResolvedValue({
      email: 'player@fruit-rush.xyz',
      wallets: { ethereum: { publicAddress: '0x1111111111111111111111111111111111111111' } },
    })

    const session = await loginWithEmail('player@fruit-rush.xyz')

    expect(mockLoginWithEmailOTP).toHaveBeenCalledWith({
      email: 'player@fruit-rush.xyz',
      showUI: true,
    })
    expect(session.address).toBe('0x1111111111111111111111111111111111111111')
    expect(session.token).toBe('did:token:abc')
    expect(session.email).toBe('player@fruit-rush.xyz')
    expect(session.provider).toBeTruthy()
  })

  it('loginWithEmail rejects invalid email before calling Magic', async () => {
    await expect(loginWithEmail('not-an-email')).rejects.toThrow(/valid email/i)
    expect(mockLoginWithEmailOTP).not.toHaveBeenCalled()
  })

  it('loginWithSocial maps oauth popup result into a session', async () => {
    mockLoginWithPopup.mockResolvedValue({
      magic: {
        idToken: 'did:oauth',
        userMetadata: {
          email: 'g@x.com',
          wallets: { ethereum: { publicAddress: '0x2222222222222222222222222222222222222222' } },
        },
      },
      oauth: { userInfo: { email: 'g@x.com' } },
    })

    const session = await loginWithSocial('google')
    expect(session.token).toBe('did:oauth')
    expect(session.address).toBe('0x2222222222222222222222222222222222222222')
  })

  it('getWalletAddress reads ethereum wallet from Magic metadata', async () => {
    mockIsLoggedIn.mockResolvedValue(true)
    mockGetInfo.mockResolvedValue({
      wallets: { ethereum: { publicAddress: '0x3333333333333333333333333333333333333333' } },
    })
    await expect(getWalletAddress()).resolves.toBe('0x3333333333333333333333333333333333333333')
  })

  it('signMessage delegates to the Magic wallet client', async () => {
    mockIsLoggedIn.mockResolvedValue(true)
    mockGetInfo.mockResolvedValue({
      wallets: { ethereum: { publicAddress: '0x3333333333333333333333333333333333333333' } },
    })
    mockSignMessage.mockResolvedValue('0xsig')

    await expect(signMessage('boast:1')).resolves.toBe('0xsig')
    expect(mockSignMessage).toHaveBeenCalledWith({ message: 'boast:1' })
  })

  it('sendCUSD writes an ERC-20 transfer and waits for receipt', async () => {
    mockIsLoggedIn.mockResolvedValue(true)
    mockGetInfo.mockResolvedValue({
      wallets: { ethereum: { publicAddress: '0x3333333333333333333333333333333333333333' } },
    })
    mockWriteContract.mockResolvedValue('0xhash')
    mockWaitForReceipt.mockResolvedValue({ status: 'success', transactionHash: '0xhash' })

    const receipt = await sendCUSD('0x4444444444444444444444444444444444444444', '1.50')
    expect(mockWriteContract).toHaveBeenCalled()
    expect(receipt.transactionHash).toBe('0xhash')
  })

  it('logout calls Magic logout when signed in', async () => {
    mockIsLoggedIn.mockResolvedValue(true)
    mockLogout.mockResolvedValue(true)
    await logout()
    expect(mockLogout).toHaveBeenCalled()
  })

  it('restoreSession returns null when logged out', async () => {
    mockIsLoggedIn.mockResolvedValue(false)
    await expect(restoreSession()).resolves.toBeNull()
  })

  it('restoreSession hydrates a live session', async () => {
    mockIsLoggedIn.mockResolvedValue(true)
    mockGetIdToken.mockResolvedValue('did:restored')
    mockGetInfo.mockResolvedValue({
      email: 'back@fruit-rush.xyz',
      wallets: { ethereum: { publicAddress: '0x5555555555555555555555555555555555555555' } },
    })

    const session = await restoreSession()
    expect(session?.token).toBe('did:restored')
    expect(session?.address).toBe('0x5555555555555555555555555555555555555555')
  })
})

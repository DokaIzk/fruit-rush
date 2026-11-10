import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { audio } from './audio'
import { PhoneStage } from './components/PhoneStage'
import { WalletMenu } from './components/WalletMenu'
import { EmailAuthForm } from './components/EmailAuthForm'
import { Settings } from './components/icons'
import type { GameEndPayload } from './game/types'
import { LoadingScreen } from './screens/LoadingScreen'
import { useWallet } from './state/useWallet'
import { getMagicIdToken, getMagicBoastProvider } from './auth/magicAuth'
import type { EIP1193Provider } from 'viem'
import type { MintStep } from './screens/BoastScreen'
import { signBoast, validateGameSession } from './api'
import {
  celoscanTxUrl,
  describeBoastError,
  formatCusd,
  mintBoastOnChain,
  readBoastFee,
  type BoastSignature,
} from './onchain/boast'
import type { GameMode, GameSessionResult, ScreenId } from './types/game'

/** Lazy screens — keep Pixi, shop, results, etc. out of the boot JS graph. */
const ConnectScreen = lazy(() =>
  import('./screens/ConnectScreen').then((m) => ({ default: m.ConnectScreen })),
)
const HomeScreen = lazy(() =>
  import('./screens/HomeScreen').then((m) => ({ default: m.HomeScreen })),
)
const ModesScreen = lazy(() =>
  import('./screens/ModesScreen').then((m) => ({ default: m.ModesScreen })),
)
const OnboardingScreen = lazy(() =>
  import('./screens/OnboardingScreen').then((m) => ({ default: m.OnboardingScreen })),
)
const PlayScreen = lazy(() =>
  import('./screens/PlayScreen').then((m) => ({ default: m.PlayScreen })),
)
const ProfileScreen = lazy(() =>
  import('./screens/ProfileScreen').then((m) => ({ default: m.ProfileScreen })),
)
const ResultsScreen = lazy(() =>
  import('./screens/ResultsScreen').then((m) => ({ default: m.ResultsScreen })),
)
const SettingsScreen = lazy(() =>
  import('./screens/SettingsScreen').then((m) => ({ default: m.SettingsScreen })),
)
const ShopScreen = lazy(() =>
  import('./screens/ShopScreen').then((m) => ({ default: m.ShopScreen })),
)
const BoastScreen = lazy(() =>
  import('./screens/BoastScreen').then((m) => ({ default: m.BoastScreen })),
)
const TournamentScreen = lazy(() =>
  import('./screens/TournamentScreen').then((m) => ({ default: m.TournamentScreen })),
)

/** Shared public boast page — /boast/:id loads independently of the game shell. */
const PublicBoastScreen = lazy(() =>
  import('./screens/PublicBoastScreen').then((m) => ({ default: m.PublicBoastScreen })),
)

/** Matches `/boast/<id>` deep links (the in-game boast route is the bare `/boast`). */
function parsePublicBoastId(pathname: string): string | null {
  const match = /^\/boast\/([A-Za-z0-9_-]+)$/.exec(pathname)
  return match ? match[1] : null
}

function ScreenFallback() {
  return <div className="screen-fallback" aria-hidden />
}

function Lazy({ children }: { children: ReactNode }) {
  return <Suspense fallback={<ScreenFallback />}>{children}</Suspense>
}

const ONBOARDED_KEY = 'fruit-rush-onboarded'
const PB_KEY = 'fruit-rush-personal-best'
const GUEST_KEY = 'fruit-rush-guest'

function loadOnboarded(): boolean {
  try {
    return localStorage.getItem(ONBOARDED_KEY) === '1'
  } catch {
    return false
  }
}

/** Guest choice lasts one browser session — a fresh visit asks again. */
function loadGuest(): boolean {
  try {
    return sessionStorage.getItem(GUEST_KEY) === '1'
  } catch {
    return false
  }
}

function loadPersonalBest(): number {
  try {
    return Number(localStorage.getItem(PB_KEY)) || 0
  } catch {
    return 0
  }
}

const SCREEN_PATHS: Record<ScreenId, string> = {
  splash: '/',
  onboarding: '/onboarding',
  connect: '/connect',
  home: '/home',
  modes: '/modes',
  play: '/play',
  results: '/results',
  shop: '/shop',
  boast: '/boast',
  tournaments: '/tournaments',
  profile: '/profile',
  settings: '/settings',
}

function screenFromPath(pathname: string): ScreenId | null {
  const match = (Object.keys(SCREEN_PATHS) as ScreenId[]).find(
    (id) => SCREEN_PATHS[id] === pathname,
  )
  return match ?? null
}

function initialScreen(): ScreenId {
  const fromPath = screenFromPath(window.location.pathname)
  // Always boot through the asset loader first (maps to splash path).
  if (!fromPath || fromPath === 'splash') return 'splash'
  // Settings is a modal now — land on home if someone opens /settings cold.
  if (fromPath === 'settings') return 'splash'
  // These need an in-memory game result, which a fresh load never has.
  if (fromPath === 'results' || fromPath === 'boast') return 'splash'
  // Deep links still show the loader, then jump to the requested screen.
  return 'splash'
}

/** Path the user asked for before the loader ran (deep link restore). */
function pendingDeepLink(): ScreenId | null {
  const fromPath = screenFromPath(window.location.pathname)
  if (!fromPath || fromPath === 'splash') return null
  if (fromPath === 'settings') return 'home'
  if (fromPath === 'results' || fromPath === 'boast') return null
  return fromPath
}

function initialSettingsOpen(): boolean {
  return window.location.pathname === SCREEN_PATHS.settings
}

const SAVE_PROGRESS_PROMPT =
  'Sign in with Email or Connect Wallet to save your progress.'

function saveProgressToast(inMiniPay: boolean): string {
  return inMiniPay ? 'Opening MiniPay…' : SAVE_PROGRESS_PROMPT
}

export default function App() {
  const wallet = useWallet()
  const [screen, setScreen] = useState<ScreenId>(initialScreen)
  const [guest, setGuest] = useState(loadGuest)
  // Where the connect screen should land after connect / continue-as-guest.
  const [connectNext, setConnectNext] = useState<ScreenId>('home')
  const [mode, setMode] = useState<GameMode>('Classic')
  /** Bumps on every Play entry so the round always mounts with the mode just picked. */
  const [playEpoch, setPlayEpoch] = useState(0)
  const [lastResult, setLastResult] = useState<GameSessionResult | null>(null)
  const [personalBest, setPersonalBest] = useState(loadPersonalBest)
  const [mintedId, setMintedId] = useState<number | null>(null)
  const [mintStep, setMintStep] = useState<MintStep>('idle')
  const [mintTxHash, setMintTxHash] = useState<string | null>(null)
  const [boastFeeCusd, setBoastFeeCusd] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(initialSettingsOpen)
  const [deepLink] = useState(pendingDeepLink)

  /**
   * Session-validation UI state: whether the boasts screen shows the email
   * sign-in band (run finished without a Magic token) or the "Checking your
   * run…" retry band (validate has not answered for 10s).
   */
  const [validateUi, setValidateUi] = useState<'none' | 'email-prompt' | 'timed-out'>('none')
  /** Unvalidated run payload kept alive for sign-in-triggered / retried validation. */
  const pendingValidateRef = useRef<GameEndPayload | null>(null)
  /** 10s watchdog for the in-flight validate request. */
  const validateTimerRef = useRef<number | null>(null)

  /** `/boast/<id>` on a shared link — public record for that boast. */
  const publicBoastId = useMemo(
    () => parsePublicBoastId(window.location.pathname),
    [],
  )

  const showToast = useCallback((message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 2200)
  }, [])

  // Read the live boast fee whenever the boast screen is open.
  useEffect(() => {
    if (screen !== 'boast') return
    let cancelled = false
    readBoastFee()
      .then((fee) => {
        if (!cancelled) setBoastFeeCusd(formatCusd(fee))
      })
      .catch(() => {
        if (!cancelled) setBoastFeeCusd(null)
      })
    return () => {
      cancelled = true
    }
  }, [screen])

  /** `/boast/<id>` public link base, e.g. https://fruit-rush.xyz */
  const shareSite = useMemo(
    () => (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined ?? '').replace(/\/$/, ''),
    [],
  )

  /**
   * Build the text/URL pair the Share + Copy-link actions use:
   * before a mint it advertises the score with the site link, after a mint
   * it points at the public /boast/<id> record.
   */
  const buildShareContent = useCallback((score: number, mintedId: number | null | undefined) => {
    if (mintedId != null) {
      return {
        text: `I scored ${score.toLocaleString()} in Fruit Rush`,
        url: `${shareSite}/boast/${mintedId}`,
      }
    }
    return {
      text: `I scored ${score.toLocaleString()} in Fruit Rush: ${shareSite}`,
      url: shareSite,
    }
  }, [shareSite])

  /**
   * Fire the /session/validate request for a finished run.
   * A 10s watchdog flips the boast screen to "Checking your run… / Retry";
   * wallet-only players without a Magic token get the email sign-in band
   * instead, and the run waits in pendingValidateRef for a later attempt.
   */
  const validateRun = useCallback((payload: GameEndPayload) => {
    if (!payload.inputEventLog?.length) return
    const playerId = wallet.address
    if (!playerId || !/^0x[0-9a-fA-F]{40}$/.test(playerId)) {
      // No wallet address available right now — the email sign-in prompt can
      // provide one (its effect re-runs validation once the address lands).
      console.log('[validate] skipped: no Magic token')
      setValidateUi('email-prompt')
      return
    }
    void getMagicIdToken().then((token) => {
      if (!token) {
        console.log('[validate] skipped: no Magic token')
        setValidateUi('email-prompt')
        return
      }
      if (validateTimerRef.current != null) window.clearTimeout(validateTimerRef.current)
      // 10s watchdog: don't leave the player spinning silently.
      validateTimerRef.current = window.setTimeout(() => setValidateUi('timed-out'), 10_000)
      void validateGameSession(token, {
        playerId,
        score: payload.score,
        mode: payload.mode,
        comboHighwater: payload.comboHighwater,
        durationSeconds: payload.durationSeconds,
        timestamp: Date.now(),
        isPersonalBest: payload.score > personalBest && payload.score > 0,
        fruitsSliced: payload.fruitsSliced,
        fruitsMissed: payload.fruitsMissed,
        bombsHit: payload.bombsHit,
        criticalSlices: payload.criticalSlices,
        accuracy: payload.accuracy,
        inputEventLog: payload.inputEventLog,
      }).then((validation) => {
        // Validation visibility: log every call with its status and payload —
        // the session/validate request is the anti-cheat contract with the
        // backend, and silent failures made boast/leaderboard bugs opaque.
        if (validateTimerRef.current != null) {
          window.clearTimeout(validateTimerRef.current)
          validateTimerRef.current = null
        }
        setValidateUi('none')
        console.log(
          `[validate] isValid=${validation.valid}${validation.rejectionReason ? ` reason=${validation.rejectionReason}` : ''}`,
          validation,
        )
        setLastResult((current) => current ? {
          ...current,
          backendSessionId: validation.sessionId,
          backendValidation: validation.valid ? 'valid' : 'invalid',
        } : current)
        if (!validation.valid) showToast(validation.rejectionReason || 'Score could not be validated')
      }).catch((error: unknown) => {
        if (validateTimerRef.current != null) {
          window.clearTimeout(validateTimerRef.current)
          validateTimerRef.current = null
        }
        setValidateUi('none')
        setLastResult((current) => current ? { ...current, backendValidation: 'unavailable' } : current)
        const message = error instanceof Error ? error.message : 'Backend unavailable'
        console.log('[validate] request failed:', message)
        showToast(message)
      })
    })
  }, [wallet.address, personalBest, showToast])

  /**
   * When the player finishes email sign-in on the boast screen (or a Magic
   * address arrives for a wallet-only player), automatically validate the
   * run that was left pending.
   */
  useEffect(() => {
    if (validateUi !== 'email-prompt') return
    const run = pendingValidateRef.current
    if (!run) return
    // The email sign-in flow provisions a Magic address underneath; validation
    // needs both the token and an address, so wait for both to be present.
    if (!/^0x[0-9a-fA-F]{40}$/.test(wallet.address ?? '')) return
    let cancelled = false
    void (async () => {
      const token = await getMagicIdToken()
      if (cancelled) return
      if (!token) {
        console.log('[validate] skipped: no Magic token')
        return
      }
      pendingValidateRef.current = null
      setValidateUi('none')
      validateRun(run)
    })()
    return () => {
      cancelled = true
    }
  }, [validateUi, wallet.email, wallet.address, validateRun])

  /** Manual Retry from the "Checking your run…" band. */
  const retryValidation = useCallback(() => {
    const run = pendingValidateRef.current
    setValidateUi('none')
    if (!run) {
      showToast('Nothing to verify — finish a run first')
      return
    }
    validateRun(run)
  }, [showToast, validateRun])

  /** Resolve an EIP-1193 provider + sender account for on-chain writes. */
  const resolveWriteProvider = useCallback(async (): Promise<{
    provider: EIP1193Provider
    account: `0x${string}`
  } | null> => {
    if (wallet.loginMethod === 'magic') {
      const session = await getMagicBoastProvider()
      if (!session) return null
      return { provider: session.provider, account: session.address }
    }
    const { connector, address } = wallet
    if (!connector || !address) return null
    const provider = (await connector.getProvider()) as EIP1193Provider
    return { provider, account: address as `0x${string}` }
  }, [wallet])


  const { closeMenu } = wallet

  const openSettings = useCallback(() => {
    closeMenu()
    setSettingsOpen(true)
  }, [closeMenu])

  const closeSettings = useCallback(() => {
    setSettingsOpen(false)
  }, [])

  /** Navigate to a screen and keep the browser URL in sync. */
  const navigate = useCallback(
    (next: ScreenId, opts: { replace?: boolean } = {}) => {
      closeMenu()
      setSettingsOpen(false)
      // Settings is a popup, not a route destination.
      if (next === 'settings') {
        setSettingsOpen(true)
        return
      }
      const path = SCREEN_PATHS[next]
      if (window.location.pathname !== path) {
        if (opts.replace) window.history.replaceState(null, '', path)
        else window.history.pushState(null, '', path)
      }
      setScreen(next)
    },
    [closeMenu],
  )

  const go = navigate

  // Normalize the URL once on boot (e.g. unknown path, or /results without a run).
  useEffect(() => {
    window.history.replaceState(null, '', SCREEN_PATHS[screen])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Browsers require a user gesture before audio can start — unlock on first tap,
  // then start the catchy menu theme if Game Music is on.
  useEffect(() => {
    const unlock = () => {
      void audio.unlock().then(() => {
        if (audio.isMusicEnabled) audio.enterMenu()
      })
    }
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  // Route the two dance grooves by section; leave play audio alone.
  useEffect(() => {
    if (!audio.isUnlocked || !audio.isMusicEnabled) return
    if (screen === 'play') return
    // Results / boast keep the party going with the main menu groove.
    if (
      screen === 'results' ||
      screen === 'boast' ||
      screen === 'home' ||
      screen === 'modes' ||
      screen === 'connect' ||
      screen === 'profile' ||
      screen === 'onboarding' ||
      screen === 'splash'
    ) {
      void audio.unlock().then(() => {
        audio.kick()
        if (audio.currentTheme !== 'menu') audio.enterMenu()
      })
      return
    }
    // Shop & tournaments get the hotter alternate dance groove.
    if (screen === 'shop' || screen === 'tournaments') {
      void audio.unlock().then(() => {
        audio.kick()
        if (audio.currentTheme !== 'hype') audio.enterHype(600)
      })
    }
  }, [screen])

  // Wallet/email overlays steal focus — resume Web Audio when the window returns.
  useEffect(() => {
    const onFocus = () => {
      if (!audio.isMusicEnabled) return
      void audio.revive()
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  // Esc closes the settings popup.
  useEffect(() => {
    if (!settingsOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSettings()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [settingsOpen, closeSettings])

  // Browser/hardware back and forward buttons.
  useEffect(() => {
    const onPopState = () => {
      closeMenu()
      setSettingsOpen(false)
      const next = screenFromPath(window.location.pathname) ?? 'home'
      if (next === 'settings') {
        setScreen('home')
        setSettingsOpen(true)
        window.history.replaceState(null, '', SCREEN_PATHS.home)
        return
      }
      if ((next === 'results' || next === 'boast') && !lastResult) {
        window.history.replaceState(null, '', SCREEN_PATHS.home)
        setScreen('home')
        return
      }
      setScreen(next)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [closeMenu, lastResult])

  const handleSplashDone = useCallback(() => {
    if (deepLink) {
      navigate(deepLink, { replace: true })
      return
    }
    if (!loadOnboarded()) {
      navigate('onboarding', { replace: true })
    } else if (wallet.status === 'connected' || guest) {
      navigate('home', { replace: true })
    } else {
      setConnectNext('home')
      navigate('connect', { replace: true })
    }
  }, [navigate, wallet.status, guest, deepLink])

  const handleOnboardingDone = useCallback(() => {
    try {
      localStorage.setItem(ONBOARDED_KEY, '1')
    } catch {
      /* ignore */
    }
    if (wallet.status === 'connected' || guest) {
      navigate('home', { replace: true })
    } else {
      setConnectNext('home')
      navigate('connect', { replace: true })
    }
  }, [navigate, wallet.status, guest])

  const handleGameEnd = useCallback(
    (payload: GameEndPayload) => {
      const isPersonalBest = payload.score > personalBest && payload.score > 0
      if (isPersonalBest) {
        setPersonalBest(payload.score)
        try {
          localStorage.setItem(PB_KEY, String(payload.score))
        } catch {
          /* ignore */
        }
      }

      setLastResult({
        playerId: wallet.address ?? 'guest',
        score: payload.score,
        mode: payload.mode,
        comboHighwater: payload.comboHighwater,
        durationSeconds: payload.durationSeconds,
        timestamp: Date.now(),
        isPersonalBest,
        fruitsSliced: payload.fruitsSliced,
        fruitsMissed: payload.fruitsMissed,
        bombsHit: payload.bombsHit,
        criticalSlices: payload.criticalSlices,
        accuracy: payload.accuracy,
        inputEventLog: payload.inputEventLog,
      })
      setMintedId(null)
      setMintStep('idle')
      setMintTxHash(null)
      setValidateUi('none')
      pendingValidateRef.current = null
      if (validateTimerRef.current != null) {
        window.clearTimeout(validateTimerRef.current)
        validateTimerRef.current = null
      }

      // Keeps the run available for a later sign-in-triggered or retried
      // validation — wallet-only users can authenticate with email after
      // the run ended and still get their score validated.
      pendingValidateRef.current = payload
      validateRun(payload)
      // Replace /play in history so Back from results returns to modes, not a new game.
      navigate('results', { replace: true })
    },
    [navigate, personalBest, wallet.address, wallet.status, showToast, validateRun],
  )

  const showWallet =
    !settingsOpen &&
    (screen === 'home' ||
      screen === 'shop' ||
      screen === 'tournaments' ||
      screen === 'profile' ||
      screen === 'boast' ||
      (wallet.menuOpen && screen !== 'connect'))

  const showSettingsChip =
    !settingsOpen &&
    (screen === 'home' || screen === 'profile' || screen === 'shop' || screen === 'tournaments')

  // Shared boast links (/boast/:id) bypass the game shell entirely — the
  // loader, onboarding, and connect screens never run for these visitors.
  if (publicBoastId) {
    return (
      <PhoneStage>
        <Lazy>
          <PublicBoastScreen boastId={publicBoastId} />
        </Lazy>
      </PhoneStage>
    )
  }

  return (
    <PhoneStage>
      {screen === 'splash' && <LoadingScreen onDone={handleSplashDone} />}

      {screen === 'onboarding' && (
        <Lazy>
          <OnboardingScreen onDone={handleOnboardingDone} />
        </Lazy>
      )}

      {screen === 'connect' && (
        <Lazy>
          <ConnectScreen
            wallet={wallet}
            onDone={() => navigate(connectNext, { replace: true })}
            onGuest={() => {
              setGuest(true)
              try {
                sessionStorage.setItem(GUEST_KEY, '1')
              } catch {
                /* ignore */
              }
              navigate(connectNext, { replace: true })
            }}
          />
        </Lazy>
      )}

      {screen === 'home' && (
        <Lazy>
          <HomeScreen
            onPlay={() => {
              // Play gates through connect-or-guest until a choice is made.
              if (wallet.status === 'connected' || guest) {
                go('modes')
              } else {
                setConnectNext('modes')
                go('connect')
              }
            }}
            onShop={() => go('shop')}
            onCompete={() => go('tournaments')}
          />
        </Lazy>
      )}

      {screen === 'modes' && (
        <Lazy>
          <ModesScreen
            guest={guest && wallet.status !== 'connected'}
            onBack={() => go('home')}
            onSelect={(selected) => {
              // Lock mode + remount key in the same tick as navigation so the
              // round never boots with a stale mode config.
              setMode(selected)
              setPlayEpoch((n) => n + 1)
              go('play')
            }}
          />
        </Lazy>
      )}

      {screen === 'play' && (
        <Lazy>
          <PlayScreen
            key={`${mode}-${playEpoch}`}
            mode={mode}
            onExit={() => go('modes')}
            onEnded={handleGameEnd}
            onRestart={() => {
              // Reuses the existing remount key — no gameplay logic changes.
              setPlayEpoch((n) => n + 1)
              void audio.unlock().then(() => audio.enterGameplay())
              go('play')
            }}
          />
        </Lazy>
      )}

      {screen === 'results' && lastResult && (
        <Lazy>
          <ResultsScreen
            result={lastResult}
            personalBest={personalBest}
            onPlayAgain={() => {
              setPlayEpoch((n) => n + 1)
              go('play')
            }}
            onBoast={() => go('boast')}
            onHome={() => go('home')}
            onShop={() => go('shop')}
            onToast={showToast}
          />
        </Lazy>
      )}

      {screen === 'shop' && (
        <Lazy>
          <ShopScreen
            onBuy={(name) => {
              if (!wallet.requireConnect()) {
                showToast(saveProgressToast(wallet.inMiniPay))
                return
              }
              showToast(`Checkout stub · ${name}`)
            }}
            onNavigate={go}
          />
        </Lazy>
      )}

      {screen === 'tournaments' && (
        <Lazy>
          <TournamentScreen
            onEnter={(id) => {
              if (!wallet.requireConnect()) {
                showToast(saveProgressToast(wallet.inMiniPay))
                return
              }
              showToast(`Entered ${id}`)
              setMode('Tournament')
              setPlayEpoch((n) => n + 1)
              void audio.unlock().then(() => audio.enterGameplay())
              go('play')
            }}
            onNavigate={go}
          />
        </Lazy>
      )}

      {screen === 'boast' && lastResult && (
        <Lazy>
          <BoastScreen
            mintedId={mintedId}
            score={lastResult.score}
            mintStep={mintStep}
            feeCusd={boastFeeCusd}
            txUrl={mintTxHash ? celoscanTxUrl(mintTxHash) : null}
            validationState={validateUi}
            onRetryValidation={retryValidation}
            emailAuthSlot={
              <EmailAuthForm wallet={wallet} compact />
            }
            onMint={async () => {
              if (!wallet.requireConnect()) {
                showToast(saveProgressToast(wallet.inMiniPay))
                return
              }
              if (!lastResult.backendSessionId) {
                if (validateUi === 'email-prompt') {
                  showToast('Sign in with email to validate this run')
                } else {
                  showToast('Score is still being validated')
                }
                return
              }
              const token = await getMagicIdToken()
              if (!token) {
                showToast('Email sign-in is required to save a boast')
                return
              }
              setMintStep('signing')
              try {
                const sig: BoastSignature = await signBoast(token, lastResult.backendSessionId)
                const walletSession = await resolveWriteProvider()
                if (!walletSession) {
                  throw new Error('Connect a wallet with cUSD to mint the boast')
                }
                const outcome = await mintBoastOnChain({
                  provider: walletSession.provider,
                  account: walletSession.account,
                  sig,
                  onStep: (step) => setMintStep(step),
                })
                setMintTxHash(outcome.txHash)
                setMintedId(outcome.boastId ?? sig.nonce)
                showToast('Boast minted on-chain 🎉')
              } catch (error) {
                setMintStep('idle')
                showToast(describeBoastError(error))
              }
            }}
            onShare={async () => {
              // A minted boast shares its public /boast/<id> page; before the
              // mint, share the score text with the site link.
              const content = buildShareContent(lastResult.score, mintedId)
              try {
                if (navigator.share) {
                  await navigator.share({
                    title: 'Fruit Rush Boast',
                    text: content.text,
                    url: content.url,
                  })
                } else {
                  await navigator.clipboard.writeText(mintedId != null ? content.url : content.text)
                  showToast('Boast link copied')
                }
              } catch (error: unknown) {
                const message = error instanceof Error ? error.message : String(error)
                if (/cancel|abort|dismissed/i.test(message)) {
                  showToast('Share cancelled')
                } else {
                  await navigator.clipboard.writeText(mintedId != null ? content.url : content.text).catch(() => {})
                  showToast('Boast link copied')
                }
              }
            }}
            onCopyLink={async () => {
              // Copy link is always available: before the mint it copies the
              // score brag with the public site URL, after the mint the
              // per-boast page.
              const content = buildShareContent(lastResult.score, mintedId)
              try {
                await navigator.clipboard.writeText(mintedId != null ? content.url : content.text)
                showToast(mintedId != null ? 'Boast link copied' : 'Link copied')
              } catch {
                showToast('Copy failed — long-press to copy manually')
              }
            }}
            onDismiss={() => go('home')}
          />
        </Lazy>
      )}

      {screen === 'profile' && (
        <Lazy>
          <ProfileScreen onPlay={() => go('modes')} onNavigate={go} />
        </Lazy>
      )}

      {settingsOpen && (
        <Lazy>
          <SettingsScreen onClose={closeSettings} />
        </Lazy>
      )}

      {showSettingsChip && (
        <button
          type="button"
          className="round-btn settings-chip"
          aria-label="Settings"
          onClick={() => {
            void audio.unlock().then(() => audio.playUi('open'))
            openSettings()
          }}
        >
          <Settings size={20} />
        </button>
      )}

      {showWallet && (
        <div className="wallet-global">
          <WalletMenu wallet={wallet} />
        </div>
      )}

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </PhoneStage>
  )
}

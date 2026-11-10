import type { GameMode, GameSessionResult } from './types/game'

export interface SessionValidationResult {
  valid: boolean
  serverScore: number
  sessionId: string
  scoreDivergence: number
  rejectionReason?: string
}

export interface LeaderboardApiEntry {
  playerAddress: string
  score: number
  timestamp: string
  gameMode: GameMode
  comboHighwater: number
  hasBoast?: boolean
}

export interface LeaderboardApiResponse {
  gameMode: GameMode
  entries: LeaderboardApiEntry[]
  total: number
}

export interface BoastSignatureResult {
  signature: string
  playerAddress: string
  score: number
  gameMode: GameMode
  nonce: number
  signerAddress: string
}

/**
 * Thrown when a production build would ship without a usable API URL.
 * Surfaced on the loading screen by BootGate (main.tsx) — never silently.
 */
export class ApiConfigError extends Error {}

/**
 * Pure misconfiguration check — takes the raw env value + build mode so unit
 * tests stay deterministic. Returns null when the build is safe to run.
 */
export function apiBootError(rawApiUrl: string | undefined, prod: boolean): string | null {
  if (!prod) return null

  const value = rawApiUrl?.trim() ?? ''
  if (value.length === 0) {
    return 'VITE_API_URL is not set for this build — score submission, leaderboard and profile would fail.'
  }
  if (/^(https?:\/\/)?(localhost|127\.0\.0\.1)/i.test(value)) {
    return `VITE_API_URL still points to localhost (${value}) — set the production Render URL before shipping.`
  }
  return null
}

/** Startup gate — throws ApiConfigError on a misconfigured production build. */
export function assertApiBaseUrl(): void {
  const problem = apiBootError(import.meta.env.VITE_API_URL, Boolean(import.meta.env.PROD))
  if (problem) {
    throw new ApiConfigError(problem)
  }
}

function apiBaseUrl(): string {
  // Loud guard on every request: a misconfigured prod build can never hit
  // localhost silently (dev builds keep the localhost default).
  assertApiBaseUrl()
  const raw = import.meta.env.VITE_API_URL?.trim() ?? ''
  return (raw || 'http://localhost:3000').replace(/\/$/, '')
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })

  const body = await response.json().catch(() => null)
  if (!response.ok) {
    const message = body?.message || body?.error || `Request failed (${response.status})`
    throw new Error(message)
  }
  return body as T
}

export interface PublicBoast {
  boastId: string
  playerAddress: string
  score: number
  gameMode: string
  transactionHash: string
  timestamp: number
}

/**
 * GET /boast/:id — public record for a minted boast.
 * Returns null when the boast does not exist (404) or the backend is
 * unreachable — the public page renders "Boast not found" in both cases.
 */
export async function fetchPublicBoast(id: string): Promise<PublicBoast | null> {
  try {
    const response = await fetch(`${apiBaseUrl()}/boast/${encodeURIComponent(id)}`)
    if (!response.ok) return null
    const body = (await response.json()) as {
      boastId: string
      player: string
      score: number
      gameMode: string
      transactionHash: string
      timestamp: number
    }
    if (!body || body.boastId == null || !body.transactionHash) return null
    return {
      boastId: body.boastId,
      playerAddress: body.player,
      score: body.score,
      gameMode: body.gameMode,
      transactionHash: body.transactionHash,
      timestamp: body.timestamp,
    }
  } catch {
    return null
  }
}

export function validateGameSession(
  token: string,
  result: GameSessionResult & { inputEventLog: Array<{ t: number; x: number; y: number; velocity: number }> },
): Promise<SessionValidationResult> {
  return request('/session/validate', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      playerId: result.playerId,
      score: result.score,
      gameMode: result.mode,
      comboHighwater: result.comboHighwater,
      durationSeconds: result.durationSeconds,
      clientTimestamp: result.timestamp,
      inputEventLog: result.inputEventLog,
    }),
  })
}

export function fetchApiLeaderboard(gameMode: GameMode): Promise<LeaderboardApiResponse> {
  return request(`/leaderboard/${encodeURIComponent(gameMode)}`)
}

export function signBoast(token: string, sessionId: string): Promise<BoastSignatureResult> {
  return request('/boast/sign', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ sessionId }),
  })
}

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

function apiBaseUrl(): string {
  return (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '')
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

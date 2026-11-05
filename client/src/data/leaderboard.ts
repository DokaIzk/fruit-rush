/**
 * Mock weekly leaderboard — swap `fetchLeaderboard()` for a real API later.
 * Keep the shape stable so the UI does not need a redesign.
 */

export interface LeaderboardEntry {
  id: string
  rank: number
  name: string
  score: number
  avatar: string
  /** Optional trophy / badge icon key for UI. */
  trophy?: 'gold' | 'silver' | 'bronze' | null
  isYou?: boolean
}

export interface LeaderboardResponse {
  period: 'weekly' | 'daily' | 'alltime'
  entries: LeaderboardEntry[]
}

const MOCK_ENTRIES: Omit<LeaderboardEntry, 'rank' | 'isYou'>[] = [
  { id: 'p1', name: 'Katsuro', score: 3008, avatar: '🥷', trophy: 'gold' },
  { id: 'p2', name: 'Sensei', score: 2756, avatar: '🥋', trophy: 'silver' },
  { id: 'p3', name: 'Mari', score: 2410, avatar: '🍊', trophy: 'bronze' },
  { id: 'p4', name: 'Rinjin', score: 1988, avatar: '🍉', trophy: null },
  { id: 'p5', name: 'Alex', score: 1540, avatar: '⚔️', trophy: null },
  { id: 'p6', name: 'Sarah', score: 1498, avatar: '🍍', trophy: null },
  { id: 'p7', name: 'Emma', score: 710, avatar: '🥝', trophy: null },
  { id: 'p8', name: 'Kai', score: 640, avatar: '🍋', trophy: null },
]

/** Build a leaderboard list that includes the current player. */
export function buildMockLeaderboard(
  playerScore: number,
  playerName = 'You',
): LeaderboardResponse {
  const others = MOCK_ENTRIES.map((e) => ({ ...e }))
  const you: LeaderboardEntry = {
    id: 'you',
    rank: 0,
    name: playerName,
    score: playerScore,
    avatar: '⭐',
    trophy: null,
    isYou: true,
  }

  const merged = [...others, you]
    .sort((a, b) => b.score - a.score)
    .map((entry, i) => ({
      ...entry,
      rank: i + 1,
      trophy:
        i === 0 ? ('gold' as const) : i === 1 ? ('silver' as const) : i === 2 ? ('bronze' as const) : entry.trophy ?? null,
    }))

  return { period: 'weekly', entries: merged }
}

import { fetchApiLeaderboard } from '../api'

/** Fetch the real leaderboard; fall back to the local demo only when the backend is unavailable. */
export async function fetchLeaderboard(
  playerScore: number,
  playerName = 'You',
  gameMode: 'Classic' | 'Zen' | 'Arcade' | 'Tournament' = 'Classic',
): Promise<LeaderboardResponse> {
  try {
    const response = await fetchApiLeaderboard(gameMode)
    const entries: LeaderboardEntry[] = response.entries.map((entry, index) => ({
      id: entry.playerAddress,
      rank: index + 1,
      name: entry.playerAddress.slice(0, 6) + '…' + entry.playerAddress.slice(-4),
      score: entry.score,
      avatar: entry.hasBoast ? '🏆' : '⭐',
      trophy: index === 0 ? ('gold' as const) : index === 1 ? ('silver' as const) : index === 2 ? ('bronze' as const) : null,
    }))

    if (playerScore > 0 && !entries.some((entry) => entry.name === playerName)) {
      entries.push({ id: 'you', rank: 0, name: playerName, score: playerScore, avatar: '⭐', trophy: null, isYou: true })
      entries.sort((a, b) => b.score - a.score)
      entries.forEach((entry, index) => { entry.rank = index + 1 })
    } else {
      const you = entries.find((entry) => entry.name === playerName)
      if (you) you.isYou = true
    }

    return { period: 'weekly', entries }
  } catch {
    return buildMockLeaderboard(playerScore, playerName)
  }
}

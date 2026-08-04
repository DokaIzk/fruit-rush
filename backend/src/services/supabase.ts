/**
 * Supabase Service
 * =================
 * Database client for session storage and leaderboard queries.
 */

import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from '../config';
import { StoredSession, LeaderboardEntry, GameMode } from '../types/session';

// Initialize Supabase client with service role key (bypasses RLS)
export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Store a validated game session.
 */
export async function storeSession(session: Omit<StoredSession, 'sessionId'>): Promise<string> {
  const { data, error } = await supabase
    .from('game_sessions')
    .insert({
      player_id: session.playerId,
      game_mode: session.gameMode,
      client_score: session.clientScore,
      server_score: session.serverScore,
      combo_highwater: session.comboHighwater,
      duration_seconds: session.durationSeconds,
      client_timestamp: session.clientTimestamp,
      server_timestamp: session.serverTimestamp,
      input_event_count: session.inputEventCount,
      score_divergence: session.scoreDivergence,
      valid: session.valid,
      rejection_reason: session.rejectionReason,
    })
    .select('session_id')
    .single();

  if (error) {
    throw new Error(`Failed to store session: ${error.message}`);
  }

  return data.session_id;
}

/**
 * Retrieve a session by ID.
 */
export async function getSession(sessionId: string): Promise<StoredSession | null> {
  const { data, error } = await supabase
    .from('game_sessions')
    .select('*')
    .eq('session_id', sessionId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw new Error(`Failed to get session: ${error.message}`);
  }

  return {
    sessionId: data.session_id,
    playerId: data.player_id,
    gameMode: data.game_mode,
    clientScore: data.client_score,
    serverScore: data.server_score,
    comboHighwater: data.combo_highwater,
    durationSeconds: data.duration_seconds,
    clientTimestamp: new Date(data.client_timestamp),
    serverTimestamp: new Date(data.server_timestamp),
    inputEventCount: data.input_event_count,
    scoreDivergence: data.score_divergence,
    valid: data.valid,
    rejectionReason: data.rejection_reason,
    boastNonce: data.boast_nonce,
    boastSignedAt: data.boast_signed_at ? new Date(data.boast_signed_at) : null,
  };
}

/**
 * Mark a session as boast-signed with nonce.
 */
export async function markSessionBoastSigned(sessionId: string, nonce: number): Promise<void> {
  const { error } = await supabase
    .from('game_sessions')
    .update({
      boast_nonce: nonce,
      boast_signed_at: new Date().toISOString(),
    })
    .eq('session_id', sessionId);

  if (error) {
    throw new Error(`Failed to mark session as boast-signed: ${error.message}`);
  }
}

/**
 * Get top 100 scores for a game mode (valid sessions only).
 */
export async function getLeaderboard(gameMode: GameMode): Promise<Omit<LeaderboardEntry, 'hasBoast'>[]> {
  const { data, error } = await supabase
    .from('game_sessions')
    .select('player_id, server_score, combo_highwater, server_timestamp, game_mode')
    .eq('game_mode', gameMode)
    .eq('valid', true)
    .order('server_score', { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(`Failed to get leaderboard: ${error.message}`);
  }

  return data.map(row => ({
    playerAddress: row.player_id,
    score: row.server_score,
    timestamp: new Date(row.server_timestamp),
    gameMode: row.game_mode as GameMode,
    comboHighwater: row.combo_highwater,
  }));
}

/**
 * Check if player has already entered a tournament.
 */
export async function hasPlayerEnteredTournament(
  tournamentId: string,
  playerAddress: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('tournament_entries')
    .select('player_address')
    .eq('tournament_id', tournamentId)
    .eq('player_address', playerAddress)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to check tournament entry: ${error.message}`);
  }

  return data !== null;
}

/**
 * Record tournament entry intent.
 */
export async function recordTournamentEntry(
  tournamentId: string,
  playerAddress: string
): Promise<void> {
  const { error } = await supabase.from('tournament_entries').insert({
    tournament_id: tournamentId,
    player_address: playerAddress,
    entered_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error(`Failed to record tournament entry: ${error.message}`);
  }
}

/**
 * Check if tournament is open for entries.
 */
export async function isTournamentOpen(tournamentId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('tournaments')
    .select('status, start_time, end_time')
    .eq('tournament_id', tournamentId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return false; // Not found
    throw new Error(`Failed to check tournament status: ${error.message}`);
  }

  const now = new Date();
  const startTime = new Date(data.start_time);
  const endTime = new Date(data.end_time);

  return data.status === 'Open' && now >= startTime && now <= endTime;
}

/**
 * Session and Game Data Types
 * ============================
 * Type definitions for game session validation and scoring.
 */

export type GameMode = 'Classic' | 'Zen' | 'Arcade' | 'Tournament';

export interface InputEvent {
  /** Milliseconds offset from session start */
  t: number;
  /** Normalized X coordinate (0–1) */
  x: number;
  /** Normalized Y coordinate (0–1) */
  y: number;
  /** Swipe velocity in pixels per millisecond */
  velocity: number;
}

export interface GameSessionResult {
  /** Celo wallet address (0x-prefixed) */
  playerId: string;
  /** Client-reported score (untrusted) */
  score: number;
  /** Game mode */
  gameMode: GameMode;
  /** Highest combo achieved during session */
  comboHighwater: number;
  /** Session duration in seconds */
  durationSeconds: number;
  /** Client timestamp (Unix ms) */
  clientTimestamp: number;
  /** Input event log for replay validation */
  inputEventLog: InputEvent[];
}

export interface ValidationResult {
  /** Whether the session passed validation */
  valid: boolean;
  /** Server-computed score from replay simulation */
  serverScore: number;
  /** Unique session ID (UUID) */
  sessionId: string;
  /** Divergence percentage between client and server score */
  scoreDivergence?: number;
  /** Rejection reason if invalid */
  rejectionReason?: string;
}

export interface BoastSignatureRequest {
  /** Session ID from a validated session */
  sessionId: string;
}

export interface BoastSignatureResponse {
  /** ECDSA signature (65 bytes hex-encoded) */
  signature: string;
  /** Player address (recovered from session) */
  playerAddress: string;
  /** Server-validated score */
  score: number;
  /** Game mode */
  gameMode: string;
  /** Nonce for replay protection */
  nonce: number;
}

export interface LeaderboardEntry {
  /** Player wallet address */
  playerAddress: string;
  /** Validated score */
  score: number;
  /** Session timestamp */
  timestamp: Date;
  /** Whether an on-chain boast exists for this score */
  hasBoast: boolean;
  /** Game mode */
  gameMode: GameMode;
  /** Highest combo */
  comboHighwater: number;
}

export interface TournamentEligibilityRequest {
  /** Player wallet address */
  playerAddress: string;
}

export interface TournamentEligibilityResponse {
  /** Whether player can enter */
  eligible: boolean;
  /** Tournament ID */
  tournamentId: string;
  /** Rejection reason if not eligible */
  reason?: string;
}

export interface StoredSession {
  sessionId: string;
  playerId: string;
  gameMode: GameMode;
  clientScore: number;
  serverScore: number;
  comboHighwater: number;
  durationSeconds: number;
  clientTimestamp: Date;
  serverTimestamp: Date;
  inputEventCount: number;
  scoreDivergence: number;
  valid: boolean;
  rejectionReason: string | null;
  boastNonce: number | null;
  boastSignedAt: Date | null;
}

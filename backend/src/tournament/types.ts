/**
 * Tournament Types
 * =================
 * Type definitions for tournament lifecycle management.
 */

export interface TournamentConfig {
  /** Unique tournament ID (from smart contract) */
  id: string;
  /** Entry fee in cUSD wei (18 decimals) */
  entryFee: bigint;
  /** Tournament start time (Unix timestamp) */
  startTime: number;
  /** Tournament end time (Unix timestamp) */
  endTime: number;
  /** Prize shares in basis points (10000 = 100%) */
  prizeSharesBps: number[];
  /** Tournament status */
  status: TournamentStatus;
}

export type TournamentStatus = 'Pending' | 'Open' | 'Closed' | 'Finalized' | 'Refunded';

export interface TournamentTemplate {
  /** Template name (e.g., "daily-dollar-dash") */
  name: string;
  /** Entry fee in cUSD (human-readable) */
  entryFeeUsd: number;
  /** Duration in seconds */
  durationSeconds: number;
  /** Prize distribution in basis points */
  prizeSharesBps: number[];
  /** Cron schedule (e.g., "0 18 * * *" = daily at 6pm) */
  cronSchedule: string;
}

export interface ActiveTournamentInfo {
  id: string;
  entryFee: string; // Human-readable cUSD
  prizePool: string; // Human-readable cUSD
  entryCount: number;
  startTime: number;
  endTime: number;
  timeRemaining: number; // Seconds
  playerEntered: boolean;
  status: TournamentStatus;
  prizeDistribution: {
    place: number;
    share: string; // Percentage
    amount: string; // cUSD
  }[];
}

export interface TournamentLeaderboardEntry {
  rank: number;
  playerAddress: string;
  score: number;
  comboHighwater: number;
  timestamp: Date;
  prize?: string; // cUSD if in top positions
}

export interface FinalizationResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
  retryCount: number;
}

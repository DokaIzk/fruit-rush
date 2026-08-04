/**
 * Tournament Validation
 * ======================
 * Prize pool validation and pre-finalization checks.
 */

import { TournamentConfig } from './types';

const MAX_PRIZE_SHARE_BPS = 8500; // 85% maximum to winners, 15% minimum rake
const BPS_DENOMINATOR = 10000;

/**
 * Validate prize distribution sums to ≤85% (≥15% rake).
 * 
 * @param prizeSharesBps - Array of prize shares in basis points
 * @throws Error if validation fails
 */
export function validatePrizeShares(prizeSharesBps: number[]): void {
  if (prizeSharesBps.length === 0) {
    throw new Error('Prize shares array cannot be empty');
  }

  const totalBps = prizeSharesBps.reduce((sum, bps) => sum + bps, 0);

  if (totalBps > MAX_PRIZE_SHARE_BPS) {
    throw new Error(
      `Prize shares sum to ${totalBps} bps (${(totalBps / 100).toFixed(1)}%), ` +
      `exceeding maximum ${MAX_PRIZE_SHARE_BPS} bps (85%). ` +
      `Minimum rake of 15% is required.`
    );
  }

  // Validate individual shares
  for (let i = 0; i < prizeSharesBps.length; i++) {
    if (prizeSharesBps[i] < 0) {
      throw new Error(`Prize share at index ${i} is negative: ${prizeSharesBps[i]}`);
    }
    if (prizeSharesBps[i] > BPS_DENOMINATOR) {
      throw new Error(`Prize share at index ${i} exceeds 100%: ${prizeSharesBps[i]} bps`);
    }
  }

  console.log(
    `[Validation] Prize shares valid: ${totalBps} bps (${(totalBps / 100).toFixed(1)}%), ` +
    `rake: ${MAX_PRIZE_SHARE_BPS - totalBps} bps (${((MAX_PRIZE_SHARE_BPS - totalBps) / 100).toFixed(1)}%)`
  );
}

/**
 * Validate tournament time range.
 * 
 * @param startTime - Unix timestamp
 * @param endTime - Unix timestamp
 * @throws Error if validation fails
 */
export function validateTimeRange(startTime: number, endTime: number): void {
  const now = Math.floor(Date.now() / 1000);

  if (startTime <= now) {
    throw new Error(`Start time ${startTime} is in the past (current: ${now})`);
  }

  if (endTime <= startTime) {
    throw new Error(`End time ${endTime} must be after start time ${startTime}`);
  }

  const duration = endTime - startTime;
  if (duration < 60) {
    throw new Error(`Tournament duration ${duration}s is too short (minimum 60s)`);
  }

  console.log(`[Validation] Time range valid: ${new Date(startTime * 1000).toISOString()} to ${new Date(endTime * 1000).toISOString()}`);
}

/**
 * Validate tournament configuration before creation.
 * 
 * @param config - Tournament configuration
 * @throws Error if validation fails
 */
export function validateTournamentConfig(config: TournamentConfig): void {
  if (config.entryFee <= 0n) {
    throw new Error('Entry fee must be positive');
  }

  validateTimeRange(config.startTime, config.endTime);
  validatePrizeShares(config.prizeSharesBps);
}

/**
 * Calculate expected prize pool and payouts.
 * 
 * @param entryFee - Entry fee in wei
 * @param entrantCount - Number of entrants
 * @param prizeSharesBps - Prize distribution
 * @returns Prize pool details
 */
export function calculatePrizePool(
  entryFee: bigint,
  entrantCount: number,
  prizeSharesBps: number[]
): {
  totalPool: bigint;
  payouts: bigint[];
  rake: bigint;
  rakePercentage: number;
} {
  const totalPool = entryFee * BigInt(entrantCount);
  const payouts: bigint[] = [];
  let totalPaid = 0n;

  for (const bps of prizeSharesBps) {
    const payout = (totalPool * BigInt(bps)) / BigInt(BPS_DENOMINATOR);
    payouts.push(payout);
    totalPaid += payout;
  }

  const rake = totalPool - totalPaid;
  const rakePercentage = Number((rake * 10000n) / totalPool) / 100;

  return { totalPool, payouts, rake, rakePercentage };
}

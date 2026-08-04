/**
 * Tournament Scheduler
 * ====================
 * Cron-based tournament lifecycle automation.
 * 
 * - Creates recurring tournaments (daily, weekly templates)
 * - Monitors tournaments for finalization
 * - Handles finalization with exponential backoff retry
 * - Sends webhook alerts on persistent failures
 */

import cron from 'node-cron';
import { supabase } from '../services/supabase';
import {
  createTournamentOnChain,
  finalizeTournamentOnChain,
  getOperatorAddress,
} from './contractService';
import { validatePrizeShares, calculatePrizePool } from './validation';
import { TournamentTemplate, FinalizationResult } from './types';
import { TOURNAMENT_FAILURE_WEBHOOK_URL, NODE_ENV } from '../config';
import { ethers } from 'ethers';

// Tournament templates (configurable via env in production)
const TEMPLATES: TournamentTemplate[] = [
  {
    name: 'daily-dollar-dash',
    entryFeeUsd: 1,
    durationSeconds: 24 * 60 * 60, // 24 hours
    prizeSharesBps: [5000, 2500, 1000], // 50%, 25%, 10% (15% rake)
    cronSchedule: '0 18 * * *', // Daily at 6pm UTC
  },
  {
    name: 'weekend-warrior',
    entryFeeUsd: 10,
    durationSeconds: 48 * 60 * 60, // 48 hours
    prizeSharesBps: [4000, 2500, 1500, 500], // 40%, 25%, 15%, 5% (15% rake)
    cronSchedule: '0 12 * * 6', // Saturday at noon UTC
  },
];

// Exponential backoff configuration
const RETRY_CONFIG = {
  maxAttempts: 3,
  baseDelayMs: 5000, // 5s
  maxDelayMs: 60000, // 60s
};

/**
 * Create a tournament from template.
 */
async function createTournamentFromTemplate(template: TournamentTemplate): Promise<void> {
  try {
    const now = Math.floor(Date.now() / 1000);
    const startTime = now + 300; // Start 5 minutes from now
    const endTime = startTime + template.durationSeconds;

    // Validate prize shares
    validatePrizeShares(template.prizeSharesBps);

    // Generate unique tournament ID (timestamp + random)
    const tournamentId = now * 1000 + Math.floor(Math.random() * 1000);

    // Convert USD to wei (18 decimals)
    const entryFeeWei = ethers.parseUnits(template.entryFeeUsd.toString(), 18);

    console.log(`[Scheduler] Creating tournament from template "${template.name}"`);
    console.log(`[Scheduler] ID: ${tournamentId}, Fee: ${template.entryFeeUsd} cUSD, Duration: ${template.durationSeconds}s`);

    // Create on-chain
    const txHash = await createTournamentOnChain(
      tournamentId,
      entryFeeWei,
      startTime,
      endTime,
      template.prizeSharesBps
    );

    // Record in Supabase
    const { error } = await supabase.from('tournaments').insert({
      tournament_id: tournamentId.toString(),
      entry_fee_wei: entryFeeWei.toString(),
      start_time: new Date(startTime * 1000).toISOString(),
      end_time: new Date(endTime * 1000).toISOString(),
      prize_shares_bps: template.prizeSharesBps,
      status: 'Pending',
      template_name: template.name,
      creation_tx_hash: txHash,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error(`[Scheduler] Failed to record tournament in database:`, error);
      throw error;
    }

    console.log(`[Scheduler] Tournament ${tournamentId} created successfully (tx: ${txHash})`);
  } catch (error) {
    console.error(`[Scheduler] Failed to create tournament from template "${template.name}":`, error);
    // Don't throw - let cron continue to next cycle
  }
}

/**
 * Get leaderboard for tournament (top N players by server score).
 */
async function getTournamentLeaderboard(
  tournamentId: string,
  limit: number
): Promise<string[]> {
  const { data, error } = await supabase
    .from('game_sessions')
    .select('player_id, server_score')
    .eq('valid', true)
    .eq('game_mode', 'Tournament')
    .gte('server_timestamp', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days
    .order('server_score', { ascending: false })
    .limit(limit);

  if (error) {
    console.error(`[Scheduler] Failed to fetch leaderboard for tournament ${tournamentId}:`, error);
    throw error;
  }

  // Return ranked player addresses
  return data.map(row => row.player_id);
}

/**
 * Finalize tournament with exponential backoff retry.
 */
async function finalizeTournamentWithRetry(
  tournamentId: string,
  prizeSharesBps: number[]
): Promise<FinalizationResult> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= RETRY_CONFIG.maxAttempts; attempt++) {
    try {
      console.log(`[Scheduler] Finalization attempt ${attempt}/${RETRY_CONFIG.maxAttempts} for tournament ${tournamentId}`);

      // Get ranked winners (up to prize slots)
      const rankedWinners = await getTournamentLeaderboard(tournamentId, prizeSharesBps.length);

      if (rankedWinners.length === 0) {
        console.log(`[Scheduler] No valid sessions for tournament ${tournamentId}, finalizing with empty winners`);
      }

      // Finalize on-chain
      const txHash = await finalizeTournamentOnChain(Number(tournamentId), rankedWinners);

      // Update Supabase
      const { error } = await supabase
        .from('tournaments')
        .update({
          status: 'Finalized',
          finalized_at: new Date().toISOString(),
          finalization_tx_hash: txHash,
          winner_count: rankedWinners.length,
        })
        .eq('tournament_id', tournamentId);

      if (error) {
        console.error(`[Scheduler] Failed to update tournament status:`, error);
      }

      console.log(`[Scheduler] Tournament ${tournamentId} finalized successfully on attempt ${attempt}`);
      return { success: true, transactionHash: txHash, retryCount: attempt };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`[Scheduler] Finalization attempt ${attempt} failed:`, lastError.message);

      if (attempt < RETRY_CONFIG.maxAttempts) {
        // Exponential backoff: 5s, 20s, 60s
        const delayMs = Math.min(
          RETRY_CONFIG.baseDelayMs * Math.pow(4, attempt - 1),
          RETRY_CONFIG.maxDelayMs
        );
        console.log(`[Scheduler] Retrying in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  // All retries failed
  const errorMessage = lastError?.message || 'Unknown error';
  console.error(`[Scheduler] Tournament ${tournamentId} finalization failed after ${RETRY_CONFIG.maxAttempts} attempts`);

  // Send webhook alert
  await sendFailureWebhook(tournamentId, errorMessage);

  return { success: false, error: errorMessage, retryCount: RETRY_CONFIG.maxAttempts };
}

/**
 * Send webhook alert for persistent finalization failure.
 */
async function sendFailureWebhook(tournamentId: string, error: string): Promise<void> {
  if (!TOURNAMENT_FAILURE_WEBHOOK_URL) {
    console.warn(`[Scheduler] No webhook URL configured, skipping alert`);
    return;
  }

  try {
    const payload = {
      event: 'tournament_finalization_failed',
      tournamentId,
      error,
      timestamp: new Date().toISOString(),
      operator: getOperatorAddress(),
    };

    const response = await fetch(TOURNAMENT_FAILURE_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(`[Scheduler] Webhook failed with status ${response.status}`);
    } else {
      console.log(`[Scheduler] Failure webhook sent for tournament ${tournamentId}`);
    }
  } catch (error) {
    console.error(`[Scheduler] Failed to send webhook:`, error);
  }
}

/**
 * Check for tournaments that need finalization.
 */
async function checkPendingFinalizations(): Promise<void> {
  try {
    const now = new Date();

    // Find tournaments past endTime that haven't been finalized
    const { data, error } = await supabase
      .from('tournaments')
      .select('tournament_id, end_time, prize_shares_bps, status')
      .in('status', ['Pending', 'Open'])
      .lt('end_time', now.toISOString());

    if (error) {
      console.error(`[Scheduler] Failed to fetch pending tournaments:`, error);
      return;
    }

    if (!data || data.length === 0) {
      return;
    }

    console.log(`[Scheduler] Found ${data.length} tournament(s) ready for finalization`);

    // Finalize each tournament (sequentially to avoid rate limiting)
    for (const tournament of data) {
      await finalizeTournamentWithRetry(
        tournament.tournament_id,
        tournament.prize_shares_bps
      );
    }
  } catch (error) {
    console.error(`[Scheduler] Error in checkPendingFinalizations:`, error);
  }
}

/**
 * Initialize tournament scheduler.
 */
export function initializeScheduler(): void {
  if (NODE_ENV === 'test') {
    console.log(`[Scheduler] Skipping scheduler initialization in test environment`);
    return;
  }

  console.log(`[Scheduler] Initializing tournament scheduler...`);

  // Schedule recurring tournament creation
  for (const template of TEMPLATES) {
    cron.schedule(template.cronSchedule, () => {
      console.log(`[Scheduler] Cron triggered for template "${template.name}"`);
      createTournamentFromTemplate(template);
    });
    console.log(`[Scheduler] Scheduled "${template.name}" with cron: ${template.cronSchedule}`);
  }

  // Check for tournaments needing finalization every 5 minutes
  cron.schedule('*/5 * * * *', () => {
    console.log(`[Scheduler] Checking for tournaments needing finalization...`);
    checkPendingFinalizations();
  });
  console.log(`[Scheduler] Scheduled finalization checker (every 5 minutes)`);

  console.log(`[Scheduler] Initialization complete`);
}

/**
 * Manually trigger tournament creation (for testing).
 */
export async function createTournamentManual(templateName: string): Promise<void> {
  const template = TEMPLATES.find(t => t.name === templateName);
  if (!template) {
    throw new Error(`Template "${templateName}" not found`);
  }
  await createTournamentFromTemplate(template);
}

/**
 * Manually trigger finalization (for testing).
 */
export async function finalizeTournamentManual(tournamentId: string): Promise<FinalizationResult> {
  const { data, error } = await supabase
    .from('tournaments')
    .select('prize_shares_bps')
    .eq('tournament_id', tournamentId)
    .single();

  if (error || !data) {
    throw new Error(`Tournament ${tournamentId} not found`);
  }

  return finalizeTournamentWithRetry(tournamentId, data.prize_shares_bps);
}

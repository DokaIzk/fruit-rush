/**
 * Tournament Admin Routes
 * ========================
 * GET  /tournament/active — List open tournaments
 * GET  /tournament/:id/leaderboard — Live tournament rankings
 * POST /tournament/:id/refund — Emergency refund (admin-only)
 */

import express from 'express';
import { authMiddleware, requirePlayerMatch } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { redis } from '../services/redis';
import { supabase } from '../services/supabase';
import { refundTournamentOnChain, getTournamentFromChain } from '../tournament/contractService';
import { calculatePrizePool } from '../tournament/validation';
import { ActiveTournamentInfo, TournamentLeaderboardEntry } from '../tournament/types';
import { ethers } from 'ethers';

const router = express.Router();

// Cache TTL for leaderboard (10 seconds)
const LEADERBOARD_CACHE_TTL = 10;

/**
 * GET /tournament/active
 * 
 * List all currently open tournaments.
 * 
 * Query params: playerAddress (optional, to show entry status)
 * Response: { tournaments: ActiveTournamentInfo[] }
 */
router.get(
  '/active',
  asyncHandler(async (req, res) => {
    const playerAddress = req.query.playerAddress as string | undefined;
    const now = new Date();

    // Fetch open tournaments from Supabase
    const { data, error } = await supabase
      .from('tournaments')
      .select('*')
      .in('status', ['Pending', 'Open'])
      .lte('start_time', now.toISOString())
      .gte('end_time', now.toISOString())
      .order('start_time', { ascending: true });

    if (error) {
      res.status(500).json({ error: 'Failed to fetch tournaments', message: error.message });
      return;
    }

    const tournaments: ActiveTournamentInfo[] = [];

    for (const t of data || []) {
      const entryFeeWei = BigInt(t.entry_fee_wei);
      const entryFeeUsd = ethers.formatUnits(entryFeeWei, 18);
      
      // Count entrants
      const { count: entryCount } = await supabase
        .from('tournament_entries')
        .select('*', { count: 'exact', head: true })
        .eq('tournament_id', t.tournament_id);

      const { totalPool, payouts } = calculatePrizePool(
        entryFeeWei,
        entryCount || 0,
        t.prize_shares_bps
      );

      // Check if player entered
      let playerEntered = false;
      if (playerAddress) {
        const { data: entryData } = await supabase
          .from('tournament_entries')
          .select('player_address')
          .eq('tournament_id', t.tournament_id)
          .eq('player_address', playerAddress)
          .single();
        playerEntered = entryData !== null;
      }

      // Calculate prize distribution
      const prizeDistribution = t.prize_shares_bps.map((bps: number, idx: number) => ({
        place: idx + 1,
        share: `${(bps / 100).toFixed(1)}%`,
        amount: ethers.formatUnits(payouts[idx], 18),
      }));

      tournaments.push({
        id: t.tournament_id,
        entryFee: entryFeeUsd,
        prizePool: ethers.formatUnits(totalPool, 18),
        entryCount: entryCount || 0,
        startTime: Math.floor(new Date(t.start_time).getTime() / 1000),
        endTime: Math.floor(new Date(t.end_time).getTime() / 1000),
        timeRemaining: Math.floor((new Date(t.end_time).getTime() - Date.now()) / 1000),
        playerEntered,
        status: t.status,
        prizeDistribution,
      });
    }

    res.json({ tournaments });
  })
);

/**
 * GET /tournament/:id/leaderboard
 * 
 * Get live tournament leaderboard (with 10s Redis cache).
 * 
 * Params: id (tournament ID)
 * Response: { tournamentId, entries: TournamentLeaderboardEntry[] }
 */
router.get(
  '/:id/leaderboard',
  asyncHandler(async (req, res) => {
    const tournamentId = req.params.id;

    // Check cache first
    const cacheKey = `tournament:${tournamentId}:leaderboard`;
    const cached = await redis.get(cacheKey);

    if (cached) {
      res.json(JSON.parse(cached));
      return;
    }

    // Fetch tournament to get prize share count
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('prize_shares_bps, entry_fee_wei')
      .eq('tournament_id', tournamentId)
      .single();

    if (tournamentError || !tournament) {
      res.status(404).json({ error: 'Tournament not found' });
      return;
    }

    // Fetch leaderboard (only valid sessions)
    const { data, error } = await supabase
      .from('game_sessions')
      .select('player_id, server_score, combo_highwater, server_timestamp')
      .eq('valid', true)
      .eq('game_mode', 'Tournament')
      .order('server_score', { ascending: false })
      .limit(100);

    if (error) {
      res.status(500).json({ error: 'Failed to fetch leaderboard', message: error.message });
      return;
    }

    // Calculate prize amounts
    const entryFeeWei = BigInt(tournament.entry_fee_wei);
    const { count: entryCount } = await supabase
      .from('tournament_entries')
      .select('*', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId);

    const { payouts } = calculatePrizePool(entryFeeWei, entryCount || 0, tournament.prize_shares_bps);

    // Build leaderboard entries
    const entries: TournamentLeaderboardEntry[] = (data || []).map((row, idx) => ({
      rank: idx + 1,
      playerAddress: row.player_id,
      score: row.server_score,
      comboHighwater: row.combo_highwater,
      timestamp: new Date(row.server_timestamp),
      prize:
        idx < tournament.prize_shares_bps.length
          ? ethers.formatUnits(payouts[idx], 18)
          : undefined,
    }));

    const response = { tournamentId, entries };

    // Cache for 10 seconds
    await redis.setEx(cacheKey, LEADERBOARD_CACHE_TTL, JSON.stringify(response));

    res.json(response);
  })
);

/**
 * POST /tournament/:id/refund
 * 
 * Emergency refund for a tournament (admin-only, requires OPERATOR_ROLE bearer).
 * 
 * Params: id (tournament ID)
 * Body: { adminKey } - Secret admin key for authorization
 * Response: { success, transactionHash }
 */
router.post(
  '/:id/refund',
  asyncHandler(async (req, res) => {
    const tournamentId = req.params.id;
    const { adminKey } = req.body;

    // Simple admin key check (replace with proper auth in production)
    const ADMIN_KEY = process.env.ADMIN_REFUND_KEY;
    if (!ADMIN_KEY || adminKey !== ADMIN_KEY) {
      res.status(403).json({ error: 'Unauthorized', message: 'Invalid admin key' });
      return;
    }

    // Verify tournament exists and is not already finalized/refunded
    const { data: tournament, error } = await supabase
      .from('tournaments')
      .select('status')
      .eq('tournament_id', tournamentId)
      .single();

    if (error || !tournament) {
      res.status(404).json({ error: 'Tournament not found' });
      return;
    }

    if (tournament.status === 'Finalized' || tournament.status === 'Refunded') {
      res.status(400).json({
        error: 'Cannot refund',
        message: `Tournament is already ${tournament.status}`,
      });
      return;
    }

    try {
      // Execute refund on-chain
      const txHash = await refundTournamentOnChain(Number(tournamentId));

      // Update database
      await supabase
        .from('tournaments')
        .update({
          status: 'Refunded',
          refund_tx_hash: txHash,
          refunded_at: new Date().toISOString(),
        })
        .eq('tournament_id', tournamentId);

      res.json({
        success: true,
        transactionHash: txHash,
        message: `Tournament ${tournamentId} refunded successfully`,
      });
    } catch (refundError) {
      console.error(`[Tournament] Refund failed:`, refundError);
      res.status(500).json({
        error: 'Refund failed',
        message: refundError instanceof Error ? refundError.message : 'Unknown error',
      });
    }
  })
);

export default router;

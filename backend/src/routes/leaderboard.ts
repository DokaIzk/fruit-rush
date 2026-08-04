/**
 * Leaderboard Routes
 * ===================
 * GET /leaderboard/:gameMode — Get top 100 scores with boast status
 */

import express from 'express';
import { leaderboardRateLimit } from '../middleware/rateLimit';
import { asyncHandler } from '../middleware/errorHandler';
import { LeaderboardGameModeSchema } from '../schemas/validation';
import { getLeaderboard } from '../services/supabase';
import { batchCheckBoastStatus } from '../services/goldsky';
import { getCachedLeaderboard, cacheLeaderboard } from '../services/redis';

const router = express.Router();

/**
 * GET /leaderboard/:gameMode
 * 
 * Get top 100 scores for a game mode with on-chain boast status.
 * Results are cached for 5 minutes.
 * 
 * Params: gameMode (Classic | Zen | Arcade | Tournament)
 * Response: { gameMode, entries[], total }
 */
router.get(
  '/:gameMode',
  leaderboardRateLimit,
  asyncHandler(async (req, res) => {
    // Validate game mode param
    const validationResult = LeaderboardGameModeSchema.safeParse(req.params);

    if (!validationResult.success) {
      res.status(400).json({
        error: 'Invalid game mode',
        message: 'Game mode must be one of: Classic, Zen, Arcade, Tournament',
      });
      return;
    }

    const { gameMode } = validationResult.data;

    // Check cache first
    const cached = await getCachedLeaderboard(gameMode);
    if (cached) {
      res.json(cached);
      return;
    }

    // Fetch leaderboard from Supabase
    const entries = await getLeaderboard(gameMode);

    // Batch check boast status from Goldsky subgraph
    const boastStatusMap = await batchCheckBoastStatus(
      entries.map(e => ({
        playerAddress: e.playerAddress,
        score: e.score,
        gameMode: e.gameMode,
      }))
    );

    // Merge boast status into entries
    const entriesWithBoastStatus = entries.map(entry => ({
      ...entry,
      hasBoast: boastStatusMap.get(entry.playerAddress) || false,
    }));

    const response = {
      gameMode,
      entries: entriesWithBoastStatus,
      total: entriesWithBoastStatus.length,
    };

    // Cache for 5 minutes
    await cacheLeaderboard(gameMode, response);

    res.json(response);
  })
);

export default router;

/**
 * Session Validation Routes
 * ==========================
 * POST /session/validate — Validate game session via replay simulation
 */

import express from 'express';
import { authMiddleware, requirePlayerMatch } from '../middleware/auth';
import { sessionRateLimit } from '../middleware/rateLimit';
import { asyncHandler } from '../middleware/errorHandler';
import { GameSessionResultSchema } from '../schemas/validation';
import { replaySimulation } from '../validator/replaySimulator';
import { storeSession } from '../services/supabase';

const router = express.Router();

/**
 * POST /session/validate
 * 
 * Validate a game session and store results.
 * 
 * Request body: GameSessionResult (validated by Zod)
 * Response: ValidationResult
 */
router.post(
  '/validate',
  authMiddleware,
  requirePlayerMatch,
  sessionRateLimit,
  asyncHandler(async (req, res) => {
    // Validate request body with Zod
    const validationResult = GameSessionResultSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        error: 'Validation error',
        details: validationResult.error.errors,
      });
      return;
    }

    const session = validationResult.data;

    // Run replay simulation
    const { serverScore, valid, divergence, rejectionReason } = replaySimulation(
      session.inputEventLog,
      session.score,
      session.gameMode,
      session.durationSeconds
    );

    // Store session in Supabase
    const sessionId = await storeSession({
      playerId: session.playerId,
      gameMode: session.gameMode,
      clientScore: session.score,
      serverScore,
      comboHighwater: session.comboHighwater,
      durationSeconds: session.durationSeconds,
      clientTimestamp: new Date(session.clientTimestamp),
      serverTimestamp: new Date(),
      inputEventCount: session.inputEventLog.length,
      scoreDivergence: divergence,
      valid,
      rejectionReason,
      boastNonce: null,
      boastSignedAt: null,
    });

    // Return validation result
    res.json({
      valid,
      serverScore,
      sessionId,
      scoreDivergence: divergence,
      ...(rejectionReason && { rejectionReason }),
    });
  })
);

export default router;

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
 * One visibility line per validate request: method, path, origin, result.
 * Kept to a single line so Render's log tail stays scannable.
 */
export function logValidateRequest(req: express.Request, summary: string): void {
  const origin = (req.headers.origin ?? 'no-origin').slice(0, 64);
  const player = typeof req.body?.playerId === 'string' ? req.body.playerId.slice(0, 10) : 'unknown';
  console.log(
    `[validate] ${req.method} ${req.originalUrl} origin=${origin} player=${player}… result=${summary}`,
  );
}

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
      logValidateRequest(req, 'REJECTED reason=schema');
      res.status(400).json({
        error: 'Validation error',
        details: validationResult.error.errors,
      });
      return;
    }

    const session = validationResult.data;

    // Run replay simulation + plausibility checks
    const { serverScore, valid, divergence, rejectionReason } = replaySimulation(
      session.inputEventLog,
      session.score,
      session.gameMode,
      session.durationSeconds,
      session.fruitsSliced,
      session.comboHighwater
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
    logValidateRequest(
      req,
      `${valid ? 'VALID' : 'INVALID'} serverScore=${serverScore} divergence=${divergence.toFixed(2)}%${rejectionReason ? ` reason=${rejectionReason}` : ''}`,
    );
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

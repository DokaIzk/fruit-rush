/**
 * Tournament Entry Routes
 * ========================
 * POST /tournament/:id/enter — Check player eligibility for tournament entry
 */

import express from 'express';
import { authMiddleware, requirePlayerMatch } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { TournamentIdSchema, TournamentEligibilityRequestSchema } from '../schemas/validation';
import {
  hasPlayerEnteredTournament,
  recordTournamentEntry,
  isTournamentOpen,
} from '../services/supabase';

const router = express.Router();

/**
 * POST /tournament/:id/enter
 * 
 * Check player eligibility and record entry intent.
 * Actual on-chain entry happens client-side after this returns.
 * 
 * Params: id (tournament ID)
 * Body: { playerAddress }
 * Response: { eligible, tournamentId, reason? }
 */
router.post(
  '/:id/enter',
  authMiddleware,
  requirePlayerMatch,
  asyncHandler(async (req, res) => {
    // Validate tournament ID
    const paramValidation = TournamentIdSchema.safeParse(req.params);
    if (!paramValidation.success) {
      res.status(400).json({
        error: 'Invalid tournament ID',
        message: 'Tournament ID must be a numeric string',
      });
      return;
    }

    // Validate request body
    const bodyValidation = TournamentEligibilityRequestSchema.safeParse(req.body);
    if (!bodyValidation.success) {
      res.status(400).json({
        error: 'Validation error',
        details: bodyValidation.error.errors,
      });
      return;
    }

    const { id: tournamentId } = paramValidation.data;
    const { playerAddress } = bodyValidation.data;

    // Check if tournament exists and is open
    const isOpen = await isTournamentOpen(tournamentId);
    if (!isOpen) {
      res.json({
        eligible: false,
        tournamentId,
        reason: 'Tournament is not open for entries',
      });
      return;
    }

    // Check if player already entered
    const alreadyEntered = await hasPlayerEnteredTournament(tournamentId, playerAddress);
    if (alreadyEntered) {
      res.json({
        eligible: false,
        tournamentId,
        reason: 'Player already entered this tournament',
      });
      return;
    }

    // Record entry intent
    await recordTournamentEntry(tournamentId, playerAddress);

    // Return eligible
    res.json({
      eligible: true,
      tournamentId,
    });
  })
);

export default router;

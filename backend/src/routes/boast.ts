/**
 * Boast Signing Routes
 * =====================
 * POST /boast/sign — Generate ECDSA signature for on-chain boast minting
 */

import express from 'express';
import { authMiddleware } from '../middleware/auth';
import { boastRateLimit } from '../middleware/rateLimit';
import { asyncHandler } from '../middleware/errorHandler';
import { BoastSignatureRequestSchema } from '../schemas/validation';
import { getSession, markSessionBoastSigned } from '../services/supabase';
import { signBoast } from '../services/signer';

const router = express.Router();

/**
 * POST /boast/sign
 * 
 * Generate ECDSA signature for a validated session.
 * 
 * Request body: { sessionId: string }
 * Response: { signature, playerAddress, score, gameMode, nonce }
 */
router.post(
  '/sign',
  authMiddleware,
  boastRateLimit,
  asyncHandler(async (req, res) => {
    // Validate request body
    const validationResult = BoastSignatureRequestSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        error: 'Validation error',
        details: validationResult.error.errors,
      });
      return;
    }

    const { sessionId } = validationResult.data;

    // Fetch session from database
    const session = await getSession(sessionId);

    if (!session) {
      res.status(404).json({
        error: 'Session not found',
        message: `No session found with ID ${sessionId}`,
      });
      return;
    }

    // Verify session is valid
    if (!session.valid) {
      res.status(400).json({
        error: 'Invalid session',
        message: 'Cannot sign boast for invalid session',
        rejectionReason: session.rejectionReason,
      });
      return;
    }

    // Verify session belongs to authenticated user
    if (session.playerId.toLowerCase() !== req.user!.publicAddress.toLowerCase()) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Session does not belong to authenticated user',
      });
      return;
    }

    // Check if already signed
    if (session.boastNonce !== null) {
      res.status(409).json({
        error: 'Already signed',
        message: 'Boast signature already generated for this session',
        existingNonce: session.boastNonce,
      });
      return;
    }

    // Generate signature
    const { signature, nonce, signerAddress } = await signBoast(
      session.playerId,
      session.serverScore,
      session.gameMode
    );

    // Mark session as boast-signed
    await markSessionBoastSigned(sessionId, nonce);

    // Return signature
    res.json({
      signature,
      playerAddress: session.playerId,
      score: session.serverScore,
      gameMode: session.gameMode,
      nonce,
      signerAddress, // For verification
    });
  })
);

export default router;

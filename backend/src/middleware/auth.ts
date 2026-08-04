/**
 * Authentication Middleware
 * ==========================
 * Magic.link JWT validation.
 */

import { Request, Response, NextFunction } from 'express';
import { Magic } from '@magic-sdk/admin';
import { MAGIC_SECRET_KEY } from '../config';

// Initialize Magic Admin SDK
const magic = new Magic(MAGIC_SECRET_KEY);

// Extend Express Request to include authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: {
        issuer: string; // DID (Decentralized Identifier)
        publicAddress: string; // Ethereum address
        email?: string;
      };
    }
  }
}

/**
 * Verify Magic.link JWT token and extract user identity.
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Extract Bearer token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid Authorization header' });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Validate token with Magic
    magic.token.validate(token);

    // Get user metadata from token
    const metadata = await magic.users.getMetadataByToken(token);

    if (!metadata.publicAddress) {
      res.status(401).json({ error: 'Invalid token: no public address' });
      return;
    }

    // Attach user to request
    req.user = {
      issuer: metadata.issuer,
      publicAddress: metadata.publicAddress,
      email: metadata.email || undefined,
    };

    next();
  } catch (error: any) {
    console.error('Auth middleware error:', error);
    res.status(401).json({
      error: 'Authentication failed',
      message: error.message || 'Invalid or expired token',
    });
  }
}

/**
 * Verify that the authenticated user matches the playerId in the request body.
 */
export function requirePlayerMatch(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const { playerId, playerAddress } = req.body;
  const requestedAddress = playerId || playerAddress;

  if (!requestedAddress) {
    res.status(400).json({ error: 'Missing playerId or playerAddress in request' });
    return;
  }

  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  // Case-insensitive address comparison
  if (req.user.publicAddress.toLowerCase() !== requestedAddress.toLowerCase()) {
    res.status(403).json({
      error: 'Forbidden',
      message: 'Authenticated address does not match requested playerId',
    });
    return;
  }

  next();
}

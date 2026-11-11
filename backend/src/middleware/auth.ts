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
  const reject401 = (reason: string): void => {
    console.error(`[auth] 401 ${req.method} ${req.originalUrl} — ${reason}`);
    res.status(401).json({ error: 'Authentication failed', message: reason });
  };

  try {
    // Extract Bearer token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      reject401(`missing or malformed Authorization header (present=${Boolean(authHeader)})`);
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Diagnostic: log the DID-token's own expiry claim (never the token).
    const claim = didTokenClaim(token);
    const expiry = claim?.ext ? new Date(claim.ext * 1000).toISOString() : 'unknown';
    const expired = claim?.ext ? claim.ext * 1000 < Date.now() : null;
    console.log(
      `[auth] ${req.method} ${req.originalUrl} — token len=${token.length} expires=${expiry}${expired === true ? ' EXPIRED' : ''}`
    );

    // Validate token with Magic
    magic.token.validate(token);

    // Get user metadata from token
    const metadata = await magic.users.getMetadataByToken(token);

    if (!metadata.publicAddress || !metadata.issuer) {
      reject401('invalid token: missing user identity');
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
    // Distinguish expiry from other Magic verification failures so /boast/sign
    // 401s are diagnosable from logs.
    const message: string = error?.message || 'Invalid or expired token';
    const reason = /expir|is before|ext/i.test(message)
      ? `expired or not-yet-valid DID token (${message})`
      : `Magic verification failed (${message})`;
    reject401(reason);
  }
}

/**
 * Decode a Magic DID token's claim segment (proof.claim.signature base64url
 * triple) for diagnostics only. Returns the { iss, aud, sub, iat, ext } claim
 * or null when the token is malformed. Never logs or returns the token itself.
 */
function didTokenClaim(token: string): { ext?: number; iat?: number } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const claim = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8')) as {
      ext?: number;
      iat?: number;
    };
    return typeof claim === 'object' && claim !== null ? claim : null;
  } catch {
    return null;
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

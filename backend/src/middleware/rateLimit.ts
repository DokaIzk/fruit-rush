/**
 * Rate Limiting Middleware
 * =========================
 * Redis-backed rate limiting per player and per IP.
 */

import { Request, Response, NextFunction } from 'express';
import { checkRateLimit } from '../services/redis';
import { SESSION_RATE_LIMIT } from '../config';

/**
 * Rate limit by player address (requires auth middleware first).
 * 
 * @param limit - Max requests per window
 * @param windowSeconds - Time window in seconds
 */
export function rateLimitByPlayer(limit: number, windowSeconds: number) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required for rate limiting' });
        return;
      }

      const playerId = req.user.publicAddress;
      const { allowed, remaining } = await checkRateLimit(playerId, limit, windowSeconds);

      // Add rate limit headers
      res.setHeader('X-RateLimit-Limit', limit.toString());
      res.setHeader('X-RateLimit-Remaining', remaining.toString());
      res.setHeader('X-RateLimit-Reset', (Date.now() + windowSeconds * 1000).toString());

      if (!allowed) {
        res.status(429).json({
          error: 'Rate limit exceeded',
          message: `Maximum ${limit} requests per ${windowSeconds} seconds`,
          retryAfter: windowSeconds,
        });
        return;
      }

      next();
    } catch (error) {
      console.error('Rate limit middleware error:', error);
      // Fail open: allow request if rate limiting fails
      next();
    }
  };
}

/**
 * Rate limit by IP address (for unauthenticated endpoints like leaderboard).
 */
export function rateLimitByIP(limit: number, windowSeconds: number) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      const { allowed, remaining } = await checkRateLimit(`ip:${ip}`, limit, windowSeconds);

      res.setHeader('X-RateLimit-Limit', limit.toString());
      res.setHeader('X-RateLimit-Remaining', remaining.toString());
      res.setHeader('X-RateLimit-Reset', (Date.now() + windowSeconds * 1000).toString());

      if (!allowed) {
        res.status(429).json({
          error: 'Rate limit exceeded',
          message: `Maximum ${limit} requests per ${windowSeconds} seconds`,
          retryAfter: windowSeconds,
        });
        return;
      }

      next();
    } catch (error) {
      console.error('Rate limit middleware error:', error);
      next();
    }
  };
}

/**
 * Session validation rate limiter (10 per hour per player by default).
 */
export const sessionRateLimit = rateLimitByPlayer(SESSION_RATE_LIMIT, 3600);

/**
 * Boast signing rate limiter (5 per hour per player).
 */
export const boastRateLimit = rateLimitByPlayer(5, 3600);

/**
 * Leaderboard rate limiter (60 per minute per IP).
 */
export const leaderboardRateLimit = rateLimitByIP(60, 60);

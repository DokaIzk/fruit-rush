/**
 * Redis Service
 * ==============
 * Redis client for rate limiting and caching.
 */

import { createClient } from 'redis';
import { REDIS_URL, REDIS_PASSWORD, REDIS_TLS } from '../config';

// Create Redis client
export const redis = createClient({
  url: REDIS_URL,
  password: REDIS_PASSWORD || undefined,
  socket: {
    tls: REDIS_TLS,
    rejectUnauthorized: REDIS_TLS, // Only verify certs in TLS mode
  },
});

// Connection error handling
redis.on('error', (err) => {
  console.error('Redis connection error:', err);
});

redis.on('connect', () => {
  console.log('✓ Redis connected');
});

// Connect immediately
(async () => {
  try {
    await redis.connect();
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
    process.exit(1);
  }
})();

/**
 * Check rate limit for a player.
 * @returns remaining requests allowed
 */
export async function checkRateLimit(
  playerId: string,
  limit: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number }> {
  const key = `ratelimit:player:${playerId}`;
  const now = Date.now();
  const windowStart = now - windowSeconds * 1000;

  // Remove old entries outside the window
  await redis.zRemRangeByScore(key, 0, windowStart);

  // Count requests in current window
  const count = await redis.zCard(key);

  if (count >= limit) {
    return { allowed: false, remaining: 0 };
  }

  // Add current request
  await redis.zAdd(key, { score: now, value: `${now}` });

  // Set expiry on key
  await redis.expire(key, windowSeconds);

  return { allowed: true, remaining: limit - count - 1 };
}

/**
 * Get next nonce for boast signing (atomic increment).
 */
export async function getNextBoastNonce(playerId: string): Promise<number> {
  const key = `boast:nonce:${playerId}`;
  const nonce = await redis.incr(key);

  // Set expiry to 1 year (nonces should persist long-term)
  await redis.expire(key, 31536000);

  return nonce;
}

/**
 * Cache leaderboard data (5 minute TTL).
 */
export async function cacheLeaderboard(gameMode: string, data: any): Promise<void> {
  const key = `leaderboard:${gameMode}`;
  await redis.setEx(key, 300, JSON.stringify(data)); // 5 min TTL
}

/**
 * Get cached leaderboard data.
 */
export async function getCachedLeaderboard(gameMode: string): Promise<any | null> {
  const key = `leaderboard:${gameMode}`;
  const cached = await redis.get(key);
  return cached ? JSON.parse(cached) : null;
}

/**
 * Graceful shutdown.
 */
export async function disconnectRedis(): Promise<void> {
  await redis.quit();
}

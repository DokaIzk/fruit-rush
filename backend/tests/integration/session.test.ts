/**
 * Session Validation Integration Tests
 * =====================================
 * Test POST /session/validate endpoint with real database.
 */

import request from 'supertest';
import app from '../../src/index';
import { GameSessionResult } from '../../src/types/session';

// Mock Magic.link auth middleware for testing
jest.mock('../../src/middleware/auth', () => ({
  authMiddleware: (req: any, res: any, next: any) => {
    req.user = {
      issuer: 'test-issuer',
      publicAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    };
    next();
  },
  requirePlayerMatch: (req: any, res: any, next: any) => next(),
}));

// Mock rate limiting for tests
jest.mock('../../src/middleware/rateLimit', () => ({
  sessionRateLimit: (req: any, res: any, next: any) => next(),
  boastRateLimit: (req: any, res: any, next: any) => next(),
  leaderboardRateLimit: (req: any, res: any, next: any) => next(),
}));

describe('POST /session/validate', () => {
  const validSession: GameSessionResult = {
    playerId: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    score: 150,
    gameMode: 'Classic',
    comboHighwater: 5,
    durationSeconds: 3,
    clientTimestamp: Date.now(),
    inputEventLog: [
      { t: 850, x: 0.5, y: 0.5, velocity: 1.0 },
      { t: 1700, x: 0.5, y: 0.5, velocity: 1.0 },
      { t: 2550, x: 0.5, y: 0.5, velocity: 1.0 },
    ],
  };

  it('should validate a valid session', async () => {
    const response = await request(app)
      .post('/session/validate')
      .send(validSession)
      .expect(200);

    expect(response.body).toHaveProperty('valid');
    expect(response.body).toHaveProperty('serverScore');
    expect(response.body).toHaveProperty('sessionId');
    expect(response.body.sessionId).toMatch(/^[a-f0-9-]{36}$/); // UUID format
  });

  it('should reject session with invalid playerId format', async () => {
    const invalidSession = {
      ...validSession,
      playerId: 'not-an-address',
    };

    const response = await request(app)
      .post('/session/validate')
      .send(invalidSession)
      .expect(400);

    expect(response.body.error).toBe('Validation error');
  });

  it('should reject session with negative score', async () => {
    const invalidSession = {
      ...validSession,
      score: -100,
    };

    const response = await request(app)
      .post('/session/validate')
      .send(invalidSession)
      .expect(400);

    expect(response.body.error).toBe('Validation error');
  });

  it('should reject session with out-of-bounds coordinates', async () => {
    const invalidSession = {
      ...validSession,
      inputEventLog: [{ t: 100, x: 1.5, y: 0.5, velocity: 0.8 }],
    };

    const response = await request(app)
      .post('/session/validate')
      .send(invalidSession)
      .expect(200); // Still 200 but marked invalid

    expect(response.body.valid).toBe(false);
    expect(response.body.rejectionReason).toContain('out of bounds');
  });

  it('should handle score divergence correctly', async () => {
    const sessionWithHighScore = {
      ...validSession,
      score: 100000, // Way higher than possible
    };

    const response = await request(app)
      .post('/session/validate')
      .send(sessionWithHighScore)
      .expect(200);

    expect(response.body.valid).toBe(false);
    expect(response.body.scoreDivergence).toBeGreaterThan(2.0);
    expect(response.body.rejectionReason).toContain('divergence');
  });

  it('should reject session with empty input log', async () => {
    const invalidSession = {
      ...validSession,
      inputEventLog: [],
    };

    const response = await request(app)
      .post('/session/validate')
      .send(invalidSession)
      .expect(400);

    expect(response.body.error).toBe('Validation error');
  });

  it('should accept tournament mode sessions', async () => {
    const tournamentSession = {
      ...validSession,
      gameMode: 'Tournament' as const,
    };

    const response = await request(app)
      .post('/session/validate')
      .send(tournamentSession)
      .expect(200);

    expect(response.body).toHaveProperty('valid');
    expect(response.body).toHaveProperty('sessionId');
  });
});

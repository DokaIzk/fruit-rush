/**
 * Boast Signing Integration Tests
 * ================================
 * Test POST /boast/sign endpoint with real database.
 */

import request from 'supertest';
import app from '../../src/index';
import { storeSession } from '../../src/services/supabase';

// Mock auth and rate limiting
jest.mock('../../src/middleware/auth', () => ({
  authMiddleware: (req: any, res: any, next: any) => {
    req.user = {
      issuer: 'test-issuer',
      publicAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    };
    next();
  },
}));

jest.mock('../../src/middleware/rateLimit', () => ({
  sessionRateLimit: (req: any, res: any, next: any) => next(),
  boastRateLimit: (req: any, res: any, next: any) => next(),
  leaderboardRateLimit: (req: any, res: any, next: any) => next(),
}));

describe('POST /boast/sign', () => {
  const testPlayerAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';
  let validSessionId: string;

  beforeEach(async () => {
    // Create a valid session first
    validSessionId = await storeSession({
      playerId: testPlayerAddress,
      gameMode: 'Classic',
      clientScore: 100,
      serverScore: 100,
      comboHighwater: 5,
      durationSeconds: 3,
      clientTimestamp: new Date(),
      serverTimestamp: new Date(),
      inputEventCount: 10,
      scoreDivergence: 0,
      valid: true,
      rejectionReason: null,
      boastNonce: null,
      boastSignedAt: null,
    });
  });

  it('should sign a valid session', async () => {
    const response = await request(app)
      .post('/boast/sign')
      .send({ sessionId: validSessionId })
      .expect(200);

    expect(response.body).toHaveProperty('signature');
    expect(response.body.signature).toMatch(/^0x[a-fA-F0-9]{130}$/);
    expect(response.body).toHaveProperty('playerAddress', testPlayerAddress);
    expect(response.body).toHaveProperty('score', 100);
    expect(response.body).toHaveProperty('gameMode', 'Classic');
    expect(response.body).toHaveProperty('nonce');
    expect(response.body.nonce).toBeGreaterThan(0);
  });

  it('should reject invalid session ID format', async () => {
    const response = await request(app)
      .post('/boast/sign')
      .send({ sessionId: 'not-a-uuid' })
      .expect(400);

    expect(response.body.error).toBe('Validation error');
  });

  it('should reject non-existent session', async () => {
    const fakeUuid = '00000000-0000-0000-0000-000000000000';

    const response = await request(app)
      .post('/boast/sign')
      .send({ sessionId: fakeUuid })
      .expect(404);

    expect(response.body.error).toBe('Session not found');
  });

  it('should reject invalid session', async () => {
    // Create an invalid session
    const invalidSessionId = await storeSession({
      playerId: testPlayerAddress,
      gameMode: 'Classic',
      clientScore: 100,
      serverScore: 50,
      comboHighwater: 5,
      durationSeconds: 3,
      clientTimestamp: new Date(),
      serverTimestamp: new Date(),
      inputEventCount: 10,
      scoreDivergence: 50, // High divergence
      valid: false,
      rejectionReason: 'Score divergence too high',
      boastNonce: null,
      boastSignedAt: null,
    });

    const response = await request(app)
      .post('/boast/sign')
      .send({ sessionId: invalidSessionId })
      .expect(400);

    expect(response.body.error).toBe('Invalid session');
    expect(response.body.rejectionReason).toBe('Score divergence too high');
  });

  it('should reject already-signed session', async () => {
    // Sign once
    await request(app).post('/boast/sign').send({ sessionId: validSessionId }).expect(200);

    // Try to sign again
    const response = await request(app)
      .post('/boast/sign')
      .send({ sessionId: validSessionId })
      .expect(409);

    expect(response.body.error).toBe('Already signed');
  });

  it('should reject session belonging to different player', async () => {
    // Create session for different player
    const otherSessionId = await storeSession({
      playerId: '0x0000000000000000000000000000000000000001',
      gameMode: 'Classic',
      clientScore: 100,
      serverScore: 100,
      comboHighwater: 5,
      durationSeconds: 3,
      clientTimestamp: new Date(),
      serverTimestamp: new Date(),
      inputEventCount: 10,
      scoreDivergence: 0,
      valid: true,
      rejectionReason: null,
      boastNonce: null,
      boastSignedAt: null,
    });

    const response = await request(app)
      .post('/boast/sign')
      .send({ sessionId: otherSessionId })
      .expect(403);

    expect(response.body.error).toBe('Forbidden');
  });
});

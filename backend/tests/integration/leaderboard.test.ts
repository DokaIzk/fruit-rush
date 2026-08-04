/**
 * Leaderboard Integration Tests
 * ==============================
 * Test GET /leaderboard/:gameMode endpoint.
 */

import request from 'supertest';
import app from '../../src/index';
import { storeSession } from '../../src/services/supabase';

// Mock rate limiting
jest.mock('../../src/middleware/rateLimit', () => ({
  sessionRateLimit: (req: any, res: any, next: any) => next(),
  boastRateLimit: (req: any, res: any, next: any) => next(),
  leaderboardRateLimit: (req: any, res: any, next: any) => next(),
}));

// Mock Goldsky subgraph (no real subgraph in tests)
jest.mock('../../src/services/goldsky', () => ({
  batchCheckBoastStatus: jest.fn().mockResolvedValue(new Map()),
  hasBoastForScore: jest.fn().mockResolvedValue(false),
  getPlayerBoasts: jest.fn().mockResolvedValue([]),
}));

describe('GET /leaderboard/:gameMode', () => {
  beforeEach(async () => {
    // Seed some test sessions
    const players = [
      '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
      '0x8888888888888888888888888888888888888888',
      '0x9999999999999999999999999999999999999999',
    ];

    for (let i = 0; i < players.length; i++) {
      await storeSession({
        playerId: players[i],
        gameMode: 'Classic',
        clientScore: (i + 1) * 1000,
        serverScore: (i + 1) * 1000,
        comboHighwater: 10 + i,
        durationSeconds: 60,
        clientTimestamp: new Date(),
        serverTimestamp: new Date(),
        inputEventCount: 50,
        scoreDivergence: 0.5,
        valid: true,
        rejectionReason: null,
        boastNonce: null,
        boastSignedAt: null,
      });
    }
  });

  it('should return leaderboard for Classic mode', async () => {
    const response = await request(app).get('/leaderboard/Classic').expect(200);

    expect(response.body).toHaveProperty('gameMode', 'Classic');
    expect(response.body).toHaveProperty('entries');
    expect(response.body).toHaveProperty('total');
    expect(Array.isArray(response.body.entries)).toBe(true);
    expect(response.body.entries.length).toBeGreaterThan(0);

    // Check entry structure
    const firstEntry = response.body.entries[0];
    expect(firstEntry).toHaveProperty('playerAddress');
    expect(firstEntry).toHaveProperty('score');
    expect(firstEntry).toHaveProperty('timestamp');
    expect(firstEntry).toHaveProperty('hasBoast');
    expect(firstEntry).toHaveProperty('gameMode');
    expect(firstEntry).toHaveProperty('comboHighwater');
  });

  it('should return leaderboard sorted by score descending', async () => {
    const response = await request(app).get('/leaderboard/Classic').expect(200);

    const scores = response.body.entries.map((e: any) => e.score);
    const sortedScores = [...scores].sort((a, b) => b - a);

    expect(scores).toEqual(sortedScores);
  });

  it('should reject invalid game mode', async () => {
    const response = await request(app).get('/leaderboard/InvalidMode').expect(400);

    expect(response.body.error).toBe('Invalid game mode');
  });

  it('should return empty leaderboard for mode with no scores', async () => {
    const response = await request(app).get('/leaderboard/Tournament').expect(200);

    expect(response.body.gameMode).toBe('Tournament');
    expect(response.body.entries).toEqual([]);
    expect(response.body.total).toBe(0);
  });

  it('should handle Zen mode', async () => {
    // Add a Zen mode session
    await storeSession({
      playerId: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
      gameMode: 'Zen',
      clientScore: 5000,
      serverScore: 5000,
      comboHighwater: 20,
      durationSeconds: 120,
      clientTimestamp: new Date(),
      serverTimestamp: new Date(),
      inputEventCount: 100,
      scoreDivergence: 0.3,
      valid: true,
      rejectionReason: null,
      boastNonce: null,
      boastSignedAt: null,
    });

    const response = await request(app).get('/leaderboard/Zen').expect(200);

    expect(response.body.gameMode).toBe('Zen');
    expect(response.body.entries.length).toBeGreaterThan(0);
  });

  it('should handle Arcade mode', async () => {
    const response = await request(app).get('/leaderboard/Arcade').expect(200);

    expect(response.body.gameMode).toBe('Arcade');
    expect(response.body).toHaveProperty('entries');
  });

  it('should include hasBoast field in entries', async () => {
    const response = await request(app).get('/leaderboard/Classic').expect(200);

    expect(response.body.entries.length).toBeGreaterThan(0);
    response.body.entries.forEach((entry: any) => {
      expect(entry).toHaveProperty('hasBoast');
      expect(typeof entry.hasBoast).toBe('boolean');
    });
  });
});

/**
 * Tournament Entry Integration Tests
 * ===================================
 * Test POST /tournament/:id/enter endpoint.
 */

import request from 'supertest';
import app from '../../src/index';
import { supabase } from '../../src/services/supabase';

// Mock auth middleware
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

// Mock rate limiting
jest.mock('../../src/middleware/rateLimit', () => ({
  sessionRateLimit: (req: any, res: any, next: any) => next(),
  boastRateLimit: (req: any, res: any, next: any) => next(),
  leaderboardRateLimit: (req: any, res: any, next: any) => next(),
}));

describe('POST /tournament/:id/enter', () => {
  const testPlayerAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';
  const testTournamentId = '1';

  beforeEach(async () => {
    // Create a test tournament
    await supabase.from('tournaments').insert({
      tournament_id: testTournamentId,
      status: 'Open',
      start_time: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      end_time: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
    });
  });

  afterEach(async () => {
    // Clean up
    await supabase.from('tournament_entries').delete().eq('tournament_id', testTournamentId);
    await supabase.from('tournaments').delete().eq('tournament_id', testTournamentId);
  });

  it('should allow eligible player to enter', async () => {
    const response = await request(app)
      .post(`/tournament/${testTournamentId}/enter`)
      .send({ playerAddress: testPlayerAddress })
      .expect(200);

    expect(response.body).toEqual({
      eligible: true,
      tournamentId: testTournamentId,
    });
  });

  it('should reject player who already entered', async () => {
    // Enter once
    await request(app)
      .post(`/tournament/${testTournamentId}/enter`)
      .send({ playerAddress: testPlayerAddress })
      .expect(200);

    // Try to enter again
    const response = await request(app)
      .post(`/tournament/${testTournamentId}/enter`)
      .send({ playerAddress: testPlayerAddress })
      .expect(200);

    expect(response.body.eligible).toBe(false);
    expect(response.body.reason).toContain('already entered');
  });

  it('should reject entry for closed tournament', async () => {
    // Create a closed tournament
    const closedTournamentId = '2';
    await supabase.from('tournaments').insert({
      tournament_id: closedTournamentId,
      status: 'Closed',
      start_time: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
      end_time: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago (ended)
    });

    const response = await request(app)
      .post(`/tournament/${closedTournamentId}/enter`)
      .send({ playerAddress: testPlayerAddress })
      .expect(200);

    expect(response.body.eligible).toBe(false);
    expect(response.body.reason).toContain('not open');

    // Cleanup
    await supabase.from('tournaments').delete().eq('tournament_id', closedTournamentId);
  });

  it('should reject entry for non-existent tournament', async () => {
    const fakeTournamentId = '99999';

    const response = await request(app)
      .post(`/tournament/${fakeTournamentId}/enter`)
      .send({ playerAddress: testPlayerAddress })
      .expect(200);

    expect(response.body.eligible).toBe(false);
    expect(response.body.reason).toContain('not open');
  });

  it('should reject invalid tournament ID format', async () => {
    const response = await request(app)
      .post('/tournament/not-numeric/enter')
      .send({ playerAddress: testPlayerAddress })
      .expect(400);

    expect(response.body.error).toBe('Invalid tournament ID');
  });

  it('should reject invalid player address format', async () => {
    const response = await request(app)
      .post(`/tournament/${testTournamentId}/enter`)
      .send({ playerAddress: 'not-an-address' })
      .expect(400);

    expect(response.body.error).toBe('Validation error');
  });

  it('should reject tournament not yet started', async () => {
    // Create a future tournament
    const futureTournamentId = '3';
    await supabase.from('tournaments').insert({
      tournament_id: futureTournamentId,
      status: 'Open',
      start_time: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
      end_time: new Date(Date.now() + 7200000).toISOString(), // 2 hours from now
    });

    const response = await request(app)
      .post(`/tournament/${futureTournamentId}/enter`)
      .send({ playerAddress: testPlayerAddress })
      .expect(200);

    expect(response.body.eligible).toBe(false);
    expect(response.body.reason).toContain('not open');

    // Cleanup
    await supabase.from('tournaments').delete().eq('tournament_id', futureTournamentId);
  });
});

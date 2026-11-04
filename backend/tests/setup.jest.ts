/**
 * Jest Test Setup
 * ================
 * Global test configuration and mocks.
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '3000';
process.env.LOG_LEVEL = 'error';

// Mock environment variables required by config
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';
process.env.MAGIC_SECRET_KEY = process.env.MAGIC_SECRET_KEY || 'sk_test_12345678901234567890';
process.env.BOAST_SIGNER_PRIVATE_KEY =
  process.env.BOAST_SIGNER_PRIVATE_KEY ||
  '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.GOLDSKY_SUBGRAPH_URL =
  process.env.GOLDSKY_SUBGRAPH_URL || 'http://localhost:8000/subgraphs/name/test';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
process.env.SCORE_TOLERANCE_PCT = '2.0';
process.env.SESSION_RATE_LIMIT = '10';
process.env.CORS_ORIGINS = '*';
process.env.TOURNAMENT_OPERATOR_PRIVATE_KEY =
  process.env.TOURNAMENT_OPERATOR_PRIVATE_KEY ||
  '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.TOURNAMENT_CONTRACT_ADDRESS =
  process.env.TOURNAMENT_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000001';
process.env.CELO_RPC_URL = process.env.CELO_RPC_URL || 'http://localhost:8545';

// Suppress console logs during tests (except errors)
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  // Keep error for debugging
};

// Mock Redis connection for unit tests
// Integration tests will use real Redis via testcontainers
jest.mock('../src/services/redis', () => {
  const mockRedis = {
    connect: jest.fn().mockResolvedValue(undefined),
    ping: jest.fn().mockResolvedValue('PONG'),
    zRemRangeByScore: jest.fn().mockResolvedValue(0),
    zCard: jest.fn().mockResolvedValue(0),
    zAdd: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
    incr: jest.fn().mockImplementation(() => {
      return Promise.resolve(Math.floor(Math.random() * 1000) + 1);
    }),
    setEx: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(null),
    quit: jest.fn().mockResolvedValue('OK'),
  };

  return {
    redis: mockRedis,
    checkRateLimit: jest.fn().mockResolvedValue({ allowed: true, remaining: 9 }),
    getNextBoastNonce: jest.fn().mockImplementation(() => {
      return Promise.resolve(Math.floor(Math.random() * 1000) + 1);
    }),
    cacheLeaderboard: jest.fn().mockResolvedValue(undefined),
    getCachedLeaderboard: jest.fn().mockResolvedValue(null),
    disconnectRedis: jest.fn().mockResolvedValue(undefined),
  };
});

// Increase timeout for all tests (useful for integration tests)
jest.setTimeout(60000);

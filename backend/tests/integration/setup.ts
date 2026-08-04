/**
 * Integration Test Setup
 * =======================
 * Spin up Postgres and Redis containers for integration tests.
 */

import { GenericContainer, StartedTestContainer } from 'testcontainers';
import { createClient } from '@supabase/supabase-js';
import { createClient as createRedisClient } from 'redis';

let postgresContainer: StartedTestContainer;
let redisContainer: StartedTestContainer;

export async function setupTestContainers() {
  console.log('Starting test containers...');

  // Start PostgreSQL
  postgresContainer = await new GenericContainer('postgres:15-alpine')
    .withEnvironment({
      POSTGRES_DB: 'test_db',
      POSTGRES_USER: 'test_user',
      POSTGRES_PASSWORD: 'test_password',
    })
    .withExposedPorts(5432)
    .start();

  const postgresHost = postgresContainer.getHost();
  const postgresPort = postgresContainer.getMappedPort(5432);
  const databaseUrl = `postgresql://test_user:test_password@${postgresHost}:${postgresPort}/test_db`;

  // Start Redis
  redisContainer = await new GenericContainer('redis:7-alpine')
    .withExposedPorts(6379)
    .start();

  const redisHost = redisContainer.getHost();
  const redisPort = redisContainer.getMappedPort(6379);
  const redisUrl = `redis://${redisHost}:${redisPort}`;

  // Set environment variables for tests
  process.env.SUPABASE_URL = `http://${postgresHost}:${postgresPort}`;
  process.env.DATABASE_URL = databaseUrl;
  process.env.REDIS_URL = redisUrl;
  process.env.REDIS_TLS = 'false';

  // Initialize database schema
  const supabase = createClient(
    process.env.SUPABASE_URL,
    'test-service-role-key', // Mock key for tests
    {
      auth: { autoRefreshToken: false, persistSession: false },
    }
  );

  // Create tables
  await createTestTables(databaseUrl);

  console.log('✓ Test containers ready');
  console.log(`  Postgres: ${databaseUrl}`);
  console.log(`  Redis: ${redisUrl}`);

  return { postgresContainer, redisContainer, databaseUrl, redisUrl };
}

export async function teardownTestContainers() {
  console.log('Stopping test containers...');

  if (postgresContainer) {
    await postgresContainer.stop();
  }

  if (redisContainer) {
    await redisContainer.stop();
  }

  console.log('✓ Test containers stopped');
}

async function createTestTables(databaseUrl: string) {
  // Use raw pg client to execute DDL
  const { Client } = require('pg');
  const client = new Client({ connectionString: databaseUrl });

  try {
    await client.connect();

    // Create tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS game_sessions (
        session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        player_id VARCHAR(42) NOT NULL,
        game_mode VARCHAR(20) NOT NULL,
        client_score INTEGER NOT NULL,
        server_score INTEGER NOT NULL,
        combo_highwater INTEGER NOT NULL,
        duration_seconds INTEGER NOT NULL,
        client_timestamp TIMESTAMPTZ NOT NULL,
        server_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        input_event_count INTEGER NOT NULL,
        score_divergence NUMERIC(5,2) NOT NULL,
        valid BOOLEAN NOT NULL,
        rejection_reason TEXT,
        boast_nonce INTEGER,
        boast_signed_at TIMESTAMPTZ
      );

      CREATE TABLE IF NOT EXISTS tournaments (
        tournament_id VARCHAR(50) PRIMARY KEY,
        status VARCHAR(20) NOT NULL,
        start_time TIMESTAMPTZ NOT NULL,
        end_time TIMESTAMPTZ NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tournament_entries (
        tournament_id VARCHAR(50) NOT NULL,
        player_address VARCHAR(42) NOT NULL,
        entered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (tournament_id, player_address)
      );
    `);

    console.log('✓ Test tables created');
  } finally {
    await client.end();
  }
}

// Global setup/teardown for Jest
export default async function globalSetup() {
  (global as any).__TEST_CONTAINERS__ = await setupTestContainers();
}

export async function globalTeardown() {
  await teardownTestContainers();
}

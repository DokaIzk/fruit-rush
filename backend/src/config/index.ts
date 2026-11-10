/**
 * Configuration Management
 * =========================
 * Centralized environment variable loading and validation.
 */

import * as dotenv from 'dotenv';
import { z } from 'zod';

// Load .env file
dotenv.config();

// Configuration schema
const ConfigSchema = z.object({
  // Server
  PORT: z.string().default('3000').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),

  // Magic.link
  MAGIC_SECRET_KEY: z.string().min(20),

  // Boast signing
  BOAST_SIGNER_PRIVATE_KEY: z.string().regex(/^0x[a-fA-F0-9]{64}$/),

  // Redis
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_TLS: z.string().transform(val => val === 'true').default('false'),

  // Goldsky
  GOLDSKY_SUBGRAPH_URL: z.string().url(),

  // Validation
  SCORE_TOLERANCE_PCT: z.string().default('2.0').transform(Number),
  SESSION_RATE_LIMIT: z.string().default('10').transform(Number),

  // CORS
  CORS_ORIGINS: z.string().default('*').transform(val =>
    val === '*' ? '*' : val.split(',').map(s => s.trim())
  ),

  // Tournament operator
  TOURNAMENT_OPERATOR_PRIVATE_KEY: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  TOURNAMENT_CONTRACT_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  CELO_RPC_URL: z.string().url(),
  TOURNAMENT_FAILURE_WEBHOOK_URL: z.preprocess(
    v => (typeof v === 'string' && v.trim() ? v : undefined),
    z.string().url().optional(),
  ),

  // Public site URL — used when the backend constructs shareable links (e.g. /boast/:id).
  PUBLIC_APP_URL: z.string().url().default('https://fruit-rush.xyz'),

  // Optional (empty values are treated as unset so .env.example templates are safe)
  SENTRY_DSN: z.preprocess(
    v => (typeof v === 'string' && v.trim() ? v : undefined),
    z.string().url().optional(),
  ),
});

// Parse and validate
const parsed = ConfigSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(JSON.stringify(parsed.error.format(), null, 2));
  process.exit(1);
}

export const config = parsed.data;

// Export individual values for convenience
export const {
  PORT,
  NODE_ENV,
  LOG_LEVEL,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  MAGIC_SECRET_KEY,
  BOAST_SIGNER_PRIVATE_KEY,
  REDIS_URL,
  REDIS_PASSWORD,
  REDIS_TLS,
  GOLDSKY_SUBGRAPH_URL,
  SCORE_TOLERANCE_PCT,
  SESSION_RATE_LIMIT,
  CORS_ORIGINS,
  TOURNAMENT_OPERATOR_PRIVATE_KEY,
  TOURNAMENT_CONTRACT_ADDRESS,
  CELO_RPC_URL,
  PUBLIC_APP_URL,
  TOURNAMENT_FAILURE_WEBHOOK_URL,
  SENTRY_DSN,
} = config;

/**
 * Zod Validation Schemas
 * =======================
 * Request/response validation using Zod for type safety and runtime checks.
 */

import { z } from 'zod';

// Game mode enum
export const GameModeSchema = z.enum(['Classic', 'Zen', 'Arcade', 'Tournament']);

// Input event schema
export const InputEventSchema = z.object({
  t: z.number().nonnegative().finite(),
  x: z.number().min(0).max(1).finite(),
  y: z.number().min(0).max(1).finite(),
  velocity: z.number().nonnegative().finite(),
});

// Game session result schema
export const GameSessionResultSchema = z.object({
  playerId: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
  score: z.number().int().nonnegative().max(10_000_000), // Max 10M score
  gameMode: GameModeSchema,
  comboHighwater: z.number().int().nonnegative().max(1000), // Max 1000 combo
  fruitsSliced: z.number().int().nonnegative().max(100_000).optional(), // Cross-check consistency
  durationSeconds: z.number().positive().max(600), // Max 10 minutes
  clientTimestamp: z.number().int().positive(),
  inputEventLog: z.array(InputEventSchema).min(1).max(10_000), // Max 10K events
});

// Boast signature request schema
export const BoastSignatureRequestSchema = z.object({
  sessionId: z.string().uuid(),
});

// Tournament eligibility request schema
export const TournamentEligibilityRequestSchema = z.object({
  playerAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
});

// Leaderboard game mode param schema
export const LeaderboardGameModeSchema = z.object({
  gameMode: GameModeSchema,
});

// Tournament ID param schema
export const TournamentIdSchema = z.object({
  id: z.string().regex(/^\d+$/, 'Tournament ID must be numeric'),
});

// Type exports
export type GameSessionResultInput = z.infer<typeof GameSessionResultSchema>;
export type BoastSignatureRequestInput = z.infer<typeof BoastSignatureRequestSchema>;
export type TournamentEligibilityRequestInput = z.infer<typeof TournamentEligibilityRequestSchema>;

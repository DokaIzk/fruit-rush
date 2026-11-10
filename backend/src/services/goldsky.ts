/**
 * Goldsky Subgraph Service
 * =========================
 * Query on-chain boast data from Goldsky-indexed subgraph.
 */

import { GraphQLClient, gql } from 'graphql-request';
import { GOLDSKY_SUBGRAPH_URL } from '../config';

// Initialize GraphQL client
const client = new GraphQLClient(GOLDSKY_SUBGRAPH_URL);

/**
 * Check if a player has minted a boast for a specific score.
 * 
 * @param playerAddress - Player's wallet address
 * @param score - Score to check
 * @param gameMode - Game mode
 * @returns true if boast exists on-chain
 */
export async function hasBoastForScore(
  playerAddress: string,
  score: number,
  gameMode: string
): Promise<boolean> {
  const query = gql`
    query GetBoast($player: String!, $score: BigInt!, $gameMode: String!) {
      boasts(
        where: {
          player: $player
          score: $score
          gameMode: $gameMode
        }
        first: 1
      ) {
        id
        boastId
        player
        score
        gameMode
        timestamp
      }
    }
  `;

  try {
    const data: any = await client.request(query, {
      player: playerAddress.toLowerCase(), // Subgraph stores addresses lowercase
      score: score.toString(), // BigInt as string
      gameMode,
    });

    return data.boasts && data.boasts.length > 0;
  } catch (error) {
    // One warning line, no stack — failures are non-fatal (fail open).
    console.warn('Goldsky subgraph query failed:', error instanceof Error ? error.message : String(error));
    return false; // Fail open (assume no boast if query fails)
  }
}

/**
 * Get all boasts for a player (for profile page).
 * 
 * @param playerAddress - Player's wallet address
 * @param limit - Max number of boasts to return
 * @returns Array of boast records
 */
export async function getPlayerBoasts(
  playerAddress: string,
  limit: number = 10
): Promise<
  Array<{
    boastId: string;
    score: number;
    gameMode: string;
    timestamp: number;
  }>
> {
  const query = gql`
    query GetPlayerBoasts($player: String!, $limit: Int!) {
      boasts(
        where: { player: $player }
        orderBy: score
        orderDirection: desc
        first: $limit
      ) {
        boastId
        score
        gameMode
        timestamp
      }
    }
  `;

  try {
    const data: any = await client.request(query, {
      player: playerAddress.toLowerCase(),
      limit,
    });

    return (data.boasts || []).map((boast: any) => ({
      boastId: boast.boastId,
      score: parseInt(boast.score),
      gameMode: boast.gameMode,
      timestamp: parseInt(boast.timestamp),
    }));
  } catch (error) {
    // One warning line, no stack — failures are non-fatal (fail open).
    console.warn('Goldsky subgraph query failed:', error instanceof Error ? error.message : String(error));
    return [];
  }
}

/**
 * Batch check boast status for multiple players (for leaderboard).
 * 
 * @param playerScores - Array of { playerAddress, score, gameMode }
 * @returns Map of playerAddress → hasBoast
 */
export async function batchCheckBoastStatus(
  playerScores: Array<{ playerAddress: string; score: number; gameMode: string }>
): Promise<Map<string, boolean>> {
  const query = gql`
    query BatchCheckBoasts($players: [String!]!) {
      boasts(where: { player_in: $players }, first: 1000) {
        player
        score
        gameMode
      }
    }
  `;

  const result = new Map<string, boolean>();

  // Nothing to look up — skip the subgraph round-trip entirely.
  if (playerScores.length === 0) {
    return result;
  }

  try {
    const data: any = await client.request(query, {
      players: playerScores.map(p => p.playerAddress.toLowerCase()),
    });

    // Build lookup set for faster checking
    const boastSet = new Set<string>();
    (data.boasts || []).forEach((boast: any) => {
      const key = `${boast.player}-${boast.score}-${boast.gameMode}`;
      boastSet.add(key);
    });

    // Check each player/score combo
    playerScores.forEach(({ playerAddress, score, gameMode }) => {
      const key = `${playerAddress.toLowerCase()}-${score}-${gameMode}`;
      result.set(playerAddress, boastSet.has(key));
    });
  } catch (error) {
    // One warning line, no stack — failures are non-fatal (fail open).
    console.warn('Goldsky batch query failed:', error instanceof Error ? error.message : String(error));
    // Fail open: mark all as no boast
    playerScores.forEach(({ playerAddress }) => {
      result.set(playerAddress, false);
    });
  }

  return result;
}

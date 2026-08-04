/**
 * Tournament Contract Service
 * ============================
 * Handles all on-chain interactions with FruitRushTournament contract.
 */

import { ethers } from 'ethers';
import {
  CELO_RPC_URL,
  TOURNAMENT_OPERATOR_PRIVATE_KEY,
  TOURNAMENT_CONTRACT_ADDRESS,
  NODE_ENV,
} from '../config';

// FruitRushTournament ABI (only functions we need)
const TOURNAMENT_ABI = [
  // createTournament(uint256 tournamentId, uint256 entryFee, uint256 startTime, uint256 endTime, uint256[] prizeSharesBps)
  'function createTournament(uint256 tournamentId, uint256 entryFee, uint256 startTime, uint256 endTime, uint256[] calldata prizeSharesBps) external',
  
  // finalize(uint256 tournamentId, address[] rankedWinners)
  'function finalize(uint256 tournamentId, address[] calldata rankedWinners) external',
  
  // refund(uint256 tournamentId)
  'function refund(uint256 tournamentId) external',
  
  // getTournament(uint256 tournamentId) returns (entryFee, startTime, endTime, totalPool, entrantCount, status, prizeSharesBps)
  'function getTournament(uint256 tournamentId) external view returns (uint256 entryFee, uint256 startTime, uint256 endTime, uint256 totalPool, uint256 entrantCount, uint8 status, uint256[] memory prizeSharesBps)',
  
  // Events
  'event TournamentCreated(uint256 indexed tournamentId, uint256 entryFee, uint256 startTime, uint256 endTime, uint256[] prizeSharesBps)',
  'event TournamentFinalized(uint256 indexed tournamentId, address[] winners, uint256[] payouts, uint256 rake)',
  'event TournamentRefunded(uint256 indexed tournamentId, uint256 totalRefunded, uint256 entrantCount)',
];

// Provider and wallet setup
const provider = new ethers.JsonRpcProvider(CELO_RPC_URL);
const operatorWallet = new ethers.Wallet(TOURNAMENT_OPERATOR_PRIVATE_KEY, provider);
const tournamentContract = new ethers.Contract(
  TOURNAMENT_CONTRACT_ADDRESS,
  TOURNAMENT_ABI,
  operatorWallet
);

/**
 * Create a new tournament on-chain.
 * 
 * @param tournamentId - Unique tournament identifier
 * @param entryFeeWei - Entry fee in cUSD wei (18 decimals)
 * @param startTime - Unix timestamp
 * @param endTime - Unix timestamp
 * @param prizeSharesBps - Prize distribution in basis points (must sum to ≤8500)
 * @returns Transaction hash
 */
export async function createTournamentOnChain(
  tournamentId: number,
  entryFeeWei: bigint,
  startTime: number,
  endTime: number,
  prizeSharesBps: number[]
): Promise<string> {
  try {
    console.log(`[Tournament] Creating tournament ${tournamentId} on-chain...`);
    
    const tx = await tournamentContract.createTournament(
      tournamentId,
      entryFeeWei,
      startTime,
      endTime,
      prizeSharesBps
    );

    console.log(`[Tournament] Transaction sent: ${tx.hash}`);
    
    const receipt = await tx.wait();
    
    if (receipt.status === 0) {
      throw new Error(`Transaction failed: ${tx.hash}`);
    }

    console.log(`[Tournament] Tournament ${tournamentId} created successfully (tx: ${tx.hash})`);
    return tx.hash;
  } catch (error) {
    console.error(`[Tournament] Failed to create tournament ${tournamentId}:`, error);
    throw new Error(`On-chain tournament creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Finalize a tournament with ranked winners.
 * 
 * @param tournamentId - Tournament identifier
 * @param rankedWinners - Ordered list of winner addresses (1st place first)
 * @returns Transaction hash
 */
export async function finalizeTournamentOnChain(
  tournamentId: number,
  rankedWinners: string[]
): Promise<string> {
  try {
    console.log(`[Tournament] Finalizing tournament ${tournamentId} with ${rankedWinners.length} winners...`);
    
    // Validate addresses
    for (const addr of rankedWinners) {
      if (!ethers.isAddress(addr)) {
        throw new Error(`Invalid winner address: ${addr}`);
      }
    }

    const tx = await tournamentContract.finalize(tournamentId, rankedWinners);

    console.log(`[Tournament] Finalization transaction sent: ${tx.hash}`);
    
    const receipt = await tx.wait();
    
    if (receipt.status === 0) {
      throw new Error(`Transaction failed: ${tx.hash}`);
    }

    console.log(`[Tournament] Tournament ${tournamentId} finalized successfully (tx: ${tx.hash})`);
    return tx.hash;
  } catch (error) {
    console.error(`[Tournament] Failed to finalize tournament ${tournamentId}:`, error);
    throw new Error(`On-chain finalization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Refund a tournament (emergency cancellation).
 * 
 * @param tournamentId - Tournament identifier
 * @returns Transaction hash
 */
export async function refundTournamentOnChain(tournamentId: number): Promise<string> {
  try {
    console.log(`[Tournament] Refunding tournament ${tournamentId}...`);
    
    const tx = await tournamentContract.refund(tournamentId);

    console.log(`[Tournament] Refund transaction sent: ${tx.hash}`);
    
    const receipt = await tx.wait();
    
    if (receipt.status === 0) {
      throw new Error(`Transaction failed: ${tx.hash}`);
    }

    console.log(`[Tournament] Tournament ${tournamentId} refunded successfully (tx: ${tx.hash})`);
    return tx.hash;
  } catch (error) {
    console.error(`[Tournament] Failed to refund tournament ${tournamentId}:`, error);
    throw new Error(`On-chain refund failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get tournament details from contract.
 * 
 * @param tournamentId - Tournament identifier
 * @returns Tournament data
 */
export async function getTournamentFromChain(tournamentId: number) {
  try {
    const [entryFee, startTime, endTime, totalPool, entrantCount, status, prizeSharesBps] =
      await tournamentContract.getTournament(tournamentId);

    return {
      entryFee,
      startTime: Number(startTime),
      endTime: Number(endTime),
      totalPool,
      entrantCount: Number(entrantCount),
      status: ['Pending', 'Open', 'Closed', 'Finalized', 'Refunded'][status] as
        'Pending' | 'Open' | 'Closed' | 'Finalized' | 'Refunded',
      prizeSharesBps: prizeSharesBps.map(Number),
    };
  } catch (error) {
    console.error(`[Tournament] Failed to get tournament ${tournamentId} from chain:`, error);
    throw new Error(`Failed to fetch tournament data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get operator wallet address (for logging, never expose private key).
 */
export function getOperatorAddress(): string {
  return operatorWallet.address;
}

// Log operator address on startup (never log private key!)
if (NODE_ENV !== 'test') {
  console.log(`[Tournament] Operator wallet: ${operatorWallet.address}`);
  console.log(`[Tournament] Contract address: ${TOURNAMENT_CONTRACT_ADDRESS}`);
}

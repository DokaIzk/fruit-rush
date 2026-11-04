/**
 * Boast Signing Service
 * ======================
 * ECDSA signature generation for on-chain boast attestations.
 */

import { Wallet, keccak256, solidityPacked, getBytes, verifyMessage } from 'ethers';
import { BOAST_SIGNER_PRIVATE_KEY } from '../config';
import { getNextBoastNonce } from './redis';

// Initialize wallet from private key
const signerWallet = new Wallet(BOAST_SIGNER_PRIVATE_KEY);

// Log signer address on startup (for verification)
console.log(`✓ Boast signer address: ${signerWallet.address}`);

/**
 * Sign a boast attestation for on-chain submission.
 * 
 * Signature scheme (matches FruitRushBoast.sol):
 * 1. Compute hash: keccak256(abi.encodePacked(player, score, gameMode, nonce))
 * 2. Wrap with Ethereum signed-message prefix (eth_sign / personal_sign)
 * 3. Sign with ECDSA using the trusted signer private key
 * 
 * @param playerAddress - Player's wallet address
 * @param score - Server-validated score
 * @param gameMode - Game mode string
 * @returns { signature, nonce, signerAddress }
 */
export async function signBoast(
  playerAddress: string,
  score: number,
  gameMode: string
): Promise<{
  signature: string;
  nonce: number;
  signerAddress: string;
}> {
  // Get next nonce for this player (prevents replay attacks)
  const nonce = await getNextBoastNonce(playerAddress);

  // Encode packed data (matches Solidity abi.encodePacked)
  // Types: address, uint256, string, uint256
  const messageHash = keccak256(
    solidityPacked(
      ['address', 'uint256', 'string', 'uint256'],
      [playerAddress, score, gameMode, nonce]
    )
  );

  // Sign the message (ethers automatically adds Ethereum signed-message prefix)
  const signature = await signerWallet.signMessage(getBytes(messageHash));

  return {
    signature,
    nonce,
    signerAddress: signerWallet.address,
  };
}

/**
 * Verify a boast signature (for testing/debugging).
 * 
 * @returns true if signature is valid
 */
export function verifyBoastSignature(
  playerAddress: string,
  score: number,
  gameMode: string,
  nonce: number,
  signature: string
): boolean {
  try {
    const messageHash = keccak256(
      solidityPacked(
        ['address', 'uint256', 'string', 'uint256'],
        [playerAddress, score, gameMode, nonce]
      )
    );

    const recoveredAddress = verifyMessage(getBytes(messageHash), signature);
    return recoveredAddress.toLowerCase() === signerWallet.address.toLowerCase();
  } catch (error) {
    return false;
  }
}

/**
 * Get the signer's public address (for contract configuration).
 */
export function getSignerAddress(): string {
  return signerWallet.address;
}

/**
 * Boast Signer Unit Tests
 * ========================
 * Test ECDSA signature generation and verification.
 */

import { signBoast, verifyBoastSignature, getSignerAddress } from '../../src/services/signer';

// Mock Redis for testing
jest.mock('../../src/services/redis', () => ({
  getNextBoastNonce: jest.fn().mockResolvedValue(1),
}));

describe('Boast Signer', () => {
  const testPlayerAddress = '0x0000000000000000000000000000000000000001';
  const testScore = 12450;
  const testGameMode = 'Classic';

  beforeAll(() => {
    // Set test private key
    process.env.BOAST_SIGNER_PRIVATE_KEY =
      '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  });

  describe('signBoast', () => {
    it('should generate a valid signature', async () => {
      const result = await signBoast(testPlayerAddress, testScore, testGameMode);

      expect(result.signature).toBeDefined();
      expect(result.signature).toMatch(/^0x[a-fA-F0-9]{130}$/); // 65 bytes = 130 hex chars
      expect(result.nonce).toBe(1);
      expect(result.signerAddress).toBeDefined();
      expect(result.signerAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });

    it('should generate different signatures for different inputs', async () => {
      const sig1 = await signBoast(testPlayerAddress, 100, 'Classic');
      const sig2 = await signBoast(testPlayerAddress, 200, 'Classic');

      expect(sig1.signature).not.toBe(sig2.signature);
    });

    it('should generate different signatures for different game modes', async () => {
      const sig1 = await signBoast(testPlayerAddress, testScore, 'Classic');
      const sig2 = await signBoast(testPlayerAddress, testScore, 'Zen');

      expect(sig1.signature).not.toBe(sig2.signature);
    });
  });

  describe('verifyBoastSignature', () => {
    it('should verify a valid signature', async () => {
      const { signature, nonce } = await signBoast(testPlayerAddress, testScore, testGameMode);

      const isValid = verifyBoastSignature(
        testPlayerAddress,
        testScore,
        testGameMode,
        nonce,
        signature
      );

      expect(isValid).toBe(true);
    });

    it('should reject invalid signature', () => {
      const fakeSignature = '0x' + '00'.repeat(65);

      const isValid = verifyBoastSignature(
        testPlayerAddress,
        testScore,
        testGameMode,
        1,
        fakeSignature
      );

      expect(isValid).toBe(false);
    });

    it('should reject signature with wrong player address', async () => {
      const { signature, nonce } = await signBoast(testPlayerAddress, testScore, testGameMode);

      const isValid = verifyBoastSignature(
        '0x0000000000000000000000000000000000000002',
        testScore,
        testGameMode,
        nonce,
        signature
      );

      expect(isValid).toBe(false);
    });

    it('should reject signature with wrong score', async () => {
      const { signature, nonce } = await signBoast(testPlayerAddress, testScore, testGameMode);

      const isValid = verifyBoastSignature(
        testPlayerAddress,
        testScore + 1,
        testGameMode,
        nonce,
        signature
      );

      expect(isValid).toBe(false);
    });

    it('should reject signature with wrong game mode', async () => {
      const { signature, nonce } = await signBoast(testPlayerAddress, testScore, 'Classic');

      const isValid = verifyBoastSignature(testPlayerAddress, testScore, 'Zen', nonce, signature);

      expect(isValid).toBe(false);
    });

    it('should reject signature with wrong nonce', async () => {
      const { signature, nonce } = await signBoast(testPlayerAddress, testScore, testGameMode);

      const isValid = verifyBoastSignature(
        testPlayerAddress,
        testScore,
        testGameMode,
        nonce + 1,
        signature
      );

      expect(isValid).toBe(false);
    });
  });

  describe('getSignerAddress', () => {
    it('should return a valid Ethereum address', () => {
      const address = getSignerAddress();

      expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });

    it('should return consistent address', () => {
      const addr1 = getSignerAddress();
      const addr2 = getSignerAddress();

      expect(addr1).toBe(addr2);
    });
  });
});

/**
 * Replay Simulator Unit Tests
 * ============================
 * Test the core score validation logic.
 */

import { replaySimulation, _testing } from '../../src/validator/replaySimulator';
import { InputEvent } from '../../src/types/session';

const { validateInputLog, SIMULATION_TIMESTEP_MS, COLLISION_THRESHOLD } = _testing;

describe('Replay Simulator', () => {
  describe('validateInputLog', () => {
    it('should accept valid input log', () => {
      const events: InputEvent[] = [
        { t: 0, x: 0.5, y: 0.5, velocity: 0.8 },
        { t: 100, x: 0.6, y: 0.6, velocity: 1.0 },
        { t: 200, x: 0.7, y: 0.7, velocity: 0.9 },
      ];

      const result = validateInputLog(events, 1);
      expect(result.valid).toBe(true);
      expect(result.reason).toBeNull();
    });

    it('should reject empty input log', () => {
      const result = validateInputLog([], 1);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Empty input log');
    });

    it('should reject out-of-bounds timestamps', () => {
      const events: InputEvent[] = [
        { t: -10, x: 0.5, y: 0.5, velocity: 0.8 },
      ];

      const result = validateInputLog(events, 1);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('outside session bounds');
    });

    it('should reject out-of-bounds coordinates', () => {
      const events: InputEvent[] = [
        { t: 100, x: 1.5, y: 0.5, velocity: 0.8 },
      ];

      const result = validateInputLog(events, 1);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('out of bounds');
    });

    it('should detect impossible teleportation', () => {
      const events: InputEvent[] = [
        { t: 0, x: 0.0, y: 0.0, velocity: 0.8 },
        { t: 10, x: 1.0, y: 1.0, velocity: 0.8 }, // Instant teleport
      ];

      const result = validateInputLog(events, 1);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('teleportation');
    });

    it('should detect superhuman input rate', () => {
      // Generate 101 events in <1 second
      const events: InputEvent[] = Array.from({ length: 101 }, (_, i) => ({
        t: i * 9, // 9ms apart = 111 inputs/sec
        x: 0.5,
        y: 0.5,
        velocity: 0.8,
      }));

      const result = validateInputLog(events, 2);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Superhuman input rate');
    });
  });

  describe('replaySimulation', () => {
    it('should validate a simple session with no input', () => {
      const events: InputEvent[] = [
        { t: 0, x: 0.5, y: 0.5, velocity: 0.8 },
      ];

      const result = replaySimulation(events, 0, 'Classic', 1);

      expect(result.valid).toBe(true);
      expect(result.serverScore).toBe(0); // No fruits sliced
      expect(result.divergence).toBe(0);
      expect(result.rejectionReason).toBeNull();
    });

    it('should accept score within 2% tolerance', () => {
      const events: InputEvent[] = [
        { t: 850, x: 0.5, y: 0.5, velocity: 1.0 },
        { t: 1700, x: 0.5, y: 0.5, velocity: 1.0 },
        { t: 2550, x: 0.5, y: 0.5, velocity: 1.0 },
      ];

      const clientScore = 35; // Assume client reported this
      const result = replaySimulation(events, clientScore, 'Classic', 3);

      // Should accept if divergence < 2%
      if (result.serverScore > 0) {
        const expectedDivergence = Math.abs(result.serverScore - clientScore) / clientScore * 100;
        expect(result.divergence).toBeCloseTo(expectedDivergence, 1);
        
        if (result.divergence <= 2.0) {
          expect(result.valid).toBe(true);
        } else {
          expect(result.valid).toBe(false);
        }
      }
    });

    it('should reject score with >2% divergence', () => {
      const events: InputEvent[] = [
        { t: 850, x: 0.5, y: 0.5, velocity: 1.0 },
      ];

      const clientScore = 1000; // Way higher than possible
      const result = replaySimulation(events, clientScore, 'Classic', 1);

      expect(result.valid).toBe(false);
      expect(result.divergence).toBeGreaterThan(2.0);
      expect(result.rejectionReason).toContain('divergence');
      expect(result.rejectionReason).toContain('exceeds');
    });

    it('should handle empty score correctly', () => {
      const events: InputEvent[] = [
        { t: 100, x: 0.0, y: 0.0, velocity: 0.5 }, // Far from fruits
      ];

      const result = replaySimulation(events, 0, 'Classic', 1);

      expect(result.valid).toBe(true);
      expect(result.serverScore).toBe(0);
    });

    it('should reject session with invalid input patterns', () => {
      const events: InputEvent[] = [
        { t: -100, x: 0.5, y: 0.5, velocity: 0.8 }, // Negative timestamp
      ];

      const result = replaySimulation(events, 100, 'Classic', 1);

      expect(result.valid).toBe(false);
      expect(result.rejectionReason).toContain('outside session bounds');
    });

    it('should handle tournament mode', () => {
      const events: InputEvent[] = [
        { t: 850, x: 0.5, y: 0.5, velocity: 1.0 },
      ];

      const result = replaySimulation(events, 15, 'Tournament', 2);

      // Should validate same as other modes
      expect(result.valid).toBeDefined();
      expect(result.serverScore).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Constants', () => {
    it('should have reasonable simulation timestep', () => {
      expect(SIMULATION_TIMESTEP_MS).toBe(10);
    });

    it('should have reasonable collision threshold', () => {
      expect(COLLISION_THRESHOLD).toBe(90); // 50px swipe + 40px fruit
    });
  });
});

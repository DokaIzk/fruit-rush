/**
 * Replay Simulator Unit Tests
 * ============================
 * Test the core score validation logic.
 */

import { replaySimulation, _testing } from '../../src/validator/replaySimulator';
import { InputEvent } from '../../src/types/session';

const { validateInputLog } = _testing;

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
      // Generate 101 events in <500ms — 200+ inputs/sec, synthetic rate
      // (legit trail sampling is ~60Hz per touch).
      const events: InputEvent[] = Array.from({ length: 101 }, (_, i) => ({
        t: i * 4, // 4ms apart = 250 inputs/sec
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
      expect(result.divergence).toBeLessThanOrEqual(100);
      expect(result.rejectionReason).toBeNull();
    });

    it('should accept an honest score within the plausibility bound', () => {
      // A dense trail like the client records (multi-point strokes).
      const events: InputEvent[] = [];
      for (let stroke = 0; stroke < 8; stroke++) {
        for (let i = 0; i < 10; i++) {
          events.push({
            t: stroke * 1200 + i * 16,
            x: 0.2 + stroke * 0.08,
            y: 0.2 + i * 0.06,
            velocity: 1.0,
          });
        }
      }

      const result = replaySimulation(events, 85, 'Classic', 13, 8, 4);
      expect(result.valid).toBe(true);
      expect(result.rejectionReason).toBeNull();
    });

    it('should reject a score above the plausibility bound', () => {
      const events: InputEvent[] = [
        { t: 100, x: 0.5, y: 0.5, velocity: 1.0 },
        { t: 116, x: 0.55, y: 0.55, velocity: 1.0 },
        { t: 132, x: 0.6, y: 0.6, velocity: 1.0 },
      ];

      // 1s run: max 3 fruits × 50 pts = 150
      const result = replaySimulation(events, 10_000, 'Classic', 1);

      expect(result.valid).toBe(false);
      expect(result.rejectionReason).toContain('plausibility bound');
    });

    it('should reject a score inconsistent with the reported slice count', () => {
      const events: InputEvent[] = [];
      for (let stroke = 0; stroke < 6; stroke++) {
        for (let i = 0; i < 10; i++) {
          events.push({
            t: stroke * 1200 + i * 16,
            x: 0.2 + stroke * 0.08,
            y: 0.2 + i * 0.06,
            velocity: 1.0,
          });
        }
      }

      // 5 slices × 50 max pts = 250 ceiling — 900 is impossible
      const result = replaySimulation(events, 900, 'Classic', 10, 5, 2);
      expect(result.valid).toBe(false);
      expect(result.rejectionReason).toContain('slices');

      // Combo higher than the slice count is impossible too
      const result2 = replaySimulation(events, 50, 'Classic', 10, 3, 9);
      expect(result2.valid).toBe(false);
      expect(result2.rejectionReason).toContain('Combo');
    });

    it('should reject a nonzero score with an empty trail', () => {
      const events: InputEvent[] = [
        { t: 100, x: 0.5, y: 0.5, velocity: 1.0 },
      ];

      const result = replaySimulation(events, 300, 'Classic', 1);
      expect(result.valid).toBe(false);
      expect(result.rejectionReason).toContain('input events');
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
        { t: 0, x: 0.5, y: 0.5, velocity: 1.0 },
        { t: 16, x: 0.52, y: 0.52, velocity: 1.0 },
        { t: 32, x: 0.54, y: 0.54, velocity: 1.0 },
      ];

      const result = replaySimulation(events, 25, 'Tournament', 2, 2, 1);

      expect(result.valid).toBe(true);
      expect(result.serverScore).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Constants', () => {
    it('should have a reasonable simulation timestep', () => {
      expect(_testing.SIMULATION_TIMESTEP_S).toBeCloseTo(0.01);
    });

    it('should use an aspect-free fruit radius close to the client hitbox', () => {
      // Client radii are 26–32 px on a ~900px viewport → ~0.03–0.065.
      expect(_testing.FRUIT_RADIUS).toBeGreaterThan(0.02);
      expect(_testing.FRUIT_RADIUS).toBeLessThan(0.08);
    });

    it('should use the client spawn cadence per mode', () => {
      expect(_testing.SPAWN_GAP_MS.Classic).toBe(520);
      expect(_testing.SPAWN_GAP_MS.Zen).toBe(700);
      expect(_testing.SPAWN_GAP_MS.Arcade).toBe(400);
    });
  });
});

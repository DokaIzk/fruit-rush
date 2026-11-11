/**
 * Replay Sanity Validator
 * =======================
 * Server-side sanity check for a claimed game session.
 *
 * ## Why not score parity?
 *
 * The server does not know which fruits the client spawned (spawns are
 * randomized client-side and never transmitted), so re-simulating "the run"
 * can only ever produce a *statistically similar* score, not the actual one.
 * Exact parity within a few percent is therefore impossible by design, and
 * the original parity gate rejected every honest run (divergence 100%).
 *
 * Instead this module:
 *
 * 1. Hard-gates the input log on impossibility (bounds, teleportation,
 *    superhuman input rate) — a forged packet still fails here.
 * 2. Gates the claimed score against a plausibility bound derived from the
 *    fastest possible spawn cadence for the mode and the maximum points a
 *    single fruit can ever award (base 15 × combo cap 3 × velocity bonus
 *    1.1 ≈ 50). Falling below the floor implied by the reported
 *    `fruitsSliced` count is equally impossible.
 * 3. Runs a corrected physics replay as a *diagnostic* score (logged and
 *    stored, not gating): fruits now launch in arcs configured per game
 *    mode and slicing uses the same segment/radius geometry as the client.
 *
 * Security properties preserved:
 * ✅ Prevents gross score inflation (10M-in-10s packets fail the bound)
 * ✅ Detects replay/teleport/superhuman-rate forgeries
 * ✅ Consistency between score, fruitsSliced and comboHighwater
 * ⚠️ Does NOT prevent aim bots or fine-grained score inflation within the
 *    plausibility bound — acceptable; session authenticity is ultimately
 *    carried by the Magic-authenticated session and boast signing.
 */

import { InputEvent, GameMode } from '../types/session';

// Simulation constants — normalized screen units at *second* scale, ported
// from the client's physics (client/src/game/FruitRushGame.ts):
// client GRAVITY = 1150 px/s² on a ~900px-tall phone viewport ≈ 1.28 /s².
const SIMULATION_TIMESTEP_S = 0.01;
const GRAVITY_UNITS_PER_S2 = 1.28;
const APEX_MIN = 0.45; // fraction of screen height (client: 0.45 + rnd*0.37)
const APEX_RANGE = 0.37;
const FRUIT_RADIUS = 0.055; // client radii 26–32 px ≈ 0.03–0.065 of height
const SWIPE_GAP_MS = 150; // input gap longer than this means the stroke ended
const SPAWN_GAP_MS: Record<GameMode, number> = {
  Classic: 520, // client spawnMinMs
  Zen: 700,
  Arcade: 400,
  Tournament: 520,
};
// Max points a single fruit can award: 15 (watermelon) × combo cap 3 × velocity bonus 1.1.
const MAX_POINTS_PER_FRUIT = 50;
// Min base points a fruit can award (orange/apple 10 × combo ≥ 1).
const MIN_POINTS_PER_FRUIT = 10;

interface Fruit {
  x: number; // 0..1 (x normalized to screen height for aspect-free distance)
  y: number; // 1 = bottom, 0 = top
  vx: number; // units/s
  vy: number; // units/s (negative = upward)
  active: boolean;
}

interface SimState {
  fruits: Fruit[];
  score: number;
  combo: number;
  lastSliceTimeS: number;
  nextSpawnS: number;
}

/**
 * Replay-validate a claimed session.
 *
 * @param inputEventLog - Client-recorded input event trail
 * @param clientScore - Claimed score
 * @param gameMode - Game mode (drives spawn cadence for the bound)
 * @param durationSeconds - Session duration
 * @param fruitsSliced - Optional client-reported slice count (tightens consistency)
 * @param comboHighwater - Optional client-reported best combo (tightens consistency)
 */
export function replaySimulation(
  inputEventLog: InputEvent[],
  clientScore: number,
  gameMode: GameMode,
  durationSeconds: number,
  fruitsSliced?: number,
  comboHighwater?: number
): {
  serverScore: number;
  valid: boolean;
  divergence: number;
  rejectionReason: string | null;
} {
  // 1. Hard gates: impossible input patterns
  const inputValidation = validateInputLog(inputEventLog, durationSeconds);
  if (!inputValidation.valid) {
    return {
      serverScore: 0,
      valid: false,
      divergence: 100,
      rejectionReason: inputValidation.reason!,
    };
  }

  // 2. Plausibility gates on the claimed score
  const plausibility = checkScorePlausibility(
    clientScore,
    gameMode,
    durationSeconds,
    inputEventLog.length,
    fruitsSliced,
    comboHighwater
  );
  if (!plausibility.valid) {
    return {
      serverScore: 0,
      valid: false,
      divergence: 100,
      rejectionReason: plausibility.reason!,
    };
  }

  // 3. Diagnostic replay (non-gating): corrected physics so the simulated
  // score is meaningful telemetry about input density.
  const serverScore = Math.round(runDiagnosticReplay(inputEventLog, gameMode, durationSeconds));
  const divergence = Math.abs(clientScore - serverScore) / Math.max(clientScore, 1) * 100;

  return {
    serverScore,
    valid: true,
    divergence,
    rejectionReason: null,
  };
}

/**
 * Plausibility bound for the claimed score.
 */
function checkScorePlausibility(
  clientScore: number,
  gameMode: GameMode,
  durationSeconds: number,
  eventCount: number,
  fruitsSliced?: number,
  comboHighwater?: number
): { valid: boolean; reason: string | null } {
  if (clientScore <= 0) return { valid: true, reason: null };

  // A score implies some input existed.
  if (eventCount < 3) {
    return { valid: false, reason: `Score ${clientScore} claimed with only ${eventCount} input events` };
  }

  // Max fruits that could possibly spawn in this duration at the mode's
  // fastest spawn cadence.
  const maxFruits = Math.ceil((durationSeconds * 1000) / SPAWN_GAP_MS[gameMode]);
  const maxScore = maxFruits * MAX_POINTS_PER_FRUIT;
  if (clientScore > maxScore) {
    return {
      valid: false,
      reason: `Score ${clientScore} exceeds plausibility bound ${maxScore} (${maxFruits} max fruits × ${MAX_POINTS_PER_FRUIT} pts)`,
    };
  }

  // Cross-check the claimed slice count when present: score = Σ fruit points
  // × combo multiplier ⇒ floor/ceiling of points per slice.
  if (typeof fruitsSliced === 'number') {
    if (clientScore > 0 && fruitsSliced <= 0) {
      return { valid: false, reason: `Score ${clientScore} claimed with ${fruitsSliced} slices` };
    }
    if (clientScore < MIN_POINTS_PER_FRUIT * fruitsSliced) {
      return {
        valid: false,
        reason: `Score ${clientScore} too low for ${fruitsSliced} slices (min ${MIN_POINTS_PER_FRUIT} pts each)`,
      };
    }
    if (clientScore > MAX_POINTS_PER_FRUIT * fruitsSliced) {
      return {
        valid: false,
        reason: `Score ${clientScore} exceeds ${fruitsSliced} slices × ${MAX_POINTS_PER_FRUIT} max pts`,
      };
    }
    if (typeof comboHighwater === 'number' && comboHighwater > fruitsSliced) {
      return {
        valid: false,
        reason: `Combo ${comboHighwater} exceeds ${fruitsSliced} slices`,
      };
    }
  }

  return { valid: true, reason: null };
}

/**
 * Diagnostic replay with client-ported physics. Score parity is not expected
 * — spawns are random on both sides — so this is telemetry, not a gate.
 */
function runDiagnosticReplay(
  inputEventLog: InputEvent[],
  gameMode: GameMode,
  durationSeconds: number
): number {
  const state: SimState = {
    fruits: [],
    score: 0,
    combo: 0,
    lastSliceTimeS: -Infinity,
    nextSpawnS: (SPAWN_GAP_MS[gameMode] / 1000) * (0.5 + Math.random()),
  };

  // Re-interleave input events with the fruit simulation clock. Input event
  // timestamps are milliseconds since session start; convert to seconds.
  const events = [...inputEventLog].sort((a, b) => a.t - b.t);
  let inputIndex = 0;
  const prevPoint = { x: events[0]?.x ?? 0, y: events[0]?.y ?? 0 };
  let hasPrev = false;

  for (let tS = 0; tS <= durationSeconds; tS += SIMULATION_TIMESTEP_S) {
    // Spawn fruits while there is a fruit still airborne below the apex band.
    if (tS >= state.nextSpawnS && tS < durationSeconds) {
      state.fruits.push(spawnFruit());
      state.nextSpawnS = tS + (SPAWN_GAP_MS[gameMode] / 1000) * (0.5 + Math.random() * 0.9);
    }

    // Physics step
    for (const fruit of state.fruits) {
      if (!fruit.active) continue;
      fruit.vy += GRAVITY_UNITS_PER_S2 * SIMULATION_TIMESTEP_S;
      fruit.x += fruit.vx * SIMULATION_TIMESTEP_S;
      fruit.y += fruit.vy * SIMULATION_TIMESTEP_S;
      if (fruit.y > 1.15 || fruit.x < -0.1 || fruit.x > 1.1) fruit.active = false;
    }
    state.fruits = state.fruits.filter((f) => f.active);

    // Slice: process every input trail point that landed at/before this step,
    // treating consecutive points as a swipe segment (client geometry).
    while (inputIndex < events.length && events[inputIndex].t / 1000 <= tS) {
      const event = events[inputIndex];
      const point = { x: event.x, y: event.y };
      if (hasPrev) {
        sliceWithSegment(state, prevPoint, point, tS);
      } else {
        sliceWithSegment(state, point, point, tS);
      }
      prevPoint.x = point.x;
      prevPoint.y = point.y;
      hasPrev = true;
      inputIndex++;
    }

    // Combo timeout
    if (tS - state.lastSliceTimeS > 1) state.combo = 0;
  }

  return state.score;
}

function spawnFruit(): Fruit {
  const apex = APEX_MIN + Math.random() * APEX_RANGE; // upward travel target
  const vyMag = Math.sqrt(2 * GRAVITY_UNITS_PER_S2 * apex);
  let vx = vyMag / Math.tan(((60 + Math.random() * 60) * Math.PI) / 180);
  const x0 = 0.1 + Math.random() * 0.8;
  const flightTime = (2 * vyMag) / GRAVITY_UNITS_PER_S2;
  const landX = x0 + vx * flightTime;
  if (landX < 0.06) vx = (0.06 - x0) / flightTime;
  if (landX > 0.94) vx = (0.94 - x0) / flightTime;
  return { x: x0, y: 1.05, vx, vy: -vyMag, active: true };
}

/**
 * Client-style segment/circle slice check for a swipe segment.
 */
function sliceWithSegment(state: SimState, from: { x: number; y: number }, to: { x: number; y: number }, tS: number) {
  for (const fruit of state.fruits) {
    if (!fruit.active) continue;
    if (segmentCircleHit(from, to, fruit, FRUIT_RADIUS)) {
      fruit.active = false;
      const comboMultiplier = Math.min(1 + state.combo * 0.1, 3);
      state.score += 10 * comboMultiplier;
      state.combo++;
      state.lastSliceTimeS = tS;
    }
  }
}

/** True when the segment p→q passes within `r` of the circle centre. */
function segmentCircleHit(p: { x: number; y: number }, q: { x: number; y: number }, c: Fruit, r: number): boolean {
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((c.x - p.x) * dx + (c.y - p.y) * dy) / lenSq));
  const ex = p.x + t * dx - c.x;
  const ey = p.y + t * dy - c.y;
  return ex * ex + ey * ey <= r * r;
}

/**
 * Validate input log for impossible patterns (anti-cheat heuristics).
 */
export function validateInputLog(
  events: InputEvent[],
  durationSeconds: number
): { valid: boolean; reason: string | null } {
  if (events.length === 0) {
    return { valid: false, reason: 'Empty input log' };
  }

  const durationMs = durationSeconds * 1000;
  // Events can be registered a beat after the run's duration timer expires
  // (the final swipe of a survival round) — tolerate a short grace window,
  // otherwise valid runs are rejected wholesale (serverScore 0, divergence 100).
  const GRACE_MS = 1000;

  for (let i = 0; i < events.length; i++) {
    const event = events[i];

    // Check timestamp bounds
    if (event.t < 0 || event.t > durationMs + GRACE_MS) {
      return { valid: false, reason: `Event timestamp ${event.t} outside session bounds [0, ${durationMs}+${GRACE_MS}]` };
    }

    // Check coordinate bounds
    if (event.x < 0 || event.x > 1 || event.y < 0 || event.y > 1) {
      return { valid: false, reason: `Event coordinates out of bounds: (${event.x}, ${event.y})` };
    }

    // Check for teleportation (impossible coordinate jumps mid-stroke).
    // NOTE: a real finger flick reaches ~10–20 screen-units/s, and lifting
    // + re-touching elsewhere between strokes is legitimate — so this only
    // rejects sustained movement faster than any human finger; the gap
    // between strokes (>SWIPE_GAP_MS) is exempt.
    if (i > 0) {
      const prev = events[i - 1];
      const dt = event.t - prev.t;
      const dx = Math.abs(event.x - prev.x);
      const dy = Math.abs(event.y - prev.y);
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Continuous finger speed cap: 25 screen-units/s (~20×+ a fast flick).
      const MAX_SPEED_UNITS_PER_S = 25;
      const maxDistance = dt > SWIPE_GAP_MS ? Infinity : MAX_SPEED_UNITS_PER_S * (dt / 1000);
      if (distance > maxDistance) {
        return { valid: false, reason: `Impossible teleportation detected: ${distance.toFixed(3)} in ${dt}ms` };
      }
    }

    // Check for superhuman input rate. The client's trail sampler runs at
    // 60Hz+ per touch (and multi-touch doubles it), so legitimate trails can
    // legally exceed 100 events/second. Flag only clearly synthetic rates
    // (>200/sec sustained).
    if (i >= 100) {
      const windowStart = events[i - 100];
      const windowDuration = event.t - windowStart.t;
      if (windowDuration < 500) {
        return { valid: false, reason: 'Superhuman input rate detected (>200 inputs/sec)' };
      }
    }
  }

  return { valid: true, reason: null };
}

/**
 * Export for testing
 */
export const _testing = {
  validateInputLog,
  SIMULATION_TIMESTEP_S,
  FRUIT_RADIUS,
  SPAWN_GAP_MS,
};

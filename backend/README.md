# Fruit Rush Backend — Session Validation Microservice

## Overview

This is the server-authoritative session validation and scoring service for Fruit Rush. It validates game sessions via replay simulation, signs boast attestations, and serves leaderboard data.

**Stack:**
- **Runtime**: Node.js 18+ / TypeScript
- **Framework**: Express.js
- **Database**: Supabase (Postgres)
- **Cache/Rate Limiting**: Redis
- **Auth**: Magic.link JWT validation
- **Testing**: Jest + Testcontainers

---

## Architecture

```
┌─────────────┐
│ PixiJS PWA  │ ← Player's browser
└──────┬──────┘
       │ HTTPS + JWT
       ▼
┌─────────────────────────────────────────┐
│   Express API (this service)            │
├─────────────────────────────────────────┤
│ POST /session/validate                  │ ← Replay validation
│ POST /boast/sign                        │ ← ECDSA signing
│ GET  /leaderboard/:gameMode             │ ← Top 100 scores
│ POST /tournament/:id/enter              │ ← Eligibility check
└──────┬──────────────────────────────────┘
       │
       ├─→ Supabase (session storage)
       ├─→ Redis (rate limiting)
       ├─→ Goldsky Subgraph (boast status)
       └─→ Magic.link (JWT validation)
```

---

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your credentials
```

### 3. Start Redis (Development)

```bash
docker run -d -p 6379:6379 redis:7-alpine
```

### 4. Run Development Server

```bash
npm run dev
```

Server starts at `http://localhost:3000`

### 5. Run Tests

```bash
npm test
```

---

## Service Architecture

This backend provides two main features:

1. **Session Validation** — Server-authoritative replay validation and boast signing
2. **Tournament Management** — Automated tournament lifecycle with scheduler

See [TOURNAMENT_MANAGEMENT.md](./TOURNAMENT_MANAGEMENT.md) for detailed tournament documentation.

---

## API Endpoints

### Session Validation

#### `POST /session/validate`

Validate a game session via replay simulation.

**Request:**
```typescript
{
  playerId: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  score: 12450,
  gameMode: "Classic",
  comboHighwater: 28,
  durationSeconds: 180,
  clientTimestamp: 1704067200000,
  inputEventLog: [
    { t: 100, x: 0.5, y: 0.3, velocity: 0.8 },
    { t: 250, x: 0.6, y: 0.4, velocity: 1.2 },
    ...
  ]
}
```

**Response (Valid):**
```json
{
  "valid": true,
  "serverScore": 12480,
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "scoreDivergence": 0.24
}
```

**Response (Invalid):**
```json
{
  "valid": false,
  "serverScore": 8500,
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "scoreDivergence": 31.73,
  "rejectionReason": "Score divergence 31.73% exceeds 2.0% tolerance"
}
```

**Rate Limit:** 10 requests per player per hour

---

### `POST /boast/sign`

Generate ECDSA signature for on-chain boast minting (valid sessions only).

**Request:**
```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response:**
```json
{
  "signature": "0x1234567890abcdef...",
  "playerAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "score": 12480,
  "gameMode": "Classic",
  "nonce": 42
}
```

**Errors:**
- `404` — Session not found
- `400` — Session invalid (failed validation)
- `409` — Boast already signed for this session

---

### `GET /leaderboard/:gameMode`

Get top 100 scores for a game mode.

**Request:**
```
GET /leaderboard/Classic
```

**Response:**
```json
{
  "gameMode": "Classic",
  "entries": [
    {
      "playerAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
      "score": 125000,
      "timestamp": "2026-08-03T18:30:00.000Z",
      "hasBoast": true,
      "comboHighwater": 85
    },
    ...
  ],
  "total": 100
}
```

`hasBoast` is queried from Goldsky Subgraph (checks if on-chain boast exists).

---

### `POST /tournament/:id/enter`

Check player eligibility for tournament entry.

**Request:**
```
POST /tournament/1/enter
{
  "playerAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
}
```

**Response (Eligible):**
```json
{
  "eligible": true,
  "tournamentId": "1"
}
```

**Response (Not Eligible):**
```json
{
  "eligible": false,
  "tournamentId": "1",
  "reason": "Player already entered this tournament"
}
```

**Validation:**
- Player hasn't already entered
- Tournament is in "Open" status (checked via Supabase)
- No boosts used in session (Tournament mode restriction)

---

### Tournament Management

#### `GET /tournament/active`

List all currently open tournaments with entry details and prize pools.

**Query Parameters:**
- `playerAddress` (optional) — Check if player has entered

**Response:**
```json
{
  "tournaments": [
    {
      "id": "12345",
      "entryFee": "5.0",
      "prizePool": "500.0",
      "entryCount": 100,
      "timeRemaining": 3600,
      "playerEntered": false,
      "status": "Open",
      "prizeDistribution": [
        { "place": 1, "share": "50.0%", "amount": "250.0" }
      ]
    }
  ]
}
```

---

#### `GET /tournament/:id/leaderboard`

Get live tournament rankings (cached for 10 seconds).

**Response:**
```json
{
  "tournamentId": "12345",
  "entries": [
    {
      "rank": 1,
      "playerAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
      "score": 125000,
      "prize": "250.0"
    }
  ]
}
```

---

#### `POST /tournament/:id/refund`

Emergency refund for a tournament (admin-only).

**Request:**
```json
{
  "adminKey": "admin_secret_key"
}
```

**Response:**
```json
{
  "success": true,
  "transactionHash": "0xabc123...",
  "message": "Tournament 12345 refunded successfully"
}
```

---

## Replay Validation

### How It Works

The server re-simulates the game session using the client's `inputEventLog`:

1. **Spawn fruits** at intervals with physics (gravity, velocity)
2. **Process input events** (swipe coordinates/velocities)
3. **Detect collisions** between swipes and fruits
4. **Calculate score** with combo multipliers and velocity bonuses
5. **Compare** server score vs. client score

### Divergence Tolerance

**Accepted:** ≤2% divergence (configurable via `SCORE_TOLERANCE_PCT`)

**Why 2%?**
- Floating-point differences between browser and Node.js
- Frame timing variations (client runs at variable FPS, server at fixed 10ms timestep)
- Physics integration differences (client uses Runge-Kutta, server uses Euler)

See `src/validator/replaySimulator.ts` for detailed documentation.

### Anti-Cheat Heuristics

✅ **Detects:**
- Score inflation (client can't claim higher score than possible)
- Teleportation (impossible coordinate jumps)
- Superhuman input rate (>100 inputs/second sustained)
- Timestamp manipulation (events outside session bounds)

⚠️ **Does NOT detect:**
- Aim bots (perfectly accurate slices) — acceptable, skill-based
- Input recording/playback — mitigated by time-based tournament windows

---

## Database Schema (Supabase)

### `game_sessions` Table

```sql
CREATE TABLE game_sessions (
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
  boast_signed_at TIMESTAMPTZ,
  
  INDEX idx_player_game_mode (player_id, game_mode, server_score DESC),
  INDEX idx_game_mode_score (game_mode, server_score DESC),
  INDEX idx_valid_sessions (valid, game_mode, server_score DESC)
);
```

---

## Environment Variables

See `.env.example` for full list. Key variables:

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (full access) |
| `MAGIC_SECRET_KEY` | Magic.link secret key for JWT validation |
| `BOAST_SIGNER_PRIVATE_KEY` | Private key for signing boast attestations (KEEP SECRET!) |
| `REDIS_URL` | Redis connection string for rate limiting |
| `GOLDSKY_SUBGRAPH_URL` | Goldsky subgraph endpoint for boast status queries |
| `SCORE_TOLERANCE_PCT` | Max divergence % (default: 2.0) |
| `SESSION_RATE_LIMIT` | Max sessions per player per hour (default: 10) |
| `TOURNAMENT_OPERATOR_PRIVATE_KEY` | Private key for tournament operations (KEEP SECRET!) |
| `TOURNAMENT_CONTRACT_ADDRESS` | FruitRushTournament contract address on Celo |
| `CELO_RPC_URL` | Celo RPC endpoint (e.g., https://forno.celo.org) |
| `TOURNAMENT_FAILURE_WEBHOOK_URL` | Webhook URL for finalization alerts (optional) |
| `ADMIN_REFUND_KEY` | Admin key for emergency refunds |

---

## Tournament Scheduler

The service includes an automated tournament scheduler that:

- Creates recurring tournaments (daily, weekly) via cron jobs
- Monitors tournaments for finalization after endTime
- Automatically finalizes with retry logic (3 attempts with exponential backoff)
- Sends webhook alerts on persistent failures

**Scheduler runs automatically on server start.** See [TOURNAMENT_MANAGEMENT.md](./TOURNAMENT_MANAGEMENT.md) for details.

---

## Deployment

### Docker

```bash
# Build image
docker build -t fruit-rush-backend .

# Run container
docker run -d \
  -p 3000:3000 \
  --env-file .env \
  fruit-rush-backend
```

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use strong `BOAST_SIGNER_PRIVATE_KEY` (32 bytes random)
- [ ] Enable Redis TLS (`REDIS_TLS=true`)
- [ ] Configure CORS origins (`CORS_ORIGINS=https://fruitrush.game`)
- [ ] Set up log aggregation (Sentry DSN)
- [ ] Use managed Redis (AWS ElastiCache, Redis Cloud)
- [ ] Enable Supabase connection pooling
- [ ] Set up health check endpoint (`GET /health`)

---

## Testing

### Unit Tests

```bash
npm test
```

### Integration Tests (with Testcontainers)

```bash
npm test -- --runInBand
```

Integration tests spin up real Postgres and Redis containers via Testcontainers.

### Test Coverage

```bash
npm run test:coverage
```

Target: >80% coverage on core validation logic.

---

## Security

### Rate Limiting

- **Session validation:** 10 requests/player/hour (Redis-backed)
- **Boast signing:** 5 requests/player/hour
- **Leaderboard:** 60 requests/IP/minute

### Authentication

All endpoints require `Authorization: Bearer <JWT>` header with Magic.link token.

**Token validation:**
1. Extract token from `Authorization` header
2. Verify with Magic.link API
3. Extract player address from token payload
4. Compare with `playerId` in request body

### Signing Key Rotation

To rotate the boast signing key:

1. Deploy new backend with new `BOAST_SIGNER_PRIVATE_KEY`
2. Update `trustedSigner` in Boast contract (owner-only function)
3. Old signatures remain valid; new sessions use new key

---

## Monitoring

### Metrics to Track

- **Session validation rate** (sessions/min)
- **Rejection rate** (invalid sessions %)
- **Average score divergence** (should be <1%)
- **Boast signing rate** (boasts/min)
- **Leaderboard query latency** (p95, p99)
- **Redis hit rate**

### Logging

All requests logged via Morgan middleware:

```
[2026-08-03 18:30:45] POST /session/validate 200 45ms - player: 0x742d... score: 12450 divergence: 0.24%
```

### Health Check

```bash
GET /health
```

Returns:
```json
{
  "status": "healthy",
  "supabase": "connected",
  "redis": "connected",
  "uptime": 3600
}
```

---

## Troubleshooting

### High Rejection Rate (>5%)

**Possible causes:**
1. Client physics out of sync with server
2. `SCORE_TOLERANCE_PCT` too tight
3. Client bug (e.g., incorrect input logging)

**Fix:**
- Review rejected sessions in `game_sessions` table
- Check `rejection_reason` column
- Adjust tolerance or fix client physics

### Redis Connection Errors

```
Error: connect ECONNREFUSED 127.0.0.1:6379
```

**Fix:**
```bash
docker run -d -p 6379:6379 redis:7-alpine
```

### Supabase Connection Pool Exhausted

```
Error: remaining connection slots reserved for non-replication superuser connections
```

**Fix:**
- Enable Supabase connection pooling (use pooler URL in `SUPABASE_URL`)
- Reduce connection pool size in code
- Scale up Supabase plan

---

## File Structure

```
backend/
├── src/
│   ├── index.ts                      # Express app entry point
│   ├── config/
│   │   └── index.ts                  # Environment config
│   ├── middleware/
│   │   ├── auth.ts                   # Magic.link JWT validation
│   │   ├── rateLimit.ts              # Redis rate limiting
│   │   └── errorHandler.ts           # Global error handler
│   ├── routes/
│   │   ├── session.ts                # /session/* endpoints
│   │   ├── boast.ts                  # /boast/* endpoints
│   │   ├── leaderboard.ts            # /leaderboard/* endpoints
│   │   └── tournament.ts             # /tournament/* endpoints
│   ├── services/
│   │   ├── supabase.ts               # Supabase client
│   │   ├── redis.ts                  # Redis client
│   │   ├── goldsky.ts                # Goldsky subgraph queries
│   │   └── signer.ts                 # ECDSA boast signing
│   ├── validator/
│   │   └── replaySimulator.ts        # Score replay engine
│   ├── types/
│   │   └── session.ts                # TypeScript types
│   └── schemas/
│       └── validation.ts             # Zod schemas
├── tests/
│   ├── integration/
│   │   ├── session.test.ts
│   │   ├── boast.test.ts
│   │   ├── leaderboard.test.ts
│   │   └── tournament.test.ts
│   └── unit/
│       ├── replaySimulator.test.ts
│       └── signer.test.ts
├── Dockerfile
├── docker-compose.yml                 # Dev services (Redis, Postgres)
├── openapi.yaml                       # OpenAPI 3.0 spec
├── package.json
├── tsconfig.json
├── jest.config.js
└── README.md                          # This file
```

---

## Next Steps

1. **Deploy to production** (see Deployment section)
2. **Set up monitoring** (Datadog, New Relic, or Sentry)
3. **Tune replay simulator** (adjust physics constants to match client)
4. **Add WebAssembly physics** (future: deterministic cross-platform simulation)
5. **Implement manual review queue** (for flagged sessions with superhuman accuracy)

---

## API Documentation

Full OpenAPI 3.0 spec available at `openapi.yaml`.

View interactive docs:
```bash
npx @redocly/cli preview-docs openapi.yaml
```

---

## License

MIT

---

## Support

- **Internal:** #backend-eng Slack channel
- **Issues:** GitHub Issues
- **Docs:** This README + inline code comments

---

## Additional Documentation

- **[TOURNAMENT_MANAGEMENT.md](./TOURNAMENT_MANAGEMENT.md)** — Complete guide to tournament scheduler, finalization, and admin endpoints
- **[TOURNAMENT_IMPLEMENTATION_STATUS.md](./TOURNAMENT_IMPLEMENTATION_STATUS.md)** — Implementation status and deliverables
- **[COMPLETE.md](./COMPLETE.md)** — Session validation implementation summary
- **[FINAL_STATUS.md](./FINAL_STATUS.md)** — Session validation deliverables checklist
- **[QUICKSTART.md](./QUICKSTART.md)** — 5-minute quick start guide
- **[openapi.yaml](./openapi.yaml)** — Full API specification

---

*Last updated: 2026-08-04*

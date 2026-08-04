## Tournament Lifecycle Management

Complete guide for the tournament scheduler, finalization system, and admin endpoints.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Tournament Lifecycle                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. SCHEDULER (node-cron)                                   │
│     - Creates recurring tournaments (daily, weekly)         │
│     - Monitors tournaments for finalization                 │
│     - Every 5 minutes: check pending finalizations          │
│                                                              │
│  2. SMART CONTRACT (ethers.js v6)                           │
│     - createTournament() → on-chain registration            │
│     - finalize() → distribute prizes + rake                 │
│     - refund() → emergency cancellation                     │
│                                                              │
│  3. SUPABASE DATABASE                                       │
│     - tournaments table → lifecycle tracking                │
│     - tournament_entries table → player entries             │
│     - game_sessions table → scores for leaderboard          │
│                                                              │
│  4. ADMIN ENDPOINTS                                         │
│     - GET /tournament/active → list open tournaments        │
│     - GET /tournament/:id/leaderboard → live rankings       │
│     - POST /tournament/:id/refund → emergency refund        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Scheduler Configuration

### Tournament Templates

Defined in `src/tournament/scheduler.ts`:

```typescript
const TEMPLATES: TournamentTemplate[] = [
  {
    name: 'daily-dollar-dash',
    entryFeeUsd: 1,
    durationSeconds: 24 * 60 * 60, // 24 hours
    prizeSharesBps: [5000, 2500, 1000], // 50%, 25%, 10% (15% rake)
    cronSchedule: '0 18 * * *', // Daily at 6pm UTC
  },
  {
    name: 'weekend-warrior',
    entryFeeUsd: 10,
    durationSeconds: 48 * 60 * 60, // 48 hours
    prizeSharesBps: [4000, 2500, 1500, 500], // 40%, 25%, 15%, 5% (15% rake)
    cronSchedule: '0 12 * * 6', // Saturday at noon UTC
  },
];
```

### Cron Schedules

| Template | Schedule | Description |
|----------|----------|-------------|
| `daily-dollar-dash` | `0 18 * * *` | Every day at 6pm UTC |
| `weekend-warrior` | `0 12 * * 6` | Every Saturday at noon UTC |
| Finalization checker | `*/5 * * * *` | Every 5 minutes |

---

## Prize Pool Math

### Rules

1. **Prize shares must sum to ≤ 8500 bps (85%)**
2. **Minimum rake is 1500 bps (15%)**
3. **Rounding dust flows to rake, never to winners**

### Example: 100 players, $5 entry

```
Total pool = $500

Prize shares: [5000, 2500, 1000] bps
├─ 1st place: $500 × 5000/10000 = $250 (50%)
├─ 2nd place: $500 × 2500/10000 = $125 (25%)
└─ 3rd place: $500 × 1000/10000 = $50  (10%)

Total paid: $425
Rake:       $75 (15%)
```

### Validation

Prize shares are validated before tournament creation:

```typescript
import { validatePrizeShares } from './tournament/validation';

validatePrizeShares([5000, 2500, 1000]); // ✅ OK (sum = 8500 bps)
validatePrizeShares([9000]); // ❌ Throws error (exceeds 8500 bps)
```

---

## Finalization Process

### Automatic Finalization

Every 5 minutes, the scheduler checks for tournaments past `endTime`:

1. **Fetch ranked winners** from `game_sessions` table (top N by `server_score`)
2. **Call `finalize()`** on-chain with ranked winner addresses
3. **Update Supabase** with finalization status and tx hash
4. **Retry with exponential backoff** if transaction fails

### Retry Logic

| Attempt | Delay | Total Time |
|---------|-------|------------|
| 1 | 0s | 0s |
| 2 | 5s | 5s |
| 3 | 20s | 25s |
| **Failed** | Send webhook | - |

### Webhook Alert

If all 3 attempts fail, a webhook is sent to `TOURNAMENT_FAILURE_WEBHOOK_URL`:

```json
{
  "event": "tournament_finalization_failed",
  "tournamentId": "12345",
  "error": "Transaction reverted: Insufficient gas",
  "timestamp": "2026-08-04T12:00:00.000Z",
  "operator": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
}
```

---

## API Endpoints

### `GET /tournament/active`

List all currently open tournaments.

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
      "startTime": 1704067200,
      "endTime": 1704153600,
      "timeRemaining": 3600,
      "playerEntered": false,
      "status": "Open",
      "prizeDistribution": [
        { "place": 1, "share": "50.0%", "amount": "250.0" },
        { "place": 2, "share": "25.0%", "amount": "125.0" },
        { "place": 3, "share": "10.0%", "amount": "50.0" }
      ]
    }
  ]
}
```

---

### `GET /tournament/:id/leaderboard`

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
      "comboHighwater": 85,
      "timestamp": "2026-08-03T18:30:00.000Z",
      "prize": "250.0"
    }
  ]
}
```

**Caching:**
- Redis key: `tournament:{id}:leaderboard`
- TTL: 10 seconds
- Reduces Supabase query load during tournament

---

### `POST /tournament/:id/refund`

Emergency refund (admin-only).

**Request:**
```json
{
  "adminKey": "super_secret_admin_key_change_me"
}
```

**Response (Success):**
```json
{
  "success": true,
  "transactionHash": "0xabc123...",
  "message": "Tournament 12345 refunded successfully"
}
```

**Response (Error — Already Finalized):**
```json
{
  "error": "Cannot refund",
  "message": "Tournament is already Finalized"
}
```

---

## Environment Variables

Add these to `.env`:

```bash
# Tournament operator wallet (KEEP SECRET!)
TOURNAMENT_OPERATOR_PRIVATE_KEY=0x...

# FruitRushTournament contract address
TOURNAMENT_CONTRACT_ADDRESS=0xc396fa8D8fA76457eAD5772a936a896716D2640F

# Celo RPC URL
CELO_RPC_URL=https://forno.celo.org

# Webhook for finalization failures (optional)
TOURNAMENT_FAILURE_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK

# Admin refund authorization key
ADMIN_REFUND_KEY=super_secret_admin_key_change_me
```

---

## Database Schema

See `db/tournaments-schema.sql` for full DDL.

### `tournaments` Table

| Column | Type | Description |
|--------|------|-------------|
| `tournament_id` | TEXT (PK) | Unique tournament ID (matches on-chain) |
| `entry_fee_wei` | TEXT | Entry fee in cUSD wei (18 decimals) |
| `start_time` | TIMESTAMPTZ | Tournament start |
| `end_time` | TIMESTAMPTZ | Tournament end |
| `prize_shares_bps` | INTEGER[] | Prize distribution |
| `status` | TEXT | Pending, Open, Closed, Finalized, Refunded |
| `template_name` | TEXT | Template used (e.g., "daily-dollar-dash") |
| `creation_tx_hash` | TEXT | On-chain creation transaction |
| `finalization_tx_hash` | TEXT | On-chain finalization transaction |
| `winner_count` | INTEGER | Number of winners paid |

### `tournament_entries` Table

| Column | Type | Description |
|--------|------|-------------|
| `entry_id` | SERIAL (PK) | Auto-increment ID |
| `tournament_id` | TEXT (FK) | References tournaments |
| `player_address` | TEXT | Player wallet address |
| `entered_at` | TIMESTAMPTZ | Entry timestamp |

**Unique constraint:** `(tournament_id, player_address)` — one entry per player per tournament

---

## Manual Operations

### Create Tournament Manually

```typescript
import { createTournamentManual } from './tournament/scheduler';

await createTournamentManual('daily-dollar-dash');
```

### Finalize Tournament Manually

```typescript
import { finalizeTournamentManual } from './tournament/scheduler';

const result = await finalizeTournamentManual('12345');
console.log(result); // { success: true, transactionHash: '0x...' }
```

### Refund Tournament via API

```bash
curl -X POST http://localhost:3000/tournament/12345/refund \
  -H 'Content-Type: application/json' \
  -d '{"adminKey":"super_secret_admin_key_change_me"}'
```

---

## Security Considerations

### Operator Wallet

- **NEVER log the private key**
- Store in environment variable only
- Use separate wallet for production (not the deployer wallet)
- Grant `OPERATOR_ROLE` and `FINALIZER_ROLE` in the Tournament contract

### Admin Refund Key

- Rotate periodically
- Use strong random key: `openssl rand -hex 32`
- Consider replacing with proper role-based auth (e.g., Magic.link admin token)

### Rate Limiting

- Leaderboard endpoint: 60 req/min per IP (via Redis)
- No rate limit on `/tournament/active` (public data)

---

## Monitoring

### Metrics to Track

- **Tournament creation rate** (tournaments/day)
- **Finalization success rate** (%successful/total)
- **Average finalization time** (seconds after endTime)
- **Retry count distribution** (how often do we need retries?)
- **Prize pool size distribution** (histogram)
- **Entry count distribution** (tournaments by size)

### Alerts

Set up alerts for:

1. **Finalization webhook triggered** → 3 retries failed
2. **Tournament creation failed** → contract error
3. **Operator wallet balance low** → needs CELO for gas
4. **Leaderboard cache miss rate high** → Redis connection issues

---

## Testing

### Unit Tests

```bash
npm test -- tests/unit/scheduler.test.ts
```

Tests:
- Prize pool calculation
- Prize share validation
- Retry logic (mocked ethers.js)
- Webhook alert

### Integration Tests

```bash
npm test -- tests/integration/tournament-admin.test.ts
```

Tests:
- GET /tournament/active
- GET /tournament/:id/leaderboard (with cache)
- POST /tournament/:id/refund (with auth)

---

## Troubleshooting

### Finalization Keeps Failing

**Symptoms:** Webhook alerts for every tournament

**Possible causes:**
1. Operator wallet out of gas (CELO)
2. Contract `FINALIZER_ROLE` not granted to operator
3. RPC rate limiting (too many requests to Celo RPC)
4. Incorrect ranked winners format (invalid addresses)

**Fix:**
```bash
# Check operator wallet balance
cast balance $TOURNAMENT_OPERATOR_ADDRESS --rpc-url $CELO_RPC_URL

# Check if operator has FINALIZER_ROLE
cast call $TOURNAMENT_CONTRACT_ADDRESS \
  "hasRole(bytes32,address)" \
  $(cast keccak "FINALIZER_ROLE") \
  $TOURNAMENT_OPERATOR_ADDRESS \
  --rpc-url $CELO_RPC_URL
```

### Leaderboard Cache Not Working

**Symptoms:** High Supabase query load, slow leaderboard responses

**Possible cause:** Redis connection lost

**Fix:**
```bash
# Check Redis connection
redis-cli -u $REDIS_URL ping
# Expected: PONG

# Check cache keys
redis-cli -u $REDIS_URL KEYS "tournament:*"
```

### Tournament Not Showing in `/tournament/active`

**Possible causes:**
1. Tournament created on-chain but not in Supabase
2. Status is not 'Pending' or 'Open'
3. Time window has passed (past endTime)

**Fix:**
```sql
-- Check tournament in Supabase
SELECT * FROM tournaments WHERE tournament_id = '12345';

-- Check on-chain status
-- Use cast call or ethers.js to query getTournament()
```

---

## Future Improvements

1. **Multi-region RPC failover** — use fallback RPCs if primary fails
2. **Gas price monitoring** — don't finalize if gas > threshold
3. **On-chain leaderboard oracle** — update leaderboard on-chain via Chainlink
4. **Dynamic tournament templates** — admin UI to create templates without code deploy
5. **Tournament cancellation** — allow refund before startTime
6. **Late entry penalties** — reduce prize share for late entries
7. **Team tournaments** — 2v2 or 3v3 with shared prize pools

---

## Support

- **Slack:** `#backend-eng` channel
- **On-call:** PagerDuty escalation for finalization failures
- **Logs:** Check CloudWatch/Datadog for scheduler errors

---

*Last updated: 2026-08-04*

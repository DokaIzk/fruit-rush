# Goldsky Mirror with Supabase

## Why Supabase?

Supabase is **Postgres-as-a-Service with a powerful API layer** on top. For Fruit Rush analytics, it offers several advantages over raw Postgres:

### ✅ Advantages

| Feature | Benefit |
|---------|---------|
| **Instant REST API** | Query analytics data via HTTP without writing backend code |
| **Realtime subscriptions** | WebSocket updates when new events land (live dashboards!) |
| **Built-in auth** | Secure API access with JWT tokens, no need to manage database users |
| **Auto-generated TypeScript types** | Type-safe queries from your frontend |
| **Free tier** | 500 MB database, 2 GB bandwidth/month (perfect for dev/staging) |
| **Dashboard UI** | Visual query builder, table editor, logs viewer |
| **Edge Functions** | Serverless functions co-located with your database |
| **Storage** | S3-compatible object storage for NFT metadata, images |

### 🎯 Perfect for Fruit Rush Because:

1. **Client-side analytics queries** — Your PixiJS PWA can query leaderboards directly via Supabase's REST API (no backend needed)
2. **Realtime leaderboards** — Subscribe to `boast_mints` table and update UI in real-time as players boast
3. **Serverless architecture** — No backend servers to maintain for analytics queries
4. **Cost-effective** — Free tier covers development; $25/month Pro tier scales to millions of rows
5. **TypeScript-native** — Pairs perfectly with your TypeScript game client

---

## Setup: Goldsky Mirror → Supabase

### Prerequisites

1. **Supabase account**: Sign up at https://supabase.com
2. **Goldsky CLI**: `npm install -g @goldsky/cli`
3. **Supabase CLI** (optional): `npm install -g supabase`

---

## Step 1: Create Supabase Project

```bash
# Via web UI: https://app.supabase.com/new
# Or via CLI:
supabase projects create fruit-rush-analytics --region us-west-1
```

Get your connection details:
- **Database URL**: Settings → Database → Connection String (Direct Connection)
- **API URL**: Settings → API → Project URL
- **Anon Key**: Settings → API → Project API keys → `anon` (public)
- **Service Role Key**: Settings → API → Project API keys → `service_role` (secret)

---

## Step 2: Configure Environment Variables

Add to your `.env`:

```bash
# Supabase database connection (for Goldsky Mirror)
# Format: postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
DATABASE_URL=postgresql://postgres:your_password@db.abc123xyz.supabase.co:5432/postgres

# Supabase API (for client-side queries)
NEXT_PUBLIC_SUPABASE_URL=https://abc123xyz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Supabase service role key (for backend/admin operations)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Security note**: The `anon` key is safe to expose in your client-side PWA (it's scoped by Row Level Security policies).

---

## Step 3: Deploy Schema to Supabase

```bash
# Connect via psql
psql $DATABASE_URL

# Run schema DDL
\i db/schema.sql

# Exit
\q
```

Or use Supabase Studio (web UI):
1. Go to SQL Editor in Supabase dashboard
2. Paste contents of `db/schema.sql`
3. Run query

---

## Step 4: Configure Row Level Security (RLS)

Supabase uses **Row Level Security** to control API access. For analytics tables, we want:
- **Public read** (anyone can query leaderboards, stats)
- **No public write** (only Goldsky can write via direct database connection)

```sql
-- Enable RLS on all tables
ALTER TABLE fruit_rush.cosmetic_mints ENABLE ROW LEVEL SECURITY;
ALTER TABLE fruit_rush.boast_mints ENABLE ROW LEVEL SECURITY;
ALTER TABLE fruit_rush.tournament_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE fruit_rush.tournament_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE fruit_rush.tournament_refunds ENABLE ROW LEVEL SECURITY;

-- Allow public read access (for leaderboards, dashboards)
CREATE POLICY "Public read access" ON fruit_rush.cosmetic_mints
  FOR SELECT USING (true);

CREATE POLICY "Public read access" ON fruit_rush.boast_mints
  FOR SELECT USING (true);

CREATE POLICY "Public read access" ON fruit_rush.tournament_entries
  FOR SELECT USING (true);

CREATE POLICY "Public read access" ON fruit_rush.tournament_payouts
  FOR SELECT USING (true);

CREATE POLICY "Public read access" ON fruit_rush.tournament_refunds
  FOR SELECT USING (true);

-- No insert/update/delete policies = only service role (Goldsky) can write
-- (Goldsky uses direct database connection, bypassing RLS)
```

**Alternative (more restrictive)**: If you want to limit reads to authenticated users only, replace `USING (true)` with `USING (auth.role() = 'authenticated')`.

---

## Step 5: Deploy Goldsky Pipeline

The `mirror-pipeline.json` config **works as-is** with Supabase — just use your Supabase `DATABASE_URL`:

```bash
# Set Supabase connection string
export DATABASE_URL="postgresql://postgres:your_password@db.abc123xyz.supabase.co:5432/postgres"

# Deploy pipeline
goldsky mirror create mirror-pipeline.json

# Check status
goldsky mirror status fruit-rush-analytics
```

Goldsky connects **directly to the Postgres database** (bypassing Supabase's API layer and RLS), so it has full write access.

---

## Step 6: Query from Your PWA Client

Install Supabase client library:

```bash
cd client
npm install @supabase/supabase-js
```

### Example: Fetch Top-10 Boasters Leaderboard

```typescript
// client/src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

```typescript
// client/src/api/leaderboard.ts
import { supabase } from '../lib/supabase';

export async function getTopBoasters(limit = 10) {
  const { data, error } = await supabase
    .from('boast_mints')
    .select('player_address, score, game_mode, block_timestamp')
    .order('score', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}
```

```typescript
// client/src/components/Leaderboard.tsx
import { useEffect, useState } from 'react';
import { getTopBoasters } from '../api/leaderboard';

export function Leaderboard() {
  const [leaders, setLeaders] = useState([]);

  useEffect(() => {
    getTopBoasters(10).then(setLeaders);
  }, []);

  return (
    <div>
      <h2>Top Boasters</h2>
      {leaders.map((player, i) => (
        <div key={player.player_address}>
          #{i + 1}: {player.player_address.slice(0, 8)}... — {player.score} points
        </div>
      ))}
    </div>
  );
}
```

---

## Step 7: Realtime Leaderboard Updates

Subscribe to new boast mints and update the UI in real-time:

```typescript
// client/src/components/RealtimeLeaderboard.tsx
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function RealtimeLeaderboard() {
  const [leaders, setLeaders] = useState([]);

  useEffect(() => {
    // Initial fetch
    fetchLeaders();

    // Subscribe to new boasts
    const subscription = supabase
      .channel('boast_mints_channel')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'fruit_rush',
          table: 'boast_mints',
        },
        (payload) => {
          console.log('New boast minted!', payload.new);
          // Re-fetch leaderboard (or optimistically update)
          fetchLeaders();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function fetchLeaders() {
    const { data } = await supabase
      .from('boast_mints')
      .select('*')
      .order('score', { ascending: false })
      .limit(10);
    setLeaders(data || []);
  }

  return (
    <div>
      <h2>🔥 Live Leaderboard</h2>
      {leaders.map((player, i) => (
        <div key={player.boast_id}>
          #{i + 1}: {player.player_address.slice(0, 8)}... — {player.score} points
        </div>
      ))}
    </div>
  );
}
```

**This gives you live leaderboards with ~100ms latency** — as soon as Goldsky ingests a new `BoastMinted` event, all connected clients get a push notification via WebSocket.

---

## Advanced: Auto-Generated TypeScript Types

Supabase can generate TypeScript types for your database schema:

```bash
# Generate types
npx supabase gen types typescript --project-id abc123xyz > client/src/types/supabase.ts
```

Then use them for type-safe queries:

```typescript
import { Database } from './types/supabase';

const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// Now queries are fully typed!
const { data } = await supabase
  .from('boast_mints')  // ← autocomplete works
  .select('player_address, score')  // ← autocomplete works
  .order('score', { ascending: false });

// data is typed as: { player_address: string; score: string }[]
```

---

## Cost Comparison: Supabase vs. Self-Hosted Postgres

| | Supabase Free | Supabase Pro | AWS RDS db.t3.small |
|---|---|---|---|
| **Price** | $0/month | $25/month | ~$25/month |
| **Database size** | 500 MB | 8 GB | 20 GB (gp2 EBS) |
| **Bandwidth** | 2 GB/month | 250 GB/month | Free (within AWS) |
| **API included** | ✅ Yes | ✅ Yes | ❌ No (build your own) |
| **Realtime** | ✅ Yes | ✅ Yes | ❌ No |
| **Auth** | ✅ Yes | ✅ Yes | ❌ No |
| **Dashboard** | ✅ Yes | ✅ Yes | ⚠️ CloudWatch only |
| **Storage** | 1 GB | 100 GB | ❌ No (S3 separate) |
| **Edge Functions** | 500K invocations | 2M invocations | ❌ No |

**Recommendation:**
- **Development/staging**: Supabase Free tier (perfect for testing)
- **Production (<1M events/month)**: Supabase Pro ($25/month)
- **Production (>1M events/month)**: Supabase Pro or scale to AWS RDS (add caching layer)

---

## Security Best Practices

### 1. Use Anon Key in Client, Service Role Key in Backend

```typescript
// ✅ GOOD: Client-side (PWA) — uses anon key + RLS
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ❌ BAD: Never expose service role key in client code!
// const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
```

### 2. Rate Limit API Access

```sql
-- Create a rate-limiting function (Supabase Pro only)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Or use Cloudflare in front of Supabase API URL for DDoS protection
```

### 3. Monitor Query Performance

```sql
-- Enable pg_stat_statements (Supabase Pro)
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- View slow queries
SELECT * FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;
```

---

## Edge Functions for Advanced Analytics

Supabase Edge Functions (Deno-based serverless) let you run complex analytics without exposing raw database queries:

```typescript
// supabase/functions/player-stats/index.ts
import { createClient } from '@supabase/supabase-js';

Deno.serve(async (req) => {
  const { playerAddress } = await req.json();

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!  // Full access
  );

  // Complex multi-table aggregation
  const [cosmetics, boasts, tournaments] = await Promise.all([
    supabase.from('cosmetic_mints').select('*').eq('player_address', playerAddress),
    supabase.from('boast_mints').select('*').eq('player_address', playerAddress),
    supabase.from('tournament_entries').select('*').eq('player_address', playerAddress),
  ]);

  return new Response(
    JSON.stringify({
      cosmetics_owned: cosmetics.data?.length || 0,
      total_boasts: boasts.data?.length || 0,
      total_score: boasts.data?.reduce((sum, b) => sum + Number(b.score), 0) || 0,
      tournaments_entered: tournaments.data?.length || 0,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
```

Deploy:
```bash
supabase functions deploy player-stats
```

Call from client:
```typescript
const { data } = await supabase.functions.invoke('player-stats', {
  body: { playerAddress: '0x742d35Cc...' },
});
```

---

## Monitoring Goldsky → Supabase Pipeline

### Check Supabase Logs

1. Go to Supabase Dashboard → Logs
2. Filter by `postgres` to see all database operations
3. Look for Goldsky's `INSERT` statements

### Monitor Database Size

```sql
-- Check table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'fruit_rush'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Set Up Alerts

Supabase Pro includes alerts for:
- Database size > 80% of plan limit
- CPU usage > 80%
- Connection pool saturation

---

## Migration Path: Raw Postgres → Supabase

If you already deployed to raw Postgres and want to migrate to Supabase:

### 1. Export Existing Data

```bash
pg_dump $OLD_DATABASE_URL --schema=fruit_rush --data-only > data.sql
```

### 2. Import to Supabase

```bash
psql $SUPABASE_DATABASE_URL < db/schema.sql  # Schema first
psql $SUPABASE_DATABASE_URL < data.sql       # Then data
```

### 3. Update Goldsky Config

```bash
# Update DATABASE_URL in .env to Supabase
export DATABASE_URL="postgresql://postgres:password@db.abc123xyz.supabase.co:5432/postgres"

# Update pipeline
goldsky mirror update fruit-rush-analytics mirror-pipeline.json
```

**Zero downtime**: Goldsky will continue from the last synced block.

---

## Comparison: Supabase vs. ClickHouse vs. Raw Postgres

| Use Case | Recommended Solution |
|----------|---------------------|
| **Client-side leaderboards** | ✅ Supabase (REST API + Realtime) |
| **Real-time dashboards** | ✅ Supabase (WebSocket subscriptions) |
| **Backend analytics API** | ✅ Supabase (Edge Functions) |
| **Complex BI queries (Metabase/Tableau)** | ⚠️ Raw Postgres or ClickHouse (better query perf) |
| **High-volume event streaming (>10M/day)** | ✅ ClickHouse (columnar storage) |
| **Finance reconciliation (ACID)** | ✅ Raw Postgres or Supabase (both ACID-compliant) |
| **Fraud detection (low-latency lookups)** | ✅ Supabase or Raw Postgres + Redis |

**Verdict for Fruit Rush:**

🏆 **Supabase is the best choice** because:
1. Your PWA client can query leaderboards directly (no backend needed)
2. Realtime subscriptions enable live leaderboard updates
3. Cost-effective ($25/month Pro tier vs. $25 RDS + backend server costs)
4. Built-in auth, storage, and Edge Functions reduce engineering overhead
5. TypeScript-native API matches your PixiJS + TypeScript stack

---

## Updated `.env.example`

Add Supabase variables to your `.env.example`:

```bash
# =============================================================================
# Supabase Configuration (Alternative to raw Postgres)
# =============================================================================
# Supabase connection string for Goldsky Mirror
# Format: postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
DATABASE_URL=postgresql://postgres:password@db.abc123xyz.supabase.co:5432/postgres

# Supabase API credentials (for client-side queries)
# Get from: https://app.supabase.com/project/[PROJECT-REF]/settings/api
NEXT_PUBLIC_SUPABASE_URL=https://abc123xyz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Supabase service role key (for backend/admin operations — KEEP SECRET!)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Summary

**Supabase = Postgres + REST API + Realtime + Auth + Storage + Edge Functions**

For Fruit Rush, this means:
- ✅ Your PixiJS PWA queries leaderboards via `fetch()` (no backend server)
- ✅ Live leaderboard updates via WebSocket subscriptions
- ✅ Type-safe queries with auto-generated TypeScript types
- ✅ Row Level Security protects your data (only reads allowed from client)
- ✅ $25/month covers database + API + realtime + auth + storage
- ✅ Goldsky Mirror works identically (just point `DATABASE_URL` at Supabase)

**Recommendation:** Start with Supabase Free tier for dev/staging, upgrade to Pro ($25/month) for production. If you outgrow it (>1M events/month), migrate to ClickHouse for analytics while keeping Supabase for realtime features.

---

## Next Steps

1. Sign up: https://supabase.com
2. Create project: `fruit-rush-analytics`
3. Deploy schema: `psql $SUPABASE_DATABASE_URL -f db/schema.sql`
4. Configure RLS: Run policies from Step 4 above
5. Update `.env`: Add Supabase credentials
6. Deploy Goldsky: `goldsky mirror create mirror-pipeline.json`
7. Install client: `npm install @supabase/supabase-js`
8. Build realtime leaderboard: Use examples from Step 7

**Full Supabase docs:** https://supabase.com/docs

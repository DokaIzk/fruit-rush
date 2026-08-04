# ⚡️ Quick Start: Supabase Setup for Fruit Rush Analytics

This guide walks you through setting up Supabase from scratch. Takes ~15 minutes.

---

## Prerequisites

✅ A Supabase account (sign up at https://supabase.com — free tier works!)  
✅ `psql` installed (`brew install postgresql` on macOS)  
✅ Goldsky CLI (`npm install -g @goldsky/cli`)  
✅ Your Fruit Rush contracts deployed to Celo mainnet

---

## Step 1: Create Supabase Project (5 min)

### 1.1 Sign Up / Log In

Visit https://supabase.com and sign up with GitHub or email.

### 1.2 Create New Project

Click **"New Project"** and fill in:

| Field | Value |
|-------|-------|
| **Organization** | Create new or select existing |
| **Name** | `fruit-rush-analytics` |
| **Database Password** | Generate strong password (save it!) |
| **Region** | `us-west-1` (or closest to your users) |
| **Pricing Plan** | Free (for dev/staging) or Pro ($25/month for production) |

Click **"Create new project"** — takes ~2 minutes to provision.

### 1.3 Get Your Connection Details

Once the project is ready:

1. Go to **Settings** → **Database**
2. Scroll to **Connection String**
3. Click **URI** tab
4. Copy the connection string (looks like `postgresql://postgres.[PROJECT-REF]:[PASSWORD]@...`)
5. **Replace `[YOUR-PASSWORD]` with your database password**

Example:
```
postgresql://postgres.abc123xyz:SuperSecretPassword123@aws-0-us-west-1.pooler.supabase.com:6543/postgres
```

---

## Step 2: Configure Environment Variables (2 min)

### 2.1 Copy Template

```bash
cd /Users/admin/Desktop/fruit-rush
cp .env.example .env
```

### 2.2 Edit `.env`

Open `.env` in your editor and fill in:

```bash
# Goldsky API key (from https://app.goldsky.com/settings/api-keys)
GOLDSKY_API_KEY=your_goldsky_api_key_here

# Celo RPC URL
CELO_RPC_URL=https://forno.celo.org

# Supabase database connection (from Step 1.3)
DATABASE_URL=postgresql://postgres.abc123xyz:YourPassword@aws-0-us-west-1.pooler.supabase.com:6543/postgres

# Supabase API URL (from Settings → API → Project URL)
NEXT_PUBLIC_SUPABASE_URL=https://abc123xyz.supabase.co

# Supabase anon key (from Settings → API → Project API keys → anon public)
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Supabase service role key (from Settings → API → Project API keys → service_role)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Where to find API keys:**
1. Go to **Settings** → **API** in Supabase dashboard
2. Copy **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
3. Copy **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Copy **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (keep secret!)

---

## Step 3: Run Automated Setup Script (3 min)

We've prepared a script that does everything for you!

```bash
# Load environment variables
source .env

# Run setup script
./scripts/setup-supabase.sh
```

This script will:
1. ✅ Test connection to Supabase
2. ✅ Create database schema (5 tables with indexes)
3. ✅ Configure Row Level Security (public read, Goldsky-only write)
4. ✅ Verify setup
5. ✅ Display next steps

**Expected output:**
```
╔════════════════════════════════════════════════════════════════╗
║       Fruit Rush Analytics — Supabase Setup Script            ║
╚════════════════════════════════════════════════════════════════╝

[0/5] Checking prerequisites...
✓ Prerequisites checked

[1/5] Testing Supabase connection...
✓ Connected to Supabase Postgres

[2/5] Deploying database schema...
✓ Schema deployed successfully
  Created: 5 tables in fruit_rush schema

[3/5] Configuring Row Level Security policies...
✓ RLS policies configured
  Created: 5 RLS policies
  Access: Public read, service-role write only

[4/5] Verifying setup...
✓ All tables created successfully
✓ RLS enabled on all tables

[5/5] Extracting Supabase project info...
✓ Detected project: abc123xyz

═══════════════════════════════════════════════════════════════
Supabase project configured successfully!
═══════════════════════════════════════════════════════════════
```

---

## Step 4: Deploy Goldsky Mirror Pipeline (3 min)

### 4.1 Extract Contract ABIs

```bash
./scripts/extract-abis.sh
```

### 4.2 Update Contract Addresses

Edit `mirror-pipeline.json` and replace all `REPLACE_ME_*` placeholders:

```json
{
  "chains": {
    "celo-mainnet": {
      "contracts": {
        "FruitRushCosmetics": {
          "address": "0x3cE7C794bae69613800b54Df4E43d62d84C4f174",  // ← Your deployed address
          "startBlock": "25123456"  // ← Your deployment block number
        },
        "FruitRushBoast": {
          "address": "0xAc9C17Eed06D935C255E5E5c668C5EF07EC79181",  // ← Your deployed address
          "startBlock": "25123500"
        },
        "FruitRushTournament": {
          "address": "0xc396fa8D8fA76457eAD5772a936a896716D2640F",  // ← Your deployed address
          "startBlock": "25123600"
        }
      }
    }
  }
}
```

**Finding deployment block numbers:**
Check your deployment script output from `forge script`, or use Celoscan:
```bash
# Replace with your contract address
curl "https://api.celoscan.io/api?module=account&action=txlist&address=0x3cE7C794bae69613800b54Df4E43d62d84C4f174&startblock=0&endblock=99999999&sort=asc" | jq '.[0].blockNumber'
```

### 4.3 Authenticate with Goldsky

```bash
goldsky login --token $GOLDSKY_API_KEY
```

### 4.4 Deploy Pipeline

```bash
# Validate config first
goldsky mirror validate mirror-pipeline.json

# Deploy to Goldsky
goldsky mirror create mirror-pipeline.json

# Check status
goldsky mirror status fruit-rush-analytics
```

**Expected output:**
```
Pipeline: fruit-rush-analytics
Status: RUNNING
Streams:
  - cosmetic_mints: syncing (block 25,456,789 / 25,456,790)
  - boast_mints: syncing (block 25,456,789 / 25,456,790)
  - tournament_entries: syncing (block 25,456,789 / 25,456,790)
  ...
```

---

## Step 5: Verify Data Ingestion (2 min)

### 5.1 Check Database

```bash
# Load env vars
source .env

# Check row counts
psql $DATABASE_URL -c "SELECT COUNT(*) FROM fruit_rush.cosmetic_mints;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM fruit_rush.boast_mints;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM fruit_rush.tournament_entries;"
```

If counts are zero, wait a few minutes for Goldsky to sync historical events.

### 5.2 Check Supabase Dashboard

1. Go to https://app.supabase.com/project/[YOUR-PROJECT-REF]
2. Click **Table Editor** in left sidebar
3. Select `fruit_rush` schema from dropdown
4. Click on any table to see rows

You should see on-chain events appearing in real-time!

---

## Step 6: Test Client-Side Queries (5 min)

### 6.1 Install Supabase Client

```bash
cd client
npm install @supabase/supabase-js
```

### 6.2 Create Supabase Client

Create `client/src/lib/supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

### 6.3 Add Environment Variables to Client

Create `client/.env.local`:

```bash
VITE_SUPABASE_URL=https://abc123xyz.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 6.4 Query Leaderboard

Create `client/src/api/leaderboard.ts`:

```typescript
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

### 6.5 Test Query

```typescript
// In your component or console
import { getTopBoasters } from './api/leaderboard';

const leaders = await getTopBoasters(10);
console.log('Top 10 Boasters:', leaders);
```

**You're now querying on-chain data directly from your PWA!** 🎉

---

## Next Steps: Realtime Leaderboard

### Enable Realtime Subscriptions

```typescript
// Subscribe to new boast mints
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
      // Update your leaderboard UI here
    }
  )
  .subscribe();

// Cleanup when component unmounts
return () => subscription.unsubscribe();
```

**This gives you live leaderboards with ~100ms latency!**

See `docs/mirror-supabase.md` for complete examples with React hooks.

---

## Troubleshooting

### ❌ "psql: connection refused"

**Fix:** Check your `DATABASE_URL` in `.env`. Make sure:
1. Password is correct (no spaces, URL-encoded if special chars)
2. Project reference matches your Supabase project
3. You're using the **Connection Pooling** URL (port 6543), not Direct Connection (port 5432)

### ❌ "permission denied for schema fruit_rush"

**Fix:** Run the RLS setup:
```bash
psql $DATABASE_URL -f db/supabase-rls.sql
```

### ❌ "goldsky mirror: command not found"

**Fix:** Install Goldsky CLI:
```bash
npm install -g @goldsky/cli
```

### ❌ Goldsky pipeline stuck at "SYNCING"

**Fix:** Check your contract addresses and start blocks in `mirror-pipeline.json`. If blocks are too high, Goldsky has nothing to index.

### ❌ Client queries return empty array

**Possible causes:**
1. Goldsky hasn't synced events yet (wait a few minutes)
2. No events emitted on-chain yet (mint a test cosmetic/boast)
3. RLS policies too restrictive (check policies in Supabase dashboard)

Run this to test RLS:
```sql
-- In psql or Supabase SQL Editor
SET ROLE anon;
SELECT COUNT(*) FROM fruit_rush.boast_mints;
RESET ROLE;
```

If this fails, check your RLS policies.

---

## Cost Estimate

**Development (Free Tier):**
- Supabase: $0/month (up to 500 MB database)
- Goldsky: ~$0.10/month (low event volume)
- **Total: ~$0.10/month**

**Production (Month 6 at PRD targets):**
- Supabase Pro: $25/month (8 GB database, 250 GB bandwidth)
- Goldsky: ~$0.50/month (~50K events/month)
- **Total: ~$25.50/month**

---

## What You've Built

✅ **Real-time on-chain analytics** — Events streamed from Celo → Supabase in <1 second  
✅ **Client-side queries** — Your PWA fetches leaderboards via REST API (no backend!)  
✅ **Live updates** — WebSocket subscriptions push new boasts to all connected players  
✅ **Secure by default** — Row Level Security allows reads, blocks writes  
✅ **Type-safe** — Auto-generated TypeScript types for your queries  
✅ **Cost-effective** — $25/month covers database + API + realtime + auth + storage  

---

## Documentation Links

- **Full Supabase guide**: `docs/mirror-supabase.md` (realtime examples, Edge Functions)
- **Analytics queries**: `db/analytics-queries.sql` (daily revenue, retention, fraud detection)
- **Goldsky setup**: `docs/mirror-setup.md` (ClickHouse alternative, troubleshooting)
- **PRD**: `PRD.md` (business requirements, success metrics)

---

## Support

- **Supabase Docs**: https://supabase.com/docs
- **Goldsky Docs**: https://docs.goldsky.com/mirror
- **Goldsky Discord**: https://discord.gg/goldsky
- **Internal**: #data-engineering Slack channel

---

*Setup complete! Your analytics infrastructure is now live.* 🚀

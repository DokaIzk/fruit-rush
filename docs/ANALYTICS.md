# Fruit Rush Analytics Infrastructure

## Overview

This directory contains the Goldsky Mirror pipeline configuration and SQL schema for streaming Fruit Rush on-chain events from Celo mainnet into a Postgres analytics database in real time.

**What's included:**
- `mirror-pipeline.json` — Goldsky Mirror pipeline definition
- `db/schema.sql` — Postgres DDL (tables, indexes, views)
- `db/analytics-queries.sql` — Example SQL queries for BI dashboards
- `docs/mirror-setup.md` — Complete setup and troubleshooting guide
- `abis/` — Contract ABI files (generated from Foundry artifacts)

---

## Database Options

Choose your analytics database based on your use case:

| Option | Best For | Monthly Cost | Setup Time |
|--------|----------|--------------|------------|
| **Supabase** ⭐️ | PWA client queries, realtime leaderboards, serverless | $0–25 | 10 min |
| **Raw Postgres** | Traditional BI tools, custom backend | $25+ | 20 min |
| **ClickHouse** | High-volume analytics (>10M events/month) | $50+ | 30 min |

**Recommendation for Fruit Rush:** **Supabase** — your PixiJS PWA can query leaderboards directly via REST API, with realtime WebSocket updates. See `docs/mirror-supabase.md` for full guide.

---

## Quick Start

### 1. Prerequisites

```bash
# Install Goldsky CLI
npm install -g @goldsky/cli

# Verify installation
goldsky --version
```

### 2. Generate Contract ABIs

```bash
cd contracts
forge build

# Extract ABIs
jq '.abi' out/FruitRushCosmetics.sol/FruitRushCosmetics.json > ../abis/FruitRushCosmetics.json
jq '.abi' out/FruitRushBoast.sol/FruitRushBoast.json > ../abis/FruitRushBoast.json
jq '.abi' out/FruitRushTournament.sol/FruitRushTournament.json > ../abis/FruitRushTournament.json
```

### 3. Configure Environment

**Option A: Supabase (Recommended)**
```bash
# Sign up at https://supabase.com and create a project
# Get your connection string from Settings → Database → Connection String

# Copy template
cp .env.example .env

# Edit .env and fill in:
# - GOLDSKY_API_KEY
# - CELO_RPC_URL
# - DATABASE_URL (Supabase Postgres URL)
# - NEXT_PUBLIC_SUPABASE_URL
# - NEXT_PUBLIC_SUPABASE_ANON_KEY
```

See `docs/mirror-supabase.md` for detailed Supabase setup (REST API, Realtime, RLS).

**Option B: Raw Postgres**
```bash
# Copy template
cp .env.example .env

# Edit .env and fill in:
# - GOLDSKY_API_KEY
# - CELO_RPC_URL
# - DATABASE_URL (standard Postgres connection string)
```

### 4. Update Contract Addresses

Edit `mirror-pipeline.json` and replace all `REPLACE_ME_*` placeholders with:
- Your deployed contract addresses (see `AGENTS.md` for addresses)
- Deployment block numbers (reduces sync time by skipping early blocks)

### 5. Create Database Schema

```bash
psql $DATABASE_URL -f db/schema.sql
```

### 6. Deploy Pipeline

```bash
# Authenticate
goldsky login --token $GOLDSKY_API_KEY

# Validate config
goldsky mirror validate mirror-pipeline.json

# Deploy
goldsky mirror create mirror-pipeline.json

# Check status
goldsky mirror status fruit-rush-analytics
```

### 7. Verify Data Ingestion

```bash
# Check row counts
psql $DATABASE_URL -c "SELECT COUNT(*) FROM fruit_rush.cosmetic_mints;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM fruit_rush.boast_mints;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM fruit_rush.tournament_entries;"
```

---

## Data Streams

| Stream ID | Source Contract | Event | Purpose |
|-----------|-----------------|-------|---------|
| `cosmetic_mints` | FruitRushCosmetics | `CosmeticMinted` | Track cosmetic NFT sales and inventory |
| `boast_mints` | FruitRushBoast | `BoastMinted` | Track score attestations and leaderboard data |
| `tournament_entries` | FruitRushTournament | `PlayerEntered` | Track tournament entry-fee revenue |
| `tournament_payouts` | FruitRushTournament | `TournamentFinalized` | Track prize distributions and house rake |
| `tournament_refunds` | FruitRushTournament | `TournamentRefunded` | Track cancelled tournaments for reconciliation |

---

## Database Schema

### Tables

All tables live in the `fruit_rush` schema:

- **`cosmetic_mints`** — ERC-1155 cosmetic NFT mints
  - Primary key: `(transaction_hash, log_index)`
  - Indexes: `player_address`, `block_timestamp DESC`, `token_id`, `block_number`

- **`boast_mints`** — On-chain score attestations
  - Primary key: `(transaction_hash, log_index)`
  - Unique: `boast_id`
  - Indexes: `player_address`, `block_timestamp DESC`, `score DESC`, `game_mode`

- **`tournament_entries`** — Tournament entry payments
  - Primary key: `(transaction_hash, log_index)`
  - Unique: `(tournament_id, player_address)`
  - Indexes: `tournament_id`, `player_address`, `block_timestamp DESC`

- **`tournament_payouts`** — Tournament prize distributions
  - Primary key: `(transaction_hash, log_index)`
  - Unique: `tournament_id`
  - Indexes: `tournament_id`, `block_timestamp DESC`, `rake`

- **`tournament_refunds`** — Cancelled tournaments
  - Primary key: `(transaction_hash, log_index)`
  - Unique: `tournament_id`
  - Indexes: `tournament_id`, `block_timestamp DESC`

### Metadata Columns

All tables include:
- `_goldsky_ingested_at` — Timestamp when Goldsky wrote the row to Postgres

---

## Example Analytics Queries

See `db/analytics-queries.sql` for ready-to-run SQL queries:

1. **Daily revenue by stream** — Cosmetics vs. boasts vs. tournament rake (in cUSD)
2. **7-day rolling player retention** — Week N → Week N+1 cohort analysis
3. **Top-10 boasters by cumulative score** — All-time leaderboard
4. **Fraud detection** — Flag unusual boast frequency or score patterns
5. **Tournament economics** — Verify ≥15% rake, reconcile prize pools
6. **Monthly Active Users (MAU)** — Track growth KPIs from PRD

### Running Queries

```bash
# Run a single query
psql $DATABASE_URL -f db/analytics-queries.sql

# Or connect interactively
psql $DATABASE_URL
fruit_rush_analytics=> SET search_path TO fruit_rush;
fruit_rush_analytics=> \i db/analytics-queries.sql
```

---

## Business Use Cases

### 1. BI Dashboards (CFO/Exec)
Connect your BI tool (Metabase, Tableau, Looker, PowerBI) to the Postgres database and visualize:
- Daily/monthly revenue by stream
- MAU, DAU, paying user %
- ARPPU (average revenue per paying user)
- Tournament rake vs. prize pool ratios

### 2. Fraud Detection (Operations)
Run automated queries to flag:
- Players boasting more than once per hour (bot-like)
- Suspiciously low score variance (replay attacks)
- Tournament entry patterns (multi-account abuse)

### 3. Finance Reconciliation (Accounting)
- Cross-check on-chain rake vs. off-chain treasury balances
- Audit tournament prize distributions
- Track refund liabilities
- Generate monthly P&L reports

### 4. Player Analytics (Product)
- Cohort retention curves
- Spending patterns by player segment
- Cosmetic popularity (top-selling token IDs)
- Game mode preferences (classic vs. arcade vs. zen)

---

## Reorg Handling

Goldsky Mirror automatically handles Celo chain reorganizations:

**Configuration:**
```json
"reorgHandling": {
  "enabled": true,
  "maxDepth": 64,
  "strategy": "delete-and-reinsert"
}
```

**How it works:**
1. Goldsky detects a reorg up to 64 blocks deep
2. Deletes affected rows from Postgres (matching `block_number`)
3. Re-ingests events from the new canonical chain

**No manual intervention required.** The `_goldsky_ingested_at` timestamp helps debug reorg issues if needed.

**Note:** Celo's 1-second block time and Plumo light-client consensus make deep reorgs extremely rare. A `maxDepth` of 64 covers >99.99% of cases.

---

## Performance Considerations

### Indexing Strategy
All tables have indexes on:
- `player_address` — Fast player-specific queries
- `block_timestamp DESC` — Fast time-range filters
- Event-specific columns (e.g., `tournament_id`, `score`)

### Query Optimization Tips
1. **Date filters**: Always include `block_timestamp` ranges to leverage indexes
2. **Aggregations**: Use materialized views for frequently accessed metrics (refresh daily)
3. **Joins**: Player-centric queries naturally join on `player_address`
4. **Large scans**: Run heavy analytics queries off-hours or on read replicas

### Scaling
- **Small scale** (<1M events/month): Single Postgres instance (2 vCPU, 4 GB RAM)
- **Medium scale** (1–10M events/month): Add read replicas for analytics queries
- **Large scale** (>10M events/month): Consider switching to ClickHouse sink (see `docs/mirror-setup.md`)

---

## Monitoring

### Pipeline Health
```bash
# Check sync lag
goldsky mirror status fruit-rush-analytics

# Tail logs for errors
goldsky mirror logs fruit-rush-analytics --follow --filter error
```

### Database Health
```bash
# Table sizes
psql $DATABASE_URL -c "\dt+ fruit_rush.*"

# Query performance
psql $DATABASE_URL -c "SELECT * FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;"

# Index usage
psql $DATABASE_URL -c "SELECT schemaname, tablename, indexname, idx_scan FROM pg_stat_user_indexes WHERE schemaname = 'fruit_rush' ORDER BY idx_scan ASC;"
```

### Alerts
Set up alerts for:
- Pipeline lag > 5 minutes (Goldsky native alerting)
- Error rate > 1% (Goldsky native alerting)
- Database disk usage > 80% (CloudWatch/Datadog)
- Query latency p95 > 500ms (Application monitoring)

---

## Cost Breakdown

### Goldsky Mirror
- **Indexing**: ~$0.01 per 1M events indexed
- **Egress**: ~$0.05 per GB streamed to Postgres
- **Estimated**: ~$0.10–0.50/month (varies with volume)

### Infrastructure
- **Postgres hosting**: $20–200/month (depends on instance size)
- **Celo RPC**: Free (public) or $50–500/month (private, rate-limited)
- **Total**: ~$20–700/month depending on scale

**Optimization:**
- Use public Celo RPC for dev/staging (free)
- Use private RPC for production (faster sync, higher rate limits)
- Start with smallest Postgres instance; scale up based on actual load

---

## Troubleshooting

See `docs/mirror-setup.md` for detailed troubleshooting steps. Common issues:

| Problem | Solution |
|---------|----------|
| Pipeline stuck at "SYNCING" | Check RPC rate limits, restart pipeline |
| Missing events in Postgres | Verify ABI, check `startBlock`, review logs |
| High ingestion lag | Increase `batchSize`, optimize Postgres indexes |
| Reorg causing data gaps | Increase `maxDepth`, check RPC stability |

---

## Next Steps

1. **Deploy to production**: Follow `docs/mirror-setup.md`
2. **Connect BI tool**: Point Metabase/Tableau at Postgres
3. **Set up dashboards**: Use queries from `db/analytics-queries.sql`
4. **Enable alerting**: Configure Goldsky + Postgres monitoring
5. **Backfill historical data**: If needed, run manual backfill from deployment block
6. **Production hardening**:
   - Enable Postgres replication (read replicas)
   - Set up daily backups
   - Configure VPC peering (Goldsky ↔ your database)

---

## Architecture Diagram

```
┌─────────────────┐
│  Celo Mainnet   │
│   (Chain 42220) │
└────────┬────────┘
         │ Events emitted
         │
         ▼
┌─────────────────┐
│  Goldsky Mirror │ ← Indexes events in real-time
│  (Managed SaaS) │    with automatic reorg handling
└────────┬────────┘
         │ Streams to sink
         │
         ▼
┌─────────────────┐
│    Postgres     │ ← SQL analytics database
│  fruit_rush DB  │    (tables + indexes + views)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  BI Dashboards  │ ← Metabase, Tableau, Looker
│  Fraud Alerts   │    Application backend
│  Finance Reports│    Data science notebooks
└─────────────────┘
```

---

## Security & Compliance

### Data Privacy
- **PII**: Only wallet addresses stored (public blockchain data)
- **No personal info**: No emails, names, KYC data in analytics DB
- **GDPR/CCPA**: Wallet addresses are pseudonymous identifiers

### Access Control
- **Postgres roles**: Grant read-only access to analytics users
- **Query audit logs**: Enable `pg_stat_statements` for query tracking
- **Network security**: Use VPC peering or IP allowlists for Postgres access

### Credentials
- **Never commit** `.env` to version control (already in `.gitignore`)
- **Rotate keys**: Goldsky API key, Postgres password every 90 days
- **Use secrets manager**: AWS Secrets Manager, HashiCorp Vault, etc.

---

## Support

- **Goldsky Docs**: https://docs.goldsky.com/mirror
- **Goldsky Discord**: https://discord.gg/goldsky (community support)
- **Internal**: #data-engineering Slack channel
- **Emergency**: Goldsky support portal (enterprise plan only)

---

## Contributing

When updating the analytics pipeline:

1. **Test in staging** first (separate pipeline + database)
2. **Update docs** — keep `mirror-setup.md` and this file in sync
3. **Version control** — commit all config changes with clear messages
4. **Schema migrations** — use Flyway/Liquibase for database changes
5. **Validate queries** — run all queries in `analytics-queries.sql` after schema changes

---

## References

- **Supabase Setup**: `docs/mirror-supabase.md` — **Recommended** — PWA-friendly REST API + Realtime
- **PRD**: `PRD.md` — Product Requirements Document
- **Contracts**: `AGENTS.md` — Smart contract overview and conventions
- **Setup Guide**: `docs/mirror-setup.md` — Raw Postgres/ClickHouse deployment
- **SQL Queries**: `db/analytics-queries.sql` — Example analytics queries
- **Schema DDL**: `db/schema.sql` — Database table definitions

---

*Last updated: 2026-08-03*

# Goldsky Mirror Setup Guide

## Overview

This guide explains how to configure and run the Goldsky Mirror pipeline that streams Fruit Rush on-chain events from Celo mainnet into a Postgres analytics database in real time.

**What is Goldsky Mirror?**

Goldsky Mirror is a managed service that indexes blockchain events and streams them into data sinks (Postgres, ClickHouse, Kafka, etc.) with automatic reorg handling. Unlike traditional subgraphs, Mirror gives you direct SQL access to your on-chain data for BI, fraud detection, and finance reconciliation.

---

## Prerequisites

1. **Goldsky Account**: Sign up at https://goldsky.com
2. **Goldsky CLI**: Install via npm:
   ```bash
   npm install -g @goldsky/cli
   ```
3. **Postgres Database**: A Postgres instance (v12+) accessible from Goldsky's infrastructure
4. **Celo RPC URL**: A reliable Celo mainnet RPC endpoint (public or private)
5. **Contract ABIs**: Export ABIs from your Foundry project (see below)

---

## Step 1: Export Contract ABIs

Goldsky needs the contract ABIs to decode events. Export them from your Foundry build artifacts:

```bash
cd contracts

# Build contracts first
forge build

# Extract ABIs (using jq)
jq '.abi' out/FruitRushCosmetics.sol/FruitRushCosmetics.json > ../abis/FruitRushCosmetics.json
jq '.abi' out/FruitRushBoast.sol/FruitRushBoast.json > ../abis/FruitRushBoast.json
jq '.abi' out/FruitRushTournament.sol/FruitRushTournament.json > ../abis/FruitRushTournament.json
```

Verify the ABI files exist:
```bash
ls -lh ../abis/
```

---

## Step 2: Configure Environment Variables

Create a `.env` file in the project root with your credentials:

```bash
# Goldsky API credentials
GOLDSKY_API_KEY=your_goldsky_api_key_here

# Celo RPC endpoint
CELO_RPC_URL=https://forno.celo.org  # or your private RPC

# Postgres connection string (format: postgresql://user:password@host:port/database)
DATABASE_URL=postgresql://analytics_user:password@db.example.com:5432/fruit_rush_analytics

# Optional: Enable debug logging
GOLDSKY_LOG_LEVEL=info
```

**Security Note**: Never commit `.env` to version control. Add it to `.gitignore`.

---

## Step 3: Update Contract Addresses in Pipeline Config

Edit `mirror-pipeline.json` and replace the placeholder addresses with your deployed contract addresses:

```json
{
  "chains": {
    "celo-mainnet": {
      "contracts": {
        "FruitRushCosmetics": {
          "address": "0x3cE7C794bae69613800b54Df4E43d62d84C4f174",  // ← Replace
          "startBlock": "25123456"  // ← Replace with deployment block number
        },
        "FruitRushBoast": {
          "address": "0xAc9C17Eed06D935C255E5E5c668C5EF07EC79181",  // ← Replace
          "startBlock": "25123500"  // ← Replace
        },
        "FruitRushTournament": {
          "address": "0xc396fa8D8fA76457eAD5772a936a896716D2640F",  // ← Replace
          "startBlock": "25123600"  // ← Replace
        }
      }
    }
  }
}
```

**Finding Deployment Block Numbers:**
```bash
# Using Celoscan API
curl "https://api.celoscan.io/api?module=account&action=txlist&address=0x3cE7C794bae69613800b54Df4E43d62d84C4f174&startblock=0&endblock=99999999&sort=asc&apikey=YOUR_CELOSCAN_API_KEY" | jq '.[0].blockNumber'
```

Or check your deployment script output from `forge script`.

---

## Step 4: Create Database Schema

Run the DDL to create tables and indexes in your Postgres database:

```bash
# Connect to your Postgres instance
psql $DATABASE_URL

# Run the schema creation script
\i db/schema.sql

# Verify tables were created
\dt fruit_rush.*

# Exit psql
\q
```

Expected output:
```
                List of relations
   Schema    |        Name         | Type  |      Owner
-------------+---------------------+-------+------------------
 fruit_rush  | boast_mints         | table | analytics_user
 fruit_rush  | cosmetic_mints      | table | analytics_user
 fruit_rush  | tournament_entries  | table | analytics_user
 fruit_rush  | tournament_payouts  | table | analytics_user
 fruit_rush  | tournament_refunds  | table | analytics_user
```

---

## Step 5: Authenticate with Goldsky

Log in to Goldsky CLI with your API key:

```bash
goldsky login --token $GOLDSKY_API_KEY
```

---

## Step 6: Start the Mirror Pipeline

Deploy the pipeline configuration to Goldsky:

```bash
# Validate the config first (local check)
goldsky mirror validate mirror-pipeline.json

# Deploy the pipeline
goldsky mirror create mirror-pipeline.json

# Check pipeline status
goldsky mirror status fruit-rush-analytics
```

Expected output:
```
Pipeline: fruit-rush-analytics
Status: RUNNING
Streams:
  - cosmetic_mints: syncing (block 25,456,789 / 25,456,790)
  - boast_mints: syncing (block 25,456,789 / 25,456,790)
  - tournament_entries: syncing (block 25,456,789 / 25,456,790)
  - tournament_payouts: syncing (block 25,456,789 / 25,456,790)
  - tournament_refunds: syncing (block 25,456,789 / 25,456,790)
```

---

## Step 7: Verify Data Ingestion

Check that data is flowing into Postgres:

```bash
psql $DATABASE_URL -c "SELECT COUNT(*) FROM fruit_rush.cosmetic_mints;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM fruit_rush.boast_mints;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM fruit_rush.tournament_entries;"
```

If counts are zero after a few minutes, check:
1. **Block range**: Ensure `startBlock` is set to your deployment block
2. **Contract addresses**: Verify addresses match deployed contracts
3. **RPC connectivity**: Test `curl $CELO_RPC_URL` responds
4. **Logs**: Run `goldsky mirror logs fruit-rush-analytics`

---

## Monitoring and Maintenance

### View Pipeline Logs

```bash
# Tail real-time logs
goldsky mirror logs fruit-rush-analytics --follow

# View last 100 lines
goldsky mirror logs fruit-rush-analytics --lines 100
```

### Check Sync Status

```bash
# Detailed sync status per stream
goldsky mirror status fruit-rush-analytics --verbose
```

### Pause/Resume Pipeline

```bash
# Pause during maintenance
goldsky mirror pause fruit-rush-analytics

# Resume after maintenance
goldsky mirror resume fruit-rush-analytics
```

### Update Pipeline Config

```bash
# After editing mirror-pipeline.json
goldsky mirror update fruit-rush-analytics mirror-pipeline.json

# Goldsky will apply changes without losing data
```

### Delete Pipeline

```bash
# WARNING: This stops ingestion but does NOT delete Postgres data
goldsky mirror delete fruit-rush-analytics
```

---

## Reorg Handling

Goldsky Mirror automatically handles chain reorganizations:

- **Detection**: Monitors up to 64 blocks deep (configurable via `maxDepth`)
- **Strategy**: `delete-and-reinsert` (default)
  1. Detects a reorg on Celo
  2. Deletes affected rows from Postgres (based on `block_number`)
  3. Re-ingests events from the new canonical chain

**No manual intervention required.** The `_goldsky_ingested_at` timestamp tracks when data was last written, which helps debug reorg-related issues.

**Example reorg scenario:**
```
Block 1000: Alice mints cosmetic → ingested to Postgres
Block 1001: Reorg detected, block 1000 was orphaned
→ Goldsky deletes all rows with block_number=1000
→ Goldsky re-ingests events from new block 1000 (if Alice's tx is still included)
```

---

## Alternative Sink: ClickHouse

Goldsky Mirror supports ClickHouse for high-throughput analytical queries. To switch from Postgres to ClickHouse:

### Step 1: Update Pipeline Config

Replace the `postgres` sink with `clickhouse`:

```json
{
  "sinks": {
    "clickhouse": {
      "type": "clickhouse",
      "host": "clickhouse.example.com",
      "port": 9000,
      "database": "fruit_rush",
      "username": "${CLICKHOUSE_USER}",
      "password": "${CLICKHOUSE_PASSWORD}",
      "batchSize": 1000,
      "flushIntervalMs": 5000,
      "reorgHandling": {
        "enabled": true,
        "maxDepth": 64,
        "strategy": "delete-and-reinsert"
      }
    }
  },
  "streams": [
    {
      "id": "cosmetic_mints",
      "sink": {
        "target": "clickhouse",  // ← Changed from "postgres"
        "table": "cosmetic_mints",
        "mapping": { ... }
      }
    }
    // ... update all streams
  ]
}
```

### Step 2: Create ClickHouse Schema

Adapt the Postgres DDL to ClickHouse syntax:

```sql
CREATE DATABASE IF NOT EXISTS fruit_rush;

CREATE TABLE fruit_rush.cosmetic_mints (
    player_address      String,
    token_id            UInt256,
    amount              UInt256,
    block_number        UInt64,
    block_timestamp     DateTime,
    transaction_hash    String,
    log_index           UInt32,
    _goldsky_ingested_at DateTime DEFAULT now()
)
ENGINE = MergeTree()
ORDER BY (block_timestamp, player_address)
PRIMARY KEY (block_timestamp);

-- Repeat for other tables
```

### Step 3: Deploy Updated Config

```bash
goldsky mirror update fruit-rush-analytics mirror-pipeline.json
```

**When to use ClickHouse vs. Postgres:**

| Use Case | Recommended Sink |
|----------|------------------|
| BI dashboards (complex joins, aggregations) | ClickHouse |
| Real-time fraud detection (low-latency lookups) | Postgres |
| Finance reconciliation (ACID guarantees) | Postgres |
| High-volume event streaming (>10M events/day) | ClickHouse |
| Application backend (transactional queries) | Postgres |

---

## Troubleshooting

### Pipeline Stuck at "SYNCING"

**Symptoms:** Status shows block lag not decreasing.

**Fixes:**
1. Check RPC rate limits: `goldsky mirror logs fruit-rush-analytics | grep "rate limit"`
2. Increase RPC throughput: Use a private RPC provider (Alchemy, Infura, QuickNode)
3. Restart pipeline: `goldsky mirror restart fruit-rush-analytics`

### Missing Events in Postgres

**Symptoms:** Contract emitted event on-chain but not in database.

**Fixes:**
1. Verify event signature in ABI matches contract: `cast abi-decode` the event
2. Check `startBlock` is not set too high (after event emission)
3. Review logs for decoding errors: `goldsky mirror logs fruit-rush-analytics --filter error`

### Reorg Causing Data Gaps

**Symptoms:** Rows deleted but not re-inserted after reorg.

**Fixes:**
1. Increase `maxDepth` if reorgs are deeper than 64 blocks (rare on Celo)
2. Check RPC stability: `curl $CELO_RPC_URL -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'`
3. Contact Goldsky support with pipeline ID

### High Ingestion Lag

**Symptoms:** Block lag growing over time (e.g., 100 blocks behind).

**Fixes:**
1. Increase `batchSize` (e.g., 500 instead of 100) for higher throughput
2. Optimize Postgres indexes: `ANALYZE fruit_rush.cosmetic_mints;`
3. Scale Postgres instance (CPU/IOPS bottleneck)

---

## Cost Estimation

Goldsky Mirror pricing (as of 2026, confirm current rates):
- **Indexing**: ~$0.01 per 1M events indexed
- **Egress**: ~$0.05 per GB streamed to sink
- **Storage**: Sink storage costs (Postgres/ClickHouse hosting) billed separately

**Estimated monthly cost for Fruit Rush:**
- 1M cosmetic mints/month: $0.01
- 500K boast mints/month: $0.005
- 100K tournament entries/month: $0.001
- Total indexing: ~$0.02/month
- Postgres egress: ~2 GB/month = $0.10
- **Total Goldsky cost**: ~$0.12/month + Postgres hosting (~$20–50/month)

---

## Next Steps

1. **Set up BI dashboards**: Connect Metabase/Tableau/Looker to Postgres using queries from `db/analytics-queries.sql`
2. **Enable alerting**: Configure Goldsky alerts for lag > 5 minutes or error rate > 1%
3. **Backfill historical data**: If contracts were deployed before pipeline start, run a manual backfill
4. **Optimize queries**: Add materialized views for frequently accessed aggregations (MAU, daily revenue)
5. **Production hardening**:
   - Enable Postgres replication (read replicas for analytics queries)
   - Set up daily backups
   - Configure VPC peering between Goldsky and your database (lower latency)

---

## Support

- **Goldsky Docs**: https://docs.goldsky.com/mirror
- **Goldsky Discord**: https://discord.gg/goldsky
- **Celo Docs**: https://docs.celo.org
- **Internal Team**: #data-engineering Slack channel

---

## Appendix: Example Commands Cheat Sheet

```bash
# Deploy pipeline
goldsky mirror create mirror-pipeline.json

# Check status
goldsky mirror status fruit-rush-analytics

# Tail logs
goldsky mirror logs fruit-rush-analytics --follow

# Pause pipeline
goldsky mirror pause fruit-rush-analytics

# Resume pipeline
goldsky mirror resume fruit-rush-analytics

# Update config
goldsky mirror update fruit-rush-analytics mirror-pipeline.json

# Delete pipeline (DANGER: stops ingestion)
goldsky mirror delete fruit-rush-analytics

# Query Postgres
psql $DATABASE_URL -f db/analytics-queries.sql

# Test RPC connectivity
curl $CELO_RPC_URL -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

# Fruit Rush Subgraph

Goldsky/The Graph subgraph that indexes all on-chain events for the Fruit Rush game on **Celo Mainnet** (chain ID 42220).

## Indexed Contracts

| Contract | Address | Start Block |
|----------|---------|-------------|
| `FruitRushCosmetics` (proxy) | `0x054ecDa9539a6ac8cE5F262AD803C477182d35c6` | 72064337 |
| `FruitRushBoast` | `0xFE1B6115A3FB7b60A184d070DC952E8fA1611097` | 72063112 |
| `FruitRushTournament` (proxy) | `0x6982756F58380B61755B4Ddf5587c6325dB8f172` | 72063302 |

---

## Project Structure

```
subgraph/
├── subgraph.yaml          # Manifest — data sources, ABIs, event handlers
├── schema.graphql         # Entity definitions
├── queries.graphql        # Sample GraphQL queries for the frontend/backend
├── package.json
├── abis/
│   ├── FruitRushCosmetics.json
│   ├── FruitRushBoast.json
│   └── FruitRushTournament.json
└── src/
    └── mappings/
        ├── cosmetics.ts   # CosmeticMinted, ItemTypeAdded, TransferSingle/Batch
        ├── boast.ts       # BoastMinted
        └── tournament.ts  # TournamentCreated, PlayerEntered, Finalized, Refunded
```

---

## Prerequisites

```bash
# Install graph-cli globally (used for codegen + build)
npm install -g @graphprotocol/graph-cli

# Install Goldsky CLI
curl https://goldsky.com/install | sh

# Authenticate with Goldsky (one-time)
goldsky login
```

---

## Step-by-Step Deploy

### 1. Install dependencies
```bash
cd subgraph/
npm install
```

### 2. Generate AssemblyScript types from schema + ABIs
```bash
npm run codegen
# or: graph codegen
```
This generates `generated/` types used in the mapping files.

### 3. Build the subgraph
```bash
npm run build
# or: graph build
```

### 4. Deploy to Goldsky
```bash
goldsky subgraph deploy fruit-rush/v1 --path .
```

After deployment, Goldsky will print a **GraphQL endpoint URL** like:
```
https://api.goldsky.com/api/public/<project-id>/subgraphs/fruit-rush/v1/gn
```

Store this URL in your backend `.env` as `GOLDSKY_SUBGRAPH_URL`.

---

## Incremental Upgrades — `--startBlock` Strategy

> **Goal:** When you add new event types in v2, avoid re-syncing from block 0.

The Goldsky subgraph manifest (`subgraph.yaml`) specifies a `startBlock` per data source.
Each data source's `startBlock` is set to the block where that contract was deployed —
not block 0. This means:

- Any upgrade that only **adds** new entities/handlers to an existing data source
  must keep the **same `startBlock`** so historical events are re-processed.
- If you add an **entirely new contract** data source in v2, set its `startBlock` to
  that contract's deploy block. Goldsky will sync it independently without
  re-processing the other contracts from block 0.

### Workflow for a v2 upgrade

1. Make your schema/mapping changes.
2. Update `subgraph.yaml` — set `startBlock` for any new data sources.
3. Run codegen and build:
   ```bash
   npm run codegen && npm run build
   ```
4. Deploy as a new named version (Goldsky keeps v1 live until you deprecate it):
   ```bash
   goldsky subgraph deploy fruit-rush/v2 --path .
   ```
5. Verify the v2 endpoint is fully synced in the Goldsky dashboard, then update
   `GOLDSKY_SUBGRAPH_URL` in production.
6. Deprecate v1 once v2 is healthy:
   ```bash
   goldsky subgraph delete fruit-rush/v1
   ```

### What requires a full re-sync

- Changing the **ID generation scheme** for an existing immutable entity
- Removing a field that is already populated in historical data
- Changing the `startBlock` to an earlier block number

If any of these are needed, treat it as a breaking schema migration and deploy a
separate subgraph name (e.g. `fruit-rush-v2/v1`).

---

## Sample Queries

See [`queries.graphql`](./queries.graphql) for ready-to-run queries:

| Query | Purpose |
|-------|---------|
| `PlayerInventory` | All cosmetic items owned by a wallet |
| `PlayerBoastHistory` | All boast attestations by a wallet |
| `TournamentLeaderboard` | Live entry list sorted by join order |
| `TournamentPayouts` | Final prize distribution after close |
| `PlayerTournamentHistory` | Tournaments entered + winnings |
| `OpenTournaments` | All currently active tournaments |
| `ItemTransferHistory` | Recent transfers for a specific cosmetic token |

---

## Entities

| Entity | Description |
|--------|-------------|
| `CosmeticItem` | An ERC-1155 token type registered via `addItemType` |
| `CosmeticBalance` | Per-wallet balance for a cosmetic item |
| `CosmeticTransfer` | Individual ERC-1155 transfer record |
| `Boast` | Immutable on-chain score attestation |
| `Tournament` | Full tournament lifecycle record |
| `TournamentEntry` | Immutable record of a player joining a tournament |
| `TournamentPayout` | Immutable winner payout record (one row per winner rank) |

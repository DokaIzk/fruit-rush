-- ============================================================================
-- Fruit Rush Analytics Database Schema
-- ============================================================================
-- Purpose: Store real-time on-chain event data from Fruit Rush contracts
--          for BI dashboards, fraud detection, and finance reconciliation.
-- Source:  Goldsky Mirror pipeline streaming from Celo mainnet (chain ID 42220)
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS fruit_rush;

SET search_path TO fruit_rush;

-- ============================================================================
-- TABLE: cosmetic_mints
-- ============================================================================
-- Purpose: Track all ERC-1155 cosmetic NFT mints from FruitRushCosmetics
-- Source Event: CosmeticMinted(address indexed to, uint256 indexed tokenId, uint256 amount)
-- Business Use: Revenue tracking, inventory analytics, player spending patterns
-- ============================================================================

CREATE TABLE IF NOT EXISTS cosmetic_mints (
    -- Primary event data
    player_address      VARCHAR(42)     NOT NULL,  -- Ethereum address (0x + 40 hex chars)
    token_id            NUMERIC(78, 0)  NOT NULL,  -- uint256 (up to 2^256-1)
    amount              NUMERIC(78, 0)  NOT NULL,  -- Number of NFTs minted
    
    -- Blockchain context
    block_number        BIGINT          NOT NULL,
    block_timestamp     TIMESTAMP       NOT NULL,  -- Unix timestamp converted to PostgreSQL timestamp
    transaction_hash    VARCHAR(66)     NOT NULL,  -- 0x + 64 hex chars
    log_index           INTEGER         NOT NULL,  -- Position within transaction logs
    
    -- Metadata
    _goldsky_ingested_at TIMESTAMP      NOT NULL DEFAULT NOW(),
    
    -- Constraints
    PRIMARY KEY (transaction_hash, log_index)
);

-- Performance indexes
CREATE INDEX idx_cosmetic_mints_player ON cosmetic_mints(player_address);
CREATE INDEX idx_cosmetic_mints_timestamp ON cosmetic_mints(block_timestamp DESC);
CREATE INDEX idx_cosmetic_mints_token_id ON cosmetic_mints(token_id);
CREATE INDEX idx_cosmetic_mints_block ON cosmetic_mints(block_number);

COMMENT ON TABLE cosmetic_mints IS 'ERC-1155 cosmetic NFT mints from FruitRushCosmetics contract';
COMMENT ON COLUMN cosmetic_mints.token_id IS 'Token ID encoding: [255:248]=category, [247:240]=rarity, [239:0]=serial';

-- ============================================================================
-- TABLE: boast_mints
-- ============================================================================
-- Purpose: Track on-chain score attestations (boasts) paid in cUSD
-- Source Event: BoastMinted(uint256 indexed boastId, address indexed player, 
--                          uint256 score, string gameMode, uint256 timestamp)
-- Business Use: Boast revenue tracking, fraud detection, leaderboard verification
-- ============================================================================

CREATE TABLE IF NOT EXISTS boast_mints (
    -- Primary event data
    boast_id            NUMERIC(78, 0)  NOT NULL UNIQUE,  -- Sequential ID from contract
    player_address      VARCHAR(42)     NOT NULL,
    score               NUMERIC(78, 0)  NOT NULL,
    game_mode           TEXT            NOT NULL,  -- e.g. "classic", "zen", "arcade"
    event_timestamp     NUMERIC(78, 0)  NOT NULL,  -- Unix timestamp from contract event
    
    -- Blockchain context
    block_number        BIGINT          NOT NULL,
    block_timestamp     TIMESTAMP       NOT NULL,
    transaction_hash    VARCHAR(66)     NOT NULL,
    log_index           INTEGER         NOT NULL,
    
    -- Metadata
    _goldsky_ingested_at TIMESTAMP      NOT NULL DEFAULT NOW(),
    
    -- Constraints
    PRIMARY KEY (transaction_hash, log_index)
);

-- Performance indexes
CREATE INDEX idx_boast_mints_player ON boast_mints(player_address);
CREATE INDEX idx_boast_mints_timestamp ON boast_mints(block_timestamp DESC);
CREATE INDEX idx_boast_mints_score ON boast_mints(score DESC);
CREATE INDEX idx_boast_mints_game_mode ON boast_mints(game_mode);
CREATE INDEX idx_boast_mints_boast_id ON boast_mints(boast_id);

COMMENT ON TABLE boast_mints IS 'On-chain score attestations from FruitRushBoast contract';
COMMENT ON COLUMN boast_mints.event_timestamp IS 'Unix timestamp from contract event (use for business logic)';
COMMENT ON COLUMN boast_mints.block_timestamp IS 'Block timestamp (use for blockchain ordering)';

-- ============================================================================
-- TABLE: tournament_entries
-- ============================================================================
-- Purpose: Track all tournament entry payments
-- Source Event: PlayerEntered(uint256 indexed tournamentId, address indexed player, 
--                            uint256 totalEntrants)
-- Business Use: Tournament revenue, player engagement, entry-fee reconciliation
-- ============================================================================

CREATE TABLE IF NOT EXISTS tournament_entries (
    -- Primary event data
    tournament_id       NUMERIC(78, 0)  NOT NULL,
    player_address      VARCHAR(42)     NOT NULL,
    total_entrants      NUMERIC(78, 0)  NOT NULL,  -- Cumulative count at time of entry
    
    -- Blockchain context
    block_number        BIGINT          NOT NULL,
    block_timestamp     TIMESTAMP       NOT NULL,
    transaction_hash    VARCHAR(66)     NOT NULL,
    log_index           INTEGER         NOT NULL,
    
    -- Metadata
    _goldsky_ingested_at TIMESTAMP      NOT NULL DEFAULT NOW(),
    
    -- Constraints
    PRIMARY KEY (transaction_hash, log_index),
    UNIQUE (tournament_id, player_address)  -- Each player can enter once per tournament
);

-- Performance indexes
CREATE INDEX idx_tournament_entries_tournament ON tournament_entries(tournament_id);
CREATE INDEX idx_tournament_entries_player ON tournament_entries(player_address);
CREATE INDEX idx_tournament_entries_timestamp ON tournament_entries(block_timestamp DESC);

COMMENT ON TABLE tournament_entries IS 'Tournament entry payments from FruitRushTournament contract';
COMMENT ON COLUMN tournament_entries.total_entrants IS 'Snapshot of total entrants at time of this entry';

-- ============================================================================
-- TABLE: tournament_payouts
-- ============================================================================
-- Purpose: Track tournament prize distributions and house rake
-- Source Event: TournamentFinalized(uint256 indexed tournamentId, address[] winners, 
--                                   uint256[] payouts, uint256 rake)
-- Business Use: Finance reconciliation, rake tracking, winner verification
-- ============================================================================

CREATE TABLE IF NOT EXISTS tournament_payouts (
    -- Primary event data
    tournament_id       NUMERIC(78, 0)  NOT NULL UNIQUE,
    winners             TEXT[]          NOT NULL,  -- Array of winner addresses (PostgreSQL text array)
    payouts             NUMERIC[]       NOT NULL,  -- Array of payout amounts in cUSD wei (numeric array)
    rake                NUMERIC(78, 0)  NOT NULL,  -- House rake in cUSD wei
    
    -- Blockchain context
    block_number        BIGINT          NOT NULL,
    block_timestamp     TIMESTAMP       NOT NULL,
    transaction_hash    VARCHAR(66)     NOT NULL,
    log_index           INTEGER         NOT NULL,
    
    -- Metadata
    _goldsky_ingested_at TIMESTAMP      NOT NULL DEFAULT NOW(),
    
    -- Constraints
    PRIMARY KEY (transaction_hash, log_index)
);

-- Performance indexes
CREATE INDEX idx_tournament_payouts_tournament ON tournament_payouts(tournament_id);
CREATE INDEX idx_tournament_payouts_timestamp ON tournament_payouts(block_timestamp DESC);
CREATE INDEX idx_tournament_payouts_rake ON tournament_payouts(rake);

COMMENT ON TABLE tournament_payouts IS 'Tournament finalizations and prize distributions from FruitRushTournament contract';
COMMENT ON COLUMN tournament_payouts.rake IS 'House rake (≥15% of prize pool) in cUSD wei (18 decimals)';
COMMENT ON COLUMN tournament_payouts.payouts IS 'Prize amounts in cUSD wei, indexed by rank (1st, 2nd, 3rd, ...)';

-- ============================================================================
-- TABLE: tournament_refunds
-- ============================================================================
-- Purpose: Track cancelled tournaments with full refunds
-- Source Event: TournamentRefunded(uint256 indexed tournamentId, uint256 totalRefunded, 
--                                  uint256 entrantCount)
-- Business Use: Finance reconciliation, customer support, refund auditing
-- ============================================================================

CREATE TABLE IF NOT EXISTS tournament_refunds (
    -- Primary event data
    tournament_id       NUMERIC(78, 0)  NOT NULL UNIQUE,
    total_refunded      NUMERIC(78, 0)  NOT NULL,  -- Total cUSD wei refunded
    entrant_count       NUMERIC(78, 0)  NOT NULL,  -- Number of players refunded
    
    -- Blockchain context
    block_number        BIGINT          NOT NULL,
    block_timestamp     TIMESTAMP       NOT NULL,
    transaction_hash    VARCHAR(66)     NOT NULL,
    log_index           INTEGER         NOT NULL,
    
    -- Metadata
    _goldsky_ingested_at TIMESTAMP      NOT NULL DEFAULT NOW(),
    
    -- Constraints
    PRIMARY KEY (transaction_hash, log_index)
);

-- Performance indexes
CREATE INDEX idx_tournament_refunds_tournament ON tournament_refunds(tournament_id);
CREATE INDEX idx_tournament_refunds_timestamp ON tournament_refunds(block_timestamp DESC);

COMMENT ON TABLE tournament_refunds IS 'Tournament cancellations and refunds from FruitRushTournament contract';

-- ============================================================================
-- HELPER VIEWS FOR COMMON QUERIES
-- ============================================================================

-- View: Convert cUSD wei to human-readable dollar amounts
CREATE OR REPLACE VIEW cosmetic_revenue_usd AS
SELECT
    player_address,
    token_id,
    amount,
    block_timestamp,
    transaction_hash,
    -- Assume average cosmetic price of $2.99 (update based on actual pricing)
    (amount * 2.99)::NUMERIC(18, 2) AS estimated_revenue_usd
FROM cosmetic_mints;

CREATE OR REPLACE VIEW boast_revenue_usd AS
SELECT
    boast_id,
    player_address,
    score,
    game_mode,
    block_timestamp,
    transaction_hash,
    -- Assume fixed boast fee of $0.99 (update based on contract boastFee)
    0.99 AS revenue_usd
FROM boast_mints;

-- View: Tournament rake in USD
CREATE OR REPLACE VIEW tournament_rake_usd AS
SELECT
    tournament_id,
    block_timestamp,
    transaction_hash,
    (rake::NUMERIC / 1e18)::NUMERIC(18, 2) AS rake_usd
FROM tournament_payouts;

COMMENT ON VIEW cosmetic_revenue_usd IS 'Estimated cosmetic revenue in USD (update pricing assumptions)';
COMMENT ON VIEW boast_revenue_usd IS 'Boast revenue in USD (assumes fixed $0.99 fee)';
COMMENT ON VIEW tournament_rake_usd IS 'Tournament house rake converted to USD';

-- ============================================================================
-- REORG HANDLING
-- ============================================================================
-- Goldsky Mirror's reorgHandling.strategy = "delete-and-reinsert" automatically
-- handles chain reorganizations by:
-- 1. Detecting reorgs up to maxDepth=64 blocks deep
-- 2. Deleting affected rows from all tables
-- 3. Re-ingesting events from the new canonical chain
--
-- No manual intervention required. The _goldsky_ingested_at timestamp tracks
-- when data was last written, which can help debug reorg-related issues.
-- ============================================================================

-- Grant read access to analytics role (adjust role name as needed)
-- GRANT USAGE ON SCHEMA fruit_rush TO analytics_role;
-- GRANT SELECT ON ALL TABLES IN SCHEMA fruit_rush TO analytics_role;
-- ALTER DEFAULT PRIVILEGES IN SCHEMA fruit_rush GRANT SELECT ON TABLES TO analytics_role;

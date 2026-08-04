-- =============================================================================
-- Fruit Rush — Tournament Lifecycle Management Schema
-- =============================================================================
-- Tracks tournament creation, entries, and finalization in Supabase.
-- Works alongside Goldsky Mirror for on-chain event data.

-- -----------------------------------------------------------------------------
-- tournaments table
-- -----------------------------------------------------------------------------
-- Tracks all tournaments created by the scheduler or admin.

CREATE TABLE IF NOT EXISTS tournaments (
  tournament_id TEXT PRIMARY KEY,
  entry_fee_wei TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  prize_shares_bps INTEGER[] NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Pending', 'Open', 'Closed', 'Finalized', 'Refunded')),
  template_name TEXT,
  
  -- Creation tracking
  creation_tx_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Finalization tracking
  finalized_at TIMESTAMPTZ,
  finalization_tx_hash TEXT,
  winner_count INTEGER DEFAULT 0,
  
  -- Refund tracking
  refunded_at TIMESTAMPTZ,
  refund_tx_hash TEXT,
  
  -- Metadata
  notes TEXT
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_tournaments_status ON tournaments(status);
CREATE INDEX IF NOT EXISTS idx_tournaments_end_time ON tournaments(end_time DESC);
CREATE INDEX IF NOT EXISTS idx_tournaments_created_at ON tournaments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tournaments_template ON tournaments(template_name);

-- Index for finding tournaments needing finalization
CREATE INDEX IF NOT EXISTS idx_tournaments_pending_finalization 
  ON tournaments(end_time) 
  WHERE status IN ('Pending', 'Open');

-- -----------------------------------------------------------------------------
-- tournament_entries table
-- -----------------------------------------------------------------------------
-- Tracks player entry intents (complementary to on-chain entry events).

CREATE TABLE IF NOT EXISTS tournament_entries (
  entry_id SERIAL PRIMARY KEY,
  tournament_id TEXT NOT NULL REFERENCES tournaments(tournament_id),
  player_address TEXT NOT NULL,
  entered_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one entry per player per tournament
  UNIQUE(tournament_id, player_address)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tournament_entries_player ON tournament_entries(player_address);
CREATE INDEX IF NOT EXISTS idx_tournament_entries_tournament ON tournament_entries(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_entries_timestamp ON tournament_entries(entered_at DESC);

-- -----------------------------------------------------------------------------
-- RLS Policies (Supabase Row Level Security)
-- -----------------------------------------------------------------------------

-- Enable RLS
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_entries ENABLE ROW LEVEL SECURITY;

-- Public read access for both tables
CREATE POLICY "Public read access for tournaments"
  ON tournaments FOR SELECT
  USING (true);

CREATE POLICY "Public read access for tournament entries"
  ON tournament_entries FOR SELECT
  USING (true);

-- Service role can do everything (backend writes via service key)
-- No additional policies needed since service role bypasses RLS

-- -----------------------------------------------------------------------------
-- Comments
-- -----------------------------------------------------------------------------

COMMENT ON TABLE tournaments IS 'Tournament lifecycle tracking for scheduler and admin operations';
COMMENT ON TABLE tournament_entries IS 'Player entry intents (complementary to on-chain Entry events)';

COMMENT ON COLUMN tournaments.tournament_id IS 'Unique tournament ID (matches on-chain ID)';
COMMENT ON COLUMN tournaments.entry_fee_wei IS 'Entry fee in cUSD wei (18 decimals)';
COMMENT ON COLUMN tournaments.prize_shares_bps IS 'Array of prize shares in basis points (sum ≤ 8500)';
COMMENT ON COLUMN tournaments.status IS 'Tournament status: Pending, Open, Closed, Finalized, Refunded';
COMMENT ON COLUMN tournaments.template_name IS 'Template used to create tournament (e.g., "daily-dollar-dash")';

-- -----------------------------------------------------------------------------
-- Sample Queries
-- -----------------------------------------------------------------------------

-- Find tournaments needing finalization
-- SELECT tournament_id, end_time, prize_shares_bps
-- FROM tournaments
-- WHERE status IN ('Pending', 'Open')
--   AND end_time < NOW();

-- Get active tournaments
-- SELECT tournament_id, entry_fee_wei, start_time, end_time, status
-- FROM tournaments
-- WHERE status IN ('Pending', 'Open')
--   AND start_time <= NOW()
--   AND end_time >= NOW()
-- ORDER BY start_time ASC;

-- Count entries for a tournament
-- SELECT COUNT(*) AS entry_count
-- FROM tournament_entries
-- WHERE tournament_id = '12345';

-- Get player's tournament history
-- SELECT t.tournament_id, t.status, te.entered_at
-- FROM tournament_entries te
-- JOIN tournaments t ON te.tournament_id = t.tournament_id
-- WHERE te.player_address = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb'
-- ORDER BY te.entered_at DESC;

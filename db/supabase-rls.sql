-- ============================================================================
-- Supabase Row Level Security (RLS) Policies
-- ============================================================================
-- Purpose: Configure public read access for analytics data while restricting
--          writes to Goldsky Mirror (via direct database connection)
-- ============================================================================

SET search_path TO fruit_rush;

-- ============================================================================
-- STEP 1: Enable RLS on All Tables
-- ============================================================================

ALTER TABLE fruit_rush.cosmetic_mints ENABLE ROW LEVEL SECURITY;
ALTER TABLE fruit_rush.boast_mints ENABLE ROW LEVEL SECURITY;
ALTER TABLE fruit_rush.tournament_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE fruit_rush.tournament_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE fruit_rush.tournament_refunds ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 2: Create Public Read Policies
-- ============================================================================
-- These policies allow anyone with the anon key to SELECT from tables
-- Perfect for client-side leaderboards, dashboards, and analytics queries
-- ============================================================================

-- Cosmetic Mints: Public Read
CREATE POLICY "Public read access for cosmetic_mints"
ON fruit_rush.cosmetic_mints
FOR SELECT
USING (true);

-- Boast Mints: Public Read
CREATE POLICY "Public read access for boast_mints"
ON fruit_rush.boast_mints
FOR SELECT
USING (true);

-- Tournament Entries: Public Read
CREATE POLICY "Public read access for tournament_entries"
ON fruit_rush.tournament_entries
FOR SELECT
USING (true);

-- Tournament Payouts: Public Read
CREATE POLICY "Public read access for tournament_payouts"
ON fruit_rush.tournament_payouts
FOR SELECT
USING (true);

-- Tournament Refunds: Public Read
CREATE POLICY "Public read access for tournament_refunds"
ON fruit_rush.tournament_refunds
FOR SELECT
USING (true);

-- ============================================================================
-- STEP 3: No Write Policies = Restricted to Service Role
-- ============================================================================
-- By NOT creating INSERT/UPDATE/DELETE policies, we ensure:
-- - Only the service role key can write to these tables
-- - Goldsky Mirror connects with the postgres user (bypasses RLS entirely)
-- - Client-side code with anon key can only read
-- ============================================================================

-- No additional policies needed!
-- Goldsky uses direct postgres:// connection → full write access
-- Clients use Supabase API with anon key → read-only via RLS

-- ============================================================================
-- OPTIONAL: Authenticated Users Only (Stricter Security)
-- ============================================================================
-- If you want to require authentication for read access:
-- Uncomment the following and comment out the "Public read" policies above
-- ============================================================================

/*
-- Cosmetic Mints: Authenticated Users Only
CREATE POLICY "Authenticated read access for cosmetic_mints"
ON fruit_rush.cosmetic_mints
FOR SELECT
USING (auth.role() = 'authenticated');

-- Boast Mints: Authenticated Users Only
CREATE POLICY "Authenticated read access for boast_mints"
ON fruit_rush.boast_mints
FOR SELECT
USING (auth.role() = 'authenticated');

-- Tournament Entries: Authenticated Users Only
CREATE POLICY "Authenticated read access for tournament_entries"
ON fruit_rush.tournament_entries
FOR SELECT
USING (auth.role() = 'authenticated');

-- Tournament Payouts: Authenticated Users Only
CREATE POLICY "Authenticated read access for tournament_payouts"
ON fruit_rush.tournament_payouts
FOR SELECT
USING (auth.role() = 'authenticated');

-- Tournament Refunds: Authenticated Users Only
CREATE POLICY "Authenticated read access for tournament_refunds"
ON fruit_rush.tournament_refunds
FOR SELECT
USING (auth.role() = 'authenticated');
*/

-- ============================================================================
-- STEP 4: Grant API Schema Access
-- ============================================================================
-- Ensure Supabase PostgREST can serve the fruit_rush schema via API
-- ============================================================================

GRANT USAGE ON SCHEMA fruit_rush TO anon, authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA fruit_rush TO anon, authenticated;

-- ============================================================================
-- STEP 5: Verify RLS Configuration
-- ============================================================================
-- Run these queries to confirm RLS is working correctly
-- ============================================================================

-- Check RLS is enabled
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'fruit_rush';
-- Expected: rowsecurity = true for all tables

-- View all policies
SELECT schemaname, tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'fruit_rush';
-- Expected: One SELECT policy per table

-- Test as anon user (simulates client-side query)
SET ROLE anon;
SELECT COUNT(*) FROM fruit_rush.boast_mints;  -- Should work
-- INSERT INTO fruit_rush.boast_mints (...) VALUES (...);  -- Should fail
RESET ROLE;

-- ============================================================================
-- NOTES
-- ============================================================================
-- 1. Goldsky Mirror bypasses RLS because it connects as the postgres superuser
-- 2. Client-side queries via Supabase JS library use the anon role (read-only)
-- 3. Backend Edge Functions can use service_role for full access if needed
-- 4. RLS policies are evaluated PER ROW, so they're efficient even on large tables
-- ============================================================================

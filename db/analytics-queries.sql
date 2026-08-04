-- ============================================================================
-- Fruit Rush Analytics Queries
-- ============================================================================
-- Purpose: Example SQL queries for BI dashboards, fraud detection, and
--          finance reconciliation using Goldsky Mirror-streamed data
-- ============================================================================

SET search_path TO fruit_rush;

-- ============================================================================
-- QUERY 1: Daily Revenue by Stream (Cosmetics vs. Boasts vs. Tournament Rake)
-- ============================================================================
-- Purpose: Track daily revenue across all monetization streams for CFO dashboard
-- Output: Date, revenue by stream, total daily revenue in cUSD
-- Note: Cosmetic revenue requires on-chain or off-chain price data; this query
--       estimates using average prices. For exact revenue, join with a prices table.
-- ============================================================================

WITH daily_cosmetics AS (
    SELECT
        DATE(block_timestamp) AS revenue_date,
        'cosmetics' AS revenue_stream,
        -- Estimate revenue: count mints × avg price $2.99
        -- For exact revenue, join with cosmetic_prices(token_id, price_cusd)
        COUNT(*) * 2.99 AS revenue_usd
    FROM cosmetic_mints
    GROUP BY DATE(block_timestamp)
),

daily_boasts AS (
    SELECT
        DATE(block_timestamp) AS revenue_date,
        'boasts' AS revenue_stream,
        -- Fixed $0.99 per boast (assumes current boastFee unchanged)
        COUNT(*) * 0.99 AS revenue_usd
    FROM boast_mints
    GROUP BY DATE(block_timestamp)
),

daily_tournament_rake AS (
    SELECT
        DATE(block_timestamp) AS revenue_date,
        'tournament_rake' AS revenue_stream,
        -- Convert rake from wei (18 decimals) to USD
        SUM(rake::NUMERIC / 1e18)::NUMERIC(18, 2) AS revenue_usd
    FROM tournament_payouts
    GROUP BY DATE(block_timestamp)
),

daily_refunds AS (
    -- Subtract refunds from tournament revenue
    SELECT
        DATE(block_timestamp) AS revenue_date,
        'tournament_refunds' AS revenue_stream,
        -SUM(total_refunded::NUMERIC / 1e18)::NUMERIC(18, 2) AS revenue_usd
    FROM tournament_refunds
    GROUP BY DATE(block_timestamp)
),

combined AS (
    SELECT * FROM daily_cosmetics
    UNION ALL
    SELECT * FROM daily_boasts
    UNION ALL
    SELECT * FROM daily_tournament_rake
    UNION ALL
    SELECT * FROM daily_refunds
)

SELECT
    revenue_date,
    SUM(CASE WHEN revenue_stream = 'cosmetics' THEN revenue_usd ELSE 0 END) AS cosmetics_revenue_usd,
    SUM(CASE WHEN revenue_stream = 'boasts' THEN revenue_usd ELSE 0 END) AS boasts_revenue_usd,
    SUM(CASE WHEN revenue_stream = 'tournament_rake' THEN revenue_usd ELSE 0 END) AS tournament_rake_usd,
    SUM(CASE WHEN revenue_stream = 'tournament_refunds' THEN revenue_usd ELSE 0 END) AS tournament_refunds_usd,
    SUM(revenue_usd) AS total_daily_revenue_usd
FROM combined
GROUP BY revenue_date
ORDER BY revenue_date DESC
LIMIT 90;  -- Last 90 days

COMMENT ON QUERY IS 'Daily revenue breakdown by stream (cosmetics, boasts, tournament rake) for CFO dashboard';


-- ============================================================================
-- QUERY 2: 7-Day Rolling Player Retention Cohort
-- ============================================================================
-- Purpose: Measure stickiness — what % of players who entered a tournament in
--          week N also entered a tournament in week N+1?
-- Output: Week start date, cohort size, retained players, retention rate
-- Business Use: Growth team KPI tracking, product iteration feedback loop
-- ============================================================================

WITH weekly_entrants AS (
    -- Identify all unique players who entered any tournament each week
    SELECT
        DATE_TRUNC('week', block_timestamp)::DATE AS week_start,
        player_address
    FROM tournament_entries
    GROUP BY DATE_TRUNC('week', block_timestamp), player_address
),

cohorts AS (
    SELECT
        w1.week_start AS cohort_week,
        COUNT(DISTINCT w1.player_address) AS cohort_size,
        COUNT(DISTINCT w2.player_address) AS retained_players
    FROM weekly_entrants w1
    LEFT JOIN weekly_entrants w2
        ON w1.player_address = w2.player_address
        AND w2.week_start = w1.week_start + INTERVAL '7 days'
    GROUP BY w1.week_start
)

SELECT
    cohort_week,
    cohort_size,
    COALESCE(retained_players, 0) AS retained_players,
    CASE
        WHEN cohort_size > 0 THEN
            (COALESCE(retained_players, 0)::NUMERIC / cohort_size * 100)::NUMERIC(5, 2)
        ELSE 0
    END AS retention_rate_pct
FROM cohorts
WHERE cohort_week < DATE_TRUNC('week', NOW())  -- Exclude incomplete current week
ORDER BY cohort_week DESC
LIMIT 12;  -- Last 12 weeks

COMMENT ON QUERY IS '7-day tournament player retention cohort (week N → week N+1)';


-- ============================================================================
-- QUERY 3: Top-10 Boasters by Total Score Attested (All-Time Leaderboard)
-- ============================================================================
-- Purpose: Global leaderboard showing top players by cumulative boasted score
-- Output: Rank, player address, total boasts minted, cumulative score, highest single score
-- Business Use: Social features, player profile badges, marketing/partnerships
-- ============================================================================

SELECT
    ROW_NUMBER() OVER (ORDER BY SUM(score) DESC) AS rank,
    player_address,
    COUNT(*) AS total_boasts,
    SUM(score) AS cumulative_score,
    MAX(score) AS highest_single_score,
    MAX(block_timestamp) AS last_boast_date
FROM boast_mints
GROUP BY player_address
ORDER BY cumulative_score DESC
LIMIT 10;

COMMENT ON QUERY IS 'Top-10 players by cumulative boasted score (all-time leaderboard)';


-- ============================================================================
-- BONUS QUERY 4: Fraud Detection — Unusual Score Patterns
-- ============================================================================
-- Purpose: Flag players with suspiciously high boast frequency or score variance
-- Output: Player address, total boasts, avg time between boasts, score std dev
-- Business Use: Anti-cheat, customer support investigations
-- ============================================================================

WITH player_stats AS (
    SELECT
        player_address,
        COUNT(*) AS total_boasts,
        AVG(score) AS avg_score,
        STDDEV(score) AS score_stddev,
        -- Calculate avg time between boasts (in hours)
        CASE
            WHEN COUNT(*) > 1 THEN
                EXTRACT(EPOCH FROM (MAX(block_timestamp) - MIN(block_timestamp))) / 3600.0 / (COUNT(*) - 1)
            ELSE NULL
        END AS avg_hours_between_boasts
    FROM boast_mints
    GROUP BY player_address
)

SELECT
    player_address,
    total_boasts,
    avg_score::NUMERIC(18, 2) AS avg_score,
    score_stddev::NUMERIC(18, 2) AS score_stddev,
    avg_hours_between_boasts::NUMERIC(8, 2) AS avg_hours_between_boasts
FROM player_stats
WHERE
    total_boasts >= 10  -- Minimum sample size
    AND (
        -- Flag if boasting more than once per hour on average (bot-like)
        avg_hours_between_boasts < 1.0
        OR
        -- Flag if score variance is suspiciously low (potential replay attack)
        (score_stddev / NULLIF(avg_score, 0)) < 0.05
    )
ORDER BY total_boasts DESC;

COMMENT ON QUERY IS 'Fraud detection: flag players with unusual boast frequency or score patterns';


-- ============================================================================
-- BONUS QUERY 5: Tournament Economics — Prize Pool vs. Rake Analysis
-- ============================================================================
-- Purpose: Verify 15% minimum rake, analyze tournament profitability
-- Output: Tournament ID, total entries, prize pool, total payouts, rake, rake %
-- Business Use: Finance reconciliation, tournament pricing optimization
-- ============================================================================

WITH tournament_entries_agg AS (
    SELECT
        tournament_id,
        COUNT(*) AS total_entries,
        MAX(total_entrants) AS final_entrant_count  -- Should match COUNT(*)
    FROM tournament_entries
    GROUP BY tournament_id
),

tournament_financials AS (
    SELECT
        e.tournament_id,
        e.total_entries,
        e.final_entrant_count,
        -- Prize pool = entry_fee × entrants (entry fee must be joined or hardcoded)
        -- For this example, assume $5 entry fee; replace with actual data
        (e.total_entries * 5.0) AS estimated_prize_pool_usd,
        -- Actual payouts + rake from finalization event
        COALESCE((
            SELECT SUM(unnest(payouts)::NUMERIC) / 1e18
            FROM tournament_payouts p
            WHERE p.tournament_id = e.tournament_id
        ), 0) AS total_payouts_usd,
        COALESCE((
            SELECT rake::NUMERIC / 1e18
            FROM tournament_payouts p
            WHERE p.tournament_id = e.tournament_id
        ), 0) AS rake_usd
    FROM tournament_entries_agg e
)

SELECT
    tournament_id,
    total_entries,
    estimated_prize_pool_usd,
    total_payouts_usd::NUMERIC(18, 2) AS total_payouts_usd,
    rake_usd::NUMERIC(18, 2) AS rake_usd,
    CASE
        WHEN estimated_prize_pool_usd > 0 THEN
            (rake_usd / estimated_prize_pool_usd * 100)::NUMERIC(5, 2)
        ELSE 0
    END AS rake_percentage,
    -- Sanity check: pool should equal payouts + rake
    (estimated_prize_pool_usd - (total_payouts_usd + rake_usd))::NUMERIC(18, 2) AS reconciliation_diff_usd
FROM tournament_financials
WHERE rake_usd > 0  -- Only finalized tournaments
ORDER BY tournament_id DESC
LIMIT 50;

COMMENT ON QUERY IS 'Tournament economics: verify rake ≥15%, reconcile prize pool vs. payouts';


-- ============================================================================
-- BONUS QUERY 6: Monthly Active Users (MAU) and Paying User %
-- ============================================================================
-- Purpose: Track MAU and paying conversion rate — key growth metrics from PRD
-- Output: Month, unique players, paying players, payer %
-- Business Use: Exec dashboard, investor reporting, product-market fit tracking
-- ============================================================================

WITH monthly_activity AS (
    -- All players who entered a tournament (activity proxy)
    SELECT
        DATE_TRUNC('month', block_timestamp)::DATE AS activity_month,
        player_address
    FROM tournament_entries
    UNION
    -- All players who minted a cosmetic
    SELECT
        DATE_TRUNC('month', block_timestamp)::DATE AS activity_month,
        player_address
    FROM cosmetic_mints
    UNION
    -- All players who minted a boast
    SELECT
        DATE_TRUNC('month', block_timestamp)::DATE AS activity_month,
        player_address
    FROM boast_mints
),

monthly_payers AS (
    -- Players who spent money (cosmetics or boasts; tournaments also count)
    SELECT
        DATE_TRUNC('month', block_timestamp)::DATE AS activity_month,
        player_address
    FROM cosmetic_mints
    UNION
    SELECT
        DATE_TRUNC('month', block_timestamp)::DATE AS activity_month,
        player_address
    FROM boast_mints
)

SELECT
    a.activity_month,
    COUNT(DISTINCT a.player_address) AS monthly_active_users,
    COUNT(DISTINCT p.player_address) AS paying_users,
    CASE
        WHEN COUNT(DISTINCT a.player_address) > 0 THEN
            (COUNT(DISTINCT p.player_address)::NUMERIC / COUNT(DISTINCT a.player_address) * 100)::NUMERIC(5, 2)
        ELSE 0
    END AS paying_user_pct
FROM monthly_activity a
LEFT JOIN monthly_payers p
    ON a.activity_month = p.activity_month
    AND a.player_address = p.player_address
GROUP BY a.activity_month
ORDER BY a.activity_month DESC
LIMIT 12;  -- Last 12 months

COMMENT ON QUERY IS 'Monthly Active Users (MAU) and paying user % — key growth KPIs';


-- ============================================================================
-- PERFORMANCE TUNING NOTES
-- ============================================================================
-- 1. All queries use indexes on player_address and block_timestamp (DESC) for fast filtering.
-- 2. For queries spanning large date ranges, consider partitioning tables by block_timestamp.
-- 3. Revenue queries assume fixed pricing; for dynamic pricing, create a `cosmetic_prices`
--    lookup table and join on token_id.
-- 4. Fraud detection queries can be expensive on large datasets — run off-hours or pre-aggregate.
-- 5. MAU/retention queries benefit from materialized views refreshed daily.
-- ============================================================================

#!/bin/bash
# ============================================================================
# Supabase Setup Script for Fruit Rush Analytics
# ============================================================================
# Purpose: Automated setup of Supabase database schema and RLS policies
# Prerequisites: 
#   - Supabase project created at https://supabase.com
#   - DATABASE_URL set in .env file
# ============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Paths
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_DIR="$REPO_ROOT/db"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       Fruit Rush Analytics — Supabase Setup Script            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# ============================================================================
# STEP 0: Check Prerequisites
# ============================================================================

echo -e "${YELLOW}[0/5] Checking prerequisites...${NC}"

# Check if .env file exists
if [ ! -f "$REPO_ROOT/.env" ]; then
    echo -e "${RED}✗ Error: .env file not found${NC}"
    echo "Please create .env from .env.example and fill in your Supabase credentials:"
    echo "  cp .env.example .env"
    echo "  # Edit .env and add DATABASE_URL"
    exit 1
fi

# Load environment variables
source "$REPO_ROOT/.env"

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}✗ Error: DATABASE_URL not set in .env${NC}"
    echo "Please add your Supabase connection string to .env:"
    echo "  DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"
    exit 1
fi

# Check if psql is installed
if ! command -v psql &> /dev/null; then
    echo -e "${RED}✗ Error: psql is not installed${NC}"
    echo "Install via: brew install postgresql (macOS)"
    exit 1
fi

echo -e "${GREEN}✓ Prerequisites checked${NC}"
echo ""

# ============================================================================
# STEP 1: Test Connection
# ============================================================================

echo -e "${YELLOW}[1/5] Testing Supabase connection...${NC}"

if psql "$DATABASE_URL" -c "SELECT version();" > /dev/null 2>&1; then
    POSTGRES_VERSION=$(psql "$DATABASE_URL" -t -c "SELECT version();" | head -n1)
    echo -e "${GREEN}✓ Connected to Supabase Postgres${NC}"
    echo "  Version: $POSTGRES_VERSION"
else
    echo -e "${RED}✗ Failed to connect to Supabase${NC}"
    echo "Please check your DATABASE_URL in .env"
    exit 1
fi
echo ""

# ============================================================================
# STEP 2: Deploy Database Schema
# ============================================================================

echo -e "${YELLOW}[2/5] Deploying database schema...${NC}"

if psql "$DATABASE_URL" -f "$DB_DIR/schema.sql" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Schema deployed successfully${NC}"
    
    # Count tables created
    TABLE_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'fruit_rush';" | tr -d ' ')
    echo "  Created: $TABLE_COUNT tables in fruit_rush schema"
else
    echo -e "${RED}✗ Schema deployment failed${NC}"
    exit 1
fi
echo ""

# ============================================================================
# STEP 3: Configure Row Level Security (RLS)
# ============================================================================

echo -e "${YELLOW}[3/5] Configuring Row Level Security policies...${NC}"

if psql "$DATABASE_URL" -f "$DB_DIR/supabase-rls.sql" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ RLS policies configured${NC}"
    
    # Count policies created
    POLICY_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'fruit_rush';" | tr -d ' ')
    echo "  Created: $POLICY_COUNT RLS policies"
    echo "  Access: Public read, service-role write only"
else
    echo -e "${RED}✗ RLS configuration failed${NC}"
    exit 1
fi
echo ""

# ============================================================================
# STEP 4: Verify Setup
# ============================================================================

echo -e "${YELLOW}[4/5] Verifying setup...${NC}"

# Check if tables exist
EXPECTED_TABLES=("cosmetic_mints" "boast_mints" "tournament_entries" "tournament_payouts" "tournament_refunds")
MISSING_TABLES=()

for table in "${EXPECTED_TABLES[@]}"; do
    if ! psql "$DATABASE_URL" -t -c "SELECT to_regclass('fruit_rush.$table');" | grep -q "$table"; then
        MISSING_TABLES+=("$table")
    fi
done

if [ ${#MISSING_TABLES[@]} -eq 0 ]; then
    echo -e "${GREEN}✓ All tables created successfully${NC}"
else
    echo -e "${RED}✗ Missing tables: ${MISSING_TABLES[*]}${NC}"
    exit 1
fi

# Check if RLS is enabled
RLS_ENABLED=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'fruit_rush' AND rowsecurity = true;" | tr -d ' ')

if [ "$RLS_ENABLED" -eq "5" ]; then
    echo -e "${GREEN}✓ RLS enabled on all tables${NC}"
else
    echo -e "${YELLOW}⚠ Warning: RLS not fully enabled (expected 5, got $RLS_ENABLED)${NC}"
fi

echo ""

# ============================================================================
# STEP 5: Display Supabase Dashboard Info
# ============================================================================

echo -e "${YELLOW}[5/5] Extracting Supabase project info...${NC}"

# Extract project reference from DATABASE_URL
if [[ $DATABASE_URL =~ db\.([a-zA-Z0-9]+)\.supabase\.co ]]; then
    PROJECT_REF="${BASH_MATCH[1]}"
    echo -e "${GREEN}✓ Detected project: $PROJECT_REF${NC}"
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}Supabase project configured successfully!${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo "📊 Supabase Dashboard:"
    echo "   https://app.supabase.com/project/$PROJECT_REF"
    echo ""
    echo "🔧 Next Steps:"
    echo "   1. Get your API credentials:"
    echo "      → Settings → API → Copy 'Project URL' and 'anon public' key"
    echo ""
    echo "   2. Add to .env:"
    echo "      NEXT_PUBLIC_SUPABASE_URL=https://$PROJECT_REF.supabase.co"
    echo "      NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG..."
    echo ""
    echo "   3. Deploy Goldsky Mirror pipeline:"
    echo "      goldsky mirror create mirror-pipeline.json"
    echo ""
    echo "   4. Test client-side queries:"
    echo "      See examples in docs/mirror-supabase.md"
    echo ""
else
    echo -e "${YELLOW}⚠ Could not extract project reference from DATABASE_URL${NC}"
    echo "Visit https://app.supabase.com to find your project"
fi

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${GREEN}✓ Supabase setup complete!${NC}"
echo ""
echo "📚 Documentation:"
echo "   - Client setup: docs/mirror-supabase.md"
echo "   - SQL queries: db/analytics-queries.sql"
echo "   - Pipeline config: mirror-pipeline.json"

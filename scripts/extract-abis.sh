#!/bin/bash
# ============================================================================
# Extract Contract ABIs for Goldsky Mirror
# ============================================================================
# Purpose: Generate ABI JSON files from Foundry build artifacts
# Usage: ./scripts/extract-abis.sh
# ============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Paths
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTRACTS_DIR="$REPO_ROOT/contracts"
ABIS_DIR="$REPO_ROOT/abis"
OUT_DIR="$CONTRACTS_DIR/out"

echo -e "${GREEN}=== Fruit Rush ABI Extraction ===${NC}"
echo "Repo root: $REPO_ROOT"
echo "Contracts: $CONTRACTS_DIR"
echo "ABIs output: $ABIS_DIR"
echo ""

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo -e "${RED}Error: jq is not installed.${NC}"
    echo "Install via: brew install jq (macOS) or apt-get install jq (Linux)"
    exit 1
fi

# Check if contracts directory exists
if [ ! -d "$CONTRACTS_DIR" ]; then
    echo -e "${RED}Error: contracts/ directory not found.${NC}"
    exit 1
fi

# Check if forge is available
if ! command -v forge &> /dev/null; then
    echo -e "${RED}Error: forge is not installed.${NC}"
    echo "Install via: curl -L https://foundry.paradigm.xyz | bash && foundryup"
    exit 1
fi

# Build contracts
echo -e "${YELLOW}Building contracts...${NC}"
cd "$CONTRACTS_DIR"
forge build

if [ ! -d "$OUT_DIR" ]; then
    echo -e "${RED}Error: forge build did not produce out/ directory.${NC}"
    exit 1
fi

# Create abis directory if it doesn't exist
mkdir -p "$ABIS_DIR"

# Contract names and paths
declare -A CONTRACTS=(
    ["FruitRushCosmetics"]="FruitRushCosmetics.sol/FruitRushCosmetics.json"
    ["FruitRushBoast"]="FruitRushBoast.sol/FruitRushBoast.json"
    ["FruitRushTournament"]="FruitRushTournament.sol/FruitRushTournament.json"
)

# Extract ABIs
echo -e "${YELLOW}Extracting ABIs...${NC}"
SUCCESS_COUNT=0
FAIL_COUNT=0

for contract_name in "${!CONTRACTS[@]}"; do
    artifact_path="${CONTRACTS[$contract_name]}"
    full_path="$OUT_DIR/$artifact_path"
    output_path="$ABIS_DIR/${contract_name}.json"
    
    if [ ! -f "$full_path" ]; then
        echo -e "${RED}✗ $contract_name: artifact not found at $artifact_path${NC}"
        ((FAIL_COUNT++))
        continue
    fi
    
    # Extract .abi field from JSON
    if jq '.abi' "$full_path" > "$output_path"; then
        file_size=$(stat -f%z "$output_path" 2>/dev/null || stat -c%s "$output_path" 2>/dev/null)
        echo -e "${GREEN}✓ $contract_name → $output_path ($file_size bytes)${NC}"
        ((SUCCESS_COUNT++))
    else
        echo -e "${RED}✗ $contract_name: jq extraction failed${NC}"
        ((FAIL_COUNT++))
    fi
done

# Summary
echo ""
echo -e "${GREEN}=== Summary ===${NC}"
echo "Extracted: $SUCCESS_COUNT ABIs"
if [ $FAIL_COUNT -gt 0 ]; then
    echo -e "${RED}Failed: $FAIL_COUNT ABIs${NC}"
    exit 1
else
    echo -e "${GREEN}All ABIs extracted successfully!${NC}"
fi

# Verify ABI structure (basic sanity check)
echo ""
echo -e "${YELLOW}Verifying ABI structure...${NC}"
for contract_name in "${!CONTRACTS[@]}"; do
    output_path="$ABIS_DIR/${contract_name}.json"
    if [ -f "$output_path" ]; then
        # Check if it's a valid JSON array
        if jq -e 'type == "array"' "$output_path" > /dev/null 2>&1; then
            event_count=$(jq '[.[] | select(.type == "event")] | length' "$output_path")
            function_count=$(jq '[.[] | select(.type == "function")] | length' "$output_path")
            echo -e "${GREEN}✓ $contract_name: valid ABI ($event_count events, $function_count functions)${NC}"
        else
            echo -e "${RED}✗ $contract_name: invalid ABI format (expected JSON array)${NC}"
            exit 1
        fi
    fi
done

echo ""
echo -e "${GREEN}=== Next Steps ===${NC}"
echo "1. Update mirror-pipeline.json with deployed contract addresses"
echo "2. Set GOLDSKY_API_KEY and DATABASE_URL in .env"
echo "3. Run: goldsky mirror create mirror-pipeline.json"
echo ""
echo "See docs/mirror-setup.md for detailed instructions."

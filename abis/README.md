# Contract ABIs

This directory contains the ABI JSON files required by Goldsky Mirror to decode on-chain events.

## Generating ABIs

After deploying contracts or making changes, regenerate ABIs from Foundry build artifacts:

```bash
cd contracts
forge build

# Extract ABIs using jq
jq '.abi' out/FruitRushCosmetics.sol/FruitRushCosmetics.json > ../abis/FruitRushCosmetics.json
jq '.abi' out/FruitRushBoast.sol/FruitRushBoast.json > ../abis/FruitRushBoast.json
jq '.abi' out/FruitRushTournament.sol/FruitRushTournament.json > ../abis/FruitRushTournament.json
```

## Files

- `FruitRushCosmetics.json` - ERC-1155 cosmetics contract ABI
- `FruitRushBoast.json` - Score attestation contract ABI
- `FruitRushTournament.json` - Tournament escrow contract ABI

These files are referenced in `mirror-pipeline.json` and must be present before deploying the Goldsky pipeline.

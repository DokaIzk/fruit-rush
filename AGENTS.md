# Fruit Rush Agent Instructions

Before doing any work in this repository, read this file first, then read [PRD.md](PRD.md) and any task-specific docs that apply.

Needed Celo ecosystem context or tooling before starting, run:

```bash
npx skills add celo-org/celopedia-skills
```

## Project Rules

- The product name is Fruit Rush.
- The primary client stack is PixiJS + PWA, with TypeScript for browser code.
- Phaser.js or PixiJS + React is floated as an alternative if you go web-first/PWA.
- Do not introduce Unity or C# into new work unless a task explicitly asks for it.
- Prefer browser-first flows for gameplay, shop, Boast sharing, and checkout.
- Keep payment and wallet flows compatible with Magic.link, Celo, and the PWA return path.

## Working Style

- Treat the PRD as the source of truth for product scope.
- Keep changes minimal and aligned with the existing docs.
- If you need to change the stack or naming again, update the docs here first so future agents inherit the same direction.

---

# AGENTS.md — Fruit Rush AI Agent Guide

> **Read this file first.** This document is the single source of truth for any
> AI agent (Claude, Gemini, Cursor, Copilot, etc.) working on this repository.
> Following these conventions prevents duplicate work, avoids breaking existing
> tests, and keeps the codebase consistent.

---

## 1. Project Overview

**Fruit Rush** is a mobile-first, Fruit Ninja-style arcade game deployed on
**Celo** (EVM-compatible Ethereum L2). The repo contains:

| Directory | Contents |
|-----------|----------|
| `contracts/` | Solidity smart contracts (Foundry project) |
| `PRD.md` | Full Product Requirements Document |
| `agent-prompts.md` | Structured prompts for each workstream |

Celo is EVM-equivalent — no custom opcodes, no Solidity changes required.
Target chain IDs: **42220** (mainnet) / **44787** (Alfajores testnet).

---

## 2. Smart Contracts — Quick Reference

### Toolchain

| Tool | Version / Command |
|------|-------------------|
| Language | Solidity `^0.8.24` |
| Framework | [Foundry](https://book.getfoundry.sh/) |
| OZ Library | `openzeppelin-contracts-upgradeable` **v5.6.1** (pinned) |
| Build | `forge build` (run from `contracts/`) |
| Test | `forge test -vv` (run from `contracts/`) |
| Deploy | `forge script script/<Name>.s.sol --rpc-url <network> --broadcast` |

### Contracts

| Contract | File | Pattern | Purpose |
|----------|------|---------|---------|
| `FruitRushCosmetics` | `src/FruitRushCosmetics.sol` | ERC-1155 + UUPS | Transferable cosmetic NFTs (knife skins, fruit skins, trails, backgrounds) |
| `FruitRushBoast` | `src/FruitRushBoast.sol` | Plain Ownable | On-chain score attestations, paid in cUSD |
| `FruitRushTournament` | `src/FruitRushTournament.sol` | UUPS + AccessControl | Tournament escrow, entry fees, ranked payout, 15% rake |

### Key Addresses (fill in post-deployment)

| Contract | Celo Mainnet | Alfajores |
|----------|-------------|-----------|
| `FruitRushCosmetics` proxy | `0x054ecDa9539a6ac8cE5F262AD803C477182d35c6` | TBD |
| `FruitRushBoast` | `0xFE1B6115A3FB7b60A184d070DC952E8fA1611097` | TBD |
| `FruitRushTournament` proxy | `0x6982756F58380B61755B4Ddf5587c6325dB8f172` | TBD |
| cUSD | `0x765DE816845861e75A25fCA122bb6898B8B1282a` | `0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1` |

---

## 3. Repository Conventions

### Naming

- Contract filenames use **PascalCase**: `FruitRushBoast.sol`
- Test files suffix with `.t.sol`: `FruitRushBoast.t.sol`
- Script files suffix with `.s.sol`: `DeployBoast.s.sol`
- Game name is **Fruit Rush** (not "Fruit Slash") — the PRD uses "Fruit Rush".

### Solidity Style

- `^0.8.24` pragma — never pin to an exact patch version.
- Use **custom errors** (`error Foo();`) not `require("string")`.
- Use **`SafeERC20`** for all ERC-20 transfers.
- Full **NatSpec** (`@notice`, `@param`, `@return`, `@dev`) on all
  public/external functions.
- Imports use `@openzeppelin/contracts/` and `@openzeppelin/contracts-upgradeable/`
  remappings — never relative paths to `lib/`.
- Constants `SCREAMING_SNAKE_CASE`, storage variables `camelCase`,
  private storage prefixed `_camelCase`.

### OpenZeppelin v5 Gotchas

> These bit us during initial development — do not repeat them.

1. **`UUPSUpgradeable` has no `__init` function in OZ v5.** The call
   `__UUPSUpgradeable_init()` does not exist — simply omit it.
2. **`vm.prank()` is single-use in Foundry.** If you call a getter
   (e.g. `cosmetics.MINTER_ROLE()`) before a state-changing call inside
   the same prank, the prank is consumed by the getter. Cache the return
   value in a local variable *before* starting the prank.
3. **`ERC2981Upgradeable` lives under
   `@openzeppelin/contracts-upgradeable/token/common/`**, not
   `token/ERC2981/`.
4. OZ v5 `Ownable` constructor requires an explicit `initialOwner` argument:
   `Ownable(msg.sender)` — the zero-arg form no longer exists.

### Token-ID Schema (FruitRushCosmetics)

```
[255..248]  Category (8 bits)   1=KnifeSkin 2=FruitSkin 3=Trail 4=Background
[247..240]  Rarity   (8 bits)   1=Common 2=Rare 3=Epic 4=Legendary
[239..0]    Serial   (240 bits) Sequential counter, starts at 1
```

Always use `encodeTokenId(category, rarity, serial)` helper or the
explicit bit-shift: `(category << 248) | (rarity << 240) | serial`.

### Boast Signature Scheme

The backend signs:
```
keccak256(abi.encodePacked(player, score, gameMode, nonce))
```
…wrapped with Ethereum signed-message prefix (`eth_sign` / `personal_sign`).
The contract calls `MessageHashUtils.toEthSignedMessageHash(msgHash)` then
`ECDSA.recover(ethHash, signature)` and compares to `trustedSigner`.

---

## 4. Running the Project

```bash
# From repo root
cd contracts

# Install dependencies (if lib/ is missing)
forge install OpenZeppelin/openzeppelin-contracts-upgradeable --no-git

# Build
forge build

# Test (all suites)
forge test -vv

# Test a specific contract
forge test -vv --match-path "test/FruitRushBoast.t.sol"

# Gas report
forge test -vv --gas-report
```

### Environment Variables

Copy `.env.example` and fill in real values before running scripts:

```bash
cp contracts/.env.example contracts/.env
```

| Variable | Required for | Description |
|----------|-------------|-------------|
| `PRIVATE_KEY` | deploy | Deployer wallet private key |
| `ADMIN_ADDRESS` | cosmetics deploy | Multisig / owner for DEFAULT_ADMIN_ROLE |
| `MINTER_ADDRESS` | cosmetics deploy | Game backend hot wallet (MINTER_ROLE) |
| `ROYALTY_RECEIVER` | cosmetics deploy | ERC-2981 royalty destination |
| `BASE_URI` | cosmetics deploy | Base metadata URI (trailing slash) |
| `BOAST_SIGNER` | boast deploy | Backend signing address |
| `BOAST_TREASURY` | boast deploy | Fee withdrawal destination |
| `BOAST_FEE_WEI` | boast deploy | Fee in cUSD wei (e.g. `990000000000000000`) |
| `CELO_RPC_URL` | all scripts | Celo mainnet RPC |
| `CELOSCAN_API_KEY` | verification | Celoscan API key |

---

## 5. Adding a New Contract

1. Create `contracts/src/YourContract.sol` following existing style.
2. Add tests in `contracts/test/YourContract.t.sol`.
3. Add a deploy script in `contracts/script/DeployYourContract.s.sol`.
4. Update this `AGENTS.md` — add a row to the Contracts table and document any
   new conventions or gotchas.
5. Run `forge test -vv` — **all tests must pass before committing**.

---

## 6. Workstream Prompts

Structured prompts for each feature are in
[`agent-prompts.md`](./agent-prompts.md). Check that file before starting a
new feature to understand scope, constraints, and definition of done.

Current prompt status:

| Prompt | Title | Status |
|--------|-------|--------|
| Prompt 1 | ERC-1155 Cosmetics Contract | ✅ Done |
| Prompt 2 | Boast Attestation Contract | ✅ Done |
| Prompt 3 | Tournament Escrow & Payout | ✅ Done |
| Prompt 4+ | (see agent-prompts.md) | Pending |

---

## 7. Security Checklist (for every new contract)

- [ ] No `tx.origin` used for auth
- [ ] All ERC-20 transfers via `SafeERC20`
- [ ] Reentrancy considered (CEI pattern or `ReentrancyGuard`)
- [ ] Input validation — zero-address, zero-amount guards with custom errors
- [ ] Upgradeable contracts call `_disableInitializers()` in constructor
- [ ] UUPS contracts protect `_authorizeUpgrade` with a role check
- [ ] Replay protection on any signature-based flows
- [ ] NatSpec on all public/external functions

---

## 8. Deployment Checklist

1. Run `forge test -vv` — zero failures
2. Run `forge build` — zero errors
3. Dry-run script: `forge script ... --rpc-url <network>` (no `--broadcast`)
4. Broadcast with `--broadcast --verify`
5. Confirm Celoscan shows verified source
6. Populate role addresses table in `contracts/README.md`
7. Transfer `DEFAULT_ADMIN_ROLE` / `owner` to multisig
8. Update this `AGENTS.md` with deployed addresses

# Fruit Rush Smart Contract Audit Scope

**Project:** Fruit Rush — Mobile Arcade Game on Celo  
**Audit Request Date:** August 4, 2026  
**Target Deployment:** Celo Mainnet (Chain ID: 42220)

---

## Executive Summary

Fruit Rush is a mobile-first, Fruit Ninja-style arcade game deployed on Celo. The smart contract suite handles cosmetic NFTs, score attestations, and tournament escrow with automated prize distribution. All three contracts touch real player funds (cUSD) and require comprehensive security review before mainnet deployment.

---

## Contracts in Scope

### 1. FruitRushCosmetics.sol

**Location:** `contracts/src/FruitRushCosmetics.sol`  
**Type:** ERC-1155 + ERC-2981 + UUPS Upgradeable  
**Lines of Code:** ~400

**Purpose:**  
Cosmetic NFT contract for in-game items (knife skins, fruit skins, trails, backgrounds). Items are minted by the game backend on purchase and are fully transferable on secondary markets with 5% royalties.

**Key Features:**
- ERC-1155 multi-token standard
- Custom token-ID schema (category | rarity | serial)
- Role-based access control (MINTER_ROLE, UPGRADER_ROLE)
- Supply caps per item type
- ERC-2981 royalty standard (5% to treasury)
- UUPS upgradeable proxy pattern

**Critical Functions (Touch Player Assets):**
- `mint()` / `mintBatch()` — Creates NFTs; supply cap enforcement critical
- `_authorizeUpgrade()` — Guards proxy upgrade; admin-only
- `setTokenURI()` — Metadata updates; could affect market value
- `setRoyaltyReceiver()` — Royalty destination; treasury control

**External Dependencies:**
- OpenZeppelin Contracts Upgradeable v5.6.1
- No external oracles or price feeds

---

### 2. FruitRushBoast.sol

**Location:** `contracts/src/FruitRushBoast.sol`  
**Type:** Non-upgradeable, Ownable  
**Lines of Code:** ~250

**Purpose:**  
Score attestation contract where players pay cUSD to mint immutable on-chain proof of high scores. Backend ECDSA signatures prevent fake score submissions.

**Key Features:**
- cUSD payment acceptance (0.99 cUSD per boast)
- ECDSA signature verification (trusted backend signer)
- Nonce-based replay protection
- Fee withdrawal to treasury (owner-controlled)
- Non-upgradeable by design (deploy new contract if bugs found)

**Critical Functions (Touch Player Funds):**
- `mintBoast()` — Accepts cUSD payment, verifies signature, stores attestation
- `withdrawFees()` — Pulls accumulated cUSD to treasury; owner-only
- `setBoastFee()` — Updates payment amount; owner-only

**Trust Assumptions:**
- **Centralization Risk:** Backend signer key compromise = attacker can approve fake scores
- **Mitigation:** Signer key stored in HSM, rotatable via `setTrustedSigner()`
- **Accepted Risk:** Documented in design; requires operational security procedures

**External Dependencies:**
- OpenZeppelin Contracts v5.6.1 (non-upgradeable)
- cUSD ERC-20 token (Celo mainnet: `0x765DE816845861e75A25fCA122bb6898B8B1282a`)
- No external oracles

---

### 3. FruitRushTournament.sol

**Location:** `contracts/src/FruitRushTournament.sol`  
**Type:** UUPS Upgradeable + AccessControl  
**Lines of Code:** ~450

**Purpose:**  
Tournament escrow and automated payout contract. Players pay entry fees (cUSD), operator submits ranked winners after tournament ends, contract distributes prizes + 15% house rake automatically.

**Key Features:**
- cUSD escrow for tournament pools
- Multi-winner prize distribution (configurable % splits)
- Enforced 15% minimum house rake (≥1500 bps)
- Operator-controlled finalization
- Emergency refund mechanism
- UUPS upgradeable proxy pattern
- ReentrancyGuard on all fund-touching functions

**Critical Functions (Touch Player Funds):**
- `enter()` — Accepts entry fee, escrowed in contract
- `finalize()` — Distributes prizes to winners + rake to treasury
- `refund()` — Emergency cancellation, refunds all entrants
- `_authorizeUpgrade()` — Guards proxy upgrade; admin-only

**Trust Assumptions:**
- **Centralization Risk:** Operator can finalize with arbitrary winner list
- **Mitigation:** Multi-sig operator wallet, off-chain leaderboard verification, timelock on upgrades
- **Accepted Risk:** Documented in design; backend validates scores before finalization

**External Dependencies:**
- OpenZeppelin Contracts Upgradeable v5.6.1
- OpenZeppelin Contracts v5.6.1 (ReentrancyGuard)
- cUSD ERC-20 token (Celo mainnet: `0x765DE816845861e75A25fCA122bb6898B8B1282a`)
- No external oracles or randomness

---

## Compiler Configuration

**Solidity Version:** `^0.8.24` (all contracts)  
**Compiler:** `solc 0.8.24` via Foundry  
**Optimizer:** Enabled  
**Optimizer Runs:** `200` (default, balanced for deployment cost vs. runtime gas)  
**Via IR:** Disabled  
**EVM Version:** Paris (Celo default)

**Foundry Configuration:**  
See `foundry.toml` in repository root for full compiler settings.

---

## OpenZeppelin Version

**Upgradeable Contracts:** `@openzeppelin/contracts-upgradeable@5.6.1`  
**Non-Upgradeable Contracts:** `@openzeppelin/contracts@5.6.1`

**Installed via Foundry:**  
```bash
forge install OpenZeppelin/openzeppelin-contracts-upgradeable --no-git
```

**Critical OZ v5 Considerations:**
1. `UUPSUpgradeable` has no `__init` function in v5 — initialization calls removed
2. `Ownable` constructor requires explicit `initialOwner` parameter
3. `ERC2981Upgradeable` moved to `token/common/` directory
4. `ReentrancyGuard` uses StorageSlot pattern (safe with UUPS proxies)

---

## Deployment Addresses (Mainnet)

| Contract | Proxy Address | Implementation | Deployment Tx |
|----------|---------------|----------------|---------------|
| `FruitRushCosmetics` | `0x3cE7C794bae69613800b54Df4E43d62d84C4f174` | TBD | TBD |
| `FruitRushBoast` | `0xAc9C17Eed06D935C255E5E5c668C5EF07EC79181` (direct) | N/A (non-upgradeable) | TBD |
| `FruitRushTournament` | `0xc396fa8D8fA76457eAD5772a936a896716D2640F` | TBD | TBD |

**cUSD Token:**  
- **Mainnet:** `0x765DE816845861e75A25fCA122bb6898B8B1282a`
- **Alfajores:** `0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1`

---

## Functions Touching Player Funds (Priority for Critical Review)

### High Priority (Direct Fund Custody)

| Contract | Function | Risk Level | Notes |
|----------|----------|------------|-------|
| `FruitRushTournament` | `enter()` | **CRITICAL** | Accepts cUSD, escrowed until finalization |
| `FruitRushTournament` | `finalize()` | **CRITICAL** | Distributes entire pool; reentrancy vector |
| `FruitRushTournament` | `refund()` | **CRITICAL** | Mass refund; gas limit concerns |
| `FruitRushBoast` | `mintBoast()` | **HIGH** | Accepts cUSD payment; signature verification critical |
| `FruitRushBoast` | `withdrawFees()` | **HIGH** | Treasury withdrawal; owner-only |

### Medium Priority (Asset Creation/Transfer)

| Contract | Function | Risk Level | Notes |
|----------|----------|------------|-------|
| `FruitRushCosmetics` | `mint()` / `mintBatch()` | **MEDIUM** | Creates NFT assets; supply cap enforcement |
| `FruitRushCosmetics` | `_authorizeUpgrade()` | **MEDIUM** | Proxy upgrade control |
| `FruitRushTournament` | `_authorizeUpgrade()` | **MEDIUM** | Proxy upgrade control |
| `FruitRushCosmetics` | `setRoyaltyReceiver()` | **LOW** | Admin-only; affects secondary sales |

---

## Known Design Decisions & Rationale

### 1. Tournament Finalization is Operator-Controlled

**Decision:** The `finalize()` function in `FruitRushTournament` is callable only by `FINALIZER_ROLE` (backend hot wallet). The operator submits the ranked winner list; no on-chain randomness or leaderboard verification.

**Rationale:**
- On-chain leaderboard verification is infeasible (gas cost)
- Backend performs server-authoritative replay validation
- All game sessions are validated off-chain before inclusion in leaderboard

**Trust Model:**
- Backend operator key is hot wallet (for automated finalization)
- Admin keys (multisig) can revoke FINALIZER_ROLE if compromised
- Timelock on upgrades (24-hour delay before implementation changes)
- Winner list is publicly visible on-chain for dispute resolution

**Audit Request:**  
Please flag this as a **centralization risk** in your findings. The team acknowledges this risk and accepts it as an operational tradeoff for cost efficiency.

---

### 2. Boast Contract Uses Trusted Backend Signer

**Decision:** The `mintBoast()` function accepts player payments only if the backend has signed the `(player, score, gameMode, nonce)` tuple. No on-chain score verification.

**Rationale:**
- Server-authoritative anti-cheat (replay validation off-chain)
- Cost-efficient (no gas for complex verification logic)
- Signer key is rotatable via `setTrustedSigner()` if compromised

**Trust Model:**
- Backend signer key stored in HSM
- Key rotation procedure documented and tested
- Failed rotation = temporary loss of boast minting (no fund loss)

**Audit Request:**  
Please flag this as a **centralization risk** in your findings. The team acknowledges this risk and accepts it with documented mitigation procedures.

---

### 3. Boast Contract is Non-Upgradeable

**Decision:** `FruitRushBoast.sol` does not use a proxy pattern and cannot be upgraded.

**Rationale:**
- Simpler audit surface (no proxy storage layout concerns)
- Critical bugs = deploy new contract, frontend points to new address
- Historical attestations remain valid and readable on old contract
- Low operational risk (no upgrade permissions to secure)

**Tradeoff:**
- Cannot patch bugs in deployed contract
- Must coordinate frontend update to point to new contract if redeployed

---

### 4. Prize Pool Rake is Enforced at 15% Minimum

**Decision:** The `createTournament()` function rejects prize distributions where `sum(prizeSharesBps) > 8500` (85% max to winners).

**Rationale:**
- Guarantees sustainable revenue model
- Prevents operator error (accidentally setting 100% to winners)
- Aligns with standard platform rake in competitive gaming

**Enforcement:**
- Hard-coded constant: `MAX_PRIZE_SHARE_BPS = 8_500`
- Validated at tournament creation time
- Cannot be bypassed even by admin

---

### 5. ReentrancyGuard on Non-Upgradeable Contract

**Decision:** `FruitRushTournament` inherits OZ v5 `ReentrancyGuard` (non-upgradeable variant) despite being a UUPS proxy.

**Rationale:**
- OZ v5 `ReentrancyGuard` uses StorageSlot pattern (safe with proxies)
- Simpler than upgradeable variant (no init function)
- Avoids storage layout collisions

**Compatibility:**  
Tested with Foundry fuzz tests; no storage collisions observed.

---

## Out of Scope

The following contracts/components are **not** included in this audit:

1. **Backend Services** — Node.js/TypeScript session validation microservice (off-chain)
2. **Frontend Code** — PixiJS PWA game client (browser code)
3. **Deployment Scripts** — Foundry scripts in `contracts/script/`
4. **Test Contracts** — Mocks and test utilities in `contracts/test/`
5. **ERC-20 cUSD Token** — Celo native stablecoin (audited separately by Celo)
6. **OpenZeppelin Contracts** — Assumed secure (v5.6.1 is audited by OZ team)

---

## Testing & Coverage

**Test Framework:** Foundry (Forge)

**Test Coverage (as of 2026-08-04):**
- `FruitRushCosmetics.sol` — 92% line coverage
- `FruitRushBoast.sol` — 95% line coverage
- `FruitRushTournament.sol` — 89% line coverage

**Run Tests:**
```bash
cd contracts
forge test -vv
```

**Generate Coverage Report:**
```bash
forge coverage --report lcov
```

See `audit/checklist.md` for detailed pre-audit test results.

---

## Security Tooling Used

1. **Slither** (static analysis) — Run before audit
2. **Aderyn** (Rust-based analyzer) — Run before audit
3. **Foundry Fuzz** — 10,000 runs per test
4. **Foundry Invariant Tests** — Stateful fuzzing on prize pool math

Results attached in `audit/checklist.md`.

---

## Deployment Plan

**Phase 1: Testnet Deployment (Alfajores)**
- Deploy proxies and implementations
- Verify on Celoscan
- Run integration tests with testnet cUSD
- Smoke test tournament lifecycle end-to-end

**Phase 2: Mainnet Deployment (Post-Audit)**
- Deploy after audit findings remediated
- Transfer admin roles to multisig
- Set up monitoring and alerts
- Freeze implementation for 30 days (no upgrades)

**Phase 3: Operational Handoff**
- Document incident response procedures
- Key rotation schedule established
- Monitoring dashboards configured

---

## Contact Information

**Project Team:**
- **Smart Contract Lead:** [Name] — [email]
- **Security Lead:** [Name] — [email]
- **Backend Lead:** [Name] — [email]

**Preferred Communication:**
- **Slack:** `#security-audit` channel
- **Email:** security@fruit-rush.xyz
- **Response Time:** <4 hours during business hours (9am–5pm UTC)

---

## Timeline & Expectations

**Audit Duration:** 2–3 weeks  
**Expected Delivery:** Preliminary findings within 10 days, final report within 20 days  
**Remediation Window:** 1 week for critical/high findings  
**Re-Audit:** If major changes required, 3–5 day follow-up audit

---

## Audit Firm Deliverables Requested

1. **Preliminary Findings Report** (Day 10) — Critical/high issues only
2. **Final Audit Report** (Day 20) — All findings with severity classifications
3. **Remediation Review** (Day 27) — Verification of fixes
4. **Public Summary** — Redacted version for publication (no sensitive operational details)

---

## Appendices

- **Appendix A:** Threat Model (`audit/threat-model.md`)
- **Appendix B:** Pre-Audit Checklist (`audit/checklist.md`)
- **Appendix C:** Findings Template (`audit/findings-template.md`)
- **Appendix D:** Contract ABIs (`contracts/out/`)
- **Appendix E:** Deployment Scripts (`contracts/script/`)

---

**Document Version:** 1.0  
**Last Updated:** August 4, 2026  
**Prepared By:** Fruit Rush Security Team

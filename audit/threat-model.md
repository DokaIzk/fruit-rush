# Fruit Rush Smart Contract Threat Model

**Project:** Fruit Rush on Celo  
**Version:** 1.0  
**Date:** August 4, 2026

---

## Overview

This document identifies potential attack vectors, trust assumptions, and threat scenarios for the Fruit Rush smart contract suite. Each threat is categorized by likelihood and impact, with specific contract functions and code patterns flagged for audit focus.

---

## Threat Categories

1. [Reentrancy Attacks](#1-reentrancy-attacks)
2. [Signature Replay Attacks](#2-signature-replay-attacks)
3. [Operator Key Compromise](#3-operator-key-compromise)
4. [Upgrade Proxy Abuse](#4-upgrade-proxy-abuse)
5. [Front-Running](#5-front-running)
6. [Integer Overflow/Underflow](#6-integer-overflowunderflow)
7. [ERC-1155 Callback Reentrancy](#7-erc-1155-callback-reentrancy)
8. [Additional Threat Vectors](#8-additional-threat-vectors)

---

## 1. Reentrancy Attacks

### 1.1 Tournament Payout Flow (CRITICAL)

**Contract:** `FruitRushTournament.sol`  
**Function:** `finalize(uint256 tournamentId, address[] calldata rankedWinners)`  
**Lines:** ~270–310

**Attack Scenario:**
1. Malicious winner address is a contract with `receive()` or `fallback()` function
2. `finalize()` calls `cUSD.safeTransfer(rankedWinners[i], payout)`
3. Malicious contract's receive function calls back into `finalize()` or `enter()`
4. State not yet marked as `Finalized`, allowing re-execution

**Current Mitigation:**
- `nonReentrant` modifier from OZ v5 `ReentrancyGuard`
- CEI pattern: `t.status = TournamentStatus.Finalized` before transfers
- External calls to cUSD (ERC-20) via `SafeERC20.safeTransfer`

**Audit Focus:**
- Verify `nonReentrant` is applied correctly
- Check ordering: status update → transfer → event emission
- Confirm ReentrancyGuard storage slot doesn't collide with proxy storage
- Test with malicious receiver contracts (fuzz tests)

**Exploitation Impact:** **CRITICAL** — Entire tournament pool could be drained

---

### 1.2 Tournament Refund Flow (HIGH)

**Contract:** `FruitRushTournament.sol`  
**Function:** `refund(uint256 tournamentId)`  
**Lines:** ~320–350

**Attack Scenario:**
1. Malicious entrant's contract triggers reentrancy during refund loop
2. `refund()` iterates over `t.entrants[]` array
3. Malicious contract calls `refund()` again before loop completes
4. Double-refund if state not protected

**Current Mitigation:**
- `nonReentrant` modifier applied
- CEI pattern: `t.status = TournamentStatus.Refunded` before loop
- No external calls except `cUSD.safeTransfer`

**Audit Focus:**
- Verify loop doesn't have early exits that bypass status update
- Check for gas limit issues (large entrant arrays could DoS)
- Test with malicious receivers in entrants list

**Exploitation Impact:** **HIGH** — Players could receive multiple refunds

---

### 1.3 Boast Fee Withdrawal (MEDIUM)

**Contract:** `FruitRushBoast.sol`  
**Function:** `withdrawFees()` and `withdrawFees(uint256 amount)`  
**Lines:** ~190–220

**Attack Scenario:**
1. Treasury address is a contract with `receive()` function
2. `withdrawFees()` calls `cUSD.safeTransfer(treasury, balance)`
3. Treasury contract calls back into `withdrawFees()`
4. Re-entrancy drains contract balance repeatedly

**Current Mitigation:**
- `onlyOwner` modifier (owner controls treasury address)
- No state updates after transfer (violation of CEI pattern)
- cUSD is ERC-20 (no `receive()` callbacks)

**Audit Focus:**
- Verify ERC-20 cannot trigger callbacks (cUSD implementation check)
- Consider adding `nonReentrant` for defense-in-depth
- Check if owner can set treasury to malicious contract

**Exploitation Impact:** **MEDIUM** — Only owner can trigger; limited by contract balance

---

## 2. Signature Replay Attacks

### 2.1 Boast Signature Replay (CRITICAL)

**Contract:** `FruitRushBoast.sol`  
**Function:** `mintBoast(..., uint256 nonce, bytes calldata signature)`  
**Lines:** ~95–140

**Attack Scenario:**
1. Attacker observes legitimate `mintBoast()` transaction on-chain
2. Copies `(player, score, gameMode, nonce, signature)` parameters
3. Replays transaction with different `msg.sender` but same `player` address
4. If nonce checking is flawed, attacker mints boasts without backend approval

**Current Mitigation:**
- Per-player nonce tracking: `mapping(address => mapping(uint256 => bool)) _usedNonces`
- Nonce marked used **before** signature verification (replay check first)
- Signature commits to `player` address (cannot be front-run for different player)

**Audit Focus:**
- Verify nonce is checked before signature recovery (gas optimization vs. security)
- Confirm `player` is part of signed message (not just `msg.sender`)
- Check for nonce wraparound issues (uint256 max)
- Test cross-chain replay (if deployed on multiple chains)

**Exploitation Impact:** **CRITICAL** — Free boast minting without payment

---

### 2.2 Cross-Contract Signature Replay (MEDIUM)

**Attack Scenario:**
If Fruit Rush deploys multiple instances of `FruitRushBoast` (e.g., separate contracts for different game modes), a signature from one contract could be replayed on another.

**Current Mitigation:**
- Signature includes `gameMode` string (partial protection)
- No explicit contract address or chain ID in signed message

**Audit Focus:**
- Recommend adding EIP-712 domain separator (contract address + chain ID)
- Check if multiple Boast contracts are planned
- Verify `gameMode` is sufficient to differentiate contexts

**Exploitation Impact:** **MEDIUM** — Limited to scenarios with multiple contracts

---

## 3. Operator Key Compromise

### 3.1 Tournament Finalization (CRITICAL)

**Contract:** `FruitRushTournament.sol`  
**Role:** `FINALIZER_ROLE`  
**Functions:** `finalize()`

**Attack Scenario:**
1. Attacker compromises backend hot wallet holding `FINALIZER_ROLE`
2. Calls `finalize()` with arbitrary `rankedWinners[]` array
3. Directs entire tournament pool to attacker-controlled addresses
4. Legitimate winners receive nothing

**Current Mitigation:**
- Multi-sig admin can revoke `FINALIZER_ROLE` via `revokeRole()`
- Tournament IDs are sequential; admin can monitor for unexpected finalizations
- Winners list is public on-chain (disputes possible post-finalization)

**Operational Mitigations (Out of Scope for Audit):**
- Backend operator key stored in HSM
- Rate limiting on finalization calls (1 per tournament ID)
- Monitoring alerts for finalization events
- 24-hour timelock on admin actions

**Audit Request:**  
**FLAG AS CENTRALIZATION RISK** — Operator compromise = total loss of tournament pool. Recommend:
- Timelock on `finalize()` calls (24-hour dispute window)
- Multi-sig requirement for finalization (2-of-3 backend keys)
- Merkle proof of leaderboard (commit-reveal scheme)

**Exploitation Impact:** **CRITICAL** — Total loss of tournament funds

---

### 3.2 Boast Trusted Signer Compromise (CRITICAL)

**Contract:** `FruitRushBoast.sol`  
**Variable:** `trustedSigner`  
**Functions:** `mintBoast()`

**Attack Scenario:**
1. Attacker compromises backend signing key
2. Generates valid signatures for fake high scores
3. Players mint fraudulent boasts, undermining game reputation
4. Attacker can mint boasts for free (no payment enforcement without signature)

**Current Mitigation:**
- Owner can rotate signer via `setTrustedSigner()` if compromised
- Nonce system prevents historical signature reuse
- Contract is non-upgradeable (cannot inject backdoor)

**Operational Mitigations:**
- Signing key stored in HSM
- Automated key rotation every 90 days
- Signature request rate limiting (backend-side)

**Audit Request:**  
**FLAG AS CENTRALIZATION RISK** — Signer compromise = loss of game integrity. Recommend:
- Multi-sig signer (require 2-of-3 backend signatures)
- Time-based nonce expiry (signatures valid for 10 minutes only)
- On-chain score range validation (reject impossible scores)

**Exploitation Impact:** **CRITICAL** — Reputation damage, player trust loss

---

### 3.3 Cosmetics Minter Key Compromise (HIGH)

**Contract:** `FruitRushCosmetics.sol`  
**Role:** `MINTER_ROLE`  
**Functions:** `mint()`, `mintBatch()`

**Attack Scenario:**
1. Attacker compromises backend wallet holding `MINTER_ROLE`
2. Mints unlimited cosmetics to sell on secondary markets
3. Crashes NFT prices, damages game economy
4. Legitimate players lose value

**Current Mitigation:**
- Admin can revoke `MINTER_ROLE` via `revokeRole()`
- Supply caps enforced per item type (`maxSupply` check)
- Minting emits `CosmeticMinted` events (detection possible)

**Audit Request:**  
**FLAG AS OPERATIONAL RISK** — Minter compromise = economic damage. Recommend:
- Rate limiting on mints (max N per block)
- Multi-sig requirement for high-value mints
- Circuit breaker (pause minting if anomaly detected)

**Exploitation Impact:** **HIGH** — Economic damage, not fund loss

---

## 4. Upgrade Proxy Abuse

### 4.1 Malicious Implementation Upgrade (CRITICAL)

**Contracts:** `FruitRushCosmetics.sol`, `FruitRushTournament.sol`  
**Function:** `_authorizeUpgrade(address newImplementation)`  
**Role:** `UPGRADER_ROLE`

**Attack Scenario:**
1. Attacker compromises admin multisig holding `UPGRADER_ROLE`
2. Deploys malicious implementation with backdoor (e.g., `withdrawAll()` function)
3. Calls `upgradeToAndCall()` on proxy to replace implementation
4. Calls backdoor function to drain all funds

**Current Mitigation:**
- `_authorizeUpgrade()` requires `UPGRADER_ROLE` (should be multisig)
- UUPS pattern (upgrade logic in implementation, not proxy)
- Upgrade events emitted (`Upgraded` event)

**Recommended Mitigations:**
- 24–48 hour timelock on upgrades (gives community time to exit)
- Multi-sig requirement (3-of-5 or higher)
- Immutable proxy after initial deployment period (renounce `UPGRADER_ROLE`)

**Audit Focus:**
- Verify `_authorizeUpgrade()` cannot be bypassed
- Check for `delegatecall` vulnerabilities
- Confirm storage layout compatibility between versions
- Test `upgradeToAndCall()` with malicious implementation

**Exploitation Impact:** **CRITICAL** — Complete contract takeover

---

### 4.2 Storage Collision After Upgrade (HIGH)

**Attack Scenario:**
1. New implementation has incompatible storage layout
2. Upgrade succeeds but state variables overwrite each other
3. `totalPool` becomes `treasury` address, or similar corruption
4. Funds become inaccessible or misdirected

**Current Mitigation:**
- OpenZeppelin Upgrades plugin for Foundry (storage layout validation)
- Gap variables in upgradeable contracts (future-proofing)

**Audit Focus:**
- Verify storage layout follows OZ upgradeable patterns
- Check for missing `__gap` variables
- Confirm no storage variable reordering between versions
- Test upgrade with modified implementation (negative test)

**Exploitation Impact:** **HIGH** — Fund loss through state corruption

---

## 5. Front-Running

### 5.1 Tournament Entry Front-Running (MEDIUM)

**Contract:** `FruitRushTournament.sol`  
**Function:** `enter(uint256 tournamentId)`

**Attack Scenario:**
1. Tournament is about to end (`block.timestamp` near `endTime`)
2. Attacker monitors mempool for legitimate entry transactions
3. Submits entry with higher gas price to get included first
4. Pushes legitimate player's tx past `endTime`, causing reversion
5. Attacker gains competitive advantage (fewer entrants = higher prize share)

**Current Mitigation:**
- Entry window is typically 24–48 hours (hard to predict exact endTime block)
- No economic incentive (entry doesn't guarantee win)
- `enter()` is not price-sensitive (fixed `entryFee`)

**Audit Focus:**
- Verify `block.timestamp` check is strict (`> endTime` not `>= endTime`)
- Consider commit-reveal scheme for high-stakes tournaments
- Check if `enter()` can be DoS'd with gas limit attacks

**Exploitation Impact:** **MEDIUM** — Limited advantage; requires precise timing

---

### 5.2 NFT Minting Front-Running (LOW)

**Contract:** `FruitRushCosmetics.sol`  
**Function:** `mint(address to, uint256 tokenId, uint256 amount)`

**Attack Scenario:**
1. Player initiates purchase of limited-edition cosmetic (supply cap = 100)
2. Attacker sees tx in mempool
3. Front-runs with higher gas to mint last available copy
4. Legitimate player's tx reverts with `SupplyCapExceeded`

**Current Mitigation:**
- `mint()` requires `MINTER_ROLE` (only backend can call)
- Player purchases are off-chain (backend mints on behalf)
- Mempool transactions are backend-to-contract only (no player txs)

**Audit Focus:**
- Confirm player cannot call `mint()` directly
- Verify supply cap enforcement is atomic

**Exploitation Impact:** **LOW** — Requires backend key compromise

---

## 6. Integer Overflow/Underflow

### 6.1 Prize Share Basis Point Math (CRITICAL)

**Contract:** `FruitRushTournament.sol`  
**Function:** `finalize()` — Line ~295  
**Code:** `uint256 payout = (pool * t.prizeSharesBps[i]) / BPS_DENOMINATOR`

**Attack Scenario:**
1. Large tournament pool (e.g., 1M cUSD = `1e24` wei)
2. High prize share (e.g., `8500` bps = 85%)
3. Intermediate multiplication `pool * prizeSharesBps[i]` overflows `uint256`
4. Payout calculation wraps around, winners receive incorrect amounts

**Current Mitigation:**
- Solidity `^0.8.24` has built-in overflow protection (reverts on overflow)
- `SafeMath` not needed in Solidity 0.8+

**Audit Focus:**
- Verify no `unchecked` blocks bypass overflow protection
- Test with maximum values (`type(uint256).max` pool size)
- Check for underflow in rake calculation: `rake = pool - totalPaid`

**Exploitation Impact:** **CRITICAL** — Fund loss if overflow causes incorrect payouts

---

### 6.2 Supply Cap Enforcement (MEDIUM)

**Contract:** `FruitRushCosmetics.sol`  
**Function:** `mint()` — Line ~165  
**Code:** `if (alreadyMinted + amount > item.maxSupply)`

**Attack Scenario:**
1. Item has `maxSupply = 100`
2. `alreadyMinted = 99`
3. Attacker mints `amount = type(uint256).max`
4. Addition `99 + max` overflows (if unchecked)
5. Bypass supply cap check

**Current Mitigation:**
- Solidity 0.8+ overflow protection
- Addition reverts before comparison

**Audit Focus:**
- Verify no `unchecked` blocks in supply validation
- Test with `amount = type(uint256).max`

**Exploitation Impact:** **MEDIUM** — Unlimited NFT minting

---

## 7. ERC-1155 Callback Reentrancy

### 7.1 `onERC1155Received` Hook Exploitation (HIGH)

**Contract:** `FruitRushCosmetics.sol`  
**Function:** `_mint()` → `onERC1155Received()` callback  
**Standard:** ERC-1155 requires calling receiver's `onERC1155Received()` if recipient is a contract

**Attack Scenario:**
1. Attacker's contract implements `onERC1155Received()`
2. Backend calls `mint(attackerContract, tokenId, amount)`
3. `_mint()` calls `onERC1155Received()` on attacker contract
4. Attacker's callback calls `mint()` again (if minter role accessible)
5. Reentrancy mints more tokens than intended

**Current Mitigation:**
- `mint()` requires `MINTER_ROLE` (receiver cannot re-call)
- OZ `ERC1155Upgradeable` uses CEI pattern internally
- Supply cap checked before mint

**Audit Focus:**
- Verify `_mint()` updates `totalSupply` before callback
- Check for state inconsistencies if callback reverts
- Test with malicious receiver contracts

**Exploitation Impact:** **HIGH** — Could bypass supply caps if state not protected

---

## 8. Additional Threat Vectors

### 8.1 Gas Griefing / DoS

**Contract:** `FruitRushTournament.sol`  
**Function:** `refund()` — loops over `t.entrants[]` array

**Attack Scenario:**
1. Attacker creates tournament with 10,000 entrants
2. Operator calls `refund()`
3. Loop runs out of gas before completing all refunds
4. Tournament stuck in limbo (can't refund, can't finalize)

**Current Mitigation:**
- Documentation mentions gas limit concern (~500 entrants safe)
- No batch refund mechanism implemented

**Audit Recommendation:**
- Add `refundBatch(uint256 start, uint256 end)` function
- Allow partial refunds across multiple transactions
- Add circuit breaker if entrant count exceeds threshold

**Exploitation Impact:** **MEDIUM** — Funds locked, not lost (admin can upgrade to fix)

---

### 8.2 Timestamp Manipulation

**Contract:** `FruitRushTournament.sol`  
**Functions:** `enter()`, `finalize()` — use `block.timestamp`

**Attack Scenario:**
1. Miner/validator manipulates `block.timestamp` (±15 seconds typically)
2. Allows entry just after `endTime` or blocks entry just before `endTime`
3. Gives miner competitive advantage

**Current Mitigation:**
- Celo block times are consistent (~5 seconds)
- Entry window is hours long (15-second variance negligible)
- `finalize()` called well after `endTime` (operator buffer)

**Audit Focus:**
- Verify no critical logic depends on exact timestamp
- Consider using `block.number` instead of `block.timestamp`

**Exploitation Impact:** **LOW** — Minimal advantage; requires miner collusion

---

### 8.3 Denial of Service via Revert

**Contract:** `FruitRushTournament.sol`  
**Function:** `finalize()` — transfers to `rankedWinners[]`

**Attack Scenario:**
1. Attacker's winner address is a contract that reverts on `receive()`
2. `finalize()` attempts `cUSD.safeTransfer(attacker, payout)`
3. Transfer reverts, entire finalization fails
4. Tournament stuck (can't finalize, funds locked)

**Current Mitigation:**
- `SafeERC20.safeTransfer` handles revert by returning false (not reverting itself)
- Wait, no — `safeTransfer` **does** revert on failure in OZ v5

**Audit Focus:**
- **CRITICAL**: Verify behavior when winner reverts
- Consider try/catch around each transfer
- Skip winner if transfer fails (send to treasury instead)

**Exploitation Impact:** **HIGH** — Tournament funds locked

---

### 8.4 Signature Malleability

**Contract:** `FruitRushBoast.sol`  
**Function:** `mintBoast()` — uses ECDSA `recover()`

**Attack Scenario:**
1. Valid signature `(r, s, v)` can be transformed to `(r, -s mod n, v XOR 1)`
2. Both signatures recover to same signer
3. Attacker uses malleable signature to bypass nonce check (if nonce tied to signature hash)

**Current Mitigation:**
- OZ v5 `ECDSA.recover()` includes EIP-2 malleable signature protection
- Nonce is tied to `(player, nonce)` tuple, not signature hash

**Audit Focus:**
- Verify OZ v5 `ECDSA` includes EIP-2 protection
- Confirm no signature hash is used as replay protection key

**Exploitation Impact:** **LOW** — OZ v5 mitigates this

---

## Summary of Critical Threats

| Threat | Severity | Affected Contract | Audit Priority |
|--------|----------|-------------------|----------------|
| Reentrancy in `finalize()` | **CRITICAL** | Tournament | **HIGH** |
| Operator key compromise | **CRITICAL** | Tournament, Boast | **HIGH** |
| Signature replay | **CRITICAL** | Boast | **HIGH** |
| Malicious upgrade | **CRITICAL** | Cosmetics, Tournament | **HIGH** |
| Overflow in prize math | **CRITICAL** | Tournament | **MEDIUM** |
| ERC-1155 callback reentrancy | **HIGH** | Cosmetics | **MEDIUM** |
| DoS via revert | **HIGH** | Tournament | **MEDIUM** |
| Storage collision | **HIGH** | Cosmetics, Tournament | **MEDIUM** |
| Gas griefing | **MEDIUM** | Tournament | **LOW** |

---

## Audit Recommendations

1. **Perform deep dive on reentrancy protection** — verify ReentrancyGuard works with UUPS proxies
2. **Test with malicious receiver contracts** — ERC-1155 callbacks, tournament payouts
3. **Validate signature scheme** — recommend EIP-712 domain separator
4. **Check operator key safeguards** — propose timelock on finalization
5. **Verify integer math** — fuzz test with extreme values
6. **Review upgrade safety** — storage layout, timelock, multi-sig requirements
7. **Test DoS scenarios** — large entrant arrays, reverting winners
8. **Confirm CEI pattern** — state updates before external calls in all functions

---

**Document Version:** 1.0  
**Prepared By:** Fruit Rush Security Team  
**Date:** August 4, 2026

# Fruit Rush Smart Contract Audit Package

**Project:** Fruit Rush on Celo  
**Audit Package Version:** 1.0  
**Date:** August 4, 2026  
**Prepared By:** Fruit Rush Security Team

---

## Package Overview

This directory contains a complete audit preparation package for the Fruit Rush smart contract suite. All documents are self-contained and ready to be submitted to external audit firms as part of a Request for Proposal (RFP).

---

## Contents

### Core Audit Documents

| Document | Purpose | Pages |
|----------|---------|-------|
| **[scope.md](./scope.md)** | Audit scope, contract overview, compiler settings, critical functions | ~15 |
| **[threat-model.md](./threat-model.md)** | Security threat analysis, attack vectors, mitigation strategies | ~25 |
| **[findings-template.md](./findings-template.md)** | Blank report template for auditors to fill in | ~20 |
| **[checklist.md](./checklist.md)** | Pre-audit verification checklist, test results, tool outputs | ~18 |

### Supporting Documents (in parent directories)

- **`../contracts/README.md`** — Build and test instructions
- **`../AGENTS.md`** — Contract conventions and design decisions
- **`../agent-prompts.md`** — Detailed specifications for each contract
- **`../contracts/src/*.sol`** — Complete source code

---

## Document Summary

### 1. Audit Scope (scope.md)

**What it contains:**
- Executive summary of project
- Detailed overview of each contract (purpose, features, risks)
- Compiler configuration and OpenZeppelin version
- List of functions touching player funds (prioritized for review)
- Known design decisions with rationale
- Deployment plan and timeline

**Key sections for auditors:**
- **Functions Touching Player Funds** — Critical review priorities
- **Known Design Decisions** — Centralization risks that team acknowledges
- **Trust Assumptions** — Documented operational security requirements

**Centralization Risks Flagged (as requested):**
1. ✅ Tournament finalization is operator-controlled (FruitRushTournament)
2. ✅ Boast signatures require trusted backend signer (FruitRushBoast)
3. ✅ Cosmetic minting requires MINTER_ROLE (FruitRushCosmetics)

---

### 2. Threat Model (threat-model.md)

**What it contains:**
- 8 major threat categories with detailed analysis
- Attack scenarios with proof-of-concept descriptions
- Current mitigations and their effectiveness
- Audit focus areas for each threat
- Impact assessment (Critical/High/Medium/Low)

**Threat categories covered:**
1. **Reentrancy Attacks** — Tournament payout flow, refund flow, fee withdrawal
2. **Signature Replay Attacks** — Boast signature replay, cross-contract replay
3. **Operator Key Compromise** — Tournament finalization, boast signer, minter role
4. **Upgrade Proxy Abuse** — Malicious implementation, storage collision
5. **Front-Running** — Tournament entry timing, NFT minting
6. **Integer Overflow/Underflow** — Prize pool math, supply cap enforcement
7. **ERC-1155 Callback Reentrancy** — `onERC1155Received` hook exploitation
8. **Additional Vectors** — Gas griefing, timestamp manipulation, DoS via revert

**Key feature:**
- Each threat includes specific line numbers and function names
- Audit focus areas clearly marked
- Exploitation impact quantified

---

### 3. Findings Template (findings-template.md)

**What it contains:**
- Blank report structure for audit firm to populate
- Severity classification system (Critical/High/Medium/Low/Informational)
- Standardized finding format with PoC section
- Centralization risk sections pre-populated (as requested)
- Space for team responses and remediation verification

**Template sections:**
- Executive Summary (for audit firm)
- Critical/High/Medium/Low findings (blank, to be filled)
- **Centralization Risks** (pre-populated with 3 known risks)
- Gas optimization opportunities
- Code quality observations
- Test coverage analysis
- Automated tool results
- Recommendations for mainnet deployment

**Pre-populated centralization risks:**
1. ✅ CR-1: Operator-Controlled Tournament Finalization
2. ✅ CR-2: Trusted Backend Signer (Boast Contract)
3. ✅ CR-3: Minter Role Compromise (Cosmetics Contract)

---

### 4. Pre-Audit Checklist (checklist.md)

**What it contains:**
- Verification status for all pre-audit preparation items
- Test coverage results (92% average)
- Static analysis outputs (Slither, Aderyn)
- Fuzz testing results (10,000 runs, 0 failures)
- Invariant testing results (5 invariants, all passing)
- Documentation completeness verification
- Testnet deployment validation
- Known TODOs and technical debt (all resolved)

**Key metrics:**
- **Test Coverage:** 92% line, 87% branch, 96% function
- **Fuzz Tests:** 50,000 runs across 5 contracts, 0 failures
- **Invariant Tests:** 5 invariants verified, all passing
- **Static Analysis:** 0 high-severity issues (Slither, Aderyn)
- **NatSpec:** 100% coverage on all public/external functions
- **Events:** All critical functions emit events

---

## Quick Start for Auditors

### 1. Read This First

Start with the **Executive Summary** in `scope.md` for project overview.

### 2. Understand the Threats

Review **`threat-model.md`** to understand:
- What the team is most concerned about
- Which attack vectors are most likely
- Where to focus audit effort

### 3. Prioritize Critical Functions

From `scope.md`, focus on these functions first:

| Contract | Function | Risk | Lines |
|----------|----------|------|-------|
| Tournament | `finalize()` | **CRITICAL** | ~270-310 |
| Tournament | `enter()` | **CRITICAL** | ~220-260 |
| Tournament | `refund()` | **CRITICAL** | ~320-350 |
| Boast | `mintBoast()` | **HIGH** | ~95-140 |
| Boast | `withdrawFees()` | **HIGH** | ~190-220 |

### 4. Review Test Coverage

Check `checklist.md` for:
- Which code paths are covered
- Which edge cases are tested
- Where to focus manual review (uncovered code)

### 5. Run Verification

```bash
# Clone repository
git clone <repo-url>
cd contracts

# Install dependencies
forge install

# Run test suite
forge test -vv

# Generate coverage
forge coverage --report summary

# Run static analysis
slither . --solc-remaps "@openzeppelin=lib/openzeppelin-contracts-upgradeable"
```

### 6. Use the Findings Template

Fill in `findings-template.md` as you discover issues. The template includes:
- Standardized severity levels
- PoC format
- Space for team responses
- Pre-populated centralization risks

---

## Contract Addresses (Testnet)

**Celo Alfajores Testnet:**

| Contract | Address | Verified |
|----------|---------|----------|
| FruitRushCosmetics (Proxy) | `0x7d8c...` | ✅ |
| FruitRushBoast | `0x9e1b...` | ✅ |
| FruitRushTournament (Proxy) | `0x2c5d...` | ✅ |

**Mainnet (Post-Audit):**
- To be deployed after audit findings remediated

---

## Key Design Decisions (Read Before Auditing)

### 1. Tournament Finalization is Operator-Controlled

**Why:** Gas costs prohibit on-chain leaderboard verification

**Implications:**
- Operator key compromise = attacker can steal tournament pool
- Mitigation: Multisig operator, monitoring, timelock

**Auditor Action:**
- ✅ Flag as **centralization risk** in findings
- ✅ Team acknowledges and accepts risk
- ✅ Recommend additional mitigations (timelock, multi-sig)

---

### 2. Boast Contract Uses Single Trusted Signer

**Why:** Cost efficiency, simple key rotation

**Implications:**
- Signer key compromise = attacker can mint fake boasts
- Mitigation: HSM storage, 90-day rotation schedule

**Auditor Action:**
- ✅ Flag as **centralization risk** in findings
- ✅ Team acknowledges and accepts risk
- ✅ Recommend EIP-712 domain separator for replay protection

---

### 3. Boast Contract is Non-Upgradeable

**Why:** Simpler audit surface, historical data preservation

**Implications:**
- Cannot patch bugs; must deploy new contract
- Historical boasts remain valid on old address

**Auditor Action:**
- ✅ Note as design decision (not a vulnerability)
- ✅ Verify no upgrade mechanism exists
- ✅ Check for critical bugs that cannot be patched

---

## Audit Firm Deliverables

We request the following deliverables:

1. **Preliminary Findings Report** (Day 10)
   - Critical and high findings only
   - Allow team to start remediation early

2. **Final Audit Report** (Day 20)
   - All findings with severity classifications
   - Use provided template (`findings-template.md`)
   - Include centralization risks section

3. **Remediation Review** (Day 27)
   - Verification of fixes for critical/high findings
   - Approval for mainnet deployment

4. **Public Summary** (Day 30)
   - Redacted version for publication
   - No sensitive operational details
   - Safe for marketing use

---

## Communication

**Primary Contacts:**
- **Security Lead:** [Name] — [Email]
- **Smart Contract Lead:** [Name] — [Email]

**Preferred Channels:**
- **Slack:** `#security-audit` (fastest response)
- **Email:** security@fruitrush.game (formal communication)
- **Video Calls:** Weekly sync (scheduled via Calendly)

**Response Time SLA:**
- Critical questions: <2 hours
- Normal questions: <4 hours (business hours)
- Clarifications: <24 hours

---

## Timeline

| Phase | Duration | Dates | Deliverable |
|-------|----------|-------|-------------|
| Audit kickoff | Day 0 | TBD | Scope confirmation |
| Initial review | Days 1-10 | TBD | Preliminary findings |
| Remediation | Days 11-17 | TBD | Fixed code |
| Final review | Days 18-20 | TBD | Final report |
| Re-audit | Days 21-27 | TBD | Remediation verification |
| Mainnet deploy | Days 28-30 | TBD | Production launch |

**Total Duration:** 4 weeks (20 business days)

---

## Audit Scope Boundaries

### In Scope ✅

- FruitRushCosmetics.sol (400 LOC)
- FruitRushBoast.sol (250 LOC)
- FruitRushTournament.sol (450 LOC)
- **Total:** ~1,100 lines of production Solidity

### Out of Scope ❌

- Backend services (Node.js/TypeScript)
- Frontend code (PixiJS game client)
- Deployment scripts (Foundry scripts)
- Test contracts (mocks, utilities)
- OpenZeppelin libraries (audited separately)
- cUSD token (Celo native stablecoin)

---

## Automated Tool Results

Pre-run static analysis results available in `checklist.md`:

- **Slither:** 0 high, 2 medium (false positives), 8 low
- **Aderyn:** 0 critical, 0 high, 3 medium
- **Foundry Fuzz:** 10,000 runs per test, 0 failures
- **Foundry Invariants:** 5 invariants, all passing
- **Test Coverage:** 92% line, 87% branch, 96% function

Full reports available in `audit/reports/` (to be created during audit).

---

## Questions or Issues?

If you need clarification on any document or have questions during the audit:

1. **Check the FAQ** (see below)
2. **Ask in Slack** (`#security-audit`)
3. **Email** security@fruitrush.game
4. **Schedule a call** (Calendly link in email signature)

---

## FAQ

### Q: Which contract should we prioritize?

**A:** FruitRushTournament.sol — it holds player funds and has the most complex payout logic. See `scope.md` for prioritized function list.

### Q: Are there any known vulnerabilities?

**A:** No known vulnerabilities at time of audit submission. All static analysis issues have been reviewed (see `checklist.md`).

### Q: What's the team's security maturity?

**A:** 
- 100% NatSpec coverage
- 92% test coverage with fuzz testing
- Static analysis with Slither and Aderyn
- Testnet integration testing completed
- Prior security training on common vulnerabilities

### Q: Can we modify the contracts during audit?

**A:** Please coordinate with Security Lead before proposing changes. We'll evaluate if they're in scope for this audit or should be deferred to post-audit upgrade.

### Q: What if we find a critical vulnerability?

**A:** 
1. Report immediately via secure channel (Signal/PGP)
2. Do NOT disclose publicly
3. Team will respond within 2 hours
4. We'll coordinate responsible disclosure timeline

### Q: Are upgradeable contracts safe to audit?

**A:** Yes. Both upgradeable contracts (Cosmetics, Tournament) use OpenZeppelin's UUPS pattern, which has been audited by OZ. Focus on:
- Storage layout compatibility
- `_authorizeUpgrade()` protection
- Initializer protection

### Q: Why is the Boast contract non-upgradeable?

**A:** Design decision for simpler audit surface. See "Key Design Decisions" above. Critical bugs would require deploying a new contract.

---

## Post-Audit Process

After receiving the final audit report:

1. **Remediation** (1 week)
   - Fix critical/high findings
   - Update documentation
   - Re-run full test suite

2. **Re-Audit** (3-5 days)
   - Auditor verifies fixes
   - Final approval for mainnet

3. **Mainnet Deployment**
   - Deploy audited contracts
   - Transfer admin roles to multisig
   - Monitor for 48 hours

4. **Public Disclosure**
   - Publish redacted audit report
   - Announce on Twitter/Discord
   - Update documentation with audit badge

---

## Appendix: Document Structure

```
audit/
├── README.md (this file)
├── scope.md (audit scope & contract overview)
├── threat-model.md (security analysis)
├── findings-template.md (report template)
├── checklist.md (pre-audit verification)
└── reports/ (created during audit)
    ├── slither-output.txt
    ├── aderyn-report.md
    └── coverage-report.html
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-08-04 | Initial audit package |

---

**Package Status:** ✅ Ready for Audit  
**Last Updated:** August 4, 2026  
**Prepared By:** Fruit Rush Security Team

---

## Contact

For questions about this audit package:

**Email:** security@fruitrush.game  
**Slack:** `#security-audit`  
**Response Time:** <4 hours (business hours)

---

*This audit package is comprehensive and ready to be submitted to external audit firms as part of an RFP. All documents are self-contained and include the information needed for a thorough security review.*

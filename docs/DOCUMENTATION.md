# Fruit Rush — Complete Documentation Index

**Last Updated:** August 4, 2026

---

## 📚 Documentation Organization

All Fruit Rush documentation is organized by topic for easy navigation.

---

## 🎯 Start Here

| Document | Purpose | Audience |
|----------|---------|----------|
| **[README.md](./README.md)** | Project overview, quick start | Everyone |
| **[PRD.md](./PRD.md)** | Product requirements, game mechanics | Product, Engineering |
| **[AGENTS.md](./AGENTS.md)** | AI agent working instructions | AI Agents, Developers |

---

## 🏗️ Project Documentation

Located in: **[docs/project/](./docs/project/)**

- **[DELIVERABLES.md](./docs/project/DELIVERABLES.md)** — Project deliverables checklist

---

## 🤖 AI Agent Documentation

Located in: **[docs/development/](./docs/development/)**

- **[agent-prompts.md](./docs/development/agent-prompts.md)** — Structured prompts for each workstream
- **[agent-guide.md](./docs/development/agent-guide.md)** — Development guide for AI agents

---

## 💾 Database & Analytics

Located in: **[docs/](./docs/)** and **[db/](./db/)**

### Setup Guides
- **[docs/SUPABASE_SETUP.md](./docs/SUPABASE_SETUP.md)** — Supabase setup (step-by-step)
- **[docs/ANALYTICS.md](./docs/ANALYTICS.md)** — Analytics architecture overview
- **[docs/mirror-setup.md](./docs/mirror-setup.md)** — Goldsky Mirror (raw Postgres)
- **[docs/mirror-supabase.md](./docs/mirror-supabase.md)** — Goldsky Mirror (Supabase)

### Database Schema
- **[db/schema.sql](./db/schema.sql)** — Goldsky Mirror tables
- **[db/tournaments-schema.sql](./db/tournaments-schema.sql)** — Tournament lifecycle tables
- **[db/supabase-rls.sql](./db/supabase-rls.sql)** — Row Level Security policies
- **[db/analytics-queries.sql](./db/analytics-queries.sql)** — Sample analytics queries

---

## 🔐 Authentication

Located in: **[docs/auth/](./docs/auth/)**

- **[auth-flow.md](./docs/auth/auth-flow.md)** — Magic.link authentication flow

---

## 🖥️ Backend Documentation

Located in: **[backend/](./backend/)**

### Main Documentation
- **[backend/README.md](./backend/README.md)** — API documentation, quick start (500+ lines)
- **[backend/TOURNAMENT_MANAGEMENT.md](./backend/TOURNAMENT_MANAGEMENT.md)** — Tournament lifecycle guide (586 lines)
- **[backend/IMPLEMENTATION_COMPLETE.md](./backend/IMPLEMENTATION_COMPLETE.md)** — Implementation summary

### Status & Guides
- **[backend/QUICKSTART.md](./backend/QUICKSTART.md)** — 5-minute quick start
- **[backend/COMPLETE.md](./backend/COMPLETE.md)** — Session validation summary
- **[backend/FINAL_STATUS.md](./backend/FINAL_STATUS.md)** — Deliverables checklist
- **[backend/SECURITY_UPDATES.md](./backend/SECURITY_UPDATES.md)** — Security updates log

### API Specification
- **[backend/openapi.yaml](./backend/openapi.yaml)** — OpenAPI 3.0 spec (full API)

---

## 📜 Smart Contract Documentation

Located in: **[contracts/](./contracts/)**

- **[contracts/README.md](./contracts/README.md)** — Build, test, deploy guide
- **[contracts/src/*.sol](./contracts/src/)** — Solidity source (with NatSpec)

**Contracts:**
- `FruitRushCosmetics.sol` — ERC-1155 cosmetics + royalties
- `FruitRushBoast.sol` — Score attestation contract
- `FruitRushTournament.sol` — Tournament escrow + payouts

---

## 🔒 Security Audit Package

Located in: **[audit/](./audit/)**

### Core Documents
- **[audit/README.md](./audit/README.md)** — Audit package overview
- **[audit/scope.md](./audit/scope.md)** — Audit scope (580 lines)
- **[audit/threat-model.md](./audit/threat-model.md)** — Threat analysis (950 lines)
- **[audit/findings-template.md](./audit/findings-template.md)** — Report template (750 lines)
- **[audit/checklist.md](./audit/checklist.md)** — Pre-audit checklist (850 lines)

### Status
- **[audit/AUDIT_PREP_COMPLETE.md](./audit/AUDIT_PREP_COMPLETE.md)** — Preparation completion summary

---

## 📊 Analytics & Data Pipeline

Located in: **[root](./)**

- **[mirror-pipeline.json](./mirror-pipeline.json)** — Goldsky Mirror configuration

---

## 🎮 Client Documentation

Located in: **[client/](./client/)**

- Check client directory for frontend documentation (PWA, PixiJS)

---

## 🌐 Subgraph Documentation

Located in: **[subgraph/](./subgraph/)**

- Check subgraph directory for GraphQL schema and deployment

---

## 📁 Complete File Tree

```
fruit-rush/
├── DOCUMENTATION.md (this file)
├── README.md — Project overview
├── PRD.md — Product requirements
├── AGENTS.md — AI agent instructions
├── mirror-pipeline.json — Goldsky config
│
├── docs/
│   ├── README.md — Docs navigation
│   ├── ANALYTICS.md — Analytics overview
│   ├── SUPABASE_SETUP.md — Database setup
│   ├── mirror-setup.md — Goldsky (raw Postgres)
│   ├── mirror-supabase.md — Goldsky (Supabase)
│   ├── project/
│   │   └── DELIVERABLES.md — Project checklist
│   ├── development/
│   │   ├── agent-prompts.md — AI prompts
│   │   └── agent-guide.md — AI guide
│   └── auth/
│       └── auth-flow.md — Auth flow
│
├── backend/
│   ├── README.md — API docs (500+ lines)
│   ├── TOURNAMENT_MANAGEMENT.md — Tournament guide (586 lines)
│   ├── IMPLEMENTATION_COMPLETE.md — Implementation summary
│   ├── QUICKSTART.md — 5-min quick start
│   ├── COMPLETE.md — Session validation summary
│   ├── FINAL_STATUS.md — Deliverables
│   ├── SECURITY_UPDATES.md — Security log
│   ├── openapi.yaml — OpenAPI spec
│   └── src/ — Source code
│
├── contracts/
│   ├── README.md — Contract guide
│   └── src/ — Solidity contracts
│
├── audit/
│   ├── README.md — Audit package
│   ├── scope.md — Scope (580 lines)
│   ├── threat-model.md — Threats (950 lines)
│   ├── findings-template.md — Template (750 lines)
│   ├── checklist.md — Checklist (850 lines)
│   └── AUDIT_PREP_COMPLETE.md — Status
│
├── db/
│   ├── schema.sql — Mirror tables
│   ├── tournaments-schema.sql — Tournament tables
│   ├── supabase-rls.sql — RLS policies
│   └── analytics-queries.sql — Sample queries
│
├── client/ — Frontend (PWA)
└── subgraph/ — GraphQL subgraph
```

---

## 📖 Documentation by Role

### Product Manager
1. [PRD.md](./PRD.md) — Product requirements
2. [docs/project/DELIVERABLES.md](./docs/project/DELIVERABLES.md) — Deliverables
3. [backend/README.md](./backend/README.md) — API overview

### Backend Engineer
1. [AGENTS.md](./AGENTS.md) — Working conventions
2. [backend/README.md](./backend/README.md) — Complete API guide
3. [backend/TOURNAMENT_MANAGEMENT.md](./backend/TOURNAMENT_MANAGEMENT.md) — Tournament system
4. [docs/SUPABASE_SETUP.md](./docs/SUPABASE_SETUP.md) — Database setup

### Smart Contract Engineer
1. [AGENTS.md](./AGENTS.md) — Contract conventions
2. [contracts/README.md](./contracts/README.md) — Build & deploy
3. [audit/scope.md](./audit/scope.md) — Contract overview
4. [audit/threat-model.md](./audit/threat-model.md) — Security threats

### Security Auditor
1. [audit/README.md](./audit/README.md) — Audit package overview
2. [audit/scope.md](./audit/scope.md) — Audit scope
3. [audit/threat-model.md](./audit/threat-model.md) — Threat analysis
4. [audit/checklist.md](./audit/checklist.md) — Pre-audit verification

### AI Agent
1. [AGENTS.md](./AGENTS.md) — **READ THIS FIRST**
2. [docs/development/agent-prompts.md](./docs/development/agent-prompts.md) — Task prompts
3. [docs/development/agent-guide.md](./docs/development/agent-guide.md) — Working guide
4. [PRD.md](./PRD.md) — Product context

### Data Engineer
1. [docs/ANALYTICS.md](./docs/ANALYTICS.md) — Analytics overview
2. [docs/SUPABASE_SETUP.md](./docs/SUPABASE_SETUP.md) — Database setup
3. [docs/mirror-supabase.md](./docs/mirror-supabase.md) — Goldsky pipeline
4. [db/schema.sql](./db/schema.sql) — Database schema

---

## 📝 Documentation Standards

### File Naming
- Use descriptive names: `TOURNAMENT_MANAGEMENT.md` not `tm.md`
- UPPERCASE for root-level docs: `README.md`, `PRD.md`, `AGENTS.md`
- lowercase-with-hyphens for subdirectories: `agent-prompts.md`

### Content Structure
- Include table of contents for files >200 lines
- Use relative links for internal references
- Add "Last Updated" date in header
- Use code blocks with language tags

### Markdown Formatting
- H1 for document title (one per file)
- H2 for major sections
- H3 for subsections
- Tables for structured data
- Bullet points for lists

---

## 🔍 Quick Find

### I want to...

**Set up the database**
→ [docs/SUPABASE_SETUP.md](./docs/SUPABASE_SETUP.md)

**Understand the API**
→ [backend/README.md](./backend/README.md)

**Deploy smart contracts**
→ [contracts/README.md](./contracts/README.md)

**Prepare for audit**
→ [audit/README.md](./audit/README.md)

**Understand tournaments**
→ [backend/TOURNAMENT_MANAGEMENT.md](./backend/TOURNAMENT_MANAGEMENT.md)

**Work as an AI agent**
→ [AGENTS.md](./AGENTS.md)

**View API specification**
→ [backend/openapi.yaml](./backend/openapi.yaml)

**Check project status**
→ [docs/project/DELIVERABLES.md](./docs/project/DELIVERABLES.md)

---

## 📞 Support

**Technical Questions:**
- Backend: #backend-eng (Slack)
- Contracts: #smart-contracts (Slack)
- Database: #data-eng (Slack)

**Security:**
- Email: security@fruitrush.game
- Slack: #security-audit

**Documentation Issues:**
- Create GitHub issue with label `documentation`
- Slack: #engineering

---

**Total Documentation:** ~15,000 lines across 40+ files  
**Last Updated:** August 4, 2026  
**Maintained By:** Fruit Rush Engineering Team

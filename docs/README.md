# Fruit Rush Documentation

**Project:** Fruit Rush — Mobile Arcade Game on Celo  
**Last Updated:** August 4, 2026

---

## Documentation Structure

This directory contains all project documentation organized by topic.

```
docs/
├── README.md (this file)
├── project/
│   └── DELIVERABLES.md — Project deliverables checklist
├── development/
│   ├── agent-prompts.md — AI agent structured prompts
│   └── agent-guide.md — AI agent development guide
├── database/
│   ├── ANALYTICS.md — Analytics overview
│   ├── SUPABASE_SETUP.md — Supabase setup guide
│   ├── mirror-setup.md — Goldsky Mirror pipeline (raw Postgres)
│   └── mirror-supabase.md — Goldsky Mirror pipeline (Supabase)
└── auth/
    └── auth-flow.md — Authentication flow documentation
```

---

## Quick Navigation

### 🎯 Project Management

- **[DELIVERABLES.md](./project/DELIVERABLES.md)** — Complete project deliverables checklist

### 💾 Database & Analytics

- **[ANALYTICS.md](./ANALYTICS.md)** — Analytics architecture overview
- **[SUPABASE_SETUP.md](./SUPABASE_SETUP.md)** — Step-by-step Supabase setup
- **[mirror-setup.md](./mirror-setup.md)** — Goldsky Mirror pipeline (raw Postgres/ClickHouse)
- **[mirror-supabase.md](./mirror-supabase.md)** — Goldsky Mirror pipeline (Supabase integration)

### 🔐 Authentication

- **[auth-flow.md](./auth/auth-flow.md)** — Magic.link authentication flow

### 🤖 AI Agent Development

- **[agent-prompts.md](./development/agent-prompts.md)** — Structured prompts for each workstream
- **[agent-guide.md](./development/agent-guide.md)** — Guide for AI agents working on this repo

---

## Root-Level Documentation

Important documentation that remains in the project root:

- **[README.md](../README.md)** — Project overview and quick start
- **[PRD.md](../PRD.md)** — Product Requirements Document
- **[AGENTS.md](../AGENTS.md)** — AI agent instructions (working style guide)

---

## Backend Documentation

Backend-specific documentation is in the backend directory:

- **[backend/README.md](../backend/README.md)** — Backend API documentation
- **[backend/TOURNAMENT_MANAGEMENT.md](../backend/TOURNAMENT_MANAGEMENT.md)** — Tournament lifecycle guide
- **[backend/IMPLEMENTATION_COMPLETE.md](../backend/IMPLEMENTATION_COMPLETE.md)** — Implementation summary
- **[backend/SECURITY_UPDATES.md](../backend/SECURITY_UPDATES.md)** — Security updates log

---

## Smart Contract Documentation

Contract-specific documentation is in the contracts directory:

- **[contracts/README.md](../contracts/README.md)** — Contract build and deployment guide

---

## Audit Documentation

Security audit preparation package:

- **[audit/README.md](../audit/README.md)** — Audit package overview
- **[audit/scope.md](../audit/scope.md)** — Audit scope document
- **[audit/threat-model.md](../audit/threat-model.md)** — Security threat analysis
- **[audit/findings-template.md](../audit/findings-template.md)** — Blank audit report template
- **[audit/checklist.md](../audit/checklist.md)** — Pre-audit verification checklist

---

## Database Documentation

Database schema and setup guides:

- **[db/schema.sql](../db/schema.sql)** — Goldsky Mirror database schema
- **[db/analytics-queries.sql](../db/analytics-queries.sql)** — Sample analytics queries
- **[db/supabase-rls.sql](../db/supabase-rls.sql)** — Row Level Security policies
- **[db/tournaments-schema.sql](../db/tournaments-schema.sql)** — Tournament tables schema

---

## Development Workflow

### Getting Started

1. Read **[PRD.md](../PRD.md)** for product overview
2. Read **[AGENTS.md](../AGENTS.md)** for development conventions
3. Follow setup guides:
   - Database: **[SUPABASE_SETUP.md](./SUPABASE_SETUP.md)**
   - Backend: **[backend/README.md](../backend/README.md)**
   - Contracts: **[contracts/README.md](../contracts/README.md)**

### For AI Agents

1. Read **[AGENTS.md](../AGENTS.md)** first
2. Check **[agent-prompts.md](./development/agent-prompts.md)** for specific tasks
3. Follow **[agent-guide.md](./development/agent-guide.md)** for working style

---

## Documentation Standards

### Markdown Files

- Use descriptive filenames (lowercase with hyphens)
- Include table of contents for files >200 lines
- Use relative links for internal references
- Include "Last Updated" date in header

### Code Documentation

- NatSpec for all Solidity contracts (100% coverage)
- JSDoc for all TypeScript functions
- Inline comments for complex logic
- README.md in each major directory

### Diagrams

- Use Mermaid for flowcharts (renders in GitHub)
- ASCII art for simple diagrams
- External tools (draw.io) for complex architecture

---

## Contributing

### Adding New Documentation

1. Choose appropriate subdirectory:
   - `project/` — Project management, roadmaps
   - `development/` — Developer guides, AI agent prompts
   - `database/` — Database setup, migrations, queries
   - `auth/` — Authentication and authorization
   
2. Use consistent formatting:
   - H1 for document title
   - H2 for major sections
   - Tables for structured data
   - Code blocks with language tags

3. Update this README with link to new document

### Updating Existing Documentation

1. Update "Last Updated" date in header
2. Maintain existing structure
3. Add to "Version History" section if present

---

## Support

For questions about documentation:

- **Technical:** #backend-eng (Slack)
- **Product:** #product (Slack)
- **Security:** security@fruitrush.game

---

**Last Updated:** August 4, 2026

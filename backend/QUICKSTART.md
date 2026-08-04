# 🚀 Backend Quick Start

## Install & Run (5 Minutes)

```bash
cd backend

# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your credentials (see below)

# 3. Start Redis
docker-compose up redis -d

# 4. Run development server
npm run dev
```

Server running at `http://localhost:3000` ✅

---

## Required Environment Variables

Edit `.env` with these values:

```bash
# Supabase (from dashboard → Settings → API)
SUPABASE_URL=https://abc123xyz.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...

# Magic.link (from dashboard.magic.link → API Keys)
MAGIC_SECRET_KEY=sk_live_...

# Boast Signing (generate with: openssl rand -hex 32)
BOAST_SIGNER_PRIVATE_KEY=0x1234567890abcdef...

# Goldsky Subgraph (from app.goldsky.com)
GOLDSKY_SUBGRAPH_URL=https://api.goldsky.com/api/public/project_abc/...

# Redis (default works for local dev)
REDIS_URL=redis://localhost:6379
```

---

## Test Endpoints

```bash
# Health check
curl http://localhost:3000/health

# Session validation (requires JWT)
curl -X POST http://localhost:3000/session/validate \
  -H "Authorization: Bearer YOUR_MAGIC_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "playerId": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "score": 1000,
    "gameMode": "Classic",
    "comboHighwater": 10,
    "durationSeconds": 60,
    "clientTimestamp": 1704067200000,
    "inputEventLog": [
      {"t": 850, "x": 0.5, "y": 0.5, "velocity": 1.0}
    ]
  }'

# Leaderboard (no auth)
curl http://localhost:3000/leaderboard/Classic
```

---

## Run Tests

```bash
npm test                # All tests
npm run test:coverage   # With coverage report
```

---

## Deploy to Production

```bash
# Build Docker image
docker build -t fruit-rush-backend .

# Run container
docker run -d \
  -p 3000:3000 \
  --env-file .env \
  fruit-rush-backend
```

---

## Docs

- **Full README**: `README.md` (500+ lines)
- **API Spec**: `openapi.yaml` (view with `npx @redocly/cli preview-docs openapi.yaml`)
- **Implementation**: `FINAL_STATUS.md` (complete checklist)

---

## Common Issues

### "Redis connection refused"
```bash
docker-compose up redis -d
```

### "Invalid Magic token"
Get a real JWT from Magic.link SDK in your PWA:
```typescript
const token = await magic.user.getIdToken();
```

### "Supabase permission denied"
Use **service role key**, not anon key. Check dashboard → Settings → API.

---

**That's it!** Backend is running. 🎉

See `README.md` for detailed documentation.

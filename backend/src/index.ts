/**
 * Fruit Rush Backend Server
 * ==========================
 * Session validation and score verification microservice.
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { PORT, NODE_ENV, CORS_ORIGINS, LOG_LEVEL } from './config';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

// Import routes
import sessionRoutes from './routes/session';
import boastRoutes from './routes/boast';
import leaderboardRoutes from './routes/leaderboard';
import tournamentRoutes from './routes/tournament';
import tournamentAdminRoutes from './routes/tournament-admin';
import healthRoutes from './routes/health';

// Import scheduler
import { initializeScheduler } from './tournament/scheduler';

// Create Express app
const app = express();

// ============================================================================
// Middleware
// ============================================================================

// Security headers
app.use(helmet());

// CORS
app.use(
  cors({
    origin: CORS_ORIGINS,
    credentials: true,
  })
);

// Body parsing
app.use(express.json({ limit: '10mb' })); // Increase limit for large input logs
app.use(express.urlencoded({ extended: true }));

// Request logging
if (NODE_ENV !== 'test') {
  app.use(
    morgan(NODE_ENV === 'production' ? 'combined' : 'dev', {
      skip: (req) => req.path === '/health', // Don't log health checks
    })
  );
}

// ============================================================================
// Routes
// ============================================================================

app.use('/session', sessionRoutes);
app.use('/boast', boastRoutes);
app.use('/leaderboard', leaderboardRoutes);
app.use('/tournament', tournamentRoutes);
app.use('/tournament', tournamentAdminRoutes); // Admin endpoints (active, leaderboard, refund)
app.use('/health', healthRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'Fruit Rush Backend',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      session: 'POST /session/validate',
      boast: 'POST /boast/sign',
      leaderboard: 'GET /leaderboard/:gameMode',
      tournament: 'POST /tournament/:id/enter',
      health: 'GET /health',
    },
  });
});

// ============================================================================
// Error Handling
// ============================================================================

// 404 handler
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

// ============================================================================
// Server Start
// ============================================================================

if (require.main === module) {
  // Initialize tournament scheduler
  initializeScheduler();
  
  app.listen(PORT, () => {
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║         Fruit Rush Backend Server                       ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`✓ Server running on port ${PORT}`);
    console.log(`✓ Environment: ${NODE_ENV}`);
    console.log(`✓ CORS origins: ${Array.isArray(CORS_ORIGINS) ? CORS_ORIGINS.join(', ') : CORS_ORIGINS}`);
    console.log('');
    console.log('Endpoints:');
    console.log(`  POST   http://localhost:${PORT}/session/validate`);
    console.log(`  POST   http://localhost:${PORT}/boast/sign`);
    console.log(`  GET    http://localhost:${PORT}/leaderboard/:gameMode`);
    console.log(`  POST   http://localhost:${PORT}/tournament/:id/enter`);
    console.log(`  GET    http://localhost:${PORT}/tournament/active`);
    console.log(`  GET    http://localhost:${PORT}/tournament/:id/leaderboard`);
    console.log(`  POST   http://localhost:${PORT}/tournament/:id/refund`);
    console.log(`  GET    http://localhost:${PORT}/health`);
    console.log('');
  });
}

// Export app for testing
export default app;

/**
 * Health Check Routes
 * ===================
 * GET /health — Service health and dependency status
 */

import express from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { supabase } from '../services/supabase';
import { redis } from '../services/redis';

const router = express.Router();

const startTime = Date.now();

/**
 * GET /health
 * 
 * Check service health and dependency connectivity.
 * 
 * Response: { status, supabase, redis, uptime }
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const health: any = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - startTime) / 1000),
    };

    // Check Supabase connectivity
    try {
      const { error } = await supabase.from('game_sessions').select('session_id').limit(1);
      health.supabase = error ? 'error' : 'connected';
    } catch (error) {
      health.supabase = 'error';
      health.status = 'degraded';
    }

    // Check Redis connectivity
    try {
      await redis.ping();
      health.redis = 'connected';
    } catch (error) {
      health.redis = 'error';
      health.status = 'degraded';
    }

    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
  })
);

export default router;

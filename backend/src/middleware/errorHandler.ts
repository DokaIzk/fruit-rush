/**
 * Error Handler Middleware
 * =========================
 * Global error handling for Express.
 */

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

/**
 * Global error handler middleware.
 * Must be registered LAST in middleware chain.
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  console.error('Error:', err);

  // Zod validation errors
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Validation error',
      details: err.errors.map(e => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    });
    return;
  }

  // Custom application errors
  if (err.name === 'UnauthorizedError') {
    res.status(401).json({
      error: 'Unauthorized',
      message: err.message || 'Authentication required',
    });
    return;
  }

  if (err.name === 'ForbiddenError') {
    res.status(403).json({
      error: 'Forbidden',
      message: err.message || 'Access denied',
    });
    return;
  }

  if (err.name === 'NotFoundError') {
    res.status(404).json({
      error: 'Not found',
      message: err.message || 'Resource not found',
    });
    return;
  }

  // Database errors
  if (err.message.includes('duplicate key') || err.message.includes('unique constraint')) {
    res.status(409).json({
      error: 'Conflict',
      message: 'Resource already exists',
    });
    return;
  }

  // Generic server error
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'production' ? 'An error occurred' : err.message,
  });
}

/**
 * 404 handler for unknown routes.
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.path} not found`,
  });
}

/**
 * Async error wrapper for route handlers.
 * Catches async errors and passes them to errorHandler.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

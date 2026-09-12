/**
 * Shared Auth Middleware for Admin API Endpoints
 * Vercel Serverless (ESM)
 * 
 * Purpose: Centralized authentication, rate limiting, and error handling
 * All admin endpoints (except /api/admin/health) must use this
 * 
 * ⚠️ Changing ENV requires redeploy on Vercel
 */

// Simple in-memory rate limiter (per IP)
// Note: Resets on cold start (Vercel serverless behavior)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS = 60; // 60 requests per minute per IP

/**
 * Get client IP address (Vercel-aware)
 */
function getClientIp(req) {
    // Vercel provides real IP via x-forwarded-for or x-real-ip
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() 
        || req.headers['x-real-ip'] 
        || req.socket?.remoteAddress 
        || 'unknown';
}

/**
 * Simple rate limiter
 * Returns: { allowed: boolean, remaining: number }
 */
function checkRateLimit(ip) {
    const now = Date.now();
    const key = ip;

    // Get or initialize tracker
    if (!rateLimitMap.has(key)) {
        rateLimitMap.set(key, { count: 0, resetAt: now + RATE_LIMIT_WINDOW });
    }

    const tracker = rateLimitMap.get(key);

    // Reset if window expired
    if (now > tracker.resetAt) {
        tracker.count = 0;
        tracker.resetAt = now + RATE_LIMIT_WINDOW;
    }

    // Check limit
    tracker.count++;

    const allowed = tracker.count <= MAX_REQUESTS;
    const remaining = Math.max(0, MAX_REQUESTS - tracker.count);

    return { allowed, remaining, resetAt: tracker.resetAt };
}

/**
 * Validate ADMIN_SECRET
 * 
 * Architecture decision:
 * - Use header-based auth (x-admin-secret) instead of JWT for simplicity
 * - Suitable for internal admin panel with limited users
 * - Easy to rotate: just change ENV and redeploy
 * 
 * @returns { success: boolean, error?: string, statusCode?: number }
 */
export function validateAuth(req, adminSecret) {
    // 1. Check if ADMIN_SECRET is configured
    if (!adminSecret || adminSecret.length === 0) {
        console.error('❌ ADMIN_SECRET not configured. Set ENV and redeploy.');
        return {
            success: false,
            statusCode: 500,
            error: 'Server configuration error: ADMIN_SECRET not set'
        };
    }

    // 2. Check if client provided token
    const token = req.headers['x-admin-secret'];
    if (!token) {
        return {
            success: false,
            statusCode: 401,
            error: 'Unauthorized: Missing x-admin-secret header'
        };
    }

    // 3. Validate token matches
    if (token !== adminSecret) {
        // Don't log the actual token for security
        console.warn('⚠️ Invalid admin secret attempt');
        return {
            success: false,
            statusCode: 401,
            error: 'Unauthorized: Invalid admin secret'
        };
    }

    // Success
    return { success: true };
}

/**
 * Main middleware function
 * Call this at the start of every admin endpoint handler
 * 
 * @param {Request} req - Vercel request object
 * @param {Response} res - Vercel response object
 * @param {string} adminSecret - ADMIN_SECRET from ENV
 * @returns {boolean} - true if authorized, false if already sent error response
 * 
 * Usage:
 * ```js
 * import { authMiddleware } from '../_middleware/auth.js';
 * 
 * export default async function handler(req, res) {
 *     const adminSecret = process.env.ADMIN_SECRET;
 *     if (!authMiddleware(req, res, adminSecret)) return;
 *     // ... your handler logic
 * }
 * ```
 */
export function authMiddleware(req, res, adminSecret) {
    // Set response headers
    res.setHeader('Content-Type', 'application/json');

    // 1. Rate limiting
    const ip = getClientIp(req);
    const rateLimit = checkRateLimit(ip);

    if (!rateLimit.allowed) {
        console.warn(`⚠️ Rate limit exceeded for IP: ${ip}`);
        res.setHeader('X-RateLimit-Remaining', '0');
        res.setHeader('X-RateLimit-Reset', new Date(rateLimit.resetAt).toISOString());
        res.status(429).json({
            error: 'Too many requests. Please try again later.',
            retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000)
        });
        return false;
    }

    // Add rate limit headers
    res.setHeader('X-RateLimit-Remaining', String(rateLimit.remaining));
    res.setHeader('X-RateLimit-Reset', new Date(rateLimit.resetAt).toISOString());

    // 2. Authentication
    const authResult = validateAuth(req, adminSecret);

    if (!authResult.success) {
        res.status(authResult.statusCode).json({ error: authResult.error });
        return false;
    }

    // All checks passed
    return true;
}

/**
 * Fail-fast guard for ENV variables
 * Call this BEFORE creating Supabase client
 * 
 * @returns { ok: boolean, error?: string }
 * 
 * Usage:
 * ```js
 * import { validateEnv } from '../_middleware/auth.js';
 * 
 * const envCheck = validateEnv(supabaseUrl, supabaseKey);
 * if (!envCheck.ok) {
 *     return res.status(500).json({ error: envCheck.error });
 * }
 * ```
 */
export function validateEnv(supabaseUrl, supabaseKey) {
    const missing = [];

    if (!supabaseUrl || supabaseUrl.length === 0) {
        missing.push('SUPABASE_URL');
    }

    if (!supabaseKey || supabaseKey.length === 0) {
        missing.push('SUPABASE_SERVICE_ROLE_KEY');
    }

    if (missing.length > 0) {
        const error = `Missing ENV variables: ${missing.join(', ')}. ` +
                     'Please configure in Vercel Dashboard and redeploy.';
        console.error(`❌ ${error}`);
        return { ok: false, error };
    }

    return { ok: true };
}

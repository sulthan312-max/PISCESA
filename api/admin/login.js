/**
 * /api/admin/login - POST verify admin secret
 * Vercel Serverless Handler (ESM)
 * 
 * ⚠️ Changing ENV requires redeploy on Vercel
 */

import { validateAuth } from './_middleware/auth.js';

const adminSecret = process.env.ADMIN_SECRET;

/**
 * POST /api/admin/login - Verify admin secret
 * 
 * This endpoint validates credentials without enforcing rate limits
 * (rate limiting is applied after successful login on other endpoints)
 */
export default async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json');

    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Validate auth using shared middleware logic
        const authResult = validateAuth(req, adminSecret);

        if (!authResult.success) {
            return res.status(authResult.statusCode).json({ error: authResult.error });
        }

        // Success - return ok status
        return res.status(200).json({ ok: true });
    } catch (err) {
        console.error('❌ Error in login handler:', err.message);
        return res.status(500).json({ 
            error: 'Internal server error', 
            details: err.message 
        });
    }
}

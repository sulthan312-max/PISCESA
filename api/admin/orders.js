/**
 * /api/admin/orders - GET orders list
 * Vercel Serverless Handler (ESM)
 * 
 * ⚠️ Changing ENV requires redeploy on Vercel
 */

import { createClient } from '@supabase/supabase-js';
import { authMiddleware, validateEnv } from './_middleware/auth.js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminSecret = process.env.ADMIN_SECRET;

// Fail-fast: Don't create Supabase client if ENV missing
const envCheck = validateEnv(supabaseUrl, supabaseKey);
let supabase = null;

if (envCheck.ok) {
    supabase = createClient(supabaseUrl, supabaseKey);
}

/**
 * GET /api/admin/orders
 */
async function handleGet(res) {
    // Fail-fast guard
    if (!envCheck.ok) {
        return res.status(500).json({ error: envCheck.error });
    }

    try {
        const { data: orders, error } = await supabase
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('❌ Supabase GET error:', error.message);
            return res.status(500).json({ error: error.message });
        }

        return res.status(200).json(orders || []);
    } catch (err) {
        console.error('❌ Error fetching orders:', err.message);
        return res.status(500).json({ error: 'Failed to fetch orders', details: err.message });
    }
}

/**
 * Main handler - Vercel Serverless
 */
export default async function handler(req, res) {
    // Auth & rate limit check
    if (!authMiddleware(req, res, adminSecret)) return;

    // Only allow GET
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    return handleGet(res);
}

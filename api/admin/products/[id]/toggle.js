/**
 * /api/admin/products/[id]/toggle - PATCH toggle product availability
 * Vercel Serverless Handler (ESM)
 * 
 * ⚠️ Changing ENV requires redeploy on Vercel
 */

import { createClient } from '@supabase/supabase-js';
import { authMiddleware, validateEnv } from '../../_middleware/auth.js';

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
 * Extract product ID from Vercel dynamic route
 * Vercel provides: req.query.id (as string or array)
 */
function getId(req) {
    let id = req.query?.id;

    if (Array.isArray(id)) {
        id = id[0];
    }

    return id || null;
}

/**
 * Parse JSON body safely
 */
async function parseBody(req) {
    if (req.body && typeof req.body === 'object') {
        return req.body;
    }

    if (typeof req.body === 'string') {
        try {
            return JSON.parse(req.body);
        } catch (e) {
            return {};
        }
    }

    if (req.readable || req.on) {
        let rawBody = '';
        for await (const chunk of req) {
            rawBody += chunk;
        }
        try {
            return rawBody ? JSON.parse(rawBody) : {};
        } catch (e) {
            return {};
        }
    }

    return {};
}

/**
 * PATCH /api/admin/products/[id]/toggle - Toggle availability
 */
async function handlePatch(id, req, res) {
    // Fail-fast guard
    if (!envCheck.ok) {
        return res.status(500).json({ error: envCheck.error });
    }

    if (!id) {
        console.error('❌ PATCH: Product ID is missing');
        return res.status(400).json({ error: 'Product ID is required' });
    }
    
    console.log(`🔀 PATCH: Toggling availability for product ID: ${id}`);
    
    try {
        const body = await parseBody(req);
        const hasExplicitAvailability = typeof body.available === 'boolean';

        let nextAvailability = body.available;
        if (!hasExplicitAvailability) {
            // Get current availability and toggle it
            const { data: existing, error: fetchError } = await supabase
                .from('products')
                .select('available')
                .eq('id', id)
                .single();

            if (fetchError || !existing) {
                console.error(`❌ PATCH: Product not found - ID: ${id}`);
                return res.status(404).json({ error: 'Product not found' });
            }

            nextAvailability = !existing.available;
            console.log(`📋 PATCH: Current availability: ${existing.available}, toggling to: ${nextAvailability}`);
        }

        const { data: updated, error } = await supabase
            .from('products')
            .update({ available: nextAvailability })
            .eq('id', id)
            .select();

        if (error) {
            console.error('❌ PATCH: Supabase error:', error.message);
            return res.status(500).json({ error: error.message });
        }

        if (!updated || updated.length === 0) {
            console.error(`❌ PATCH: Product not found after toggle - ID: ${id}`);
            return res.status(404).json({ error: 'Product not found' });
        }

        console.log(`✅ PATCH: Availability toggled to ${nextAvailability} for ID:`, id);
        return res.status(200).json(updated[0]);
    } catch (err) {
        console.error('❌ PATCH: Unexpected error:', err.message);
        return res.status(500).json({ error: 'Failed to toggle availability', details: err.message });
    }
}

/**
 * Main handler - Vercel Serverless
 */
export default async function handler(req, res) {
    // Auth & rate limit check
    if (!authMiddleware(req, res, adminSecret)) return;

    if (req.method !== 'PATCH') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Extract ID
    const id = getId(req);
    if (!id) {
        return res.status(400).json({ error: 'Product ID is required' });
    }

    return handlePatch(id, req, res);
}

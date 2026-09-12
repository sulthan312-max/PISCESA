/**
 * /api/admin/products/[id] - GET, PUT, DELETE single product
 * Vercel Serverless Handler (ESM)
 * 
 * ⚠️ Changing ENV requires redeploy on Vercel
 */

import { createClient } from '@supabase/supabase-js';
import { authMiddleware, validateEnv } from '../_middleware/auth.js';

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
    // Vercel dynamic routes provide id via req.query
    let id = req.query?.id;

    // Handle array (shouldn't happen but just in case)
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
 * GET /api/admin/products/[id] - Get single product
 */
async function handleGet(id, res) {
    // Fail-fast guard
    if (!envCheck.ok) {
        return res.status(500).json({ error: envCheck.error });
    }

    if (!id) {
        console.error('❌ GET: Product ID is missing');
        return res.status(400).json({ error: 'Product ID is required' });
    }
    
    console.log(`📦 GET: Fetching product with ID: ${id}`);
    
    try {
        const { data: product, error } = await supabase
            .from('products')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                // No rows found
                console.error(`❌ GET: Product not found - ID: ${id}`);
                return res.status(404).json({ error: 'Product not found' });
            }
            console.error('❌ GET: Supabase error:', error.message);
            return res.status(500).json({ error: error.message });
        }

        if (!product) {
            console.error(`❌ GET: Product returned null for ID: ${id}`);
            return res.status(404).json({ error: 'Product not found' });
        }

        console.log(`✅ GET: Product loaded successfully:`, product.id);
        return res.status(200).json(product);
    } catch (err) {
        console.error('❌ GET: Unexpected error:', err.message);
        return res.status(500).json({ error: 'Failed to fetch product', details: err.message });
    }
}

/**
 * PUT /api/admin/products/[id] - Update product
 */
async function handlePut(id, req, res) {
    // Fail-fast guard
    if (!envCheck.ok) {
        return res.status(500).json({ error: envCheck.error });
    }

    if (!id) {
        console.error('❌ PUT: Product ID is missing');
        return res.status(400).json({ error: 'Product ID is required' });
    }
    
    console.log(`🔄 PUT: Updating product with ID: ${id}`);
    
    try {
        const updateData = await parseBody(req);
        console.log('📝 PUT: Update data received:', Object.keys(updateData));

        // Remove immutable fields
        delete updateData.id;
        delete updateData.created_at;
        delete updateData.updated_at;

        // Validate at least one field to update
        if (Object.keys(updateData).length === 0) {
            console.warn('⚠️ PUT: No fields to update');
            return res.status(400).json({ error: 'No fields to update' });
        }

        const { data: products, error } = await supabase
            .from('products')
            .update(updateData)
            .eq('id', id)
            .select();

        if (error) {
            console.error('❌ PUT: Supabase error:', error.message);
            return res.status(500).json({ error: error.message });
        }

        if (!products || products.length === 0) {
            console.error(`❌ PUT: Product not found after update - ID: ${id}`);
            return res.status(404).json({ error: 'Product not found' });
        }

        console.log(`✅ PUT: Product updated successfully:`, products[0].id);
        return res.status(200).json(products[0]);
    } catch (err) {
        console.error('❌ PUT: Unexpected error:', err.message);
        return res.status(500).json({ error: 'Failed to update product', details: err.message });
    }
}

/**
 * DELETE /api/admin/products/[id] - Delete product
 */
async function handleDelete(id, res) {
    // Fail-fast guard
    if (!envCheck.ok) {
        return res.status(500).json({ error: envCheck.error });
    }

    if (!id) {
        console.error('❌ DELETE: Product ID is missing');
        return res.status(400).json({ error: 'Product ID is required' });
    }
    
    console.log(`🗑️ DELETE: Deleting product with ID: ${id}`);
    
    try {
        const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('❌ DELETE: Supabase error:', error.message);
            return res.status(500).json({ error: error.message });
        }

        console.log(`✅ DELETE: Product deleted successfully:`, id);
        return res.status(200).json({ success: true });
    } catch (err) {
        console.error('❌ DELETE: Unexpected error:', err.message);
        return res.status(500).json({ error: 'Failed to delete product', details: err.message });
    }
}

/**
 * Main handler - Vercel Serverless
 */
export default async function handler(req, res) {
    // Auth & rate limit check
    if (!authMiddleware(req, res, adminSecret)) return;

    // Extract ID
    const id = getId(req);
    if (!id) {
        return res.status(400).json({ error: 'Product ID is required' });
    }

    // Route by method
    if (req.method === 'GET') {
        return handleGet(id, res);
    }

    if (req.method === 'PUT') {
        return handlePut(id, req, res);
    }

    if (req.method === 'DELETE') {
        return handleDelete(id, res);
    }

    return res.status(405).json({ error: 'Method not allowed' });
}

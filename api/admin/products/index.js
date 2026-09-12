/**
 * /api/admin/products - GET list, POST create
 * Vercel Serverless Handler (ESM)
 * 
 * ⚠️ Changing ENV requires redeploy on Vercel
 */

import { createClient } from '@supabase/supabase-js';
import { authMiddleware, validateEnv } from '../_middleware/auth.js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminSecret = process.env.ADMIN_SECRET;

// Validate env vars on startup - Fail-fast guard
const envCheck = validateEnv(supabaseUrl, supabaseKey);
let supabase = null;

if (envCheck.ok) {
    supabase = createClient(supabaseUrl, supabaseKey);
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

    // Stream body if needed
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
 * GET /api/admin/products - List all products
 */
async function handleGet(req, res) {
    // Fail-fast guard
    if (!envCheck.ok) {
        return res.status(500).json({ error: envCheck.error });
    }

    console.log('📦 GET: Fetching all products');
    
    try {
        const { data: products, error } = await supabase
            .from('products')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('❌ GET: Supabase error:', error.message);
            return res.status(500).json({ error: error.message });
        }

        console.log(`✅ GET: Loaded ${products?.length || 0} products`);
        return res.status(200).json(products || []);
    } catch (err) {
        console.error('❌ GET: Unexpected error:', err.message);
        return res.status(500).json({ error: 'Failed to fetch products', details: err.message });
    }
}

/**
 * POST /api/admin/products - Create new product
 */
async function handlePost(req, res) {    // Fail-fast guard
    if (!envCheck.ok) {
        return res.status(500).json({ error: envCheck.error });
    }
    console.log('✨ POST: Creating new product');
    
    try {
        const body = await parseBody(req);
        const {
            name,
            name_en,
            description,
            description_en,
            specifications,
            specifications_en,
            uses,
            uses_en,
            stock,
            price,
            available,
            image_url
        } = body;

        if (!name || !name.trim()) {
            console.warn('⚠️ POST: Product name is required');
            return res.status(400).json({ error: 'Product name is required' });
        }

        console.log(`📝 POST: Creating product: ${name}`);

        const productData = {
            name,
            name_en: name_en || null,
            description: description || null,
            description_en: description_en || null,
            specifications: Array.isArray(specifications) ? specifications : [],
            specifications_en: Array.isArray(specifications_en) ? specifications_en : [],
            uses: Array.isArray(uses) ? uses : [],
            uses_en: Array.isArray(uses_en) ? uses_en : [],
            stock: Number.isFinite(Number(stock)) ? Number(stock) : 0,
            price: Number.isFinite(Number(price)) ? Number(price) : 0,
            available: available !== false,
            image_url: image_url || null
        };

        const { data: products, error } = await supabase
            .from('products')
            .insert([productData])
            .select();

        if (error) {
            console.error('❌ POST: Supabase error:', error.message);
            return res.status(500).json({ error: error.message });
        }

        if (!products || products.length === 0) {
            console.error('❌ POST: No product returned from insert');
            return res.status(500).json({ error: 'Failed to create product' });
        }

        console.log(`✅ POST: Product created successfully: ${products[0].id}`);
        return res.status(201).json(products[0]);
    } catch (err) {
        console.error('❌ POST: Unexpected error:', err.message);
        return res.status(500).json({ error: 'Failed to create product', details: err.message });
    }
}

/**
 * Main handler - Vercel Serverless
 * @param {*} req - Vercel request object
 * @param {*} res - Vercel response object
 */
export default async function handler(req, res) {
    // Auth & rate limit check
    if (!authMiddleware(req, res, adminSecret)) return;

    // Route by method
    if (req.method === 'GET') {
        return handleGet(req, res);
    }

    if (req.method === 'POST') {
        return handlePost(req, res);
    }

    return res.status(405).json({ error: 'Method not allowed' });
}

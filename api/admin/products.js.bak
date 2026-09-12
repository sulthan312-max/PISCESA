// Admin products collection endpoint (GET, POST)
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const adminSecret = process.env.ADMIN_SECRET;

function isAuthorized(req) {
    const token = req.headers['x-admin-secret'];
    return Boolean(token && adminSecret && token === adminSecret);
}

async function readJsonBody(req) {
    if (req.body && typeof req.body === 'object') return req.body;
    if (typeof req.body === 'string') return JSON.parse(req.body);

    let rawBody = '';
    for await (const chunk of req) {
        rawBody += chunk;
    }
    if (!rawBody) return {};
    return JSON.parse(rawBody);
}

export default async function handler(req, res) {
    if (!isAuthorized(req)) {
        return res.status(401).json({ error: 'Unauthorized: Invalid or missing admin secret' });
    }

    if (req.method === 'GET') {
        try {
            const { data: products, error } = await supabase
                .from('products')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                return res.status(500).json({ error: error.message });
            }

            return res.status(200).json(products || []);
        } catch (err) {
            console.error('Error fetching products:', err);
            return res.status(500).json({ error: 'Failed to fetch products' });
        }
    }

    if (req.method === 'POST') {
        try {
            const body = await readJsonBody(req);
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

            if (!name) {
                return res.status(400).json({ error: 'Product name is required' });
            }

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

            const { data: product, error } = await supabase
                .from('products')
                .insert([productData])
                .select();

            if (error) {
                return res.status(500).json({ error: error.message });
            }

            return res.status(201).json(product[0]);
        } catch (err) {
            console.error('Error creating product:', err);
            return res.status(500).json({ error: 'Failed to create product' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}

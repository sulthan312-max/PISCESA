/**
 * /api/public/company - GET public company profile (no auth)
 * Vercel Serverless Handler (ESM)
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Missing env vars: SUPABASE_URL or SUPABASE_ANON_KEY');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function handleGet(res) {
    try {
        const { data: companies, error } = await supabase
            .from('company')
            .select('*')
            .eq('is_active', true)
            .limit(1);

        if (error) {
            console.error('Supabase GET error:', error.message);
            return res.status(500).json({ error: error.message });
        }

        const company = companies && companies.length > 0 ? companies[0] : null;
        return res.status(200).json(company || {});
    } catch (err) {
        console.error('Error fetching public company info:', err.message);
        return res.status(500).json({ error: 'Failed to fetch company info', details: err.message });
    }
}

export default async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'GET') {
        return handleGet(res);
    }

    return res.status(405).json({ error: 'Method not allowed' });
}

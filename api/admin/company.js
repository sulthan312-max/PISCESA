/**
 * /api/admin/company - GET, POST company profile
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
 * GET /api/admin/company
 */
async function handleGet(res) {
    // Fail-fast guard
    if (!envCheck.ok) {
        return res.status(500).json({ error: envCheck.error });
    }

    try {
        const { data: companies, error } = await supabase
            .from('company')
            .select('*')
            .eq('is_active', true)
            .limit(1);

        if (error) {
            console.error('❌ Supabase GET error:', error.message);
            return res.status(500).json({ error: error.message });
        }

        const company = companies && companies.length > 0 ? companies[0] : null;
        return res.status(200).json(company || {});
    } catch (err) {
        console.error('❌ Error fetching company info:', err.message);
        return res.status(500).json({ error: 'Failed to fetch company info', details: err.message });
    }
}

/**
 * POST /api/admin/company
 */
async function handlePostPut(req, res) {
    // Fail-fast guard
    if (!envCheck.ok) {
        return res.status(500).json({ error: envCheck.error });
    }

    try {
        const payload = await parseBody(req);
        const companyData = {
            name: payload.name || '',
            name_en: payload.name_en || '',
            tagline: payload.tagline || '',
            tagline_en: payload.tagline_en || '',
            description: payload.description || '',
            description_en: payload.description_en || '',
            address: payload.address || '',
            address_en: payload.address_en || '',
            phone: payload.phone || '',
            whatsapp_number: payload.whatsapp_number || payload.whatsapp || '',
            whatsapp_message: payload.whatsapp_message || '',
            whatsapp_message_en: payload.whatsapp_message_en || '',
            email: payload.email || '',
            google_maps_url: payload.google_maps_url || '',
            logo_url: payload.logo_url || payload.logo_path || '',
            social_instagram: payload.social_instagram || '',
            social_facebook: payload.social_facebook || '',
            social_linkedin: payload.social_linkedin || '',
            operating_hours: payload.operating_hours || '',
            is_active: true
        };

        const { data: activeCompanies } = await supabase
            .from('company')
            .select('id')
            .eq('is_active', true)
            .limit(1);

        const activeCompany = activeCompanies && activeCompanies.length > 0 ? activeCompanies[0] : null;

        // Ensure only one active row
        await supabase.from('company').update({ is_active: false }).neq('id', activeCompany?.id || '');

        if (activeCompany && activeCompany.id) {
            const { data: updated, error } = await supabase
                .from('company')
                .update(companyData)
                .eq('id', activeCompany.id)
                .select();

            if (error) {
                console.error('❌ Supabase UPDATE error:', error.message);
                return res.status(500).json({ error: error.message });
            }

            return res.status(200).json(updated[0] || {});
        }

        const { data: created, error } = await supabase
            .from('company')
            .insert([companyData])
            .select();

        if (error) {
            console.error('❌ Supabase INSERT error:', error.message);
            return res.status(500).json({ error: error.message });
        }

        return res.status(201).json(created[0] || {});
    } catch (err) {
        console.error('❌ Error saving company info:', err.message);
        return res.status(500).json({ error: 'Failed to save company info', details: err.message });
    }
}

/**
 * Main handler - Vercel Serverless
 */
export default async function handler(req, res) {
    // Auth & rate limit check
    if (!authMiddleware(req, res, adminSecret)) return;

    // Route by method
    if (req.method === 'GET') {
        return handleGet(res);
    }

    if (req.method === 'POST' || req.method === 'PUT') {
        return handlePostPut(req, res);
    }

    return res.status(405).json({ error: 'Method not allowed' });
}

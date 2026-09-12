/**
 * /api/admin/health - Health check endpoint for admin system
 * Vercel Serverless Handler (ESM)
 * 
 * Purpose: Quick diagnostic to verify ENV variables without exposing secrets
 * Use this to troubleshoot admin login issues without checking Vercel logs
 * 
 * ⚠️ Changing ENV requires redeploy on Vercel
 */

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminSecret = process.env.ADMIN_SECRET;

/**
 * GET /api/admin/health - Check ENV configuration
 * 
 * Returns:
 * - status: 'ok' if all ENV vars present, 'degraded' if any missing
 * - hasAdminSecret: boolean
 * - hasSupabaseUrl: boolean
 * - hasServiceRoleKey: boolean
 * - timestamp: ISO datetime
 * 
 * Does NOT expose actual values for security
 */
export default async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json');

    // Only allow GET
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Check each ENV var
    const hasAdminSecret = Boolean(adminSecret && adminSecret.length > 0);
    const hasSupabaseUrl = Boolean(supabaseUrl && supabaseUrl.length > 0);
    const hasServiceRoleKey = Boolean(supabaseKey && supabaseKey.length > 0);

    const allPresent = hasAdminSecret && hasSupabaseUrl && hasServiceRoleKey;

    // Build response
    const response = {
        status: allPresent ? 'ok' : 'degraded',
        timestamp: new Date().toISOString(),
        env: {
            hasAdminSecret,
            hasSupabaseUrl,
            hasServiceRoleKey
        }
    };

    // If degraded, add warning
    if (!allPresent) {
        response.warning = 'Some ENV variables are missing. Admin functions may not work.';
        response.action = 'Verify ENV vars in Vercel Dashboard and redeploy if needed.';
    }

    const statusCode = allPresent ? 200 : 503;
    return res.status(statusCode).json(response);
}

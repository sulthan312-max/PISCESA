/**
 * /api/admin/upload - POST upload product images
 * Vercel Serverless Handler (ESM)
 * 
 * Note: For Vercel, ensure Supabase Storage bucket is public
 * and CORS is properly configured
 * 
 * ⚠️ Changing ENV requires redeploy on Vercel
 */

import { createClient } from '@supabase/supabase-js';
import { authMiddleware, validateEnv } from './_middleware/auth.js';
import fs from 'fs/promises';
import path from 'path';
import formidable from 'formidable';

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
 * Parse multipart form data
 */
function parseForm(req) {
    const form = formidable({ 
        multiples: false, 
        keepExtensions: true,
        maxFileSize: 50 * 1024 * 1024 // 50MB max
    });
    return new Promise((resolve, reject) => {
        form.parse(req, (err, fields, files) => {
            if (err) return reject(err);
            return resolve({ fields, files });
        });
    });
}

/**
 * Extract file from formidable result
 */
function getFile(files) {
    const file = files?.file;
    if (Array.isArray(file)) return file[0];
    return file || null;
}

/**
 * POST /api/admin/upload - Upload product image
 */
async function handlePost(req, res) {
    // Fail-fast guard
    if (!envCheck.ok) {
        return res.status(500).json({ error: envCheck.error });
    }

    let uploadedFile = null;

    try {
        // Parse form data
        const { fields, files } = await parseForm(req);
        const file = getFile(files);
        
        if (!file) {
            return res.status(400).json({ error: 'No file provided' });
        }

        uploadedFile = file;

        // Generate safe filename
        const originalName = file.originalFilename || file.newFilename || 'upload';
        const providedName = Array.isArray(fields.fileName) ? fields.fileName[0] : fields.fileName;
        const safeName = String(providedName || originalName)
            .replace(/[^a-zA-Z0-9._-]/g, '_')
            .substring(0, 100); // Max 100 chars
        
        const ext = path.extname(safeName) || path.extname(originalName) || '';
        const finalName = safeName.endsWith(ext) ? safeName : `${safeName}${ext}`;
        const filePath = `products/${Date.now()}_${finalName}`;

        console.log(`📤 Uploading: ${filePath}`);

        // Read file buffer
        const fileBuffer = await fs.readFile(file.filepath);

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
            .from('product_images')
            .upload(filePath, fileBuffer, {
                upsert: true,
                contentType: file.mimetype || 'application/octet-stream'
            });

        if (uploadError) {
            console.error('Supabase upload error:', uploadError.message);
            return res.status(500).json({ error: uploadError.message });
        }

        // Get public URL
        const { data: publicUrlData } = supabase.storage
            .from('product_images')
            .getPublicUrl(filePath);

        console.log(`✅ Upload successful: ${publicUrlData.publicUrl}`);

        return res.status(200).json({ imageUrl: publicUrlData.publicUrl });
    } catch (err) {
        console.error('Error uploading image:', err.message);
        return res.status(500).json({ 
            error: 'Failed to upload image',
            details: err.message 
        });
    } finally {
        // Clean up temp file
        if (uploadedFile?.filepath) {
            try {
                await fs.unlink(uploadedFile.filepath);
            } catch (cleanupError) {
                console.warn('Failed to clean up temp file:', cleanupError.message);
            }
        }
    }
}

/**
 * Main handler - Vercel Serverless
 */
export default async function handler(req, res) {
    // Auth & rate limit check
    if (!authMiddleware(req, res, adminSecret)) return;

    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    return handlePost(req, res);
}


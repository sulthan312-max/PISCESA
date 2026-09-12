/**
 * /api/translate - Translation Service
 * Uses MyMemory Translation API (free, no key required)
 * Vercel Serverless Handler (ESM)
 */

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
 * POST /api/translate - Translate text from Indonesian to English
 */
async function handlePost(req, res) {
    try {
        const body = await parseBody(req);
        const { text, source = 'id', target = 'en' } = body;

        if (!text || !text.trim()) {
            console.warn('⚠️ TRANSLATE: Empty text provided');
            return res.status(400).json({ error: 'Text is required' });
        }

        console.log(`🌐 TRANSLATE: Translating ${source} -> ${target}`);

        // Use MyMemory Translation API (free, no key required)
        const encodedText = encodeURIComponent(text.trim());
        const langPair = `${source}|${target}`;

        const response = await fetch(
            `https://api.mymemory.translated.net/get?q=${encodedText}&langpair=${langPair}`,
            {
                method: 'GET',
                timeout: 10000
            }
        );

        if (!response.ok) {
            console.error(`❌ TRANSLATE: API error ${response.status}`);
            return res.status(500).json({ error: 'Translation service unavailable' });
        }

        const data = await response.json();

        if (data.responseStatus !== 200) {
            console.error('❌ TRANSLATE: MyMemory error:', data.responseStatus);
            return res.status(500).json({ error: 'Translation service error' });
        }

        if (!data.responseData || !data.responseData.translatedText) {
            console.error('❌ TRANSLATE: No translation returned');
            return res.status(500).json({ error: 'No translation received' });
        }

        const translatedText = data.responseData.translatedText;
        console.log(`✅ TRANSLATE: Success - ${translatedText.substring(0, 50)}`);

        return res.status(200).json({
            success: true,
            translatedText: translatedText,
            source: source,
            target: target
        });
    } catch (err) {
        console.error('❌ TRANSLATE: Unexpected error:', err.message);
        return res.status(500).json({ error: 'Failed to translate', details: err.message });
    }
}

/**
 * Main handler - Vercel Serverless
 */
export default async function handler(req, res) {
    // Add CORS headers
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle OPTIONS request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Route by method
    if (req.method === 'POST') {
        return handlePost(req, res);
    }

    return res.status(405).json({ error: 'Method not allowed' });
}

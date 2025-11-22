// Anti-Bypass Verification Endpoint
const validCodes = new Map(); // In production, use KV storage

// Generate verification codes
function generateVerificationCode() {
    return Math.random().toString(36).substr(2, 8).toUpperCase();
}

export async function onRequestPost(context) {
    try {
        const body = await context.request.json();
        const { sessionId, step, code, timestamp } = body;
        
        // Basic validation
        if (!sessionId || step === undefined || !code) {
            return jsonResponse({ success: false, message: 'Missing parameters' }, 400);
        }
        
        // Check timestamp (prevent replay attacks)
        const now = Date.now();
        if (Math.abs(now - timestamp) > 60000) { // 1 minute tolerance
            return jsonResponse({ success: false, message: 'Request expired' }, 400);
        }
        
        // Verify code from KV storage
        const kvKey = `verify_${sessionId}_${step}`;
        const storedCode = await context.env.KEYSYSTEM_KV?.get(kvKey);
        
        if (!storedCode) {
            // For demo: accept codes in format STEP1-XXXX, STEP2-XXXX, STEP3-XXXX
            const expectedPrefix = `STEP${step + 1}`;
            if (code.startsWith(expectedPrefix) && code.length === 10) {
                // Valid format
                await context.env.KEYSYSTEM_KV?.put(kvKey, code, { expirationTtl: 3600 });
                return jsonResponse({ success: true });
            } else {
                return jsonResponse({ success: false, message: 'Invalid code format' }, 400);
            }
        }
        
        // Code already used
        if (storedCode === code) {
            return jsonResponse({ success: false, message: 'Code already used' }, 400);
        }
        
        return jsonResponse({ success: false, message: 'Invalid code' }, 400);
        
    } catch (error) {
        console.error('Verification error:', error);
        return jsonResponse({ success: false, message: 'Server error' }, 500);
    }
}

export async function onRequestOptions() {
    return new Response(null, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        }
    });
}

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        }
    });
}
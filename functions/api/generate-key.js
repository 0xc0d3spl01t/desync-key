// Enhanced Key Generation with Session Validation
export async function onRequestPost(context) {
    try {
        const body = await context.request.json();
        const { sessionId, appName, ownerId, version } = body;
        
        // Validate session completed all steps
        if (!sessionId) {
            return jsonResponse({ success: false, message: 'Invalid session' }, 400);
        }
        
        // Check if all 3 steps were completed (check KV storage)
        const verifiedSteps = [];
        for (let i = 0; i < 3; i++) {
            const kvKey = `verify_${sessionId}_${i}`;
            const step = await context.env.KEYSYSTEM_KV?.get(kvKey);
            if (step) verifiedSteps.push(i);
        }
        
        if (verifiedSteps.length < 3) {
            return jsonResponse({ 
                success: false, 
                message: `Only ${verifiedSteps.length}/3 steps completed` 
            }, 400);
        }
        
        // Prevent duplicate key generation
        const keyGenKey = `keygen_${sessionId}`;
        const existingKey = await context.env.KEYSYSTEM_KV?.get(keyGenKey);
        if (existingKey) {
            return jsonResponse({ 
                success: false, 
                message: 'Key already generated for this session' 
            }, 400);
        }
        
        // Generate KeyAuth license
        const SELLER_KEY = context.env.KEYAUTH_SELLER_KEY;
        
        if (!SELLER_KEY) {
            return jsonResponse({ 
                success: false, 
                message: 'Server configuration error' 
            }, 500);
        }
        
        const keyMask = "*****-*****-*****-*****-*****";
        
        const params = new URLSearchParams({
            sellerkey: SELLER_KEY,
            type: 'add',
            expiry: '1', // 1 day = 24 hours
            mask: keyMask,
            level: '1',
            amount: '1',
            format: 'JSON',
            owner: 'SnowHub_' + sessionId.substr(0, 8),
            character: '1',
            note: `Generated via verified Linkvertise system - ${new Date().toISOString()}`
        });
        
        const apiUrl = `https://keyauth.win/api/seller/?${params.toString()}`;
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'User-Agent': 'SnowHub-KeySystem/1.0'
            }
        });
        
        const data = await response.json();
        
        if (data.success && data.key) {
            // Store generated key to prevent duplicates
            await context.env.KEYSYSTEM_KV?.put(keyGenKey, data.key, { 
                expirationTtl: 86400 // 24 hours
            });
            
            // Clean up verification data
            for (let i = 0; i < 3; i++) {
                await context.env.KEYSYSTEM_KV?.delete(`verify_${sessionId}_${i}`);
            }
            
            return jsonResponse({
                success: true,
                key: data.key
            });
        } else {
            return jsonResponse({
                success: false,
                message: data.message || 'Failed to generate key'
            }, 400);
        }
        
    } catch (error) {
        console.error('Key generation error:', error);
        return jsonResponse({
            success: false,
            message: 'Server error'
        }, 500);
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
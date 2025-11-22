// Anti-bypass Configuration
const CONFIG = {
    linkvertiseLinks: [
        "https://link-hub.net/1350251/09ZydmogGnmy",
        "https://direct-link.net/1350251/YVBOjBm7dCR4", 
        "https://link-hub.net/1350251/ZEMonA7VOARt"
    ],
    workerEndpoint: "/api/generate-key",
    localStorageKey: "snowhub_keysystem_progress",
    sessionKey: "snowhub_session_id",
    anticheatEndpoint: "/api/verify-step",
    // Redirect URL für Linkvertise (muss in Linkvertise-Dashboard eingestellt sein)
    redirectBase: "https://desync-key.pages.dev"
};

const notyf = new Notyf({
    duration: 4000,
    position: { x: 'right', y: 'top' }
});

let currentStep = 0;
let sessionId = null;
let linkvertiseWindow = null;
let checkInterval = null;

// Generate unique session ID
function generateSessionId() {
    return 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Initialize session
function initSession() {
    sessionId = sessionStorage.getItem(CONFIG.sessionKey);
    if (!sessionId) {
        sessionId = generateSessionId();
        sessionStorage.setItem(CONFIG.sessionKey, sessionId);
    }
}

// Load progress
function loadProgress() {
    const saved = localStorage.getItem(CONFIG.localStorageKey);
    if (saved) {
        try {
            const data = JSON.parse(saved);
            // Verify session matches
            if (data.sessionId === sessionId && Date.now() - data.timestamp < 3600000) {
                currentStep = data.step;
                updateUI();
            } else {
                clearProgress();
            }
        } catch (e) {
            clearProgress();
        }
    }
}

// Save progress with anti-tamper
function saveProgress() {
    const data = {
        step: currentStep,
        sessionId: sessionId,
        timestamp: Date.now(),
        checksum: btoa(currentStep + sessionId + Date.now())
    };
    localStorage.setItem(CONFIG.localStorageKey, JSON.stringify(data));
}

// Clear progress
function clearProgress() {
    localStorage.removeItem(CONFIG.localStorageKey);
    currentStep = 0;
}

// Update UI
function updateUI() {
    const statusText = document.getElementById('statusText');
    const actionButton = document.getElementById('actionButton');
    const currentStepEl = document.getElementById('currentStep');
    const progressFill = document.getElementById('progressFill');
    const verifySection = document.getElementById('verifySection');

    currentStepEl.textContent = currentStep;
    progressFill.style.width = (currentStep / 3 * 100) + '%';

    verifySection.classList.add('hidden');
    actionButton.classList.remove('hidden');

    if (currentStep === 0) {
        statusText.innerHTML = 'Complete 3 Linkvertise checkpoints to get your 24-hour license key.<br><span style="color: #ef4444; font-size: 12px;">⚠️ Bypass attempts will be detected and blocked.</span>';
        actionButton.textContent = 'Start - Step 1';
        actionButton.disabled = false;
    } else if (currentStep < 3) {
        statusText.innerHTML = `Great! Now complete checkpoint ${currentStep + 1}.<br><span style="color: #fbbf24; font-size: 12px;">Complete the Linkvertise page fully to proceed.</span>`;
        actionButton.textContent = `Continue - Step ${currentStep + 1}`;
        actionButton.disabled = false;
    } else {
        statusText.innerHTML = 'All checkpoints completed! Generating your key...';
        actionButton.disabled = true;
        generateKey();
    }
}

// Handle step - opens Linkvertise with monitoring
function handleStep() {
    if (currentStep >= 3) return;
    
    const link = CONFIG.linkvertiseLinks[currentStep];
    const actionButton = document.getElementById('actionButton');
    
    // Create step token to identify which checkpoint this is
    const stepToken = btoa(sessionId + '_step' + currentStep + '_' + Date.now());
    
    // Store the step token for verification when user returns
    sessionStorage.setItem('pending_step', currentStep.toString());
    sessionStorage.setItem('pending_token', stepToken);
    
    // Build full Linkvertise URL with redirect back to our site
    // The redirect URL will include the step parameter
    const redirectUrl = encodeURIComponent(`${CONFIG.redirectBase}?step=${currentStep}&token=${stepToken}`);
    const linkWithRedirect = link + (link.includes('?') ? '&' : '?') + 'return=' + redirectUrl;
    
    // For traditional popup monitoring (fallback)
    const verifyToken = btoa(sessionId + '_' + currentStep + '_' + Date.now());
    const linkWithToken = link + (link.includes('?') ? '&' : '?') + 'ref=' + verifyToken;
    
    // Try to redirect in same window (works better with Linkvertise)
    // Store current state before redirect
    sessionStorage.setItem('linkvertise_redirect', 'true');
    sessionStorage.setItem('linkvertise_step', currentStep.toString());
    
    // Redirect to Linkvertise
    window.location.href = link;
}

// Monitor Linkvertise window
function startWindowMonitoring() {
    let startTime = Date.now();
    let warningShown = false;
    
    checkInterval = setInterval(() => {
        // Check if window is closed
        if (linkvertiseWindow && linkvertiseWindow.closed) {
            clearInterval(checkInterval);
            
            const elapsedTime = Date.now() - startTime;
            
            // If closed too quickly (less than 10 seconds), it's likely a bypass attempt
            if (elapsedTime < 10000) {
                notyf.error('⚠️ Bypass detected! You must complete the full Linkvertise page.');
                document.getElementById('actionButton').disabled = false;
                document.getElementById('actionButton').textContent = `Retry - Step ${currentStep + 1}`;
                
                // Add warning
                showBypassWarning();
            } else {
                // Show verification section
                showVerificationSection();
            }
        }
        
        // Show warning after 5 seconds if window still open
        if (!warningShown && Date.now() - startTime > 5000) {
            warningShown = true;
            notyf.open({
                type: 'info',
                message: 'Complete all steps on the Linkvertise page!',
                duration: 5000
            });
        }
    }, 1000);
}

// Show verification section
function showVerificationSection() {
    const verifySection = document.getElementById('verifySection');
    const actionButton = document.getElementById('actionButton');
    
    actionButton.classList.add('hidden');
    verifySection.classList.remove('hidden');
    
    document.getElementById('verifyCode').value = '';
    document.getElementById('verifyCode').focus();
    
    notyf.open({
        type: 'info',
        message: 'Enter the verification code from the Linkvertise page',
        duration: 5000
    });
}

// Verify step with backend
async function verifyStep() {
    const verifyCode = document.getElementById('verifyCode').value.trim();
    
    if (!verifyCode) {
        notyf.error('Please enter the verification code!');
        return;
    }
    
    const loader = document.getElementById('loader');
    loader.classList.remove('hidden');
    
    try {
        // Verify with backend
        const response = await fetch(CONFIG.anticheatEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                sessionId: sessionId,
                step: currentStep,
                code: verifyCode,
                timestamp: Date.now()
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Valid - proceed
            currentStep++;
            saveProgress();
            notyf.success(`✓ Step ${currentStep} completed!`);
            
            setTimeout(() => {
                updateUI();
                loader.classList.add('hidden');
            }, 1000);
        } else {
            // Invalid code
            notyf.error('❌ Invalid code! Try again.');
            loader.classList.add('hidden');
        }
        
    } catch (error) {
        console.error('Verification error:', error);
        notyf.error('Verification failed. Please try again.');
        loader.classList.add('hidden');
    }
}

// Show bypass warning
function showBypassWarning() {
    const statusText = document.getElementById('statusText');
    const warning = document.createElement('div');
    warning.className = 'warning';
    warning.innerHTML = '⚠️ <strong>Bypass Detected!</strong><br>You must complete the entire Linkvertise page. Closing it early won\'t work.';
    statusText.after(warning);
    
    setTimeout(() => warning.remove(), 5000);
}

// Generate key
async function generateKey() {
    const loader = document.getElementById('loader');
    loader.classList.remove('hidden');
    
    try {
        const response = await fetch(CONFIG.workerEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                sessionId: sessionId,
                appName: 'snow-hub',
                ownerId: 'rmEth7Edk0',
                version: '1.0'
            })
        });
        
        const data = await response.json();
        
        if (data.success && data.key) {
            displayKey(data.key);
            clearProgress();
            sessionStorage.removeItem(CONFIG.sessionKey);
        } else {
            throw new Error(data.message || 'Failed to generate key');
        }
    } catch (error) {
        console.error('Error:', error);
        notyf.error('Failed to generate key. Please contact support.');
        currentStep = 2;
        updateUI();
    } finally {
        loader.classList.add('hidden');
    }
}

// Display key
function displayKey(key) {
    const statusText = document.getElementById('statusText');
    const actionButton = document.getElementById('actionButton');
    const stepInfo = document.querySelector('.step-info');
    const verifySection = document.getElementById('verifySection');
    
    statusText.innerHTML = `
        <span style="color: #4ade80; font-weight: 500; font-size: 18px;">✓ Success!</span><br>
        Your 24-hour license key:
    `;
    
    const keyDisplay = document.createElement('div');
    keyDisplay.className = 'key-display';
    keyDisplay.textContent = key;
    
    const copyButton = document.createElement('button');
    copyButton.className = 'button';
    copyButton.textContent = '📋 Copy Key';
    copyButton.onclick = () => copyToClipboard(key);
    
    actionButton.replaceWith(copyButton);
    verifySection.remove();
    stepInfo.after(keyDisplay);
    stepInfo.remove();
    
    notyf.success('🎉 Key generated successfully!');
}

// Copy to clipboard
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        notyf.success('✓ Key copied to clipboard!');
    }).catch(() => {
        const tempInput = document.createElement('input');
        tempInput.value = text;
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand('copy');
        document.body.removeChild(tempInput);
        notyf.success('✓ Key copied to clipboard!');
    });
}

// Check URL parameters for redirect from Linkvertise
async function checkURLParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    const hash = urlParams.get('hash');
    const step = urlParams.get('step');
    const token = urlParams.get('token');
    
    // Check if we're returning from a Linkvertise redirect
    const wasRedirected = sessionStorage.getItem('linkvertise_redirect') === 'true';
    const expectedStep = sessionStorage.getItem('linkvertise_step');
    
    // Clean URL immediately
    if (hash || step || wasRedirected) {
        window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    // Handle hash parameter (current Linkvertise setup)
    if (hash && wasRedirected && expectedStep !== null) {
        const stepNum = parseInt(expectedStep);
        
        // Clear redirect flags
        sessionStorage.removeItem('linkvertise_redirect');
        sessionStorage.removeItem('linkvertise_step');
        
        // Check if we're on the expected step
        if (currentStep !== stepNum) {
            notyf.error('Step mismatch detected. Please try again.');
            return;
        }
        
        if (currentStep >= 3) {
            notyf.error('All steps already completed!');
            return;
        }
        
        const loader = document.getElementById('loader');
        loader.classList.remove('hidden');
        
        notyf.open({
            type: 'info',
            message: `Processing checkpoint ${currentStep + 1} completion...`,
            duration: 2000
        });
        
        // Accept the redirect and move to next step
        setTimeout(() => {
            currentStep++;
            saveProgress();
            notyf.success(`✓ Checkpoint ${currentStep} completed!`);
            
            setTimeout(() => {
                updateUI();
                loader.classList.add('hidden');
            }, 500);
        }, 1000);
        
        return;
    }
    
    // Handle step parameter (future enhanced setup)
    if (step !== null && token) {
        const pendingStep = sessionStorage.getItem('pending_step');
        const pendingToken = sessionStorage.getItem('pending_token');
        
        if (pendingStep === step && pendingToken === token) {
            // Valid redirect with correct step
            sessionStorage.removeItem('pending_step');
            sessionStorage.removeItem('pending_token');
            
            const stepNum = parseInt(step);
            
            if (currentStep === stepNum && currentStep < 3) {
                const loader = document.getElementById('loader');
                loader.classList.remove('hidden');
                
                notyf.open({
                    type: 'info',
                    message: `Processing checkpoint ${currentStep + 1} completion...`,
                    duration: 2000
                });
                
                setTimeout(() => {
                    currentStep++;
                    saveProgress();
                    notyf.success(`✓ Checkpoint ${currentStep} completed!`);
                    
                    setTimeout(() => {
                        updateUI();
                        loader.classList.add('hidden');
                    }, 500);
                }, 1000);
            }
        }
    }
}

// Initialize
window.addEventListener('DOMContentLoaded', () => {
    initSession();
    loadProgress();
    checkURLParameters(); // Check for redirect from Linkvertise
    updateUI();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (checkInterval) clearInterval(checkInterval);
    if (linkvertiseWindow && !linkvertiseWindow.closed) {
        linkvertiseWindow.close();
    }
});

// Listen for Enter key on verify input
document.addEventListener('DOMContentLoaded', () => {
    const verifyInput = document.getElementById('verifyCode');
    if (verifyInput) {
        verifyInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                verifyStep();
            }
        });
    }
});

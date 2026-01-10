console.log("SentinelGraph: Security Layer v4 (Fixed) Active");

let isScanning = false;

// --- HELPERS ---
function findChatInput() {
    return document.querySelector('#prompt-textarea') || 
           document.querySelector('div[contenteditable="true"]') || 
           document.querySelector('textarea');
}

function getChatText(el) {
    if (!el) return "";
    return el.nodeName === 'DIV' ? el.innerText : el.value;
}

function setChatText(el, text) {
    if (!el) return;
    if (el.nodeName === 'DIV') {
        el.innerText = text;
    } else {
        el.value = text;
    }
    // Element par thappa lagao ki ye scan ho gaya hai
    el.setAttribute('data-scanned', 'true'); 
    el.dispatchEvent(new Event('input', { bubbles: true }));
}

// --- CORE LOGIC ---
async function processSecurityScan(text, element) {
    if (isScanning) return false;
    isScanning = true;

    try {
        console.log("🛡️ Sentinel: Scanning malformed structures...");
        const query = `mutation { scanPrompt(text: ${JSON.stringify(text)}) { redactedText } }`;
        
        const response = await fetch('http://localhost:4000/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });

        const result = await response.json();
        const cleanedText = result.data.scanPrompt.redactedText;
        
        setChatText(element, cleanedText);
        isScanning = false;
        return true;
    } catch (err) {
        console.error("❌ Sentinel Offline:", err);
        isScanning = false;
        return false;
    }
}

// --- EVENT LISTENERS ---

// 1. MOUSE CLICK & KEYBOARD ENTER (Combined Logic)
const interceptor = async (e) => {
    const inputEl = findChatInput();
    if (!inputEl) return;

    // LOOP BREAK: Agar input par scan ka thappa hai, toh bypass karo
    if (inputEl.getAttribute('data-scanned') === 'true') {
        inputEl.removeAttribute('data-scanned'); // Agle message ke liye saaf karo
        return; 
    }

    const isClick = e.type === 'click' && e.target.closest('button[data-testid="send-button"]');
    const isEnter = e.type === 'keydown' && e.key === 'Enter' && !e.shiftKey;

    if ((isClick || isEnter) && !isScanning) {
        const textValue = getChatText(inputEl);

        if (textValue.trim().length > 0) {
            e.preventDefault();
            e.stopImmediatePropagation();

            const success = await processSecurityScan(textValue, inputEl);
            if (success) {
                console.log("✅ Scan Complete. Sending...");
                // Naya event trigger karo jo ab 'data-scanned' dekh kar nikal jayega
                if (isClick) {
                    e.target.closest('button[data-testid="send-button"]').click();
                } else {
                    inputEl.dispatchEvent(new KeyboardEvent('keydown', {
                        key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true
                    }));
                }
            }
        }
    }
};

document.addEventListener('click', interceptor, true);
document.addEventListener('keydown', interceptor, true);
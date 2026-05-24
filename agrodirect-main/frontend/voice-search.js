/**
 * VoiceSearch Module for AgroDirect
 * Handles Speech-to-Text (STT) for search inputs.
 */
const VoiceSearch = {
    recognition: null,
    isListening: false,
    activeInput: null,

    init() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.warn("[VoiceSearch] Web Speech API not supported in this browser.");
            return false;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = true;

        this.recognition.onstart = () => {
            this.isListening = true;
            this.updateUI(true);
        };

        this.recognition.onresult = (event) => {
            const transcript = Array.from(event.results)
                .map(result => result[0])
                .map(result => result.transcript)
                .join('');

            if (this.activeInput) {
                this.activeInput.value = transcript;
                // Trigger input event for live filtering
                this.activeInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
        };

        this.recognition.onerror = (event) => {
            console.error("[VoiceSearch] Error:", event.error);
            this.stop();
        };

        this.recognition.onend = () => {
            this.isListening = false;
            this.updateUI(false);
        };

        return true;
    },

    start(inputElement, langCode = 'en-US') {
        if (!this.recognition && !this.init()) return;
        if (this.isListening) {
            this.stop();
            return;
        }

        this.activeInput = inputElement;
        this.recognition.lang = langCode;
        
        try {
            this.recognition.start();
        } catch (e) {
            console.error("[VoiceSearch] Start failed:", e);
        }
    },

    stop() {
        if (this.recognition && this.isListening) {
            this.recognition.stop();
        }
    },

    updateUI(listening) {
        if (!this.activeInput) return;
        const container = this.activeInput.closest('.search-container') || this.activeInput.parentElement;
        const btn = container ? container.querySelector('.voice-search-btn') : null;
        
        if (btn) {
            if (listening) {
                btn.classList.add('listening');
                this.activeInput.placeholder = "Listening...";
            } else {
                btn.classList.remove('listening');
                // Restore placeholder if needed or just leave it
                this.activeInput.placeholder = this.activeInput.getAttribute('data-original-placeholder') || "Search products...";
            }
        }
    },

    /**
     * Helper to inject voice search button into a search box
     */
    inject(inputSelector) {
        const input = document.querySelector(inputSelector);
        if (!input || input.nextElementSibling?.classList.contains('voice-search-btn')) return;

        // Wrap in container if not already
        if (!input.parentElement.classList.contains('search-container')) {
            const wrapper = document.createElement('div');
            wrapper.className = 'search-container';
            input.parentNode.insertBefore(wrapper, input);
            wrapper.appendChild(input);
        }

        input.setAttribute('data-original-placeholder', input.placeholder);

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'voice-search-btn';
        btn.innerHTML = '<i class="fas fa-microphone"></i>';
        btn.title = "Search by voice";
        
        btn.onclick = () => {
            const currentLang = localStorage.getItem('agroDirectLang') || 'en-US';
            this.start(input, currentLang);
        };

        input.parentElement.appendChild(btn);
    }
};

export default VoiceSearch;
window.VoiceSearch = VoiceSearch;

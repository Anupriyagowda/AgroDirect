const VoiceGuidance = {
    selectedLanguage: localStorage.getItem('agroDirectLang') || 'en-US',
    voices: [],
    isInitialized: false,

    init() {
        if (this.isInitialized && this.voices.length > 0) return;

        const loadVoices = () => {
            this.voices = window.speechSynthesis.getVoices();
            if (this.voices.length > 0 && !this.isInitialized) {
                this.isInitialized = true;
                console.log(`[VoiceGuidance] Loaded ${this.voices.length} voices.`);
            }
        };

        if (window.speechSynthesis.onvoiceschanged !== undefined) {
            window.speechSynthesis.onvoiceschanged = loadVoices;
        }
        
        loadVoices();
        
        // Retry logic for some browsers that load voices slowly
        if (this.voices.length === 0) {
            setTimeout(loadVoices, 500);
            setTimeout(loadVoices, 1500);
        }
    },

    setLanguage(langCode) {
        if (this.selectedLanguage === langCode && this.isInitialized) return;
        this.selectedLanguage = langCode;
        console.log(`[VoiceGuidance] Language set to: ${langCode}`);
    },

    getBestVoice(langCode) {
        if (!this.voices.length) this.voices = window.speechSynthesis.getVoices();
        
        const lang = langCode || this.selectedLanguage || 'en-US';
        const targetFull = lang.toLowerCase().replace('_', '-');
        const targetBase = targetFull.split('-')[0];

        const matches = this.voices.filter(v => {
            const vLang = v.lang.toLowerCase().replace('_', '-');
            return vLang === targetFull || vLang === targetBase || vLang.startsWith(targetBase);
        });

        if (matches.length === 0) {
            console.log(`[VoiceGuidance] No local voice found for ${lang}. Available languages:`, 
                [...new Set(this.voices.map(v => v.lang))]);
            return this.voices.find(v => v.lang.toLowerCase().startsWith('en')) || this.voices[0];
        }

        const femaleKeywords = [
            'female', 'girl', 'woman', 'lady', 'soft', 
            'zira', 'veena', 'heera', 'swara', 'sangeeta', 'lekha', 'kalpana', 'vaishali',
            'shravani', 'ananya', 'madhur', 'neerja'
        ];
        
        const femaleMatches = matches.filter(v => 
            femaleKeywords.some(key => v.name.toLowerCase().includes(key))
        );

        return femaleMatches.length > 0 ? femaleMatches[0] : matches[0];
    },

    isServerTtsLanguage(langCode) {
        const lang = (langCode || this.selectedLanguage || 'en-US').toLowerCase().replace('_', '-');
        const base = lang.split('-')[0];
        return ['hi', 'ta', 'kn', 'te', 'gu', 'ml'].includes(base);
    },

    hasLocalVoice(langCode) {
        if (!this.voices.length) this.voices = window.speechSynthesis.getVoices();
        const lang = (langCode || this.selectedLanguage || 'en-US').toLowerCase().replace('_', '-');
        const base = lang.split('-')[0];
        return this.voices.some(v => {
            const vLang = v.lang.toLowerCase().replace('_', '-');
            return vLang === lang || vLang === base || vLang.startsWith(base);
        });
    },

    async speakWithGoogleTts(text, lang) {
        try {
            const response = await fetch('/api/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, lang })
            });
            if (!response.ok) {
                console.warn('[VoiceGuidance] Google TTS request failed:', response.status, response.statusText);
                return false;
            }
            const data = await response.json();
            if (!data.audioContent) {
                console.warn('[VoiceGuidance] Google TTS response contained no audio.');
                return false;
            }

            const audio = new Audio(`data:audio/mp3;base64,${data.audioContent}`);
            await audio.play().catch(err => {
                console.error('[VoiceGuidance] Audio play failed:', err);
                throw err;
            });
            return true;
        } catch (err) {
            console.error('[VoiceGuidance] Google TTS error:', err);
            return false;
        }
    },

    async speak(textOrKey) {
        let user = {};
        try {
            user = JSON.parse(localStorage.getItem('agroUser') || '{}');
        } catch(e) {}
        const role = user.role || 'consumer';

        const publicKeys = [
            'voiceWelcome', 'voiceLoginHelp', 'createAccountTitle', 
            'voiceAddedToCart', 'voiceOrderPlaced', 'voiceCheckoutHelp'
        ];
        
        const isPublic = publicKeys.some(k => textOrKey.includes(k)) || textOrKey.toLowerCase().includes('welcome');
        if (role !== 'farmer' && !isPublic) {
            return;
        }

        const lang = this.selectedLanguage;
        let text = textOrKey;

        const canUseLocalSpeech = !!window.speechSynthesis;

        if (window.translations && window.translations[lang] && window.translations[lang][textOrKey]) {
            text = window.translations[lang][textOrKey];
        } else if (window.translations && window.translations[lang]) {
            for (const key in window.translations[lang]) {
                if (textOrKey.includes(key)) {
                    text = textOrKey.replace(key, window.translations[lang][key]);
                }
            }
        }

        const shouldUseServerTts = this.isServerTtsLanguage(lang) || (canUseLocalSpeech && !this.hasLocalVoice(lang));
        if (shouldUseServerTts) {
            const serverSuccess = await this.speakWithGoogleTts(text, lang);
            if (serverSuccess) {
                console.log(`[VoiceGuidance] Used Google Cloud TTS for ${lang}`);
                return;
            }
            console.warn('[VoiceGuidance] Google Cloud TTS failed; falling back to local speech if available.');
        }

        if (!canUseLocalSpeech) {
            console.warn('[VoiceGuidance] Browser speech synthesis unavailable for local playback.');
            return;
        }

        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;

        const bestVoice = this.getBestVoice(lang);
        if (bestVoice) {
            utterance.voice = bestVoice;
            utterance.lang = bestVoice.lang;
            console.log(`[VoiceGuidance] Using voice: ${bestVoice.name} (${bestVoice.lang})`);
        } else {
            console.warn(`[VoiceGuidance] No voice available for language: ${lang}`);
        }

        utterance.rate = 0.95;
        utterance.pitch = 1.05;
        utterance.onerror = (event) => {
            console.error(`[VoiceGuidance] Speech error: ${event.error}`);
        };

        window.speechSynthesis.speak(utterance);
    },

    // Predefined actions actions using translation keys
    welcome() {
        this.speak('voiceWelcome');
    },

    loginHelp() {
        this.speak('voiceLoginHelp');
    },

    addedToCart(itemName) {
        const lang = this.selectedLanguage;
        const suffix = (window.translations[lang] && window.translations[lang].voiceAddedToCart) 
                 ? window.translations[lang].voiceAddedToCart 
                 : `added to your cart successfully.`;
        
        this.speak(`${itemName} ${suffix}`);
    },

    removedFromCart(itemName) {
        const lang = this.selectedLanguage;
        const suffix = (window.translations[lang] && window.translations[lang].voiceRemovedFromCart) 
                 ? window.translations[lang].voiceRemovedFromCart 
                 : `removed from your cart successfully.`;
        
        this.speak(`${itemName} ${suffix}`);
    },

    checkoutHelp() {
        this.speak('voiceCheckoutHelp');
    },

    orderPlaced() {
        this.speak('voiceOrderPlaced');
    },

    farmerWelcome() {
        this.speak('voiceFarmerWelcome');
    },

    statusUpdated() {
        this.speak('voiceStatusUpdated');
    }
};

VoiceGuidance.init();
export default VoiceGuidance;
window.VoiceGuidance = VoiceGuidance;


import translations from './translations.js';
import VoiceGuidance from './voice-guidance.js';
import VoiceSearch from './voice-search.js';

const KEY_LANG = 'agroDirectLang';

export function initLanguage() {
    const savedLang = localStorage.getItem(KEY_LANG) || 'en-US';
    applyLanguage(savedLang);
}

export function applyLanguage(lang) {
    localStorage.setItem(KEY_LANG, lang);
    if (VoiceGuidance && VoiceGuidance.setLanguage) {
        VoiceGuidance.setLanguage(lang);
    }
    
    // Auto-inject voice search to any search boxes if not already present
    if (window.VoiceSearch && window.VoiceSearch.inject) {
        document.querySelectorAll('.search-box').forEach(sb => {
            if (!sb.id) sb.id = 'search-' + Math.random().toString(36).substr(2, 9);
            window.VoiceSearch.inject('#' + sb.id);
        });
    }

    const t = translations[lang] || translations['en-US'];

    // Update text content for elements with data-i18n
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (t[key]) {
            // Check if element has an icon to preserve
            const icon = el.querySelector('i');
            el.textContent = t[key];
            if (icon) el.prepend(icon);
        }
    });

    // Update placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (t[key]) {
            el.placeholder = t[key];
        }
    });

    // Update titles
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        if (t[key]) {
            el.title = t[key];
        }
    });

    // Update Dropdown Buttons
    const langDropdown = document.getElementById('langDropdown');
    const langBtn = document.querySelector('.lang-btn');
    if (langDropdown || langBtn) {
        const names = {
            'en-US': 'English',
            'hi-IN': 'हिन्दी',
            'gu-IN': 'ગુજરાતી',
            'kn-IN': 'ಕನ್ನಡ',
            'te-IN': 'తెలుగు',
            'ta-IN': 'தமிழ்',
            'ml-IN': 'മലയാളം'
        };
        const activeItem = langDropdown || langBtn;
        if (activeItem.tagName === 'BUTTON' && !activeItem.classList.contains('lang-btn')) {
            const icon = '<i class="fas fa-language me-1"></i> ';
            activeItem.innerHTML = icon + (names[lang] || 'Language');
        }
    }

    // Update index-style active pills if they exist
    document.querySelectorAll('.lang-pill').forEach(pill => {
        pill.classList.toggle('active', pill.getAttribute('onclick')?.includes(lang));
    });

    // Notify other components if needed
    window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang, t } }));
}

window.changeLanguage = function (lang) {
    applyLanguage(lang);
    // Set voice guidance language immediately
    if (VoiceGuidance && VoiceGuidance.setLanguage) {
        VoiceGuidance.setLanguage(lang);
        // Force voices update if needed
        if (window.speechSynthesis && window.speechSynthesis.onvoiceschanged) {
            window.speechSynthesis.onvoiceschanged();
        }
        
        // Check if voice is available for this language
        const availableVoices = window.speechSynthesis.getVoices();
        const hasVoice = availableVoices.some(v => {
            const vLang = v.lang.toLowerCase().replace('_', '-');
            const langCode = lang.toLowerCase().replace('_', '-');
            return vLang === langCode || vLang.startsWith(langCode.split('-')[0]);
        });
        
        if (!hasVoice && lang !== 'en-US') {
            console.warn(`[Voice] No voice support for ${lang}. Using English fallback. To get native voice support, install language voices in your system.`);
        }
    }
    // Add welcome message on change for farmers
    if (VoiceGuidance && VoiceGuidance.welcome) {
        VoiceGuidance.welcome();
    }
};

window.applyLanguage = applyLanguage;
window.translations = translations;

export function translatePage() {
    const savedLang = localStorage.getItem(KEY_LANG) || 'en-US';
    applyLanguage(savedLang);
}

// Global initializer
document.addEventListener('DOMContentLoaded', () => {
    initLanguage();

    // Attach listeners to items with .lang-select
    document.querySelectorAll('.lang-select').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const lang = e.currentTarget.getAttribute('data-lang');
            window.changeLanguage(lang);
        });
    });

    // Dynamic injection of voice search for any initial search boxes
    if (window.VoiceSearch && window.VoiceSearch.inject) {
        document.querySelectorAll('.search-box').forEach(sb => {
            if (!sb.id) sb.id = 'search-' + Math.random().toString(36).substr(2, 9);
            window.VoiceSearch.inject('#' + sb.id);
        });
    }
});

/**
 * AgroDirect Theme Switcher
 * Handles Light/Dark mode transitions and persistence.
 * This script is designed to be included in the <head> to prevent FOUC (Flash of Unstyled Content).
 */

(function () {
    const savedTheme = localStorage.getItem('agroTheme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);

    const ThemeSwitcher = {
        async init() {
            this.updateToggleUI(savedTheme);
            await this.applyCustomizations();

            // Listen for system theme changes if no preference is saved
            if (!localStorage.getItem('agroTheme')) {
                window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
                    this.applyTheme(e.matches ? 'dark' : 'light');
                });
            }
        },

        async applyCustomizations() {
            try {
                // Fetch settings from API
                const response = await fetch('/api/settings');
                const s = await response.json();
                
                if (s) {
                    // Apply colors
                    if (s.primaryColor) document.documentElement.style.setProperty('--primary-color', s.primaryColor);
                    if (s.primaryLight) document.documentElement.style.setProperty('--primary-light', s.primaryLight);
                    
                    const isLogin = window.location.pathname === '/' || 
                                   window.location.pathname.endsWith('index.html') || 
                                   window.location.pathname.includes('/login');

                    if (isLogin) {
                        // Priority for Login Page
                        if (s.loginBg) {
                            document.body.style.backgroundImage = `url('${s.loginBg}')`;
                            document.body.style.backgroundSize = 'cover';
                            document.body.style.backgroundPosition = 'center';
                            document.body.style.backgroundAttachment = 'fixed';
                        } else {
                            // Default login fallback (the animated gradient from CSS)
                            document.body.style.backgroundImage = '';
                        }
                    } else {
                        // Priority for Website Pages
                        if (s.websiteBg) {
                            document.body.style.backgroundImage = `url('${s.websiteBg}')`;
                            document.body.style.backgroundSize = 'cover';
                            document.body.style.backgroundPosition = 'center';
                            document.body.style.backgroundAttachment = 'fixed';
                            document.body.style.backgroundRepeat = 'no-repeat';
                        } else if (s.backgroundColor) {
                            // Solid or Gradient from customization
                            document.body.style.backgroundImage = 'none';
                            if (s.backgroundColor.includes('gradient')) {
                                document.body.style.background = s.backgroundColor;
                                document.body.style.backgroundAttachment = 'fixed';
                            } else {
                                document.body.style.backgroundColor = s.backgroundColor;
                                document.body.style.background = s.backgroundColor; // Ensure override
                            }
                        }
                    }
                }
            } catch (error) {
                console.warn('Customization settings could not be loaded, using defaults.');
                // Fallback to localStorage if API fails
                const localSaved = localStorage.getItem('agroCustomSettings');
                if (localSaved) {
                    const ls = JSON.parse(localSaved);
                    if (ls.primaryColor) document.documentElement.style.setProperty('--primary-color', ls.primaryColor);
                    if (ls.backgroundColor) document.body.style.background = ls.backgroundColor;
                }
            }
        },

        toggle() {
            const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';

            this.applyTheme(newTheme);
            localStorage.setItem('agroTheme', newTheme);
            this.updateToggleUI(newTheme);
        },

        applyTheme(theme) {
            document.documentElement.setAttribute('data-theme', theme);
            window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme } }));
        },

        updateToggleUI(theme) {
            const toggleBtn = document.getElementById('themeToggle');
            if (toggleBtn) {
                const icon = toggleBtn.querySelector('i');
                if (icon) {
                    icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
                }
                toggleBtn.title = theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode';
            }
        }
    };

    // Initialize UI-dependent parts when DOM is ready
    document.addEventListener('DOMContentLoaded', () => ThemeSwitcher.init());

    // Expose to window
    window.ThemeSwitcher = ThemeSwitcher;
})();

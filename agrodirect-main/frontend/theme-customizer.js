(function () {
    function applyCustomTheme() {
        const savedSettings = localStorage.getItem('agroCustomSettings');
        if (!savedSettings) return;

        try {
            const settings = JSON.parse(savedSettings);
            const root = document.documentElement;

            if (settings.primaryColor) {
                root.style.setProperty('--primary', settings.primaryColor);
            }
            if (settings.primaryLight) {
                root.style.setProperty('--primary-light', settings.primaryLight);
            }
            if (settings.backgroundColor) {
                document.body.style.background = settings.backgroundColor;
                // If it's a gradient, we might need more specific logic, but start simple
                document.body.style.backgroundImage = settings.backgroundColor;
            }
        } catch (e) {
            console.error("Failed to apply custom theme:", e);
        }
    }

    // Apply on load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyCustomTheme);
    } else {
        applyCustomTheme();
    }

    // Listen for changes
    window.addEventListener('storage', (e) => {
        if (e.key === 'agroCustomSettings') {
            applyCustomTheme();
        }
    });

    // Make it available for real-time preview in customization panel
    window.previewTheme = applyCustomTheme;
})();

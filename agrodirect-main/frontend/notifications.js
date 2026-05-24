/**
 * Modern Notification System
 * Replaces native alert() and confirm() with sleek, animated UI components.
 */

const Notifications = (() => {
    let container = null;

    const createContainer = () => {
        if (container) return container;
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
        return container;
    };

    const icons = {
        success: 'fas fa-check-circle',
        error: 'fas fa-exclamation-circle',
        warning: 'fas fa-exclamation-triangle',
        info: 'fas fa-info-circle'
    };

    const showToast = (options) => {
        const { title, message, type = 'info', duration = 4000 } = options;
        const parent = createContainer();

        const toast = document.createElement('div');
        toast.className = `modern-toast toast-${type}`;
        
        toast.innerHTML = `
            <div class="toast-icon">
                <i class="${icons[type] || icons.info}"></i>
            </div>
            <div class="toast-content">
                <div class="toast-title">${title || type.charAt(0).toUpperCase() + type.slice(1)}</div>
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close"><i class="fas fa-times"></i></button>
            <div class="toast-progress">
                <div class="toast-progress-fill" style="transition: transform ${duration}ms linear; transform: scaleX(0);"></div>
            </div>
        `;

        parent.appendChild(toast);

        // Animate progress bar
        setTimeout(() => {
            const fill = toast.querySelector('.toast-progress-fill');
            fill.style.transform = 'scaleX(1)';
        }, 10);

        const close = () => {
            toast.classList.add('out');
            setTimeout(() => toast.remove(), 400);
        };

        toast.querySelector('.toast-close').onclick = close;

        const timeout = setTimeout(close, duration);

        return { close, timeout };
    };

    // Custom modern confirm logic
    const showConfirm = (title, message, confirmText = 'Confirm', cancelText = 'Cancel') => {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'modern-overlay';
            overlay.innerHTML = `
                <div class="modern-modal">
                    <div class="modal-icon text-warning"><i class="fas fa-question-circle"></i></div>
                    <h3>${title}</h3>
                    <p class="text-muted mt-2">${message}</p>
                    <div class="modal-btns">
                        <button class="modal-btn btn-cancel">${cancelText}</button>
                        <button class="modal-btn btn-confirm">${confirmText}</button>
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);
            setTimeout(() => overlay.classList.add('active'), 10);

            const close = (result) => {
                overlay.classList.remove('active');
                setTimeout(() => {
                    overlay.remove();
                    resolve(result);
                }, 300);
            };

            overlay.querySelector('.btn-confirm').onclick = () => close(true);
            overlay.querySelector('.btn-cancel').onclick = () => close(false);
            overlay.onclick = (e) => { if(e.target === overlay) close(false); };
        });
    };

    return { showToast, showConfirm };
})();

// Global helpers
window.showAlert = (message, type = 'info', title = '') => {
    Notifications.showToast({ title, message, type });
};

window.showSuccess = (message) => window.showAlert(message, 'success', 'Success');
window.showError = (message) => window.showAlert(message, 'error', 'Error');
window.showWarning = (message) => window.showAlert(message, 'warning', 'Warning');

// Override native alert for instant modernization
window.alert = (msg) => {
    const lower = msg.toLowerCase();
    let type = 'info';
    let title = 'Notification';
    
    if (lower.includes('success') || lower.includes('successfully') || lower.includes('thank')) {
        type = 'success';
        title = 'Success';
    } else if (lower.includes('error') || lower.includes('failed') || lower.includes('invalid')) {
        type = 'error';
        title = 'Error';
    } else if (lower.includes('warn') || lower.includes('attention') || lower.includes('please')) {
        type = 'warning';
        title = 'Warning';
    }
    
    window.showAlert(msg, type, title);
};

// Promise-based confirm
window.modernConfirm = (title, message) => Notifications.showConfirm(title, message);

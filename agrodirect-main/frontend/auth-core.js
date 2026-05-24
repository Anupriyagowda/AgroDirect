// auth.js - Shared authentication functions

// Dynamic Injection of Modern Notifications
(function() {
    if (!document.querySelector('link[href*="notifications.css"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = '/notifications.css';
        document.head.appendChild(link);
    }
})();

function initAuth() {
    // Initialize Bootstrap dropdowns
    initBootstrapDropdowns();

    // Check and update auth status
    checkAuthStatus();

    // Setup logout functionality
    setupLogout();

    // Check session validity
    checkSession();
}

function initBootstrapDropdowns() {
    try {
        if (typeof bootstrap !== 'undefined' && bootstrap.Dropdown) {
            const dropdownElements = [].slice.call(document.querySelectorAll('.dropdown-toggle'));
            dropdownElements.forEach(function (dropdownToggleEl) {
                if (!dropdownToggleEl._dropdown) {
                    new bootstrap.Dropdown(dropdownToggleEl);
                }
            });
        }
    } catch (error) {
        console.error('Dropdown initialization error:', error);
    }
}

function checkAuthStatus() {
    try {
        const token = sessionStorage.getItem('agroToken') || localStorage.getItem('agroToken');
        const userData = getCurrentUser();
        const userDropdown = document.getElementById("userDropdown");
        const loginButton = document.getElementById("loginButton");
        const userNameDisplay = document.getElementById("userNameDisplay");

        if (userDropdown) userDropdown.style.display = 'none';
        if (loginButton) loginButton.style.display = 'none';

        if (token && userData && userData.name) {
            if (userNameDisplay) {
                userNameDisplay.textContent = userData.name;
            }

            // Add Dashboard link based on role
            const userDropdownMenu = document.querySelector('.dropdown-menu[aria-labelledby="userDropdown"]');
            if (userDropdownMenu) {
                // Remove existing dashboard link if any
                const existingDashboard = userDropdownMenu.querySelector('.dashboard-link');
                if (existingDashboard) existingDashboard.remove();

                const dashboardItem = document.createElement('li');
                dashboardItem.className = 'dashboard-link';
                const dashboardLink = document.createElement('a');
                dashboardLink.className = 'dropdown-item';

                if (userData.role === 'admin') {
                    dashboardLink.href = '/adminpanel/admin.html';
                    dashboardLink.innerHTML = '<i class="fas fa-chart-line me-2"></i>Admin Dashboard';
                } else if (userData.role === 'farmer') {
                    dashboardLink.href = '/farmer-dashboard.html';
                    dashboardLink.innerHTML = '<i class="fas fa-tractor me-2"></i>Farmer Dashboard';
                } else {
                    dashboardLink.href = '/home page/home.html';
                    dashboardLink.innerHTML = '<i class="fas fa-home me-2"></i>Home';
                }

                dashboardItem.appendChild(dashboardLink);
                userDropdownMenu.insertBefore(dashboardItem, userDropdownMenu.firstChild);
            }

            if (userDropdown) {
                userDropdown.style.display = 'block';
                initBootstrapDropdowns();
            }
        } else {
            if (loginButton) {
                loginButton.style.display = 'block';
            }
        }
    } catch (error) {
        console.error('Authentication check error:', error);
    }
}

function setupLogout() {
    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) {
        logoutButton.addEventListener('click', function (e) {
            e.preventDefault();
            logoutUser();
        });
    }
}

function logoutUser() {
    // Optional: Send logout request to server
    const token = sessionStorage.getItem('agroToken') || localStorage.getItem('agroToken');
    if (token) {
        fetch('/api/logout', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        }).catch(error => console.error('Logout API error:', error));
    }

    // Clear client-side storage
    localStorage.removeItem('agroToken');
    localStorage.removeItem('agroUser');
    localStorage.removeItem('agroLoginTime');
    sessionStorage.removeItem('agroToken');
    sessionStorage.removeItem('agroUser');
    sessionStorage.removeItem('agroLoginTime');

    // Redirect to login page or home
    window.location.href = "/index.html";
}

function checkSession() {
    const loginTime = sessionStorage.getItem('agroLoginTime') || localStorage.getItem('agroLoginTime');
    const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

    if (loginTime && (new Date().getTime() - parseInt(loginTime) > SESSION_TIMEOUT)) {
        logoutUser();
    }
}

// Session check is handled client-side

function getCurrentUser() {
    try {
        const userData = sessionStorage.getItem('agroUser') || localStorage.getItem('agroUser');
        return userData ? JSON.parse(userData) : null;
    } catch (error) {
        console.error('Error parsing user data:', error);
        return null;
    }
}

function updateAuthUI() {
    const user = getCurrentUser();
    const token = sessionStorage.getItem('agroToken') || localStorage.getItem('agroToken');

    const loginButton = document.getElementById('loginButton');
    const userNameDisplay = document.getElementById('userNameDisplay');
    const userDropdown = document.getElementById('userDropdown');
    const userSection = document.querySelector('.user-section');

    if (token && user && user.name) {
        if (loginButton) loginButton.style.display = 'none';
        if (userNameDisplay) userNameDisplay.textContent = user.name;
        if (userDropdown) userDropdown.style.display = 'block';
        if (userSection) userSection.style.display = 'block';

        // Populate form fields if they exist (e.g., in review.html)
        const reviewerNameField = document.getElementById('reviewerName');
        if (reviewerNameField) {
            reviewerNameField.value = user.name;
        }

        // Hide Profile and Orders for Admin and Farmer
        if (user.role === 'admin' || user.role === 'farmer') {
            const profileLink = document.querySelector('a[href*="profile.html"]');
            const ordersLink = document.querySelector('a[href*="order.html"]');
            if (profileLink && profileLink.parentElement) profileLink.parentElement.style.display = 'none';
            if (ordersLink && ordersLink.parentElement) ordersLink.parentElement.style.display = 'none';
        }
    } else {
        if (loginButton) loginButton.style.display = 'block';
        if (userDropdown) userDropdown.style.display = 'none';
        if (userSection) userSection.style.display = 'none';

        // Disable review form elements if they exist
        const reviewForm = document.getElementById('reviewForm');
        if (reviewForm) {
            const formElements = reviewForm.elements;
            for (let i = 0; i < formElements.length; i++) {
                formElements[i].disabled = true;
            }

            // Add login message if not already present
            if (!document.getElementById('auth-login-message')) {
                const loginMessage = document.createElement('div');
                loginMessage.id = 'auth-login-message';
                loginMessage.className = 'alert alert-warning mt-3';
                loginMessage.innerHTML = 'Please <a href="/index.html">login</a> to submit a review';
                reviewForm.appendChild(loginMessage);
            }
        }
    }
}

// Call this when page loads and after login/logout
document.addEventListener("DOMContentLoaded", function () {
    updateAuthUI();
});

// Dynamically load voice guidance module for pages that include auth-core.js
(function ensureVoiceGuidanceLoaded() {
    if (window.VoiceGuidance) return;
    try {
        const script = document.createElement('script');
        script.type = 'module';
        script.src = '/voice-guidance.js';
        script.onload = () => {
            try { if (window.VoiceGuidance && typeof window.VoiceGuidance.init === 'function') window.VoiceGuidance.init(); } catch(e){}
        };
        document.head.appendChild(script);
    } catch (e) {
        console.warn('Failed to inject voice-guidance module:', e);
    }
})();

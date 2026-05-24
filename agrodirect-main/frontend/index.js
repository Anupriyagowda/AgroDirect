function isValidPhone(phone) {
    // Only digits, exactly 10 characters
    return /^\d{10}$/.test(phone);
}
// Toggle password visibility for password fields
window.togglePasswordVisibility = function(inputId, iconSpan) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const icon = iconSpan.querySelector('i');
    if (input.type === 'password') {
        input.type = 'text';
        if (icon) {
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        }
    } else {
        input.type = 'password';
        if (icon) {
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    }
};
import VoiceGuidance from './voice-guidance.js';

window.showError = window.showError || function(msg) { alert(msg); };
window.showWarning = window.showWarning || function(msg) { alert(msg); };
window.showSuccess = window.showSuccess || function(msg) { alert(msg); };

let selectedRole = "consumer";
window.selectedRole = selectedRole;
let signupOtpSessionId = null;

// Load and populate previously logged emails
function loadPreviousEmails() {
    const datalist = document.getElementById('previousEmails');
    if (!datalist) return;
    
    try {
        const previousEmails = JSON.parse(localStorage.getItem('agroDirectPreviousEmails') || '[]');
        datalist.innerHTML = '';
        previousEmails.forEach(email => {
            const option = document.createElement('option');
            option.value = email;
            datalist.appendChild(option);
        });
    } catch (e) {
        console.error('Error loading previous emails:', e);
    }
}

// Store email after successful login
function storePreviousEmail(email) {
    try {
        let previousEmails = JSON.parse(localStorage.getItem('agroDirectPreviousEmails') || '[]');
        // Remove duplicates and add new email at the beginning
        previousEmails = previousEmails.filter(e => e !== email);
        previousEmails.unshift(email);
        // Keep only last 10 emails
        previousEmails = previousEmails.slice(0, 10);
        localStorage.setItem('agroDirectPreviousEmails', JSON.stringify(previousEmails));
        loadPreviousEmails();
    } catch (e) {
        console.error('Error storing previous email:', e);
    }
}

function showAdminLogin() {
    selectedRole = "admin";
    window.selectedRole = selectedRole;
    document.getElementById("roleSelection").style.display = "none";
    const loginForm = document.getElementById("loginForm");
    if (loginForm) loginForm.style.display = "block";
    const formFooter = document.querySelector("#loginForm .form-footer");
    if (formFooter) formFooter.style.display = "none";
}

function setRole(role) {
    selectedRole = role;
    window.selectedRole = selectedRole;
    // Highlight selected role
    const consumerBtn = document.getElementById('role-consumer');
    const farmerBtn = document.getElementById('role-farmer');
    if (consumerBtn && farmerBtn) {
        consumerBtn.classList.remove('selected-role');
        farmerBtn.classList.remove('selected-role');
        if (role === 'consumer') consumerBtn.classList.add('selected-role');
        if (role === 'farmer') farmerBtn.classList.add('selected-role');
    }
    document.getElementById("roleSelection").style.display = "none";
    if (role === 'admin') {
        showAdminLogin();
    } else {
        toggleForm("loginForm");
    }
}

function toggleForm(formId) {
    document.getElementById("loginForm").style.display = "none";
    document.getElementById("signupForm").style.display = "none";
    document.getElementById("recoverForm").style.display = "none";

    // Hide login success message when switching forms
    const loginMsg = document.getElementById("loginSuccessMsg");
    if (loginMsg) {
        loginMsg.textContent = "";
        loginMsg.style.display = "none";
    }

    // Hide login error message when switching forms
    const loginError = document.getElementById("loginPasswordError");
    if (loginError) {
        loginError.textContent = "";
        loginError.style.display = "none";
    }

    const target = document.getElementById(formId);
    if (target) {
        target.style.display = "block";
        if (formId === 'loginForm') {
            VoiceGuidance.loginHelp();
            // Load previous emails when showing login form
            loadPreviousEmails();
        } else if (formId === 'signupForm') {
            VoiceGuidance.speak('createAccountTitle');
            // Clear signup form fields to prevent autocomplete
            document.getElementById('signupEmail').value = '';
            document.getElementById('signupPhone').value = '';
            document.getElementById('signupName').value = '';
            document.getElementById('signupPassword').value = '';
            resetSignupOtpState();
            const signupError = document.getElementById("signupError");
            if (signupError) {
                signupError.textContent = "";
                signupError.style.display = "none";
            }
        } else if (formId === 'recoverForm') {
            // Clear recover form fields to prevent autocomplete
            document.getElementById('recoverEmail').value = '';
            const recoverError = document.getElementById("recoverError");
            if (recoverError) {
                recoverError.textContent = "";
                recoverError.style.display = "none";
            }
        }
    }

    // Show/hide certificate upload only for farmer signup
    const certBox = document.getElementById('certificateUploadBox');
    if (certBox) {
        if (formId === 'signupForm' && selectedRole === 'farmer') {
            certBox.style.display = 'block';
        } else {
            certBox.style.display = 'none';
        }
    }

    const formFooter = document.querySelector("#loginForm .form-footer");
    if (formFooter) {
        if (formId === "loginForm" && selectedRole === "admin") {
            formFooter.style.display = "none";
        } else {
            formFooter.style.display = "block";
        }
    }
}

function showRecover() {
    toggleForm("recoverForm");
}

function clearInputs() {
    if (document.getElementById("signupEmail")) document.getElementById("signupEmail").value = "";
    if (document.getElementById("signupPhone")) document.getElementById("signupPhone").value = "";
    if (document.getElementById("signupName")) document.getElementById("signupName").value = "";
    if (document.getElementById("signupPassword")) document.getElementById("signupPassword").value = "";
    if (document.getElementById("loginEmail")) document.getElementById("loginEmail").value = "";
    if (document.getElementById("loginPassword")) document.getElementById("loginPassword").value = "";
    if (document.getElementById("recoverEmail")) document.getElementById("recoverEmail").value = "";
    if (document.getElementById("signupEmailOtp")) document.getElementById("signupEmailOtp").value = "";
}

function resetSignupOtpState() {
    signupOtpSessionId = null;
    const otpSection = document.getElementById('signupOtpSection');
    if (otpSection) otpSection.style.display = 'none';
    const otpMessage = document.getElementById('signupOtpMessage');
    if (otpMessage) {
        otpMessage.textContent = '';
        otpMessage.style.display = 'none';
    }
    const requestBtn = document.getElementById('signupRequestOtpBtn');
    if (requestBtn) requestBtn.innerHTML = '<i class="fas fa-paper-plane"></i> <span>Send Email OTP</span>';
    const verifyBtn = document.getElementById('signupVerifyBtn');
    if (verifyBtn) verifyBtn.style.display = 'none';
    if (document.getElementById('signupEmailOtp')) document.getElementById('signupEmailOtp').value = '';
}

function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function isValidPassword(password) {
    return password.length >= 6 && /[!@#$%^&*]/.test(password);
}

function isValidName(name) {
    return name.trim().length >= 2;
}

async function login(event) {
    if (event) event.preventDefault();
    const email = document.getElementById("loginEmailOrPhone").value.trim();
    const phone = document.getElementById("loginPhone") ? document.getElementById("loginPhone").value.trim() : "";
    const password = document.getElementById("loginPassword").value;

    const t = (key) => (window.translations && window.translations[localStorage.getItem('agroDirectLang') || 'en-US']) ? window.translations[localStorage.getItem('agroDirectLang') || 'en-US'][key] : key;

    // Clear previous error and success
    const loginError = document.getElementById("loginPasswordError");
    if (loginError) {
        loginError.textContent = "";
        loginError.style.display = "none";
    }
    const loginSuccess = document.getElementById("loginSuccessMsg");
    if (loginSuccess) {
        loginSuccess.textContent = "";
        loginSuccess.style.display = "none";
    }

    if (!email || !password) {
        showWarning(t('fillAllFields') || "Please fill in all fields");
        return;
    }

    if (!isValidEmail(email)) {
        if (loginError) {
            loginError.textContent = t('invalidEmail') || "Please enter a valid email address";
            loginError.style.display = 'block';
        }
        return;
    }

    try {
        console.log(`[AUTH] Attempting login for ${email} with requested role: ${selectedRole}`);
        const response = await fetch('http://localhost:5003/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, role: selectedRole }),
        });

        const data = await response.json();
        console.log('[AUTH] Server response:', { status: response.status, data });

        if (response.ok) {
            // Show login success inline, then redirect
            if (loginSuccess) {
                loginSuccess.textContent = t('loginSuccess') || 'Login successful! Redirecting...';
                loginSuccess.style.display = 'block';
            }
            
            localStorage.setItem('agroToken', data.token);
            localStorage.setItem('agroUser', JSON.stringify({
                id: data.user.id || data.user._id,
                name: data.user.name,
                email: data.user.email,
                role: data.user.role
            }));
            localStorage.setItem('agroLoginTime', new Date().getTime());
            
            // Store email for future autocomplete suggestions
            storePreviousEmail(email);

            const role = data.user.role;
            console.log(`[AUTH] Success! Redirecting ${email} to ${role} dashboard.`);

            setTimeout(() => {
                if (role === 'farmer') {
                    VoiceGuidance.farmerWelcome();
                    setTimeout(() => window.location.href = '/farmer-dashboard.html', 2000);
                } else if (role === 'consumer') {
                    window.location.href = '/home page/home.html';
                } else if (role === 'admin') {
                    window.location.href = '/adminpanel/padmin.html';
                } else {
                    window.location.href = '/home page/home.html';
                }
            }, 1000);
        } else {
            // Handle error
            let errorMsg = data.message || data.error || 'Login failed.';
            
            if (response.status === 403 && data.message === "Role mismatch") {
                errorMsg = `Login Failed: Your account is registered as a "${data.accountRole}", but you are trying to login as a "${data.requestedRole}". Please select the correct role.`;
                // Show popup for role mismatch
                const popup = document.getElementById('roleMismatchPopup');
                const msg = document.getElementById('roleMismatchMsg');
                if (popup && msg) {
                    msg.textContent = errorMsg;
                    popup.style.display = 'flex';
                } else {
                    showError(errorMsg);
                }
                // Show role selection screen again
                document.getElementById('roleSelection').style.display = 'block';
                document.getElementById('loginForm').style.display = 'none';
                // Clear password field for security
                const pw = document.getElementById('loginPassword');
                if (pw) pw.value = '';
            } else {
                if (loginError) {
                    loginError.textContent = errorMsg;
                    loginError.style.display = 'block';
                } else {
                    showError(errorMsg);
                }
            }
            console.error('[AUTH] Login Error:', errorMsg);
            return;
            // Hide success message on error
            if (loginSuccess) {
                loginSuccess.textContent = "";
                loginSuccess.style.display = "none";
            }
            // Prevent redirect on error
            return;
        }
    } catch (error) {
        console.error('Login exception:', error);
        const t = (key) => (window.translations && window.translations[localStorage.getItem('agroDirectLang') || 'en-US']) ? window.translations[localStorage.getItem('agroDirectLang') || 'en-US'][key] : key;
        if (loginError) {
            loginError.textContent = t('tryAgain') || 'Login failed. Please try again.';
            loginError.style.display = 'block';
        } else {
            showError(t('tryAgain') || 'Login failed. Please try again.');
        }
        // Hide success message on error
        if (loginSuccess) {
            loginSuccess.textContent = "";
            loginSuccess.style.display = "none";
        }
    }
}

async function signup(event) {
    if (event) event.preventDefault();
    const email = document.getElementById("signupEmail").value.trim();
    const phone = document.getElementById("signupPhone").value.trim();
    const name = document.getElementById("signupName").value.trim();
    const password = document.getElementById("signupPassword").value;

    const t = (key) => (window.translations && window.translations[localStorage.getItem('agroDirectLang') || 'en-US']) ? window.translations[localStorage.getItem('agroDirectLang') || 'en-US'][key] : key;

    const signupError = document.getElementById("signupError");
    if (signupError) {
        signupError.textContent = "";
        signupError.style.display = "none";
    }
    if (selectedRole === 'admin') {
        if (signupError) {
            signupError.textContent = t('adminSignupRestricted') || 'Admin accounts cannot be created through this form.';
            signupError.style.display = 'block';
        }
        return;
    }
    if (!email || !phone || !name || !password) {
        if (signupError) {
            signupError.textContent = t('fillAllFields') || "Please fill in all fields";
            signupError.style.display = 'block';
        }
        return;
    }
    if (!isValidPhone(phone)) {
        if (signupError) {
            signupError.textContent = t('invalidPhone') || "Please enter a valid 10-digit phone number";
            signupError.style.display = 'block';
        }
        return;
    }
    if (!isValidEmail(email)) {
        if (signupError) {
            signupError.textContent = t('invalidEmail') || "Please enter a valid email address";
            signupError.style.display = 'block';
        }
        return;
    }
    if (!isValidName(name)) {
        if (signupError) {
            signupError.textContent = t('invalidName') || "Name must be at least 2 characters long";
            signupError.style.display = 'block';
        }
        return;
    }
    if (!isValidPassword(password)) {
        if (signupError) {
            signupError.textContent = t('passwordReq') || 'Password requirements not met.';
            signupError.style.display = 'block';
        }
        return;
    }

    if (selectedRole === 'farmer') {
        const certInput = document.getElementById('signupCertificate');
        if (!certInput || !certInput.files[0]) {
            if (signupError) {
                signupError.textContent = t('uploadCertReq') || 'Farmer registration requires an organic certificate upload.';
                signupError.style.display = 'block';
            }
            return;
        }
    }

    try {
        const response = await fetch('http://localhost:5003/api/signup/request-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, phone, name, role: selectedRole }),
        });

        const data = await response.json();

        if (response.ok) {
            signupOtpSessionId = data.sessionId;
            const otpSection = document.getElementById('signupOtpSection');
            const requestBtn = document.getElementById('signupRequestOtpBtn');
            const verifyBtn = document.getElementById('signupVerifyBtn');
            const otpMessage = document.getElementById('signupOtpMessage');

            if (otpSection) otpSection.style.display = 'block';
            if (requestBtn) requestBtn.innerHTML = '<i class="fas fa-sync-alt"></i> <span>Resend Email OTP</span>';
            if (verifyBtn) verifyBtn.style.display = 'inline-flex';

            if (otpMessage) {
                const debugParts = [];
                if (data.debugEmailOtp) debugParts.push(`Email OTP: ${data.debugEmailOtp}`);
                otpMessage.textContent = debugParts.length
                    ? `${data.message || 'Verification code sent.'} ${debugParts.join(' | ')}`
                    : (data.message || 'Verification code sent to your email address.');
                otpMessage.style.display = 'block';
            }

            if (signupError) {
                signupError.textContent = '';
                signupError.style.display = 'none';
            }
        } else {
            if (signupError) {
                signupError.textContent = data.message || data.error || t('signupFailed') || 'Signup failed.';
                signupError.style.display = 'block';
            }
        }
    } catch (error) {
        console.error('OTP request error:', error);
        if (signupError) {
            signupError.textContent = t('signupFailed') || 'Signup failed. Please try again.';
            signupError.style.display = 'block';
        }
    }
}

async function completeSignup(event) {
    if (event) event.preventDefault();

    const email = document.getElementById("signupEmail").value.trim();
    const phone = document.getElementById("signupPhone").value.trim();
    const name = document.getElementById("signupName").value.trim();
    const password = document.getElementById("signupPassword").value;
    const emailOtp = document.getElementById('signupEmailOtp').value.trim();
    const t = (key) => (window.translations && window.translations[localStorage.getItem('agroDirectLang') || 'en-US']) ? window.translations[localStorage.getItem('agroDirectLang') || 'en-US'][key] : key;
    const signupError = document.getElementById("signupError");
    const otpMessage = document.getElementById('signupOtpMessage');

    if (signupError) {
        signupError.textContent = "";
        signupError.style.display = "none";
    }

    if (!signupOtpSessionId) {
        if (signupError) {
            signupError.textContent = 'Please request OTPs first.';
            signupError.style.display = 'block';
        }
        return;
    }

    if (!emailOtp) {
        if (signupError) {
            signupError.textContent = 'Please enter the email OTP.';
            signupError.style.display = 'block';
        }
        return;
    }

    if (!email || !phone || !name || !password) {
        if (signupError) {
            signupError.textContent = t('fillAllFields') || 'Please fill in all fields';
            signupError.style.display = 'block';
        }
        return;
    }

    if (!isValidPhone(phone) || !isValidEmail(email) || !isValidName(name) || !isValidPassword(password)) {
        if (signupError) {
            signupError.textContent = t('signupFailed') || 'Please check the signup details and try again.';
            signupError.style.display = 'block';
        }
        return;
    }

    if (selectedRole === 'farmer') {
        const certInput = document.getElementById('signupCertificate');
        if (!certInput || !certInput.files[0]) {
            if (signupError) {
                signupError.textContent = t('uploadCertReq') || 'Farmer registration requires an organic certificate upload.';
                signupError.style.display = 'block';
            }
            return;
        }
    }

    const formData = new FormData();
    formData.append('sessionId', signupOtpSessionId);
    formData.append('email', email);
    formData.append('phone', phone);
    formData.append('name', name);
    formData.append('password', password);
    formData.append('role', selectedRole);
    formData.append('emailOtp', emailOtp);

    const certInput = document.getElementById('signupCertificate');
    if (selectedRole === 'farmer' && certInput && certInput.files[0]) {
        formData.append('certificate', certInput.files[0]);
    }

    try {
        const response = await fetch('http://localhost:5003/api/signup', {
            method: 'POST',
            body: formData,
        });

        const data = await response.json();

        if (response.ok) {
            toggleForm('loginForm');
            clearInputs();
            resetSignupOtpState();
            setTimeout(() => {
                const msg = document.getElementById('loginSuccessMsg');
                if (msg) {
                    msg.textContent = data.message || t('signupSuccess') || 'Account created successfully! Please log in.';
                    msg.style.display = 'block';
                }
            }, 300);
        } else {
            if (signupError) {
                signupError.textContent = data.message || data.error || t('signupFailed') || 'Signup failed.';
                signupError.style.display = 'block';
            }
            if (otpMessage) {
                otpMessage.textContent = '';
                otpMessage.style.display = 'none';
            }
        }
    } catch (error) {
        console.error('Signup completion error:', error);
        if (signupError) {
            signupError.textContent = t('signupFailed') || 'Signup failed. Please try again.';
            signupError.style.display = 'block';
        }
    }
}

async function recoverPassword(event) {
    if (event) event.preventDefault();
    const email = document.getElementById("recoverEmail").value.trim();
    const t = (key) => (window.translations && window.translations[localStorage.getItem('agroDirectLang') || 'en-US']) ? window.translations[localStorage.getItem('agroDirectLang') || 'en-US'][key] : key;
    const recoverError = document.getElementById("recoverError");
    if (recoverError) {
        recoverError.textContent = "";
        recoverError.style.display = "none";
    }

    if (!isValidEmail(email)) {
        if (recoverError) {
            recoverError.textContent = t('invalidEmail') || "Please enter a valid email address";
            recoverError.style.display = 'block';
        }
        return;
    }

    try {
        const response = await fetch('http://localhost:5003/api/recover', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
        });

        let data = null;
        if (response.ok) {
            data = await response.json();
            const successMsg = document.getElementById('recoverSuccessMsg');
            if (successMsg) {
                successMsg.textContent = t('recoverySent') || 'Password recovery instructions sent to your email';
                successMsg.style.display = 'block';
                // Optional: clear inputs but don't toggle form immediately so user can read it
                clearInputs();
                setTimeout(() => {
                    toggleForm('loginForm');
                    successMsg.style.display = 'none';
                    successMsg.textContent = '';
                }, 3000);
            } else {
                showSuccess(t('recoverySent') || 'Password recovery instructions sent to your email');
                toggleForm('loginForm');
                clearInputs();
            }
        } else {
            // Try to parse JSON, but fallback to generic error if not JSON
            try {
                data = await response.json();
            } catch (e) {
                data = {};
            }
            if (recoverError) {
                recoverError.textContent = (data && data.error) || t('recoveryFailed') || 'Password recovery failed';
                recoverError.style.display = 'block';
            } else {
                showError((data && data.error) || t('recoveryFailed') || 'Password recovery failed');
            }
        }
    } catch (error) {
        console.error('Error:', error);
        if (recoverError) {
            recoverError.textContent = t('recoveryFailed') || 'Password recovery failed. Please try again.';
            recoverError.style.display = 'block';
        } else {
            showError(t('recoveryFailed') || 'Password recovery failed. Please try again.');
        }
    }
}

// Attach to window for HTML onclick compatibility
window.setRole = setRole;
window.showAdminLogin = showAdminLogin;
window.toggleForm = toggleForm;
window.showRecover = showRecover;
window.login = login;
window.signup = signup;
window.completeSignup = completeSignup;
window.recoverPassword = recoverPassword;

document.addEventListener("DOMContentLoaded", function () {
    VoiceGuidance.init();

    const loginF = document.getElementById('loginForm');
    const signupF = document.getElementById('signupForm');
    const recoverF = document.getElementById('recoverForm');

    // These might not be needed if using onclick directly, 
    // but good to have as backup or for handling enter key
    if (loginF) loginF.addEventListener('submit', login);
    if (signupF) signupF.addEventListener('submit', signup);
    if (recoverF) recoverF.addEventListener('submit', recoverPassword);

    if (selectedRole === 'farmer') {
        VoiceGuidance.welcome();
    }
    
    // Load previous emails when page loads
    loadPreviousEmails();
});

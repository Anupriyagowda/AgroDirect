document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const resetForm = document.getElementById('passwordResetForm');
    const resetError = document.getElementById('resetError');
    const resetSuccess = document.getElementById('resetSuccess');
    
    // Redirect if no token
    if (!token) {
        resetError.textContent = "Invalid or missing reset token. Please request a new link.";
        resetError.style.display = 'block';
        resetForm.style.display = 'none';
        return;
    }

    resetForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        // Clear previous messages
        resetError.textContent = "";
        resetError.style.display = 'none';
        resetSuccess.textContent = "";
        resetSuccess.style.display = 'none';

        // Basic validation
        if (newPassword !== confirmPassword) {
            resetError.textContent = "Passwords do not match!";
            resetError.style.display = 'block';
            return;
        }

        if (newPassword.length < 6) {
            resetError.textContent = "Password must be at least 6 characters long.";
            resetError.style.display = 'block';
            return;
        }

        try {
            const response = await fetch(`/api/reset/${token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ newPassword })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                resetSuccess.textContent = "Password updated successfully! You can now login with your new password.";
                resetSuccess.style.display = 'block';
                resetForm.style.display = 'none';
                
                // Optional: Redirect to login after 3 seconds
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 3000);
            } else {
                resetError.textContent = data.message || "Failed to reset password. The link may have expired.";
                resetError.style.display = 'block';
            }
        } catch (error) {
            console.error('Error reset password:', error);
            resetError.textContent = "An error occurred. Please try again later.";
            resetError.style.display = 'block';
        }
    });
});

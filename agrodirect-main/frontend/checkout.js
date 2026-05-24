document.addEventListener('DOMContentLoaded', function () {
    checkAuthState();
    loadSavedAddress();
    setupAddressForm();
});

function checkAuthState() {
    const token = localStorage.getItem('agroToken');
    const userDropdown = document.getElementById('userDropdown');
    const loginButton = document.getElementById('loginButton');
    const userNameDisplay = document.getElementById('userNameDisplay');

    if (token) {
        userDropdown.style.display = 'block';
        loginButton.style.display = 'none';
        userNameDisplay.textContent = 'Account';
    } else {
        userDropdown.style.display = 'none';
        loginButton.style.display = 'block';
        window.location.href = 'index.html';
    }
}

async function loadSavedAddress() {
    const token = localStorage.getItem('agroToken');
    if (!token) return;

    try {
        const response = await fetch('/api/user/profile', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch user profile');
        }

        const userData = await response.json();
        if (userData.address) {
            let addr = userData.address;
            if (typeof addr === 'string') {
                try { addr = JSON.parse(addr); } catch(e) {}
            }
            displaySavedAddress(addr);
        }
    } catch (error) {
        console.error('Error loading address:', error);
        showErrorToast('Failed to load saved address');
    }
}

function displaySavedAddress(address) {
    const addressContainer = document.getElementById('savedAddresses');
    if (!addressContainer) return;

    const addressHTML = `
        <div class="saved-address mb-3">
            <div class="form-check">
                <input class="form-check-input" type="radio" name="addressSelection" id="savedAddress" checked>
                <label class="form-check-label" for="savedAddress">
                    <strong>${address.firstName || address.name || ''}${address.lastName ? ' ' + address.lastName : ''}</strong><br>
                    ${address.addressLine1 || ''}<br>
                    ${address.addressLine2 ? address.addressLine2 + '<br>' : ''}
                    ${address.city || ''}, ${address.state || ''} ${address.zipCode || ''}<br>
                    Phone: ${address.phone || ''}
                </label>
            </div>
            <button class="btn btn-sm btn-outline-primary mt-2" onclick="editAddress()">
                <i class="fas fa-edit"></i> Edit
            </button>
        </div>
    `;

    addressContainer.innerHTML = addressHTML;
}

function setupAddressForm() {
    const form = document.getElementById('deliveryAddressForm');
    if (!form) return;

    form.addEventListener('submit', handleAddressSubmit);
}

async function handleAddressSubmit(event) {
    event.preventDefault();

    const token = localStorage.getItem('agroToken');
    if (!token) {
        showErrorToast('Please login to continue');
        return;
    }

    const addressData = {
        firstName: document.getElementById('firstName').value,
        lastName: document.getElementById('lastName').value || '',
        phone: document.getElementById('phone').value,
        addressLine1: document.getElementById('addressLine1').value,
        addressLine2: document.getElementById('addressLine2').value,
        city: document.getElementById('city').value,
        state: document.getElementById('state').value,
        zipCode: document.getElementById('zipCode').value,
        deliveryInstructions: document.getElementById('deliveryInstructions').value
    };

    try {
        const response = await fetch('/api/user/address', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(addressData)
        });

        if (!response.ok) {
            throw new Error('Failed to save address');
        }

        showSuccessToast('Address saved successfully');
        window.location.href = 'confirmorder.html';
    } catch (error) {
        console.error('Error saving address:', error);
        showErrorToast('Failed to save address');
    }
}

function editAddress() {
    const token = localStorage.getItem('agroToken');
    if (!token) return;

    fetch('/api/user/profile', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
        .then(response => response.json())
        .then(userData => {
            if (userData.address) {
                let addr = userData.address;
                if (typeof addr === 'string') {
                    try { addr = JSON.parse(addr); } catch(e) {}
                }
                document.getElementById('firstName').value = addr.firstName || addr.name || '';
                document.getElementById('lastName').value = addr.lastName || '';
                document.getElementById('phone').value = addr.phone || '';
                document.getElementById('addressLine1').value = addr.addressLine1 || '';
                document.getElementById('addressLine2').value = addr.addressLine2 || '';
                document.getElementById('city').value = addr.city || '';
                document.getElementById('state').value = addr.state || '';
                document.getElementById('zipCode').value = addr.zipCode || '';
                document.getElementById('deliveryInstructions').value = addr.deliveryInstructions || '';
            }
        })
        .catch(error => {
            console.error('Error loading address:', error);
            showErrorToast('Failed to load address');
        });
}

function showSuccessToast(message) {
    Toastify({
        text: message,
        duration: 3000,
        gravity: "top",
        position: "right",
        backgroundColor: "#2e7d32",
    }).showToast();
}

function showErrorToast(message) {
    Toastify({
        text: message,
        duration: 3000,
        gravity: "top",
        position: "right",
        backgroundColor: "#d32f2f",
    }).showToast();
} 

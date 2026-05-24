function parseJwt(token) {
    try { return JSON.parse(atob(token.split('.')[1])); } catch (e) { return null; }
}

let pendingCancelOrderId = null;

function showOrderToast(message, variant = 'success') {
    const container = document.getElementById('orderToastContainer');
    if (!container) return;

    const toastId = `toast-${Date.now()}`;
    const textColor = variant === 'danger' ? 'text-bg-danger' : 'text-bg-success';

    container.insertAdjacentHTML('beforeend', `
        <div id="${toastId}" class="toast order-toast ${textColor}" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="d-flex">
                <div class="toast-body fw-semibold">${message}</div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        </div>
    `);

    const toastElement = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastElement, { delay: 2600 });
    toastElement.addEventListener('hidden.bs.toast', () => toastElement.remove());
    toast.show();
}

function openCancelOrderModal(orderId) {
    pendingCancelOrderId = orderId;
    const modalElement = document.getElementById('cancelOrderModal');
    const modal = bootstrap.Modal.getOrCreateInstance(modalElement);
    modal.show();
}

async function performCancelOrder() {
    const orderId = pendingCancelOrderId;
    if (!orderId) return;

    const token = localStorage.getItem('agroToken');
    if (!token) {
        showOrderToast('Please login again.', 'danger');
        return;
    }

    const confirmBtn = document.getElementById('confirmCancelBtn');
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> Cancelling...';

    try {
        const response = await fetch(`/api/orders/${orderId}/cancel`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Failed to cancel order');
        }

        const modalElement = document.getElementById('cancelOrderModal');
        bootstrap.Modal.getOrCreateInstance(modalElement).hide();
        showOrderToast('Order cancelled successfully');
        window.location.reload();
    } catch (error) {
        showOrderToast(error.message || 'Unable to cancel order', 'danger');
    } finally {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = '<i class="fas fa-times me-2"></i>Yes, Cancel';
        pendingCancelOrderId = null;
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('agroToken');
            window.location.href = '/index.html';
        });
    }

    const confirmCancelBtn = document.getElementById('confirmCancelBtn');
    if (confirmCancelBtn) {
        confirmCancelBtn.addEventListener('click', performCancelOrder);
    }

    document.addEventListener('click', (event) => {
        const cancelButton = event.target.closest('.cancel-order-btn');
        if (!cancelButton) return;
        openCancelOrderModal(cancelButton.dataset.orderId);
    });

    const cancelOrderModal = document.getElementById('cancelOrderModal');
    if (cancelOrderModal) {
        cancelOrderModal.addEventListener('hidden.bs.modal', () => {
            pendingCancelOrderId = null;
        });
    }

    const token = localStorage.getItem('agroToken');
    if (!token) {
        window.location.href = '/index.html';
        return;
    }

    const user = parseJwt(token);
    if (!user || (!user.id && user.role !== 'admin')) {
        alert('Invalid session. Please login again.');
        return;
    }

    try {
        const resp = await fetch(`/api/orders/user?email=${encodeURIComponent(user.email)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const orders = await resp.json();
        const container = document.getElementById('ordersContainer');

        if (!resp.ok) throw new Error(orders.error || 'Failed to load orders');

        if (orders.length === 0) {
            container.innerHTML = `
                <div class="text-center py-5 glass-order-card">
                    <i class="fas fa-shopping-basket text-success mb-3" style="font-size: 4rem; opacity: 0.5;"></i>
                    <h4 class="text-muted">You haven't placed any orders yet.</h4>
                    <a href="shopnow.html" class="btn btn-success mt-3 rounded-pill px-4">Start Shopping</a>
                </div>`;
            return;
        }

        let html = '';
        orders.forEach(order => {
            const status = (order.status || order.orderStatus || 'pending').toLowerCase();
            const date = new Date(order.orderDate).toLocaleString('en-IN', {
                day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
            });

            let progressWidth = '0%';
            let s1 = '', s2 = '', s3 = '', s4 = '';

            if (status === 'pending') { progressWidth = '15%'; s1 = 'active'; }
            else if (status === 'processing') { progressWidth = '50%'; s1 = 'completed'; s2 = 'active'; }
            else if (status === 'shipped') { progressWidth = '83%'; s1 = 'completed'; s2 = 'completed'; s3 = 'active'; }
            else if (status === 'delivered') { progressWidth = '100%'; s1 = 'completed'; s2 = 'completed'; s3 = 'completed'; s4 = 'completed'; }
            else if (status === 'cancelled') { progressWidth = '0%'; }

            const itemsHtml = order.items.map(i => `
                <div class="item-row">
                    <span><i class="fas fa-seedling text-success me-2"></i> ${i.name} (x${i.quantity})</span>
                    <span class="fw-semibold">₹${(i.price * i.quantity).toFixed(2)}</span>
                </div>
            `).join('');

            html += `
                <div class="glass-order-card">
                    <div class="d-flex justify-content-between align-items-center flex-wrap mb-4">
                        <div>
                            <h5 class="mb-1 text-dark fw-bold">Order #${order._id.substring(0, 8).toUpperCase()}</h5>
                            <small class="text-muted"><i class="far fa-calendar-alt"></i> ${date}</small>
                        </div>
                        <div class="text-end mt-2 mt-md-0">
                            <span class="order-header-badge">Total: ₹${Number(order.totalPrice || order.totalAmount || 0).toFixed(2)}</span>
                        </div>
                    </div>

                    ${status === 'cancelled' ? '<div class="order-cancelled-note"><i class="fas fa-ban me-2"></i>This order has been cancelled.</div>' : ''}

                    <div class="tracking-container position-relative">
                        <div class="progress-background">
                            <div class="progress-fill" style="width: ${progressWidth};"></div>
                        </div>
                        <div class="d-flex justify-content-between position-relative z-1">
                            <div class="tracking-step text-center ${s1}">
                                <div class="tracking-icon"><i class="fas fa-clipboard-list"></i></div>
                                <div class="tracking-label">Pending</div>
                            </div>
                            <div class="tracking-step text-center ${s2}">
                                <div class="tracking-icon"><i class="fas fa-box-open"></i></div>
                                <div class="tracking-label">Processing</div>
                            </div>
                            <div class="tracking-step text-center ${s3}">
                                <div class="tracking-icon"><i class="fas fa-shipping-fast"></i></div>
                                <div class="tracking-label">Shipped</div>
                            </div>
                            <div class="tracking-step text-center ${s4}">
                                <div class="tracking-icon"><i class="fas fa-check-circle"></i></div>
                                <div class="tracking-label">Delivered</div>
                            </div>
                        </div>
                    </div>

                    <div class="item-list mt-4">
                        <h6 class="text-secondary fw-bold mb-3"><i class="fas fa-shopping-bag me-1"></i> Order Items</h6>
                        ${itemsHtml}
                    </div>

                    ${status === 'pending' || status === 'processing' ? `
                        <div class="d-flex justify-content-end mt-4">
                            <button class="btn btn-outline-danger cancel-order-btn" type="button" data-order-id="${order.id || order._id}">
                                <i class="fas fa-times me-2"></i>Cancel Order
                            </button>
                        </div>
                    ` : ''}
                </div>
            `;
        });

        container.innerHTML = html;
    } catch (err) {
        console.error(err);
        const container = document.getElementById('ordersContainer');
        if (container) {
            container.innerHTML = `<div class="alert alert-danger shadow-sm">Failed to load tracking data: ${err.message}</div>`;
        }
    }
});

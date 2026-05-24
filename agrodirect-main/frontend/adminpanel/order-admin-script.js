$(document).ready(function() {
    $('#loadingSpinner').show();
    fetchAllOrders();
    
    function fetchAllOrders() {
        $.get('/api/all-orders', function(orders) {
            if (!orders || orders.length === 0) {
                $('#ordersContainer').html('<div class="alert alert-info">No orders found.</div>');
                $('#loadingSpinner').hide();
                return;
            }
            
            let html = '';
            orders.forEach(order => {
                html += `
                    <div class="section-card order-card mb-4">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <h3 class="section-title">
                                <i class="fas fa-receipt me-2"></i>
                                Order #${order.id}
                            </h3>
                            <span class="badge bg-primary">New Order</span>
                        </div>
                        
                        <div class="row mb-3">
                            <div class="col-md-6">
                                <p><strong><i class="fas fa-user me-2"></i>Customer:</strong> ${order.userName}</p>
                                <p><strong><i class="fas fa-map-marker-alt me-2"></i>Address:</strong> ${order.address}</p>
                            </div>
                            <div class="col-md-6">
                                <p><strong><i class="fas fa-calendar-alt me-2"></i>Date:</strong> ${order.timestamp}</p>
                                <p><strong><i class="fas fa-credit-card me-2"></i>Payment:</strong> ${order.paymentMethod}</p>
                            </div>
                        </div>
                        
                        <h5 class="mb-3"><i class="fas fa-box-open me-2"></i>Order Items</h5>
                        <div class="table-responsive">
                            <table class="table item-table">
                                <thead>
                                    <tr>
                                        <th>Item</th>
                                        <th>Quantity</th>
                                        <th>Price</th>
                                        <th>Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${order.items.map(item => `
                                        <tr>
                                            <td class="item-name">${item.name}</td>
                                            <td>${item.quantity} ${item.unit || 'units'}</td>
                                            <td>?${item.price.toFixed(2)}</td>
                                            <td>?${(item.price * item.quantity).toFixed(2)}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                        
                        <div class="d-flex justify-content-end mt-3">
                            <h4 class="me-3">Total: ?${order.totalAmount.toFixed(2)}</h4>
                        </div>
                    </div>
                `;
            });
            
            $('#ordersContainer').html(html);
            $('#loadingSpinner').hide();
            
        }).fail(function() {
            $('#ordersContainer').html('<div class="alert alert-danger">Error loading orders from backend.</div>');
            $('#loadingSpinner').hide();
        });
    }
});

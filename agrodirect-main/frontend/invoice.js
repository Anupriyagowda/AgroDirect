/**
 * Premium Invoice Rendering for AgroDirect
 * Displays a professional invoice after order placement.
 */

function renderInvoice(order) {
    const invoiceContainer = document.getElementById('invoiceSection') || document.createElement('div');
    if (!invoiceContainer.id) {
        invoiceContainer.id = 'invoiceSection';
        document.querySelector('.order-body').appendChild(invoiceContainer);
    }

    // Define styles for the invoice
    const style = document.createElement('style');
    style.innerHTML = `
        @media print {
            body * { visibility: hidden; }
            #invoiceSection, #invoiceSection * { visibility: visible; }
            #invoiceSection { position: absolute; left: 0; top: 0; width: 100%; }
            .no-print { display: none !important; }
        }
        .invoice-card {
            background: #fff;
            border: 1px solid #e0e0e0;
            border-radius: 12px;
            padding: 40px;
            margin-top: 30px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.05);
            font-family: 'Poppins', sans-serif;
            color: #333;
        }
        .invoice-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #e8f5e9;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .invoice-logo {
            font-size: 24px;
            font-weight: 700;
            color: #2e7d32;
        }
        .invoice-meta {
            text-align: right;
        }
        .invoice-id {
            font-size: 18px;
            font-weight: 600;
            color: #1b5e20;
        }
        .invoice-date {
            color: #777;
            font-size: 14px;
        }
        .invoice-details {
            display: flex;
            justify-content: space-between;
            margin-bottom: 40px;
        }
        .detail-group h6 {
            color: #2e7d32;
            text-transform: uppercase;
            font-size: 12px;
            letter-spacing: 1px;
            margin-bottom: 10px;
        }
        .detail-group p {
            margin: 0;
            font-size: 14px;
            line-height: 1.6;
        }
        .invoice-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
        }
        .invoice-table th {
            text-align: left;
            background: #f1f8f1;
            padding: 12px 15px;
            color: #1b5e20;
            font-size: 13px;
            text-transform: uppercase;
        }
        .invoice-table td {
            padding: 15px;
            border-bottom: 1px solid #eee;
            font-size: 14px;
        }
        .invoice-summary {
            width: 300px;
            margin-left: auto;
        }
        .summary-line {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            font-size: 14px;
        }
        .summary-total {
            border-top: 2px solid #2e7d32;
            margin-top: 10px;
            padding-top: 15px;
            font-weight: 700;
            font-size: 18px;
            color: #2e7d32;
        }
        .invoice-footer {
            margin-top: 50px;
            text-align: center;
            color: #aaa;
            font-size: 12px;
        }
        .btn-print {
            background-color: #2e7d32;
            color: white;
            border: none;
            padding: 10px 25px;
            border-radius: 30px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.3s;
            display: inline-flex;
            align-items: center;
            gap: 8px;
        }
        .btn-print:hover {
            background-color: #1b5e20;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(46, 125, 50, 0.2);
        }
    `;
    document.head.appendChild(style);

    const itemsHtml = order.items.map(item => `
        <tr>
            <td>${item.name}</td>
            <td>${item.quantity} ${item.unit || ''}</td>
            <td>₹${item.price.toFixed(2)}</td>
            <td style="text-align: right;">₹${(item.price * item.quantity).toFixed(2)}</td>
        </tr>
    `).join('');

    invoiceContainer.innerHTML = `
        <div class="invoice-card">
            <div class="invoice-header">
                <div class="invoice-logo">🌿 AgroDirect</div>
                <div class="invoice-meta">
                    <div class="invoice-id">INVOICE #${order.id || order.orderId}</div>
                    <div class="invoice-date">${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                </div>
            </div>

            <div class="invoice-details">
                <div class="detail-group">
                    <h6>Billed To</h6>
                    <p><strong>${order.customerName || 'Customer'}</strong></p>
                    <p>${order.deliveryAddress || 'Registered Address'}</p>
                </div>
                <div class="detail-group" style="text-align: right;">
                    <h6>Payment Method</h6>
                    <p>${order.paymentMethod || 'Online'}</p>
                    <h6>Order Status</h6>
                    <p><span class="badge bg-success">Confirmed</span></p>
                </div>
            </div>

            <table class="invoice-table">
                <thead>
                    <tr>
                        <th>Product</th>
                        <th>Quantity</th>
                        <th>Unit Price</th>
                        <th style="text-align: right;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHtml}
                </tbody>
            </table>

            <div class="invoice-summary">
                <div class="summary-line">
                    <span>Subtotal:</span>
                    <span>₹${order.totalAmount.toFixed(2)}</span>
                </div>
                <div class="summary-line">
                    <span>Tax (GST 5%):</span>
                    <span>Included</span>
                </div>
                <div class="summary-line">
                    <span>Delivery Charge:</span>
                    <span style="color: #2e7d32;">FREE</span>
                </div>
                <div class="summary-line summary-total">
                    <span>Grand Total:</span>
                    <span>₹${order.totalAmount.toFixed(2)}</span>
                </div>
            </div>

            <div class="text-center mt-5 no-print">
                <button class="btn-print" onclick="window.print()">
                    <i class="fas fa-print"></i> Print Invoice
                </button>
            </div>

            <div class="invoice-footer">
                <p>Thank you for shopping with AgroDirect! We support sustainable and organic farming.</p>
                <p>Kolara, Karnataka | +91 8660898160 | agrodirectt@gmail.com</p>
            </div>
        </div>
    `;

    // Smooth scroll to invoice
    invoiceContainer.scrollIntoView({ behavior: 'smooth' });
}

window.renderInvoice = renderInvoice;

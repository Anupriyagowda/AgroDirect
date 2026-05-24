const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: process.env.EMAIL_PORT == 465, // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

/**
 * Send an email using the configured transporter.
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} html - HTML body content
 */
const sendEmail = async (to, subject, html) => {
    try {
        const mailOptions = {
            from: `"Agro-Direct" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            html
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`[EMAIL] Sent: ${info.messageId} to ${to}`);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error(`[EMAIL ERROR] Failed to send to ${to}:`, error.message);
        return { success: false, error: error.message };
    }
};

/**
 * Template for Farmer Approval notification.
 */
const sendFarmerApprovalEmail = async (email, name) => {
    const subject = 'Your Agro-Direct Farmer Account is Approved!';
    const html = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 10px; overflow: hidden;">
            <div style="background-color: #2E5A1C; padding: 20px; text-align: center; color: white;">
                <h1 style="margin: 0;">Agro-Direct</h1>
            </div>
            <div style="padding: 30px;">
                <h2>Congratulations, ${name}!</h2>
                <p>We are excited to inform you that your farmer account on <strong>Agro-Direct</strong> has been successfully verified and approved by our administrator.</p>
                <p>You can now log in to your dashboard to:</p>
                <ul style="list-style-type: none; padding-left: 0;">
                    <li>✅ List your fresh produce for sale</li>
                    <li>✅ Manage your product availability</li>
                    <li>✅ View and track your orders</li>
                </ul>
                <div style="text-align: center; margin: 40px 0;">
                    <a href="http://localhost:5003/index.html" style="background-color: #4CAF50; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Login to Dashboard</a>
                </div>
                <p>Thank you for joining our community and helping us connect fresh produce directly to consumers.</p>
                <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;">
                <p style="font-size: 12px; color: #777; text-align: center;">This is an automated message, please do not reply directly to this email.</p>
            </div>
        </div>
    `;
    return sendEmail(email, subject, html);
};

/**
 * Template for signup OTP verification.
 */
const sendSignupOtpEmail = async (email, name, otp) => {
    const subject = 'Your Agro-Direct verification code';
    const html = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 10px; overflow: hidden;">
            <div style="background-color: #2E5A1C; padding: 20px; text-align: center; color: white;">
                <h1 style="margin: 0;">Agro-Direct</h1>
            </div>
            <div style="padding: 30px;">
                <h2>Verify your registration</h2>
                <p>Hello ${name || 'there'},</p>
                <p>Use the following code to verify your email address while creating your Agro-Direct account:</p>
                <div style="margin: 30px 0; text-align: center;">
                    <div style="display: inline-block; padding: 14px 22px; background: #e8f5e9; color: #1b5e20; font-size: 28px; letter-spacing: 6px; font-weight: bold; border-radius: 10px; border: 1px solid #c8e6c9;">${otp}</div>
                </div>
                <p>This code expires in 10 minutes. If you did not request this, you can ignore this message.</p>
            </div>
        </div>
    `;
    return sendEmail(email, subject, html);
};

/**
 * Template for Password Reset link.
 */
const sendPasswordResetEmail = async (email, resetLink) => {
    const subject = 'Reset Your Agro-Direct Password';
    const html = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 10px; overflow: hidden;">
            <div style="background-color: #2E5A1C; padding: 20px; text-align: center; color: white;">
                <h1 style="margin: 0;">Agro-Direct</h1>
            </div>
            <div style="padding: 30px;">
                <h2>Password Reset Request</h2>
                <p>Hello,</p>
                <p>We received a request to reset the password for your Agro-Direct account. If you didn't make this request, you can safely ignore this email.</p>
                <p>To reset your password, please click the button below. This link will expire in <strong>15 minutes</strong> for security reasons.</p>
                <div style="text-align: center; margin: 40px 0;">
                    <a href="${resetLink}" style="background-color: #4CAF50; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Reset Password</a>
                </div>
                <p>If the button doesn't work, you can copy and paste the following link into your browser:</p>
                <p style="word-break: break-all; color: #2E5A1C;">${resetLink}</p>
                <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;">
                <p style="font-size: 12px; color: #777; text-align: center;">For security, never share this link with anyone else.</p>
            </div>
        </div>
    `;
    return sendEmail(email, subject, html);
};

/**
 * Template for Order Confirmation.
 */
const sendOrderConfirmationEmail = async (email, order) => {
    const subject = `Order Confirmed - #${order.id}`;
    
    // Safety parse variables to ensure .toFixed() doesn't fail on strings
    const safeTotal = parseFloat(order.totalPrice) || 0;

    const itemsHtml = order.items.map(item => {
        const p = parseFloat(item.price) || 0;
        const q = parseFloat(item.quantity) || 1;
        return `
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.name}</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">₹${p.toFixed(2)}</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">₹${(p * q).toFixed(2)}</td>
        </tr>
    `}).join('');

    const html = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 650px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
            <div style="background-color: #2E5A1C; padding: 25px; text-align: center; color: white;">
                <h1 style="margin: 0; font-size: 28px; letter-spacing: 1px;">Agro-Direct</h1>
                <p style="margin: 5px 0 0; opacity: 0.8;">Fresh From the Farm to Your Door</p>
            </div>
            <div style="padding: 30px;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <div style="display: inline-block; background-color: #e8f5e9; color: #2E5A1C; padding: 10px 20px; border-radius: 20px; font-weight: bold; font-size: 14px;">ORDER CONFIRMED</div>
                    <h2 style="margin: 15px 0 5px; color: #1b5e20;">Thank you for your order!</h2>
                    <p style="color: #666;">We've received your order and are getting it ready for delivery.</p>
                </div>

                <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
                    <table style="width: 100%; font-size: 14px;">
                        <tr>
                            <td style="color: #888;">Order Number:</td>
                            <td style="text-align: right; font-weight: bold;">#${order.id}</td>
                        </tr>
                        <tr>
                            <td style="color: #888;">Order Date:</td>
                            <td style="text-align: right;">${new Date(order.orderDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</td>
                        </tr>
                        <tr>
                            <td style="color: #888;">Payment Method:</td>
                            <td style="text-align: right;">${order.paymentMethod}</td>
                        </tr>
                    </table>
                </div>

                <h3 style="border-bottom: 2px solid #e8f5e9; padding-bottom: 10px; color: #2E5A1C;">Order Summary</h3>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                    <thead>
                        <tr style="background-color: #f1f8f1; font-size: 13px; text-transform: uppercase; color: #555;">
                            <th style="padding: 10px; text-align: left;">Product</th>
                            <th style="padding: 10px; text-align: center;">Qty</th>
                            <th style="padding: 10px; text-align: right;">Price</th>
                            <th style="padding: 10px; text-align: right;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="3" style="padding: 20px 10px 5px; text-align: right; color: #888;">Subtotal:</td>
                            <td style="padding: 20px 10px 5px; text-align: right; font-weight: bold;">₹${safeTotal.toFixed(2)}</td>
                        </tr>
                        <tr>
                            <td colspan="3" style="padding: 5px 10px; text-align: right; color: #888;">Delivery Fee:</td>
                            <td style="padding: 5px 10px; text-align: right; color: #2E5A1C; font-weight: bold;">FREE</td>
                        </tr>
                        <tr style="font-size: 18px;">
                            <td colspan="3" style="padding: 15px 10px; text-align: right; font-weight: bold; color: #1b5e20;">Total Amount:</td>
                            <td style="padding: 15px 10px; text-align: right; font-weight: bold; color: #1b5e20; border-top: 2px solid #2E5A1C;">₹${safeTotal.toFixed(2)}</td>
                        </tr>
                    </tfoot>
                </table>

                <div style="margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
                    <h3 style="color: #2E5A1C; margin-bottom: 10px;">Delivery Details</h3>
                    <p style="margin: 0; font-size: 14px; color: #555;">
                        <strong>Address:</strong><br>
                        ${order.deliveryAddress || 'Standard Delivery Address'}
                    </p>
                </div>

                <div style="text-align: center; margin: 40px 0 20px;">
                    <p style="font-size: 14px; color: #888;">Have questions? Contact us at <a href="mailto:support@agrodirect.com" style="color: #2E5A1C; text-decoration: none;">support@agrodirect.com</a></p>
                    <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                    <p style="font-size: 12px; color: #aaa;">&copy; 2026 Agro-Direct. All rights reserved.</p>
                </div>
            </div>
        </div>
    `;
    return sendEmail(email, subject, html);
};

/**
 * Template for New Order Notification to Farmer.
 */
const sendNewOrderNotificationToFarmer = async (farmerEmail, orderId, farmerItems) => {
    const subject = `New Order Received - Order #${orderId}`;
    const itemsHtml = farmerItems.map(item => {
        const p = parseFloat(item.price) || 0;
        return `
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.name}</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity} ${item.unit || ''}</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">₹${p.toFixed(2)}</td>
        </tr>
    `}).join('');

    const html = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 650px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
            <div style="background-color: #1b5e20; padding: 25px; text-align: center; color: white;">
                <h1 style="margin: 0; font-size: 24px;">New Order Alert!</h1>
                <p style="margin: 5px 0 0; opacity: 0.8;">Agro-Direct Seller Notification</p>
            </div>
            <div style="padding: 30px;">
                <h2>Hello Seller,</h2>
                <p>You have received a new order for your products on Agro-Direct. Please review the details below and prepare for fulfillment.</p>
                
                <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 0;"><strong>Order ID:</strong> #${orderId}</p>
                    <p style="margin: 5px 0 0;"><strong>Status:</strong> Pending Fulfillment</p>
                </div>

                <h3 style="color: #1b5e20; border-bottom: 2px solid #e8f5e9; padding-bottom: 10px;">Products for You to Fulfill:</h3>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                    <thead>
                        <tr style="background-color: #f1f8f1; font-size: 13px; text-transform: uppercase; color: #555;">
                            <th style="padding: 10px; text-align: left;">Product</th>
                            <th style="padding: 10px; text-align: center;">Qty</th>
                            <th style="padding: 10px; text-align: right;">Price</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                </table>

                <div style="background-color: #fff8e1; border-left: 5px solid #ffc107; padding: 15px; margin: 30px 0; border-radius: 4px;">
                    <p style="margin: 0; font-weight: bold; color: #856404;">Action Required:</p>
                    <p style="margin: 5px 0 0; font-size: 14px; color: #856404;">Please log in to your dashboard to complete this order and update its fulfillment status. Customers appreciate prompt delivery!</p>
                </div>

                <div style="text-align: center; margin: 40px 0;">
                    <a href="http://localhost:5003/index.html" style="background-color: #2e7d32; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">Go to Farmer Dashboard</a>
                </div>

                <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;">
                <p style="font-size: 12px; color: #999; text-align: center;">This is an automated notification from the Agro-Direct Platform.</p>
            </div>
        </div>
    `;
    return sendEmail(farmerEmail, subject, html);
};

/**
 * Template for Order Status Update Notification.
 */
const sendOrderStatusUpdateEmail = async (userEmail, orderId, status) => {
    const subject = `Order Update - #${orderId} is now ${status.toUpperCase()}`;
    const html = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 650px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
            <div style="background-color: #2E5A1C; padding: 25px; text-align: center; color: white;">
                <h1 style="margin: 0; font-size: 24px;">Order Status Update</h1>
                <p style="margin: 5px 0 0; opacity: 0.8;">Agro-Direct Notification</p>
            </div>
            <div style="padding: 30px;">
                <h2>Hello,</h2>
                <p>The status of your order <strong>#${orderId}</strong> has been updated by the seller.</p>
                
                <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 5px solid #2E5A1C;">
                    <p style="margin: 0; font-size: 16px;">New Status: <strong style="font-size: 18px; text-transform: uppercase; color: #2E5A1C;">${status}</strong></p>
                </div>

                <p>You can log in to your Agro-Direct account to view the full details of your order.</p>

                <div style="text-align: center; margin: 40px 0;">
                    <a href="http://localhost:5003/index.html" style="background-color: #4CAF50; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">View Order Details</a>
                </div>

                <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;">
                <p style="font-size: 12px; color: #999; text-align: center;">This is an automated notification from the Agro-Direct Platform.</p>
            </div>
        </div>
    `;
    return sendEmail(userEmail, subject, html);
};

module.exports = {
    sendEmail,
    sendFarmerApprovalEmail,
    sendSignupOtpEmail,
    sendPasswordResetEmail,
    sendOrderConfirmationEmail,
    sendNewOrderNotificationToFarmer,
    sendOrderStatusUpdateEmail
};

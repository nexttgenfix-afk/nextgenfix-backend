const nodemailer = require('nodemailer');

// Create transporter
let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    console.warn('Email credentials not configured. Email service is in mock mode.');
    return null;
  }
  
  transporter = nodemailer.createTransporter({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });
  
  return transporter;
}

module.exports = {
  /**
   * Send email
   * @param {String} to - Recipient email
   * @param {String} subject - Email subject
   * @param {String} html - Email HTML content
   * @returns {Object} Send result
   */
  async sendEmail(to, subject, html) {
    const transport = getTransporter();
    
    if (!transport) {
      console.log('[MOCK] Sending email:', { to, subject });
      return { success: true, messageId: `mock-${Date.now()}`, message: 'Email sent (MOCK)' };
    }
    
    try {
      const info = await transport.sendMail({
        from: process.env.EMAIL_FROM || 'NextGenFix <noreply@nextgenfix.com>',
        to,
        subject,
        html
      });
      
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Email send error:', error);
      throw error;
    }
  },

  /**
   * Send welcome email to new user
   * @param {Object} user - User object
   * @returns {Object} Send result
   */
  async sendWelcomeEmail(user) {
    const html = `
      <h1>Welcome to NextGenFix!</h1>
      <p>Hi ${user.name || 'there'},</p>
      <p>Thank you for joining NextGenFix. We're excited to serve you delicious food!</p>
      <p>Your referral code: <strong>${user.referralCode}</strong></p>
      <p>Share this code with friends and both of you get rewards!</p>
      <p>Happy ordering!</p>
      <p>- The NextGenFix Team</p>
    `;
    
    return await this.sendEmail(user.email, 'Welcome to NextGenFix!', html);
  },

  /**
   * Send order confirmation email
   * @param {Object} order - Order object
   * @param {Object} user - User object
   * @returns {Object} Send result
   */
  async sendOrderConfirmation(order, user) {
    const html = `
      <h1>Order Confirmed!</h1>
      <p>Hi ${user.name},</p>
      <p>Your order #${order._id} has been confirmed.</p>
      <p><strong>Order Type:</strong> ${order.orderType}</p>
      <p><strong>Total Amount:</strong> ₹${order.finalAmount}</p>
      <p>We'll notify you when your order is ready.</p>
      <p>Thank you for ordering with NextGenFix!</p>
    `;
    
    return await this.sendEmail(user.email, `Order Confirmation #${order._id}`, html);
  },

  /**
   * Send password reset email
   * @param {String} email - User email
   * @param {String} resetToken - Reset token
   * @returns {Object} Send result
   */
  async sendPasswordResetEmail(email, resetToken) {
    const resetUrl = `${process.env.APP_URL}/reset-password?token=${resetToken}`;
    
    const html = `
      <h1>Password Reset Request</h1>
      <p>You requested a password reset for your NextGenFix account.</p>
      <p>Click the link below to reset your password:</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>This link will expire in 1 hour.</p>
      <p>If you didn't request this, please ignore this email.</p>
    `;
    
    return await this.sendEmail(email, 'Password Reset Request', html);
  },

  /**
   * Send order receipt email
   * @param {Object} order - Order object
   * @param {Object} user - User object
   * @returns {Object} Send result
   */
  async sendReceiptEmail(order, user) {
    const itemsList = order.items.map(item => 
      `<li>${item.quantity}x ${item.name} - ₹${item.price * item.quantity}</li>`
    ).join('');
    
    const html = `
      <h1>Order Receipt</h1>
      <p>Hi ${user.name},</p>
      <p><strong>Order #${order._id}</strong></p>
      <p><strong>Date:</strong> ${new Date(order.createdAt).toLocaleString()}</p>
      <h3>Items:</h3>
      <ul>${itemsList}</ul>
      <p><strong>Subtotal:</strong> ₹${order.subtotal}</p>
      <p><strong>Tax:</strong> ₹${order.taxAmount}</p>
      <p><strong>Delivery:</strong> ₹${order.deliveryCharges || 0}</p>
      <p><strong>Discount:</strong> -₹${order.tierDiscount + order.couponDiscount}</p>
      <h3>Total: ₹${order.finalAmount}</h3>
      <p>Thank you for your order!</p>
    `;
    
    return await this.sendEmail(user.email, `Receipt for Order #${order._id}`, html);
  }
};

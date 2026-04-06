const Razorpay = require('razorpay');

class RazorpayService {
  constructor() {
    if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
      this.razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET
      });
    } else {
      console.warn('⚠️ Razorpay credentials missing from .env. Payments will fail.');
      this.razorpay = null;
    }
  }

  /**
   * Create a single-use payment link
   */
  async createPaymentLink(phone, amount, description, metadata = {}) {
    if (!this.razorpay) {
      throw new Error('Razorpay is not configured. Check environment variables.');
    }
    try {
      // Amount in paise (1 INR = 100 paise)
      const amountInPaise = Math.round(amount * 100);
      
      const payload = {
        amount: amountInPaise,
        currency: 'INR',
        accept_partial: false,
        description: description,
        customer: {
          name: metadata.customerName || 'Customer',
          contact: phone,
          email: metadata.email || ''
        },
        notify: {
          sms: false,
          email: false
        },
        reminder_enable: true,
        notes: {
          ...metadata,
          source: 'whatsapp_bot'
        },
        callback_url: `${process.env.API_URL}/api/whatsapp/razorpay-callback`,
        callback_method: 'get'
      };

      const response = await this.razorpay.paymentLink.create(payload);
      return response;
    } catch (error) {
      console.error('RazorpayService.createPaymentLink Error:', error);
      throw error;
    }
  }

  /**
   * Static method to verify webhook signature
   */
  static verifyWebhookSignature(payload, signature) {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    return Razorpay.validateWebhookSignature(payload, signature, secret);
  }
}

module.exports = new RazorpayService();

const axios = require('axios');

/**
 * Help send formatted messages via MSG91 WhatsApp Outbound API
 */
class WhatsappSender {
  static getApiUrl(isInteractive = false) {
    // MSG91 /bulk endpoint ONLY supports templates. 
    // For Buttons/Lists (interactive), we MUST use the single message endpoint.
    if (isInteractive) {
      return 'https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/';
    }
    return process.env.MSG91_WHATSAPP_API_URL || 'https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/';
  }

  static getHeaders() {
    return {
      'Content-Type': 'application/json',
      authkey: process.env.MSG91_AUTHKEY
    };
  }

  /**
   * Send a simple text message
   */
  static async sendText(phone, text) {
    const payload = {
      recipient_number: phone.replace(/^\+/, '').replace(/\s+/g, ''),
      integrated_number: process.env.MSG91_INTEGRATED_NUMBER,
      content_type: 'text',
      text: { body: text }
    };

    try {
      // Text messages work on single endpoint
      const response = await axios.post(this.getApiUrl(true), payload, { headers: this.getHeaders() });
      return response.data;
    } catch (error) {
      console.error('WhatsappSender.sendText Error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Send a message with Quick Reply buttons (max 3)
   */
  static async sendButtons(phone, bodyText, buttons, footerText = '') {
    const payload = {
      recipient_number: phone.replace(/^\+/, '').replace(/\s+/g, ''),
      integrated_number: process.env.MSG91_INTEGRATED_NUMBER,
      content_type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: bodyText },
        footer: { text: footerText },
        action: {
          buttons: buttons.map((btn, index) => ({
            type: 'reply',
            reply: {
              id: btn.id || `btn_${index}`,
              title: btn.title
            }
          }))
        }
      }
    };

    try {
      // Interactive messages MUST use the single message endpoint
      const response = await axios.post(this.getApiUrl(true), payload, { headers: this.getHeaders() });
      return response.data;
    } catch (error) {
      console.error('WhatsappSender.sendButtons Error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Send a List message (helpful for menu categories or items)
   */
  static async sendList(phone, bodyText, buttonText, sections, headerText = '', footerText = '') {
    const payload = {
      recipient_number: phone.replace(/^\+/, '').replace(/\s+/g, ''),
      integrated_number: process.env.MSG91_INTEGRATED_NUMBER,
      content_type: 'interactive',
      interactive: {
        type: 'list',
        header: headerText ? { type: 'text', text: headerText } : undefined,
        body: { text: bodyText },
        footer: { text: footerText },
        action: {
          button: buttonText,
          sections: sections
        }
      }
    };

    try {
      // Interactive messages MUST use the single message endpoint
      const response = await axios.post(this.getApiUrl(true), payload, { headers: this.getHeaders() });
      return response.data;
    } catch (error) {
      console.error('WhatsappSender.sendList Error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Send Location Request
   */
  static async sendLocationRequest(phone, bodyText = 'Please share your location') {
    const payload = {
      recipient_number: phone.replace(/^\+/, '').replace(/\s+/g, ''),
      integrated_number: process.env.MSG91_INTEGRATED_NUMBER,
      content_type: 'interactive',
      interactive: {
        type: 'location_request_message',
        body: { text: bodyText },
        action: { name: 'send_location' }
      }
    };

    try {
      const response = await axios.post(this.getApiUrl(true), payload, { headers: this.getHeaders() });
      return response.data;
    } catch (error) {
      console.error('WhatsappSender.sendLocationRequest Error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Send Payment Link via MSG91 WhatsApp Outbound API
   * Note: This is different from Razorpay payment links.
   * This uses MSG91's structured payment message if available.
   */
  static async sendPaymentMessage(phone, bodyText, items, footerText = '') {
    const payload = {
      recipient_number: phone.replace(/^\+/, '').replace(/\s+/g, ''),
      integrated_number: process.env.MSG91_INTEGRATED_NUMBER,
      content_type: 'interactive',
      interactive: {
        type: 'payment_link',
        body: { text: bodyText },
        footer: { text: footerText },
        items: items.map(item => ({
          name: item.name,
          amount: item.amount.toString(),
          quantity: item.quantity.toString()
        }))
      }
    };

    try {
      const response = await axios.post(this.getApiUrl(true), payload, { headers: this.getHeaders() });
      return response.data;
    } catch (error) {
      console.error('WhatsappSender.sendPaymentMessage Error:', error.response?.data || error.message);
      throw error;
    }
  }
}

module.exports = WhatsappSender;

const axios = require('axios');

/**
 * Help send formatted messages via MSG91 WhatsApp Outbound API
 */
class WhatsappSender {
  static getPayloadBase(phone) {
    return {
      integrated_number: process.env.MSG91_INTEGRATED_NUMBER,
      content_type: 'template', // Default, will change for interactive
      payload: {
        messaging_product: 'whatsapp',
        to: [phone.replace(/^\+/, '').replace(/\s+/g, '')]
      }
    };
  }

  static getApiUrl() {
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
      integrated_number: process.env.MSG91_INTEGRATED_NUMBER,
      content_type: 'text',
      payload: {
        messaging_product: 'whatsapp',
        type: 'text',
        text: { body: text },
        to: [phone.replace(/^\+/, '').replace(/\s+/g, '')]
      }
    };

    try {
      const response = await axios.post(this.getApiUrl(), payload, { headers: this.getHeaders() });
      return response.data;
    } catch (error) {
      console.error('WhatsappSender.sendText Error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Send a message with Quick Reply buttons (max 3)
   */
  static async sendButtons(phone, bodyText, buttons) {
    const payload = {
      integrated_number: process.env.MSG91_INTEGRATED_NUMBER,
      content_type: 'interactive',
      payload: {
        messaging_product: 'whatsapp',
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: bodyText },
          action: {
            buttons: buttons.map((btn, index) => ({
              type: 'reply',
              reply: {
                id: btn.id || `btn_${index}`,
                title: btn.title
              }
            }))
          }
        },
        to: [phone.replace(/^\+/, '').replace(/\s+/g, '')]
      }
    };

    try {
      const response = await axios.post(this.getApiUrl(), payload, { headers: this.getHeaders() });
      return response.data;
    } catch (error) {
      console.error('WhatsappSender.sendButtons Error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Send a List message (helpful for menu categories or items)
   */
  static async sendList(phone, bodyText, buttonText, sections) {
    const payload = {
      integrated_number: process.env.MSG91_INTEGRATED_NUMBER,
      content_type: 'interactive',
      payload: {
        messaging_product: 'whatsapp',
        type: 'interactive',
        interactive: {
          type: 'list',
          body: { text: bodyText },
          action: {
            button: buttonText,
            sections: sections
          }
        },
        to: [phone.replace(/^\+/, '').replace(/\s+/g, '')]
      }
    };

    try {
      const response = await axios.post(this.getApiUrl(), payload, { headers: this.getHeaders() });
      return response.data;
    } catch (error) {
      console.error('WhatsappSender.sendList Error:', error.response?.data || error.message);
      throw error;
    }
  }
}

module.exports = WhatsappSender;

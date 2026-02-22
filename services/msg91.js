const axios = require('axios');

/**
 * Send WhatsApp OTP via MSG91's WhatsApp Outbound (Bulk) API
 * @param {string} phone - Phone number (will be formatted to E.164 without '+')
 * @param {string} otp - 6-digit OTP string
 */
const sendWhatsappOtp = async (phone, otp) => {
  // Format to E.164 without '+' (e.g. 919876543210)
  const formattedPhone = phone.replace(/^\+/, '').replace(/\s+/g, '');

  const payload = {
    integrated_number: process.env.MSG91_INTEGRATED_NUMBER,
    content_type: 'template',
    payload: {
      messaging_product: 'whatsapp',
      type: 'template',
      template: {
        name: 'otp_verification',
        language: { code: 'en', policy: 'deterministic' },
        namespace: process.env.MSG91_TEMPLATE_NAMESPACE,
        to_and_components: [
          {
            to: [formattedPhone],
            components: {
              body_1: { type: 'text', value: otp },
              button_1: { subtype: 'url', type: 'text', value: otp }
            }
          }
        ]
      }
    }
  };

  const apiUrl =
    process.env.MSG91_WHATSAPP_API_URL ||
    'https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/';

  try {
    const response = await axios.post(apiUrl, payload, {
      headers: {
        'Content-Type': 'application/json',
        authkey: process.env.MSG91_AUTHKEY
      }
    });

    console.log('MSG91 WhatsApp OTP sent:', response.data);
    return { success: true };
  } catch (error) {
    const errMsg =
      error.response?.data?.message ||
      error.response?.data ||
      error.message ||
      'Unknown MSG91 error';
    console.error('MSG91 WhatsApp OTP error:', errMsg);
    throw new Error(`MSG91 WhatsApp OTP failed: ${errMsg}`);
  }
};

module.exports = { sendWhatsappOtp };

/**
 * Payment Service - Placeholder for PhonePe Integration
 * This service provides mock implementations for development
 * Replace with actual PhonePe SDK calls when credentials are available
 */

module.exports = {
  /**
   * Initiate payment transaction
   * @param {String} orderId - Order ID
   * @param {Number} amount - Amount in INR
   * @param {Object} userInfo - User information
   * @returns {Object} Payment transaction details
   */
  async initiatePayment(orderId, amount, userInfo = {}) {
    console.log('[MOCK] Initiating payment:', { orderId, amount, userInfo });
    
    // MOCK: Return fake transaction
    return {
      success: true,
      transactionId: `TXN${Date.now()}`,
      paymentUrl: `https://mock-phonepe.com/pay?txn=TXN${Date.now()}`,
      message: 'Payment initiated (MOCK)',
      orderId,
      amount
    };
  },

  /**
   * Verify payment status
   * @param {String} transactionId - PhonePe transaction ID
   * @returns {Object} Payment status
   */
  async verifyPayment(transactionId) {
    console.log('[MOCK] Verifying payment:', transactionId);
    
    // MOCK: Return success
    return {
      success: true,
      status: 'completed',
      transactionId,
      message: 'Payment verified (MOCK)'
    };
  },

  /**
   * Process refund
   * @param {String} transactionId - Original transaction ID
   * @param {Number} amount - Refund amount
   * @returns {Object} Refund status
   */
  async refundPayment(transactionId, amount) {
    console.log('[MOCK] Processing refund:', { transactionId, amount });
    
    // MOCK: Return success
    return {
      success: true,
      refundId: `REF${Date.now()}`,
      transactionId,
      amount,
      message: 'Refund processed (MOCK)',
      status: 'completed'
    };
  },

  /**
   * Get payment status
   * @param {String} transactionId - Transaction ID
   * @returns {Object} Payment status
   */
  async getPaymentStatus(transactionId) {
    console.log('[MOCK] Getting payment status:', transactionId);
    
    // MOCK: Return success status
    return {
      success: true,
      transactionId,
      status: 'completed',
      message: 'Payment status retrieved (MOCK)'
    };
  },

  /**
   * Handle PhonePe callback
   * @param {Object} callbackData - Callback data from PhonePe
   * @returns {Object} Processed callback result
   */
  async handleCallback(callbackData) {
    console.log('[MOCK] Handling payment callback:', callbackData);
    
    // MOCK: Return success
    return {
      success: true,
      verified: true,
      message: 'Callback processed (MOCK)',
      data: callbackData
    };
  }
};

const Payment = require('../models/paymentModel');
const Order = require('../models/orderModel');
const mongoose = require('mongoose');
const crypto = require('crypto');
const axios = require('axios');

// PhonePe configuration
const PHONEPE_MERCHANT_ID = process.env.PHONEPE_MERCHANT_ID || 'MERCHANTUAT';
const PHONEPE_SALT_KEY = process.env.PHONEPE_SALT_KEY || '099eb0cd-02cf-4e2a-8aca-3e6c6aff0399';
const PHONEPE_SALT_INDEX = process.env.PHONEPE_SALT_INDEX || '1';
const PHONEPE_API_URL = process.env.PHONEPE_API_URL || 'https://api-preprod.phonepe.com/apis/pg-sandbox';
const PHONEPE_CALLBACK_URL = process.env.PHONEPE_CALLBACK_URL || 'http://localhost:5000/api/payments/phonepe/callback';
const PHONEPE_REDIRECT_URL = process.env.PHONEPE_REDIRECT_URL || 'http://localhost:3000/payment-status';

/**
 * Generate PhonePe checksum
 */
const generatePhonePeChecksum = (payload) => {
  const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');
  const string = base64Payload + '/pg/v1/pay' + PHONEPE_SALT_KEY;
  const sha256 = crypto.createHash('sha256').update(string).digest('hex');
  return sha256 + '###' + PHONEPE_SALT_INDEX;
};

/**
 * Verify PhonePe checksum
 */
const verifyPhonePeChecksum = (response, receivedChecksum) => {
  const string = response + PHONEPE_SALT_KEY;
  const sha256 = crypto.createHash('sha256').update(string).digest('hex');
  const expectedChecksum = sha256 + '###' + PHONEPE_SALT_INDEX;
  return expectedChecksum === receivedChecksum;
};

/**
 * Initiate payment
 * POST /api/payments/initiate
 */
exports.initiatePayment = async (req, res) => {
  try {
    const { orderId, method } = req.body;
    const userId = req.user._id;

    // Validate order
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID'
      });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if user owns this order
    if (order.user.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to pay for this order'
      });
    }

    // Check if order already paid
    if (order.paymentStatus === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Order already paid'
      });
    }

    // Handle COD (Cash on Delivery)
    if (method === 'cod') {
      const payment = new Payment({
        orderId: order._id,
        method: 'cod',
        status: 'success',
        amount: order.totalAmount,
        transactionId: `COD_${Date.now()}_${order._id}`
      });

      await payment.save();

      // Update order payment status
      order.paymentStatus = 'paid';
      order.paymentMethod = 'cod';
      await order.save();

      return res.json({
        success: true,
        message: 'COD order confirmed',
        data: {
          payment,
          order
        }
      });
    }

    // Handle online payment via PhonePe
    if (['card', 'upi', 'netbanking', 'wallet'].includes(method)) {
      // Create payment record
      const payment = new Payment({
        orderId: order._id,
        method,
        status: 'pending',
        amount: order.totalAmount
      });

      await payment.save();

      // Prepare PhonePe payload
      const merchantTransactionId = `TXN_${Date.now()}_${payment._id}`;
      const payload = {
        merchantId: PHONEPE_MERCHANT_ID,
        merchantTransactionId,
        merchantUserId: userId.toString(),
        amount: Math.round(order.totalAmount * 100), // Convert to paise
        redirectUrl: `${PHONEPE_REDIRECT_URL}?transactionId=${merchantTransactionId}`,
        redirectMode: 'POST',
        callbackUrl: PHONEPE_CALLBACK_URL,
        mobileNumber: req.user.phone || '9999999999',
        paymentInstrument: {
          type: 'PAY_PAGE'
        }
      };

      // Generate checksum
      const checksum = generatePhonePeChecksum(payload);
      const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');

      // Store transaction ID in payment
      payment.transactionId = merchantTransactionId;
      payment.phonePePayload = payload;
      await payment.save();

      // Make API call to PhonePe
      try {
        const response = await axios.post(
          `${PHONEPE_API_URL}/pg/v1/pay`,
          {
            request: base64Payload
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'X-VERIFY': checksum
            }
          }
        );

        if (response.data.success) {
          return res.json({
            success: true,
            message: 'Payment initiated',
            data: {
              paymentUrl: response.data.data.instrumentResponse.redirectInfo.url,
              transactionId: merchantTransactionId,
              payment
            }
          });
        } else {
          payment.status = 'failed';
          payment.paymentGatewayResponse = 'failed';
          await payment.save();

          return res.status(400).json({
            success: false,
            message: 'Payment initiation failed',
            error: response.data.message
          });
        }
      } catch (phonePeError) {
        console.error('PhonePe API error:', phonePeError.response?.data || phonePeError.message);
        payment.status = 'failed';
        payment.paymentGatewayResponse = 'failed';
        await payment.save();

        return res.status(500).json({
          success: false,
          message: 'Payment gateway error',
          error: phonePeError.response?.data?.message || phonePeError.message
        });
      }
    }

    return res.status(400).json({
      success: false,
      message: 'Invalid payment method'
    });
  } catch (error) {
    console.error('Error initiating payment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate payment',
      error: error.message
    });
  }
};

/**
 * Get payment status
 * GET /api/payments/:id/status
 */
exports.getPaymentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment ID'
      });
    }

    const payment = await Payment.findById(id).populate('orderId');

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // Check if user owns this payment
    if (payment.orderId.user.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view this payment'
      });
    }

    res.json({
      success: true,
      data: payment
    });
  } catch (error) {
    console.error('Error fetching payment status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment status',
      error: error.message
    });
  }
};

/**
 * PhonePe callback handler
 * POST /api/payments/phonepe/callback
 */
exports.phonePeCallback = async (req, res) => {
  try {
    const { response } = req.body;
    const checksum = req.headers['x-verify'];

    // Verify checksum
    if (!verifyPhonePeChecksum(response, checksum)) {
      console.error('Invalid checksum in PhonePe callback');
      return res.status(400).json({
        success: false,
        message: 'Invalid checksum'
      });
    }

    // Decode response
    const decodedResponse = JSON.parse(Buffer.from(response, 'base64').toString());
    const { transactionId, code, amount } = decodedResponse;

    // Find payment by transaction ID
    const payment = await Payment.findOne({ transactionId });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // Update payment status
    if (code === 'PAYMENT_SUCCESS') {
      payment.status = 'success';
      payment.paymentGatewayResponse = 'success';
      payment.phonePeResponse = decodedResponse;
      await payment.save();

      // Update order
      const order = await Order.findById(payment.orderId);
      if (order) {
        order.paymentStatus = 'paid';
        order.paymentMethod = payment.method;
        await order.save();
      }

      return res.json({
        success: true,
        message: 'Payment successful',
        data: payment
      });
    } else {
      payment.status = 'failed';
      payment.paymentGatewayResponse = 'failed';
      payment.phonePeResponse = decodedResponse;
      await payment.save();

      return res.json({
        success: false,
        message: 'Payment failed',
        data: payment
      });
    }
  } catch (error) {
    console.error('Error in PhonePe callback:', error);
    res.status(500).json({
      success: false,
      message: 'Callback processing failed',
      error: error.message
    });
  }
};

/**
 * PhonePe webhook handler
 * POST /api/payments/phonepe/webhook
 */
exports.phonePeWebhook = async (req, res) => {
  try {
    const { response } = req.body;
    const checksum = req.headers['x-verify'];

    // Verify checksum
    if (!verifyPhonePeChecksum(response, checksum)) {
      console.error('Invalid checksum in PhonePe webhook');
      return res.status(400).send('Invalid checksum');
    }

    // Decode response
    const decodedResponse = JSON.parse(Buffer.from(response, 'base64').toString());
    const { transactionId, code } = decodedResponse;

    // Find payment by transaction ID
    const payment = await Payment.findOne({ transactionId });

    if (payment) {
      // Update payment status
      if (code === 'PAYMENT_SUCCESS') {
        payment.status = 'success';
        payment.paymentGatewayResponse = 'success';
      } else {
        payment.status = 'failed';
        payment.paymentGatewayResponse = 'failed';
      }
      payment.phonePeResponse = decodedResponse;
      await payment.save();

      // Update order if payment successful
      if (code === 'PAYMENT_SUCCESS') {
        const order = await Order.findById(payment.orderId);
        if (order && order.paymentStatus !== 'paid') {
          order.paymentStatus = 'paid';
          order.paymentMethod = payment.method;
          await order.save();
        }
      }
    }

    // Always return 200 to PhonePe
    res.status(200).send('OK');
  } catch (error) {
    console.error('Error in PhonePe webhook:', error);
    res.status(200).send('OK'); // Still return 200 to avoid retries
  }
};

/**
 * Process refund (Admin only)
 * POST /api/payments/:id/refund
 */
exports.processRefund = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment ID'
      });
    }

    const payment = await Payment.findById(id).populate('orderId');

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // Check if payment is successful
    if (payment.status !== 'success') {
      return res.status(400).json({
        success: false,
        message: 'Only successful payments can be refunded'
      });
    }

    // Check if already refunded
    if (payment.refundStatus === 'refunded') {
      return res.status(400).json({
        success: false,
        message: 'Payment already refunded'
      });
    }

    // For COD, just mark as refunded
    if (payment.method === 'cod') {
      payment.refundStatus = 'refunded';
      payment.refundReason = reason;
      payment.refundedAt = new Date();
      await payment.save();

      // Update order
      const order = await Order.findById(payment.orderId);
      if (order) {
        order.paymentStatus = 'refunded';
        await order.save();
      }

      return res.json({
        success: true,
        message: 'COD payment marked as refunded',
        data: payment
      });
    }

    // For online payments, initiate PhonePe refund
    // Note: This is a simplified version. Actual PhonePe refund API integration needed
    payment.refundStatus = 'processing';
    payment.refundReason = reason;
    await payment.save();

    // TODO: Integrate actual PhonePe refund API
    // For now, just mark as processing
    
    res.json({
      success: true,
      message: 'Refund initiated',
      data: payment
    });
  } catch (error) {
    console.error('Error processing refund:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process refund',
      error: error.message
    });
  }
};

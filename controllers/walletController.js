const mongoose = require('mongoose');
const User = require('../models/userModel');
const WalletTransaction = require('../models/walletTransactionModel');
const Order = require('../models/orderModel');
const walletService = require('../services/walletService');
const crypto = require('crypto');

/**
 * USER ENDPOINTS - For mobile/user app
 */

/**
 * GET /api/wallet
 * Get user's wallet balance and recent transactions
 */
const getWallet = async (req, res) => {
  try {
    const userId = req.userId;

    const user = await User.findById(userId).select('walletBalance');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get recent transactions (last 10)
    const recentTransactions = await WalletTransaction.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('transactionId type amount balanceAfter status description createdAt');

    res.status(200).json({
      success: true,
      data: {
        balance: user.walletBalance || 0,
        recentTransactions
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch wallet',
      error: error.message
    });
  }
};

/**
 * GET /api/wallet/transactions
 * Get paginated transaction history with filters
 */
const getTransactionHistory = async (req, res) => {
  try {
    const userId = req.userId;
    const { page = 1, limit = 20, type, startDate, endDate, status } = req.query;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      type,
      startDate,
      endDate,
      status
    };

    const result = await walletService.getTransactionHistory(userId, options);

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transaction history',
      error: error.message
    });
  }
};

/**
 * POST /api/wallet/topup
 * Initiate wallet top-up via PhonePe
 * Body: { amount }
 */
const initiateTopup = async (req, res) => {
  try {
    const userId = req.userId;
    const { amount } = req.body;

    // Validate amount
    if (!amount || amount < 10 || amount > 50000) {
      return res.status(400).json({
        success: false,
        message: 'Invalid amount. Minimum: ₹10, Maximum: ₹50,000'
      });
    }

    // TODO: Integrate with PhonePe API
    // This is a mock implementation
    const phonepeTransactionId = `PH${Date.now()}${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Create pending transaction
    const transaction = new WalletTransaction({
      user: userId,
      type: 'top_up',
      amount,
      balanceBefore: (await User.findById(userId)).walletBalance || 0,
      balanceAfter: (await User.findById(userId)).walletBalance || 0, // Will be updated on callback
      description: `Wallet top-up of ₹${amount}`,
      metadata: {
        referenceNumber: phonepeTransactionId
      },
      status: 'pending'
    });

    await transaction.save();

    res.status(200).json({
      success: true,
      message: 'Top-up initiated',
      data: {
        transactionId: transaction.transactionId,
        phonepeTransactionId,
        amount,
        // TODO: Return PhonePe payment URL
        paymentUrl: `https://phonepe.com/pay?txn=${phonepeTransactionId}`
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to initiate top-up',
      error: error.message
    });
  }
};

/**
 * POST /api/wallet/phonepe/callback
 * Handle PhonePe payment callback
 * Body: { transactionId, status, amount }
 */
const phonepeCallback = async (req, res) => {
  try {
    const { phonepeTransactionId, status, amount } = req.body;

    // TODO: Verify PhonePe checksum (SHA256 + salt)

    if (!phonepeTransactionId || !status) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Find pending transaction
    const transaction = await WalletTransaction.findOne({
      'metadata.referenceNumber': phonepeTransactionId,
      status: 'pending'
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    if (status === 'SUCCESS') {
      // Update transaction status
      transaction.status = 'completed';
      const user = await User.findById(transaction.user);
      const balanceAfter = (user.walletBalance || 0) + amount;

      // Update balance
      user.walletBalance = balanceAfter;
      await user.save();

      // Update transaction
      transaction.balanceAfter = balanceAfter;
      await transaction.save();

      res.status(200).json({
        success: true,
        message: 'Top-up successful',
        data: {
          transactionId: transaction.transactionId,
          amount,
          newBalance: balanceAfter
        }
      });
    } else {
      // Payment failed
      transaction.status = 'failed';
      await transaction.save();

      res.status(400).json({
        success: false,
        message: 'Payment failed',
        data: {
          transactionId: transaction.transactionId,
          status: 'failed'
        }
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to process callback',
      error: error.message
    });
  }
};

/**
 * ADMIN ENDPOINTS - For admin dashboard
 */

/**
 * GET /api/admin/wallet/user/:userId
 * Get specific user's wallet details
 */
const getUserWallet = async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }

    const user = await User.findById(userId).select('name email phone walletBalance tier totalOrders totalSpent');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get recent transactions
    const recentTransactions = await WalletTransaction.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('metadata.orderId', 'orderId status')
      .populate('metadata.adminId', 'name email');

    // Get total top-ups and payments
    const stats = await WalletTransaction.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    const statsByType = {};
    stats.forEach(stat => {
      statsByType[stat._id] = {
        count: stat.count,
        totalAmount: stat.totalAmount
      };
    });

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          tier: user.tier,
          totalOrders: user.totalOrders,
          totalSpent: user.totalSpent,
          walletBalance: user.walletBalance || 0
        },
        statsByType,
        recentTransactions
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user wallet',
      error: error.message
    });
  }
};

/**
 * POST /api/admin/wallet/add-bonus
 * Add bonus to user wallet
 * Body: { userId, amount, description }
 */
const addWalletBonus = async (req, res) => {
  try {
    const adminId = req.adminId;
    const { userId, amount, description } = req.body;

    // Validate input
    if (!userId || !amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid userId or amount'
      });
    }

    // Check user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Credit wallet
    const result = await walletService.creditWallet(
      userId,
      amount,
      'bonus',
      description || `Admin bonus of ₹${amount}`,
      {
        adminId,
        reason: description || 'Admin bonus'
      }
    );

    res.status(200).json({
      success: true,
      message: 'Bonus added successfully',
      data: {
        transactionId: result.transaction.transactionId,
        amount: result.transaction.amount,
        newBalance: result.transaction.balanceAfter
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to add bonus',
      error: error.message
    });
  }
};

/**
 * POST /api/admin/wallet/deduct
 * Deduct amount from user wallet
 * Body: { userId, amount, reason }
 */
const deductWalletAmount = async (req, res) => {
  try {
    const adminId = req.adminId;
    const { userId, amount, reason } = req.body;

    // Validate input
    if (!userId || !amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid userId or amount'
      });
    }

    // Check user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Debit wallet
    const result = await walletService.debitWallet(
      userId,
      amount,
      'deduction',
      reason || `Admin deduction of ₹${amount}`,
      {
        adminId,
        reason: reason || 'Admin deduction'
      }
    );

    res.status(200).json({
      success: true,
      message: 'Amount deducted successfully',
      data: {
        transactionId: result.transaction.transactionId,
        amount: result.transaction.amount,
        newBalance: result.transaction.balanceAfter
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to deduct amount',
      error: error.message
    });
  }
};

/**
 * GET /api/admin/wallet/stats
 * Get platform-wide wallet statistics
 */
const getWalletStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const options = {
      startDate,
      endDate
    };

    const result = await walletService.getWalletStats(options);

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch wallet stats',
      error: error.message
    });
  }
};

/**
 * GET /api/admin/wallet/search
 * Search users by name or phone number
 * Query: { query: string }
 */
const searchUsers = async (req, res) => {
  try {
    const { query } = req.query;

    // Validate query
    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters'
      });
    }

    const searchQuery = query.trim();

    // Search by name or phone number (case-insensitive)
    const users = await User.find({
      $or: [
        { name: { $regex: searchQuery, $options: 'i' } },
        { phone: { $regex: searchQuery, $options: 'i' } }
      ]
    })
      .select('_id name email phone walletBalance')
      .limit(10);

    const formattedUsers = users.map(user => ({
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      walletBalance: user.walletBalance || 0
    }));

    res.status(200).json({
      success: true,
      data: formattedUsers
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to search users',
      error: error.message
    });
  }
};

module.exports = {
  // User endpoints
  getWallet,
  getTransactionHistory,
  initiateTopup,
  phonepeCallback,

  // Admin endpoints
  getUserWallet,
  addWalletBonus,
  deductWalletAmount,
  getWalletStats,
  searchUsers
};

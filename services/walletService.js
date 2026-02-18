const mongoose = require('mongoose');
const User = require('../models/userModel');
const WalletTransaction = require('../models/walletTransactionModel');

/**
 * Wallet Service - Handles all wallet operations with transactional safety
 * Uses MongoDB sessions to ensure atomicity of concurrent transactions
 */

module.exports = {
  /**
   * Credit wallet (add money)
   * @param {String} userId - User ID
   * @param {Number} amount - Amount to add
   * @param {String} type - Transaction type (top_up, refund, bonus, reversal)
   * @param {String} description - Transaction description
   * @param {Object} metadata - Additional metadata
   * @returns {Object} Transaction details
   */
  async creditWallet(userId, amount, type, description, metadata = {}) {
    if (!userId || !amount || amount <= 0) {
      throw new Error('Invalid userId or amount');
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Get user with lock to prevent race conditions
      const user = await User.findById(userId).session(session);
      if (!user) {
        throw new Error('User not found');
      }

      const balanceBefore = user.walletBalance || 0;
      const balanceAfter = balanceBefore + amount;

      // Update user wallet balance
      await User.findByIdAndUpdate(
        userId,
        { walletBalance: balanceAfter },
        { session, new: true }
      );

      // Create transaction record
      const transaction = new WalletTransaction({
        user: userId,
        type,
        amount,
        balanceBefore,
        balanceAfter,
        description,
        metadata,
        status: 'completed'
      });

      await transaction.save({ session });

      await session.commitTransaction();

      return {
        success: true,
        transaction: {
          transactionId: transaction.transactionId,
          amount,
          balanceBefore,
          balanceAfter,
          type,
          description,
          status: 'completed'
        }
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  },

  /**
   * Debit wallet (remove money)
   * @param {String} userId - User ID
   * @param {Number} amount - Amount to deduct
   * @param {String} type - Transaction type (order_payment, deduction)
   * @param {String} description - Transaction description
   * @param {Object} metadata - Additional metadata
   * @returns {Object} Transaction details
   */
  async debitWallet(userId, amount, type, description, metadata = {}) {
    if (!userId || !amount || amount <= 0) {
      throw new Error('Invalid userId or amount');
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Get user with lock
      const user = await User.findById(userId).session(session);
      if (!user) {
        throw new Error('User not found');
      }

      const balanceBefore = user.walletBalance || 0;

      // Check if sufficient balance
      if (balanceBefore < amount) {
        throw new Error(`Insufficient wallet balance. Available: ₹${balanceBefore}, Required: ₹${amount}`);
      }

      const balanceAfter = balanceBefore - amount;

      // Update user wallet balance
      await User.findByIdAndUpdate(
        userId,
        { walletBalance: balanceAfter },
        { session, new: true }
      );

      // Create transaction record
      const transaction = new WalletTransaction({
        user: userId,
        type,
        amount,
        balanceBefore,
        balanceAfter,
        description,
        metadata,
        status: 'completed'
      });

      await transaction.save({ session });

      await session.commitTransaction();

      return {
        success: true,
        transaction: {
          transactionId: transaction.transactionId,
          amount,
          balanceBefore,
          balanceAfter,
          type,
          description,
          status: 'completed'
        }
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  },

  /**
   * Get current wallet balance
   * @param {String} userId - User ID
   * @returns {Number} Current balance
   */
  async getWalletBalance(userId) {
    if (!userId) {
      throw new Error('Invalid userId');
    }

    const user = await User.findById(userId).select('walletBalance');
    if (!user) {
      throw new Error('User not found');
    }

    return user.walletBalance || 0;
  },

  /**
   * Get wallet transaction history with pagination
   * @param {String} userId - User ID
   * @param {Object} options - Query options (page, limit, type, startDate, endDate)
   * @returns {Object} Paginated transactions
   */
  async getTransactionHistory(userId, options = {}) {
    if (!userId) {
      throw new Error('Invalid userId');
    }

    const {
      page = 1,
      limit = 20,
      type = null,
      startDate = null,
      endDate = null,
      status = null
    } = options;

    const skip = (page - 1) * limit;
    const query = { user: userId };

    // Apply filters
    if (type) {
      query.type = type;
    }
    if (status) {
      query.status = status;
    }
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    // Get total count
    const total = await WalletTransaction.countDocuments(query);

    // Get paginated results
    const transactions = await WalletTransaction.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('metadata.orderId', 'orderId status')
      .populate('metadata.adminId', 'name email');

    return {
      success: true,
      data: transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  },

  /**
   * Get platform-wide wallet statistics
   * @param {Object} options - Query options (startDate, endDate)
   * @returns {Object} Platform statistics
   */
  async getWalletStats(options = {}) {
    const { startDate = null, endDate = null } = options;

    const matchStage = {
      $match: { status: 'completed' }
    };

    if (startDate || endDate) {
      matchStage.$match.createdAt = {};
      if (startDate) {
        matchStage.$match.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        matchStage.$match.createdAt.$lte = new Date(endDate);
      }
    }

    // Get statistics by transaction type
    const stats = await WalletTransaction.aggregate([
      matchStage,
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Get total wallet balance across all users
    const userStats = await User.aggregate([
      {
        $group: {
          _id: null,
          totalBalance: { $sum: '$walletBalance' },
          usersWithBalance: {
            $sum: {
              $cond: [{ $gt: ['$walletBalance', 0] }, 1, 0]
            }
          }
        }
      }
    ]);

    const walletBalance = userStats[0]?.totalBalance || 0;
    const usersWithBalance = userStats[0]?.usersWithBalance || 0;

    // Calculate summary
    const summaryByType = {};
    stats.forEach(stat => {
      summaryByType[stat._id] = {
        count: stat.count,
        totalAmount: stat.totalAmount
      };
    });

    return {
      success: true,
      data: {
        totalBalance: walletBalance,
        usersWithBalance,
        transactionStats: summaryByType,
        summary: {
          topUps: summaryByType.top_up || { count: 0, totalAmount: 0 },
          payments: summaryByType.order_payment || { count: 0, totalAmount: 0 },
          refunds: summaryByType.refund || { count: 0, totalAmount: 0 },
          bonuses: summaryByType.bonus || { count: 0, totalAmount: 0 },
          deductions: summaryByType.deduction || { count: 0, totalAmount: 0 }
        }
      }
    };
  },

  /**
   * Verify wallet balance for payment
   * @param {String} userId - User ID
   * @param {Number} requiredAmount - Amount needed
   * @returns {Object} Verification result
   */
  async verifyBalance(userId, requiredAmount) {
    if (!userId || !requiredAmount || requiredAmount <= 0) {
      throw new Error('Invalid userId or amount');
    }

    const user = await User.findById(userId).select('walletBalance');
    if (!user) {
      throw new Error('User not found');
    }

    const balance = user.walletBalance || 0;
    const hasBalance = balance >= requiredAmount;

    return {
      success: true,
      hasBalance,
      currentBalance: balance,
      requiredAmount,
      shortfall: hasBalance ? 0 : requiredAmount - balance
    };
  },

  /**
   * Reverse a transaction (for failed payments, cancellations, etc.)
   * @param {String} transactionId - Transaction ID to reverse
   * @param {String} reason - Reason for reversal
   * @returns {Object} Reversal transaction details
   */
  async reverseTransaction(transactionId, reason) {
    if (!transactionId) {
      throw new Error('Invalid transactionId');
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Get original transaction
      const originalTransaction = await WalletTransaction.findOne({
        transactionId: transactionId
      }).session(session);

      if (!originalTransaction) {
        throw new Error('Transaction not found');
      }

      if (originalTransaction.status !== 'completed') {
        throw new Error('Can only reverse completed transactions');
      }

      const userId = originalTransaction.user;
      const user = await User.findById(userId).session(session);
      if (!user) {
        throw new Error('User not found');
      }

      // Reverse the transaction
      const reversalAmount = originalTransaction.amount;
      let balanceAfter;

      if (['top_up', 'refund', 'bonus', 'reversal'].includes(originalTransaction.type)) {
        // Credit transactions need to be reversed (deducted)
        balanceAfter = user.walletBalance - reversalAmount;
      } else {
        // Debit transactions need to be reversed (credited)
        balanceAfter = user.walletBalance + reversalAmount;
      }

      if (balanceAfter < 0) {
        throw new Error('Reversal would result in negative balance');
      }

      // Update user wallet balance
      await User.findByIdAndUpdate(
        userId,
        { walletBalance: balanceAfter },
        { session, new: true }
      );

      // Create reversal transaction
      const reversalTransaction = new WalletTransaction({
        user: userId,
        type: 'reversal',
        amount: reversalAmount,
        balanceBefore: user.walletBalance,
        balanceAfter,
        description: `Reversal of ${originalTransaction.type} - ${reason}`,
        metadata: {
          reversedTransactionId: originalTransaction.transactionId,
          reason
        },
        reversedTransaction: originalTransaction._id,
        reversalReason: reason,
        status: 'completed'
      });

      await reversalTransaction.save({ session });

      // Mark original as reversed
      originalTransaction.status = 'reversed';
      await originalTransaction.save({ session });

      await session.commitTransaction();

      return {
        success: true,
        reversal: {
          transactionId: reversalTransaction.transactionId,
          originalTransactionId,
          amount: reversalAmount,
          balanceAfter,
          reason,
          status: 'completed'
        }
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }
};

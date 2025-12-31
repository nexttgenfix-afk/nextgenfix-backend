const User = require('../models/userModel');
const Settings = require('../models/settingsModel');

module.exports = {
  /**
   * Calculate user's current tier based on monthly orders
   * @param {String} userId - User ID
   * @returns {Object} Tier information
   */
  async calculateUserTier(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const settings = await Settings.getInstance();
      const tierConfig = settings.tierSystem;

      const monthlyOrders = user.tierProgress?.currentMonthOrders || 0;

      let newTier = 'bronze';
      if (monthlyOrders >= tierConfig.gold.requiredOrders) {
        newTier = 'gold';
      } else if (monthlyOrders >= tierConfig.silver.requiredOrders) {
        newTier = 'silver';
      }

      // Update user tier if changed
      if (user.tier !== newTier) {
        user.tier = newTier;
        user.tierProgress.lastTierUpdate = new Date();
        await user.save();
      }

      return {
        currentTier: newTier,
        monthlyOrders,
        discount: tierConfig[newTier].discount,
        nextTier: this.getNextTier(newTier),
        ordersToNextTier: this.getOrdersToNextTier(monthlyOrders, newTier, tierConfig)
      };
    } catch (error) {
      console.error('Calculate user tier error:', error);
      throw error;
    }
  },

  /**
   * Get user's tier progress
   * @param {String} userId - User ID
   * @returns {Object} Tier progress details
   */
  async getTierProgress(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const settings = await Settings.getInstance();
      const tierConfig = settings.tierSystem;

      const monthlyOrders = user.tierProgress?.currentMonthOrders || 0;
      const currentTier = user.tier || 'bronze';

      return {
        currentTier,
        monthlyOrders,
        currentDiscount: tierConfig[currentTier].discount,
        nextTier: this.getNextTier(currentTier),
        ordersToNextTier: this.getOrdersToNextTier(monthlyOrders, currentTier, tierConfig),
        tiers: {
          bronze: tierConfig.bronze,
          silver: tierConfig.silver,
          gold: tierConfig.gold
        }
      };
    } catch (error) {
      console.error('Get tier progress error:', error);
      throw error;
    }
  },

  /**
   * Apply tier discount to amount
   * @param {Number} amount - Original amount
   * @param {String} tier - User tier
   * @returns {Object} Discount details
   */
  async applyTierDiscount(amount, tier) {
    try {
      const settings = await Settings.getInstance();
      const tierConfig = settings.tierSystem;

      const discountPercent = tierConfig[tier]?.discount || 0;
      const discountAmount = (amount * discountPercent) / 100;

      return {
        originalAmount: amount,
        discountPercent,
        discountAmount,
        finalAmount: amount - discountAmount
      };
    } catch (error) {
      console.error('Apply tier discount error:', error);
      return {
        originalAmount: amount,
        discountPercent: 0,
        discountAmount: 0,
        finalAmount: amount
      };
    }
  },

  /**
   * Check and update tier eligibility (monthly check)
   * @param {String} userId - User ID
   * @returns {Object} Update result
   */
  async checkTierEligibility(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Check if it's a new month
      const lastUpdate = user.tierProgress?.lastTierUpdate || new Date(0);
      const now = new Date();
      const isNewMonth = now.getMonth() !== lastUpdate.getMonth() || 
                         now.getFullYear() !== lastUpdate.getFullYear();

      if (isNewMonth) {
        // Reset monthly counter
        user.tierProgress.currentMonthOrders = 0;
        user.tierProgress.lastTierUpdate = now;
        user.tier = 'bronze'; // Reset to bronze at start of new month
        await user.save();

        return {
          reset: true,
          message: 'Tier reset for new month'
        };
      }

      // Recalculate tier
      return await this.calculateUserTier(userId);
    } catch (error) {
      console.error('Check tier eligibility error:', error);
      throw error;
    }
  },

  /**
   * Upgrade user tier
   * @param {String} userId - User ID
   * @param {String} newTier - New tier
   * @returns {Object} Updated user
   */
  async upgradeTier(userId, newTier) {
    try {
      const user = await User.findByIdAndUpdate(
        userId,
        { 
          tier: newTier,
          'tierProgress.lastTierUpdate': new Date()
        },
        { new: true }
      );

      return user;
    } catch (error) {
      console.error('Upgrade tier error:', error);
      throw error;
    }
  },

  /**
   * Helper: Get next tier
   * @param {String} currentTier - Current tier
   * @returns {String|null} Next tier or null
   */
  getNextTier(currentTier) {
    const tierOrder = ['bronze', 'silver', 'gold'];
    const currentIndex = tierOrder.indexOf(currentTier);
    return currentIndex < tierOrder.length - 1 ? tierOrder[currentIndex + 1] : null;
  },

  /**
   * Helper: Get orders needed to reach next tier
   * @param {Number} currentOrders - Current monthly orders
   * @param {String} currentTier - Current tier
   * @param {Object} tierConfig - Tier configuration
   * @returns {Number} Orders needed
   */
  getOrdersToNextTier(currentOrders, currentTier, tierConfig) {
    const nextTier = this.getNextTier(currentTier);
    if (!nextTier) return 0;

    const requiredOrders = tierConfig[nextTier].requiredOrders;
    return Math.max(0, requiredOrders - currentOrders);
  }
};

const Settings = require('../models/settingsModel');

/**
 * Get public settings (no auth required)
 * GET /api/settings/public
 */
exports.getPublicSettings = async (req, res) => {
  try {
    const settings = await Settings.getSettings();

    // Return only public-facing settings
    res.json({
      success: true,
      data: {
        businessHours: settings.businessHours,
        deliveryCharges: {
          baseFee: settings.deliveryCharges.baseFee,
          perKm: settings.deliveryCharges.perKm,
          minOrderAmount: settings.deliveryCharges.minOrderAmount,
          freeDeliveryThreshold: settings.deliveryCharges.freeDeliveryThreshold
        },
        taxInfo: {
          gstRate: settings.taxInfo.gstRate,
          serviceTax: settings.taxInfo.serviceTax,
          packagingCharge: settings.taxInfo.packagingCharge
        },
        appConfig: settings.appConfig,
        schedulingConfig: {
          allowPreOrders: settings.schedulingConfig.allowPreOrders,
          maxDaysInAdvance: settings.schedulingConfig.maxDaysInAdvance,
          allowTableReservation: settings.schedulingConfig.allowTableReservation
        }
      }
    });
  } catch (error) {
    console.error('Error fetching public settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch settings',
      error: error.message
    });
  }
};

/**
 * Get business hours (no auth required)
 * GET /api/settings/business-hours
 */
exports.getBusinessHours = async (req, res) => {
  try {
    const settings = await Settings.getSettings();

    res.json({
      success: true,
      data: settings.businessHours
    });
  } catch (error) {
    console.error('Error fetching business hours:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch business hours',
      error: error.message
    });
  }
};

/**
 * Get delivery charges (no auth required)
 * GET /api/settings/delivery-charges
 */
exports.getDeliveryCharges = async (req, res) => {
  try {
    const settings = await Settings.getSettings();

    res.json({
      success: true,
      data: settings.deliveryCharges
    });
  } catch (error) {
    console.error('Error fetching delivery charges:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch delivery charges',
      error: error.message
    });
  }
};

/**
 * Get all settings (Admin only)
 * GET /api/settings
 */
exports.getAllSettings = async (req, res) => {
  try {
    const settings = await Settings.getSettings();

    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('Error fetching all settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch settings',
      error: error.message
    });
  }
};

/**
 * Update business hours (Admin only)
 * PUT /api/settings/business-hours
 */
exports.updateBusinessHours = async (req, res) => {
  try {
    const { businessHours } = req.body;

    if (!businessHours) {
      return res.status(400).json({
        success: false,
        message: 'Business hours data is required'
      });
    }

    // Validate business hours structure
    const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    for (const day of daysOfWeek) {
      if (businessHours[day]) {
        const { open, close, isClosed } = businessHours[day];
        
        // Validate time format (HH:MM)
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!isClosed) {
          if (!open || !close) {
            return res.status(400).json({
              success: false,
              message: `${day}: open and close times are required when not closed`
            });
          }
          if (!timeRegex.test(open) || !timeRegex.test(close)) {
            return res.status(400).json({
              success: false,
              message: `${day}: invalid time format. Use HH:MM (24-hour format)`
            });
          }
        }
      }
    }

    const settings = await Settings.getSettings();
    settings.businessHours = businessHours;
    await settings.save();

    res.json({
      success: true,
      message: 'Business hours updated successfully',
      data: settings.businessHours
    });
  } catch (error) {
    console.error('Error updating business hours:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update business hours',
      error: error.message
    });
  }
};

/**
 * Update business information (Admin only)
 * PUT /api/settings/business
 */
exports.updateBusinessInfo = async (req, res) => {
  try {
    const { name, description, phone, email, address, website, logo } = req.body;

    // Server-side validation
    const errors = [];
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        errors.push('Name must be a non-empty string');
      }
    }

    if (email !== undefined) {
      const emailRegex = /^\S+@\S+\.\S+$/;
      if (typeof email !== 'string' || !emailRegex.test(email)) {
        errors.push('Invalid email address');
      }
    }

    if (phone !== undefined) {
      if (typeof phone !== 'string') {
        errors.push('Phone must be a string');
      } else {
        const digits = phone.replace(/\D/g, '');
        if (digits.length < 7 || digits.length > 15) {
          errors.push('Phone number must contain between 7 and 15 digits');
        }
      }
    }

    if (website !== undefined) {
      if (typeof website !== 'string') {
        errors.push('Website must be a string');
      } else {
        try {
          const u = new URL(website);
          if (u.protocol !== 'http:' && u.protocol !== 'https:') {
            errors.push('Website must use http or https');
          }
        } catch (e) {
          errors.push('Invalid website URL');
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: 'Validation errors', errors });
    }

    const settings = await Settings.getSettings();

    if (name !== undefined) settings.business = settings.business || {};
    settings.business.name = name !== undefined ? name : settings.business.name;
    settings.business.description = description !== undefined ? description : settings.business.description;
    settings.business.phone = phone !== undefined ? phone : settings.business.phone;
    settings.business.email = email !== undefined ? email : settings.business.email;
    settings.business.address = address !== undefined ? address : settings.business.address;
    settings.business.website = website !== undefined ? website : settings.business.website;
    settings.business.logo = logo !== undefined ? logo : settings.business.logo;

    await settings.save();

    res.json({
      success: true,
      message: 'Business information updated successfully',
      data: settings.business
    });
  } catch (error) {
    console.error('Error updating business info:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update business information',
      error: error.message
    });
  }
};

/**
 * Update delivery configuration (Admin only)
 * PUT /api/settings/delivery
 */
exports.updateDeliveryConfig = async (req, res) => {
  try {
    const { baseFee, perKm, minOrderAmount, freeDeliveryThreshold, maxDeliveryDistance } = req.body;

    const settings = await Settings.getSettings();

    if (baseFee !== undefined) settings.deliveryCharges.baseFee = baseFee;
    if (perKm !== undefined) settings.deliveryCharges.perKm = perKm;
    if (minOrderAmount !== undefined) settings.deliveryCharges.minOrderAmount = minOrderAmount;
    if (freeDeliveryThreshold !== undefined) settings.deliveryCharges.freeDeliveryThreshold = freeDeliveryThreshold;
    if (maxDeliveryDistance !== undefined) settings.deliveryCharges.maxDeliveryDistance = maxDeliveryDistance;

    await settings.save();

    res.json({
      success: true,
      message: 'Delivery configuration updated successfully',
      data: settings.deliveryCharges
    });
  } catch (error) {
    console.error('Error updating delivery config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update delivery configuration',
      error: error.message
    });
  }
};

/**
 * Update tier configuration (Admin only)
 * PUT /api/settings/tiers
 */
exports.updateTierConfig = async (req, res) => {
  try {
    const { tierConfig } = req.body;

    if (!tierConfig) {
      return res.status(400).json({
        success: false,
        message: 'Tier configuration data is required'
      });
    }

    const settings = await Settings.getSettings();

  // Update tier configurations (no platinum tier)
  const tiers = ['bronze', 'silver', 'gold'];
    for (const tier of tiers) {
      if (tierConfig[tier]) {
        if (tierConfig[tier].minOrders !== undefined) {
          settings.tierConfig[tier].minOrders = tierConfig[tier].minOrders;
        }
        if (tierConfig[tier].discount !== undefined) {
          settings.tierConfig[tier].discount = tierConfig[tier].discount;
        }
      }
    }

    await settings.save();

    res.json({
      success: true,
      message: 'Tier configuration updated successfully',
      data: settings.tierConfig
    });
  } catch (error) {
    console.error('Error updating tier config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update tier configuration',
      error: error.message
    });
  }
};

/**
 * Update referral configuration (Admin only)
 * PUT /api/settings/referral
 */
exports.updateReferralConfig = async (req, res) => {
  try {
    const { enabled, referrerReward, refereeReward, minOrderAmount, maxReferrals, validityDays } = req.body;

    const settings = await Settings.getSettings();

    if (enabled !== undefined) settings.referralConfig.enabled = enabled;
    if (referrerReward !== undefined) settings.referralConfig.referrerReward = referrerReward;
    if (refereeReward !== undefined) settings.referralConfig.refereeReward = refereeReward;
    if (minOrderAmount !== undefined) settings.referralConfig.minOrderAmount = minOrderAmount;
    if (maxReferrals !== undefined) settings.referralConfig.maxReferrals = maxReferrals;
    if (validityDays !== undefined) settings.referralConfig.validityDays = validityDays;

    await settings.save();

    res.json({
      success: true,
      message: 'Referral configuration updated successfully',
      data: settings.referralConfig
    });
  } catch (error) {
    console.error('Error updating referral config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update referral configuration',
      error: error.message
    });
  }
};

/**
 * Update tax configuration (Admin only)
 * PUT /api/settings/tax
 */
exports.updateTaxConfig = async (req, res) => {
  try {
    const { gstRate, serviceTax, packagingCharge } = req.body;

    const settings = await Settings.getSettings();

    if (gstRate !== undefined) {
      if (gstRate < 0 || gstRate > 100) {
        return res.status(400).json({
          success: false,
          message: 'GST rate must be between 0 and 100'
        });
      }
      settings.taxInfo.gstRate = gstRate;
    }

    if (serviceTax !== undefined) {
      if (serviceTax < 0 || serviceTax > 100) {
        return res.status(400).json({
          success: false,
          message: 'Service tax must be between 0 and 100'
        });
      }
      settings.taxInfo.serviceTax = serviceTax;
    }

    if (packagingCharge !== undefined) {
      if (packagingCharge < 0) {
        return res.status(400).json({
          success: false,
          message: 'Packaging charge must be non-negative'
        });
      }
      settings.taxInfo.packagingCharge = packagingCharge;
    }

    await settings.save();

    res.json({
      success: true,
      message: 'Tax configuration updated successfully',
      data: settings.taxInfo
    });
  } catch (error) {
    console.error('Error updating tax config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update tax configuration',
      error: error.message
    });
  }
};

/**
 * Update scheduling configuration (Admin only)
 * PUT /api/settings/scheduling
 */
exports.updateSchedulingConfig = async (req, res) => {
  try {
    const { allowPreOrders, maxDaysInAdvance, slotDuration, allowTableReservation } = req.body;

    const settings = await Settings.getSettings();

    if (allowPreOrders !== undefined) settings.schedulingConfig.allowPreOrders = allowPreOrders;
    if (maxDaysInAdvance !== undefined) {
      if (maxDaysInAdvance < 1) {
        return res.status(400).json({
          success: false,
          message: 'Max days in advance must be at least 1'
        });
      }
      settings.schedulingConfig.maxDaysInAdvance = maxDaysInAdvance;
    }
    if (slotDuration !== undefined) {
      if (slotDuration < 15) {
        return res.status(400).json({
          success: false,
          message: 'Slot duration must be at least 15 minutes'
        });
      }
      settings.schedulingConfig.slotDuration = slotDuration;
    }
    if (allowTableReservation !== undefined) settings.schedulingConfig.allowTableReservation = allowTableReservation;

    await settings.save();

    res.json({
      success: true,
      message: 'Scheduling configuration updated successfully',
      data: settings.schedulingConfig
    });
  } catch (error) {
    console.error('Error updating scheduling config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update scheduling configuration',
      error: error.message
    });
  }
};

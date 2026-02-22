const Rating = require('../models/ratingModel');
const Order = require('../models/orderModel');
const mongoose = require('mongoose');

// Submit ratings for an order (one rating per menu item)
exports.submitRating = async (req, res) => {
  const userId = req.user.id;
  const { orderId } = req.params;
  const { ratings } = req.body;

  try {
    // Get order details and verify ownership + delivered status
    const order = await Order.findOne({
      _id: orderId,
      user: userId,
      status: 'delivered'
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found or not eligible for rating"
      });
    }

    // Get the list of item IDs in this order
    const orderItemIds = order.items.map(item => item.itemId.toString());

    // Validate all menuItemIds belong to this order
    for (const r of ratings) {
      if (!orderItemIds.includes(r.menuItemId)) {
        return res.status(400).json({
          success: false,
          message: `Menu item ${r.menuItemId} is not part of this order`
        });
      }
    }

    // Check for already-rated items in this order
    const existingRatings = await Rating.find({
      user: userId,
      orderId: orderId,
      menuItemId: { $in: ratings.map(r => r.menuItemId) }
    });

    if (existingRatings.length > 0) {
      const alreadyRated = existingRatings.map(r => r.menuItemId.toString());
      return res.status(400).json({
        success: false,
        message: "Some items have already been rated",
        alreadyRated
      });
    }

    // Create rating documents
    const ratingDocs = ratings.map(r => ({
      user: userId,
      orderId: orderId,
      menuItemId: r.menuItemId,
      rating: r.rating,
      comment: r.comment || undefined
    }));

    const savedRatings = await Rating.insertMany(ratingDocs);

    res.status(201).json({
      success: true,
      message: "Ratings submitted successfully",
      data: savedRatings
    });
  } catch (err) {
    console.error("Submit rating error:", err);
    res.status(500).json({ success: false, message: "Failed to submit rating", error: err.message });
  }
};

// Get ratings for a restaurant
exports.getRestaurantRatings = async (req, res) => {
  const { restaurantId } = req.params;
  const { page = 1, limit = 10, sort = 'newest' } = req.query;

  try {
    // Build query
    const query = { restaurantId: restaurantId };
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Define sort options
    let sortOption = {};
    if (sort === 'newest') {
      sortOption = { createdAt: -1 };
    } else if (sort === 'oldest') {
      sortOption = { createdAt: 1 };
    } else if (sort === 'highest') {
      sortOption = { rating: -1 };
    } else if (sort === 'lowest') {
      sortOption = { rating: 1 };
    }

    // Get ratings with pagination
    const ratings = await Rating.find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('user', 'name profilePicture');

    // Get total count for pagination
    const total = await Rating.countDocuments(query);

    // Get average rating
    const aggregateResult = await Rating.aggregate([
      { $match: { restaurantId: new mongoose.Types.ObjectId(restaurantId) } },
      { $group: {
          _id: null,
          averageRating: { $avg: "$rating" },
          totalRatings: { $sum: 1 },
          fiveStars: { $sum: { $cond: [{ $eq: ["$rating", 5] }, 1, 0] } },
          fourStars: { $sum: { $cond: [{ $eq: ["$rating", 4] }, 1, 0] } },
          threeStars: { $sum: { $cond: [{ $eq: ["$rating", 3] }, 1, 0] } },
          twoStars: { $sum: { $cond: [{ $eq: ["$rating", 2] }, 1, 0] } },
          oneStar: { $sum: { $cond: [{ $eq: ["$rating", 1] }, 1, 0] } }
        }}
    ]);

    // Format response
    const stats = aggregateResult.length > 0 ? {
      averageRating: parseFloat(aggregateResult[0].averageRating.toFixed(1)),
      totalRatings: aggregateResult[0].totalRatings,
      distribution: {
        5: aggregateResult[0].fiveStars,
        4: aggregateResult[0].fourStars,
        3: aggregateResult[0].threeStars,
        2: aggregateResult[0].twoStars,
        1: aggregateResult[0].oneStar
      }
    } : {
      averageRating: 0,
      totalRatings: 0,
      distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
    };

    res.status(200).json({
      ratings,
      stats,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        hasMore: skip + ratings.length < total
      }
    });
  } catch (err) {
    console.error("Get restaurant ratings error:", err);
    res.status(500).json({ message: "Failed to fetch ratings", error: err.message });
  }
};

// Get user's ratings
exports.getUserRatings = async (req, res) => {
  const userId = req.user.id;
  const { page = 1, limit = 10 } = req.query;

  try {
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get user's ratings with pagination
    const ratings = await Rating.find({ user: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('menuItemId', 'name price image')
      .populate('orderId', 'createdAt items');

    // Get total count for pagination
    const total = await Rating.countDocuments({ user: userId });

    res.status(200).json({
      ratings,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        hasMore: skip + ratings.length < total
      }
    });
  } catch (err) {
    console.error("Get user ratings error:", err);
    res.status(500).json({ message: "Failed to fetch your ratings", error: err.message });
  }
};

// Edit a rating
exports.editRating = async (req, res) => {
  const userId = req.user.id;
  const { ratingId } = req.params;
  const { rating, comment } = req.body;

  // Validate rating if provided
  if (rating) {
    const ratingValue = parseInt(rating);
    if (isNaN(ratingValue) || ratingValue < 1 || ratingValue > 5) {
      return res.status(400).json({ 
        message: "Rating must be between 1 and 5" 
      });
    }
  }

  try {
    // Find the rating and verify ownership
    const existingRating = await Rating.findOne({
      _id: ratingId,
      user: userId
    });

    if (!existingRating) {
      return res.status(404).json({ message: "Rating not found or not authorized" });
    }

    // Update the rating
    const updateData = {};
    if (rating) updateData.rating = parseInt(rating);
    if (comment !== undefined) updateData.comment = comment;

    const updatedRating = await Rating.findByIdAndUpdate(
      ratingId,
      updateData,
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: "Rating updated successfully",
      data: updatedRating
    });
  } catch (err) {
    console.error("Edit rating error:", err);
    res.status(500).json({ message: "Failed to update rating", error: err.message });
  }
};

// Delete a rating
exports.deleteRating = async (req, res) => {
  const userId = req.user.id;
  const { ratingId } = req.params;

  try {
    // Find the rating and verify ownership
    const existingRating = await Rating.findOne({
      _id: ratingId,
      user: userId
    });

    if (!existingRating) {
      return res.status(404).json({ success: false, message: "Rating not found or not authorized" });
    }

    // Delete the rating
    await Rating.findByIdAndDelete(ratingId);

    res.status(200).json({
      success: true,
      message: "Rating deleted successfully"
    });
  } catch (err) {
    console.error("Delete rating error:", err);
    res.status(500).json({ message: "Failed to delete rating", error: err.message });
  }
};

// Check if an order can be rated
exports.checkRatingEligibility = async (req, res) => {
  const userId = req.user.id;
  const { orderId } = req.params;

  try {
    // Check if order exists and is delivered
    const order = await Order.findOne({
      _id: orderId,
      user: userId
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Check if order is delivered
    const isDelivered = order.status === 'delivered';

    // Check if user has already rated this order
    const existingRating = await Rating.findOne({
      user: userId,
      orderId: orderId
    });

    const hasRated = !!existingRating;

    res.status(200).json({
      canRate: isDelivered && !hasRated,
      isDelivered,
      hasRated,
      ratingId: existingRating ? existingRating._id : null
    });
  } catch (err) {
    console.error("Check rating eligibility error:", err);
    res.status(500).json({ message: "Failed to check rating eligibility", error: err.message });
  }
};

// Get restaurant rating stats only
exports.getRestaurantRatings = async (req, res) => {
  const { restaurantId } = req.params;

  try {
    // Get average rating
    const aggregateResult = await Rating.aggregate([
      { $match: { restaurantId: new mongoose.Types.ObjectId(restaurantId) } },
      { $group: {
          _id: null,
          averageRating: { $avg: "$rating" },
          totalRatings: { $sum: 1 },
          fiveStars: { $sum: { $cond: [{ $eq: ["$rating", 5] }, 1, 0] } },
          fourStars: { $sum: { $cond: [{ $eq: ["$rating", 4] }, 1, 0] } },
          threeStars: { $sum: { $cond: [{ $eq: ["$rating", 3] }, 1, 0] } },
          twoStars: { $sum: { $cond: [{ $eq: ["$rating", 2] }, 1, 0] } },
          oneStar: { $sum: { $cond: [{ $eq: ["$rating", 1] }, 1, 0] } }
        }}
    ]);

    // Format response
    const stats = aggregateResult.length > 0 ? {
      averageRating: parseFloat(aggregateResult[0].averageRating.toFixed(1)),
      totalRatings: aggregateResult[0].totalRatings,
      distribution: {
        5: aggregateResult[0].fiveStars,
        4: aggregateResult[0].fourStars,
        3: aggregateResult[0].threeStars,
        2: aggregateResult[0].twoStars,
        1: aggregateResult[0].oneStar
      }
    } : {
      averageRating: 0,
      totalRatings: 0,
      distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
    };

    res.status(200).json({ stats });
  } catch (err) {
    console.error("Get restaurant rating stats error:", err);
    res.status(500).json({ message: "Failed to fetch rating stats", error: err.message });
  }
};

// Get chef rating stats only
exports.getChefRatings = async (req, res) => {
  const { chefId } = req.params;

  try {
    // Get average rating
    const aggregateResult = await Rating.aggregate([
      { $match: { chefId: new mongoose.Types.ObjectId(chefId) } },
      { $group: {
          _id: null,
          averageRating: { $avg: "$rating" },
          totalRatings: { $sum: 1 },
          fiveStars: { $sum: { $cond: [{ $eq: ["$rating", 5] }, 1, 0] } },
          fourStars: { $sum: { $cond: [{ $eq: ["$rating", 4] }, 1, 0] } },
          threeStars: { $sum: { $cond: [{ $eq: ["$rating", 3] }, 1, 0] } },
          twoStars: { $sum: { $cond: [{ $eq: ["$rating", 2] }, 1, 0] } },
          oneStar: { $sum: { $cond: [{ $eq: ["$rating", 1] }, 1, 0] } }
        }}
    ]);

    // Format response
    const stats = aggregateResult.length > 0 ? {
      averageRating: parseFloat(aggregateResult[0].averageRating.toFixed(1)),
      totalRatings: aggregateResult[0].totalRatings,
      distribution: {
        5: aggregateResult[0].fiveStars,
        4: aggregateResult[0].fourStars,
        3: aggregateResult[0].threeStars,
        2: aggregateResult[0].twoStars,
        1: aggregateResult[0].oneStar
      }
    } : {
      averageRating: 0,
      totalRatings: 0,
      distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
    };

    res.status(200).json({ stats });
  } catch (err) {
    console.error("Get chef rating stats error:", err);
    res.status(500).json({ message: "Failed to fetch rating stats", error: err.message });
  }
};


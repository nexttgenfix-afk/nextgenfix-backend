const FAQ = require('../models/faqModel');
const mongoose = require('mongoose');

/**
 * ADMIN FUNCTIONS - For FAQ management
 */

/**
 * Create new FAQ
 */
const createFAQ = async (req, res) => {
  try {
    const { question, answer, category, tags } = req.body;
    const adminId = req.adminId;

    // Validate input
    if (!question || !answer || !category) {
      return res.status(400).json({
        success: false,
        message: 'Question, answer, and category are required'
      });
    }

    if (question.length < 10 || question.length > 200) {
      return res.status(400).json({
        success: false,
        message: 'Question must be between 10 and 200 characters'
      });
    }

    if (answer.length < 20 || answer.length > 1000) {
      return res.status(400).json({
        success: false,
        message: 'Answer must be between 20 and 1000 characters'
      });
    }

    const faq = new FAQ({
      question,
      answer,
      category,
      tags: tags || [],
      admin: {
        createdBy: adminId
      }
    });

    await faq.save();

    res.status(201).json({
      success: true,
      message: 'FAQ created successfully',
      data: faq
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create FAQ',
      error: error.message
    });
  }
};

/**
 * Update FAQ
 */
const updateFAQ = async (req, res) => {
  try {
    const { id } = req.params;
    const { question, answer, category, tags, isActive } = req.body;
    const adminId = req.adminId;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid FAQ ID'
      });
    }

    const faq = await FAQ.findById(id);
    if (!faq) {
      return res.status(404).json({
        success: false,
        message: 'FAQ not found'
      });
    }

    // Update fields
    if (question) {
      if (question.length < 10 || question.length > 200) {
        return res.status(400).json({
          success: false,
          message: 'Question must be between 10 and 200 characters'
        });
      }
      faq.question = question;
    }

    if (answer) {
      if (answer.length < 20 || answer.length > 1000) {
        return res.status(400).json({
          success: false,
          message: 'Answer must be between 20 and 1000 characters'
        });
      }
      faq.answer = answer;
    }

    if (category) faq.category = category;
    if (tags) faq.tags = tags;
    if (isActive !== undefined) faq.isActive = isActive;

    faq.admin.updatedBy = adminId;
    await faq.save();

    res.status(200).json({
      success: true,
      message: 'FAQ updated successfully',
      data: faq
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update FAQ',
      error: error.message
    });
  }
};

/**
 * Delete FAQ
 */
const deleteFAQ = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid FAQ ID'
      });
    }

    const faq = await FAQ.findByIdAndDelete(id);
    if (!faq) {
      return res.status(404).json({
        success: false,
        message: 'FAQ not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'FAQ deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete FAQ',
      error: error.message
    });
  }
};

/**
 * Get all FAQs (Admin - includes inactive)
 */
const getAllFAQsAdmin = async (req, res) => {
  try {
    const { page = 1, limit = 20, category, isActive } = req.query;

    const skip = (page - 1) * limit;
    const query = {};

    if (category) query.category = category;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const total = await FAQ.countDocuments(query);
    const faqs = await FAQ.find(query)
      .sort({ order: 1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('admin.createdBy', 'name email')
      .populate('admin.updatedBy', 'name email');

    res.status(200).json({
      success: true,
      data: faqs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch FAQs',
      error: error.message
    });
  }
};

/**
 * Reorder FAQs (change order field)
 */
const reorderFAQs = async (req, res) => {
  try {
    const { faqOrder } = req.body; // Array of { faqId, order }

    if (!Array.isArray(faqOrder)) {
      return res.status(400).json({
        success: false,
        message: 'faqOrder must be an array'
      });
    }

    for (const item of faqOrder) {
      if (!mongoose.Types.ObjectId.isValid(item.faqId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid FAQ ID'
        });
      }

      await FAQ.findByIdAndUpdate(item.faqId, { order: item.order });
    }

    res.status(200).json({
      success: true,
      message: 'FAQs reordered successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to reorder FAQs',
      error: error.message
    });
  }
};

/**
 * Get FAQ statistics
 */
const getFAQStats = async (req, res) => {
  try {
    const totalFAQs = await FAQ.countDocuments();
    const activeFAQs = await FAQ.countDocuments({ isActive: true });

    const byCategory = await FAQ.aggregate([
      {
        $match: { isActive: true }
      },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    const mostViewed = await FAQ.find({ isActive: true })
      .sort({ views: -1 })
      .limit(5)
      .select('question category views helpful notHelpful');

    const totalViews = await FAQ.aggregate([
      {
        $match: { isActive: true }
      },
      {
        $group: {
          _id: null,
          totalViews: { $sum: '$views' },
          totalHelpful: { $sum: '$helpful' },
          totalNotHelpful: { $sum: '$notHelpful' }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalFAQs,
        activeFAQs,
        byCategory,
        mostViewed,
        engagement: totalViews[0] || {
          totalViews: 0,
          totalHelpful: 0,
          totalNotHelpful: 0
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch FAQ stats',
      error: error.message
    });
  }
};

/**
 * PUBLIC FUNCTIONS - For user app
 */

/**
 * Get all active FAQs (public)
 */
const getFAQs = async (req, res) => {
  try {
    const { category } = req.query;

    const query = { isActive: true };
    if (category) query.category = category;

    const faqs = await FAQ.find(query)
      .sort({ order: 1, createdAt: -1 })
      .select('faqId question answer category tags views helpful notHelpful');

    res.status(200).json({
      success: true,
      data: faqs
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch FAQs',
      error: error.message
    });
  }
};

/**
 * Get FAQs by category
 */
const getFAQByCategory = async (req, res) => {
  try {
    const { category } = req.params;

    const faqs = await FAQ.find({
      category,
      isActive: true
    })
      .sort({ order: 1, createdAt: -1 })
      .select('faqId question answer category tags views helpful notHelpful');

    if (faqs.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No FAQs found for this category'
      });
    }

    res.status(200).json({
      success: true,
      data: faqs
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch FAQs',
      error: error.message
    });
  }
};

/**
 * Search FAQs
 */
const searchFAQs = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters'
      });
    }

    const faqs = await FAQ.find(
      {
        $text: { $search: query },
        isActive: true
      },
      {
        score: { $meta: 'textScore' }
      }
    )
      .sort({ score: { $meta: 'textScore' } })
      .limit(10)
      .select('faqId question answer category tags');

    res.status(200).json({
      success: true,
      data: faqs
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to search FAQs',
      error: error.message
    });
  }
};

/**
 * Mark FAQ as helpful
 */
const markFAQHelpful = async (req, res) => {
  try {
    const { faqId } = req.params;
    const { isHelpful } = req.body;

    if (!mongoose.Types.ObjectId.isValid(faqId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid FAQ ID'
      });
    }

    if (isHelpful === undefined) {
      return res.status(400).json({
        success: false,
        message: 'isHelpful must be provided'
      });
    }

    const faq = await FAQ.findById(faqId);
    if (!faq) {
      return res.status(404).json({
        success: false,
        message: 'FAQ not found'
      });
    }

    if (isHelpful) {
      faq.helpful += 1;
    } else {
      faq.notHelpful += 1;
    }

    await faq.save();

    res.status(200).json({
      success: true,
      message: 'Thank you for your feedback',
      data: {
        helpful: faq.helpful,
        notHelpful: faq.notHelpful
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to submit feedback',
      error: error.message
    });
  }
};

/**
 * Increment FAQ view count
 */
const incrementFAQView = async (req, res) => {
  try {
    const { faqId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(faqId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid FAQ ID'
      });
    }

    const faq = await FAQ.findByIdAndUpdate(
      faqId,
      { $inc: { views: 1 } },
      { new: true }
    );

    if (!faq) {
      return res.status(404).json({
        success: false,
        message: 'FAQ not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'View count updated'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update view count',
      error: error.message
    });
  }
};

module.exports = {
  // Admin functions
  createFAQ,
  updateFAQ,
  deleteFAQ,
  getAllFAQsAdmin,
  reorderFAQs,
  getFAQStats,

  // Public functions
  getFAQs,
  getFAQByCategory,
  searchFAQs,
  markFAQHelpful,
  incrementFAQView
};

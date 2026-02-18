const Complaint = require('../models/complaintModel');
const mongoose = require('mongoose');

// Helper to build a query that accepts either a Mongo _id or the human-friendly complaintId (e.g. CMP123456)
const buildComplaintQuery = (id) => {
  if (mongoose.Types.ObjectId.isValid(id)) {
    return { _id: id };
  }
  return { complaintId: id };
};

/**
 * Submit a new complaint
 * POST /api/complaints (user route)
 * POST /api/complaints/admin (admin route)
 */
exports.submitComplaint = async (req, res) => {
  try {
    const { subject, category, description, priority, userId } = req.body;
    
    // Determine userId based on who is making the request
    // If admin is creating complaint, use userId from body
    // If user is creating their own complaint, use req.user._id
    let complaintUserId;
    
    if (req.admin) {
      // Admin creating complaint for a user
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'userId is required when admin creates a complaint'
        });
      }
      complaintUserId = userId;
    } else if (req.user) {
      // User creating their own complaint
      complaintUserId = req.user._id;
    } else {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Handle media files if uploaded
    const media = req.files ? req.files.map(file => file.path) : [];

    const complaint = new Complaint({
      user: complaintUserId,
      subject,
      category,
      description,
      priority: priority || 'Medium',
      media,
      status: req.body.status || 'Open'
    });

    await complaint.save();

    // Populate user details
    await complaint.populate('user', 'name email phone');

    res.status(201).json({
      success: true,
      message: 'Complaint submitted successfully',
      data: complaint
    });
  } catch (error) {
    console.error('Error submitting complaint:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit complaint',
      error: error.message
    });
  }
};

/**
 * Get all complaints for the logged-in user
 * GET /api/complaints
 */
exports.getUserComplaints = async (req, res) => {
  try {
    const userId = req.user._id;
    const { status, page = 1, limit = 10 } = req.query;

    const filter = { user: userId };
    if (status) {
      filter.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const complaints = await Complaint.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('user', 'name email phone');

    const total = await Complaint.countDocuments(filter);

    res.json({
      success: true,
      data: complaints,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
        hasMore: skip + complaints.length < total
      }
    });
  } catch (error) {
    console.error('Error fetching user complaints:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch complaints',
      error: error.message
    });
  }
};

/**
 * Get complaint by ID
 * GET /api/complaints/:id
 */
exports.getComplaintById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const query = buildComplaintQuery(id);
    const complaint = await Complaint.findOne(query).populate('user', 'name email phone');

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found'
      });
    }

    // Check if user owns this complaint (unless admin)
    if (req.user.role !== 'admin' && complaint.user._id.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view this complaint'
      });
    }

    res.json({
      success: true,
      data: complaint
    });
  } catch (error) {
    console.error('Error fetching complaint:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch complaint',
      error: error.message
    });
  }
};

/**
 * Get all complaints (Admin only)
 * GET /api/complaints/all
 */
exports.getAllComplaints = async (req, res) => {
  try {
    const { status, category, priority, page = 1, limit = 20 } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (category) filter.category = category;
    if (priority) filter.priority = priority;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const complaints = await Complaint.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('user', 'name email phone');

    const total = await Complaint.countDocuments(filter);

    res.json({
      success: true,
      data: complaints,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
        hasMore: skip + complaints.length < total
      }
    });
  } catch (error) {
    console.error('Error fetching all complaints:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch complaints',
      error: error.message
    });
  }
};

/**
 * Update complaint status (Admin only)
 * PUT /api/complaints/:id/status
 */
exports.updateComplaintStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['Open', 'In-progress', 'Resolved', 'Closed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be one of: ' + validStatuses.join(', ')
      });
    }

    const query = buildComplaintQuery(id);
    const complaint = await Complaint.findOneAndUpdate(
      query,
      { status },
      { new: true }
    ).populate('user', 'name email phone');

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found'
      });
    }

    res.json({
      success: true,
      message: 'Complaint status updated successfully',
      data: complaint
    });
  } catch (error) {
    console.error('Error updating complaint status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update complaint status',
      error: error.message
    });
  }
};

/**
 * Respond to complaint (Admin only)
 * PUT /api/complaints/:id/respond
 */
exports.respondToComplaint = async (req, res) => {
  try {
    const { id } = req.params;
    const { response } = req.body;

    if (!response || !response.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Response is required'
      });
    }

    const query = buildComplaintQuery(id);
    const complaint = await Complaint.findOneAndUpdate(
      query,
      { 
        response,
        status: 'In-progress',
        respondedAt: new Date()
      },
      { new: true }
    ).populate('user', 'name email phone');

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found'
      });
    }

    res.json({
      success: true,
      message: 'Response added successfully',
      data: complaint
    });
  } catch (error) {
    console.error('Error responding to complaint:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to respond to complaint',
      error: error.message
    });
  }
};

/**
 * Get complaint statistics (Admin only)
 * GET /api/complaints/stats
 */
exports.getComplaintStats = async (req, res) => {
  try {
    const total = await Complaint.countDocuments();
    const open = await Complaint.countDocuments({ status: 'Open' });
    const inProgress = await Complaint.countDocuments({ status: 'In-progress' });
    const resolved = await Complaint.countDocuments({ status: 'Resolved' });
    const closed = await Complaint.countDocuments({ status: 'Closed' });

    // Category breakdown
    const categoryStats = await Complaint.aggregate([
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

    // Priority breakdown
    const priorityStats = await Complaint.aggregate([
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 }
        }
      }
    ]);

    // Recent complaints (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentCount = await Complaint.countDocuments({
      createdAt: { $gte: sevenDaysAgo }
    });

    res.json({
      success: true,
      data: {
        total,
        byStatus: {
          open,
          inProgress,
          resolved,
          closed
        },
        byCategory: categoryStats.map(stat => ({
          category: stat._id,
          count: stat.count
        })),
        byPriority: priorityStats.map(stat => ({
          priority: stat._id,
          count: stat.count
        })),
        recentComplaints: recentCount
      }
    });
  } catch (error) {
    console.error('Error fetching complaint stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch complaint statistics',
      error: error.message
    });
  }
};

/**
 * Update a complaint (Admin only)
 * PUT /api/complaints/admin/:id
 */
exports.updateComplaint = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const query = buildComplaintQuery(id);
    const complaint = await Complaint.findOneAndUpdate(
      query,
      updates,
      { new: true, runValidators: true }
    ).populate('user', 'name email phone');

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found'
      });
    }

    res.json({
      success: true,
      message: 'Complaint updated successfully',
      data: complaint
    });
  } catch (error) {
    console.error('Error updating complaint:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update complaint',
      error: error.message
    });
  }
};

/**
 * Delete a complaint (Admin only)
 * DELETE /api/complaints/admin/:id
 */
exports.deleteComplaint = async (req, res) => {
  try {
    const { id } = req.params;

    const query = buildComplaintQuery(id);
    const complaint = await Complaint.findOneAndDelete(query);

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found'
      });
    }

    res.json({
      success: true,
      message: 'Complaint deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting complaint:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete complaint',
      error: error.message
    });
  }
};

/**
 * Export complaints to CSV (Admin only)
 * GET /api/complaints/admin/export
 */
/**
 * Add response to complaint (new approach with responses array)
 * POST /api/complaints/:id/respond
 */
exports.addComplaintResponse = async (req, res) => {
  try {
    const { id } = req.params;
    const { message, isInternal = false } = req.body;
    const adminId = req.adminId;

    // Validate input
    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Response message is required'
      });
    }

    // Find complaint
    const query = buildComplaintQuery(id);
    const complaint = await Complaint.findOne(query);

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found'
      });
    }

    // Get admin details
    let adminName = 'Support Team';
    try {
      const Admin = require('../models/adminModel');
      const admin = await Admin.findById(adminId).select('name');
      if (admin) adminName = admin.name;
    } catch (e) {
      console.error('Error fetching admin details:', e.message);
    }

    // Add response
    complaint.responses.push({
      adminId,
      adminName,
      message,
      isInternal,
      createdAt: new Date()
    });

    // Update lastResponseAt
    complaint.lastResponseAt = new Date();

    // If not internal note, update status to In-progress
    if (!isInternal && complaint.status === 'Open') {
      complaint.status = 'In-progress';
    }

    await complaint.save();

    // Populate responses for response
    await complaint.populate('responses.adminId', 'name email');

    res.status(200).json({
      success: true,
      message: 'Response added successfully',
      data: complaint
    });
  } catch (error) {
    console.error('Error adding response:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add response',
      error: error.message
    });
  }
};

/**
 * Assign complaint to admin
 * PUT /api/complaints/:id/assign
 */
exports.assignComplaint = async (req, res) => {
  try {
    const { id } = req.params;
    const { adminId } = req.body;

    if (!adminId) {
      return res.status(400).json({
        success: false,
        message: 'adminId is required'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(adminId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid admin ID'
      });
    }

    const query = buildComplaintQuery(id);
    const complaint = await Complaint.findOneAndUpdate(
      query,
      { assignedTo: adminId },
      { new: true }
    ).populate('assignedTo', 'name email');

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Complaint assigned successfully',
      data: complaint
    });
  } catch (error) {
    console.error('Error assigning complaint:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign complaint',
      error: error.message
    });
  }
};

/**
 * Get complaint statistics
 * GET /api/admin/complaints/stats
 */
exports.getComplaintStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const matchStage = {};
    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) {
        matchStage.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        matchStage.createdAt.$lte = new Date(endDate);
      }
    }

    // Total complaints
    const total = await Complaint.countDocuments();

    // By status
    const byStatus = await Complaint.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // By category
    const byCategory = await Complaint.aggregate([
      { $match: matchStage },
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

    // By priority
    const byPriority = await Complaint.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Average resolution time
    const resolutionTimes = await Complaint.aggregate([
      {
        $match: {
          ...matchStage,
          resolvedAt: { $exists: true }
        }
      },
      {
        $project: {
          resolutionTime: {
            $subtract: ['$resolvedAt', '$createdAt']
          }
        }
      },
      {
        $group: {
          _id: null,
          avgResolutionTime: { $avg: '$resolutionTime' }
        }
      }
    ]);

    // Open complaints
    const openComplaints = await Complaint.countDocuments({
      status: { $in: ['Open', 'In-progress'] }
    });

    // Resolved complaints
    const resolvedComplaints = await Complaint.countDocuments({
      status: 'Resolved'
    });

    const statusMap = {};
    byStatus.forEach(item => {
      statusMap[item._id] = item.count;
    });

    const categoryMap = {};
    byCategory.forEach(item => {
      categoryMap[item._id] = item.count;
    });

    const priorityMap = {};
    byPriority.forEach(item => {
      priorityMap[item._id] = item.count;
    });

    const avgResolutionTimeMs = resolutionTimes[0]?.avgResolutionTime || 0;
    const avgResolutionTimeHours = Math.round(avgResolutionTimeMs / (1000 * 60 * 60));

    res.status(200).json({
      success: true,
      data: {
        total,
        openComplaints,
        resolvedComplaints,
        byStatus: statusMap,
        byCategory: categoryMap,
        byPriority: priorityMap,
        avgResolutionTimeHours
      }
    });
  } catch (error) {
    console.error('Error fetching complaint stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch complaint statistics',
      error: error.message
    });
  }
};

exports.exportComplaints = async (req, res) => {
  try {
    const { status, category, priority, from, to } = req.query;

    // Build filter
    const filter = {};
    if (status && status !== '' && status !== 'all') filter.status = status;
    if (category && category !== '' && category !== 'all') filter.category = category;
    if (priority && priority !== '' && priority !== 'all') filter.priority = priority;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }

    const complaints = await Complaint.find(filter)
      .populate('user', 'name email phone')
      .sort({ createdAt: -1 });

    // Convert to CSV
    const csv = [
      ['ID', 'User', 'Email', 'Subject', 'Category', 'Priority', 'Status', 'Created At', 'Updated At'].join(','),
      ...complaints.map(c => [
        c._id,
        c.user?.name || 'N/A',
        c.user?.email || 'N/A',
        `"${c.subject.replace(/"/g, '""')}"`,
        c.category,
        c.priority,
        c.status,
        c.createdAt.toISOString(),
        c.updatedAt.toISOString()
      ].join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="complaints-${Date.now()}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting complaints:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export complaints',
      error: error.message
    });
  }
};

const ChefRequest = require('../models/chefRequestModel');
const User = require('../models/userModel');
const Chef = require('../models/chefModel');
const mongoose = require('mongoose');
const { createNotificationUtil } = require('./notificationController');

// Create a food request
exports.createFoodRequest = async (req, res) => {
  const userId = req.user.id;
  const { 
    chefId, 
    dishName, 
    cuisineStyle, 
    description,
    dietaryRestrictions, 
    preferredIngredients,
    portionSize,
    customPortionDetails,
    deliveryType,
    scheduledDelivery,
    budget,
    additionalNotes,
    deliveryAddressId
  } = req.body;

  // Validate required fields
  if (!chefId || !dishName) {
    return res.status(400).json({ 
      message: "Chef ID and dish name are required" 
    });
  }

  if (deliveryType === 'scheduled' && (!scheduledDelivery || !scheduledDelivery.date)) {
    return res.status(400).json({ 
      message: "Scheduled delivery requires date and time" 
    });
  }

  try {
    // Verify chef exists
    const chef = await Chef.findById(chefId);
    if (!chef) {
      return res.status(404).json({ message: "Chef not found" });
    }

    // Create request
    const chefRequest = new ChefRequest({
      user: userId,
      chef: chefId,
      requestType: 'food',
      foodRequest: {
        dishName,
        cuisineStyle,
        description,
        dietaryRestrictions,
        preferredIngredients,
        portionSize,
        customPortionDetails,
        deliveryType,
        scheduledDelivery,
        budget
      },
      additionalNotes,
      deliveryAddress: deliveryAddressId,
      responseTime: chef.responseTime || 60 // Use chef's response time or default
    });

    await chefRequest.save();

    // Create notification for chef
    await createNotificationUtil(
      chef._id, 
      `New food request: ${dishName}`, 
      userId
    );

    res.status(201).json({
      message: "Food request created successfully",
      requestId: chefRequest.requestId,
      chefName: chef.name,
      kitchenName: chef.kitchenName,
      estimatedResponseTime: chefRequest.responseTime
    });
  } catch (err) {
    console.error("Create food request error:", err);
    res.status(500).json({ message: "Failed to create food request" });
  }
};

// Create a chef rental request
exports.createChefRentalRequest = async (req, res) => {
  const userId = req.user.id;
  const { 
    chefId, 
    scheduledTime,
    scheduledDate,
    venue,
    numberOfGuests,
    occasion,
    specialRequirements,
    budget,
    additionalNotes
  } = req.body;

  // Validate required fields
  if (!chefId || !scheduledDate || !scheduledTime || !venue) {
    return res.status(400).json({ 
      message: "Chef ID, scheduled date, scheduled time, and venue are required" 
    });
  }

  try {
    // Verify chef exists
    const chef = await Chef.findById(chefId);
    if (!chef) {
      return res.status(404).json({ message: "Chef not found" });
    }

    // Create request
    const chefRequest = new ChefRequest({
      user: userId,
      chef: chefId,
      requestType: 'chef-rental',
      chefRental: {
        scheduledTime,
        scheduledDate,
        venue,
        numberOfGuests,
        occasion,
        specialRequirements,
        budget
      },
      additionalNotes,
      responseTime: chef.responseTime || 60 // Use chef's response time or default
    });

    await chefRequest.save();

    // Create notification for chef
    await createNotificationUtil(
      chef._id, 
      `New chef rental request for ${scheduledDate.from ? new Date(scheduledDate.from).toLocaleDateString() : 'unknown date'}`, 
      userId
    );

    res.status(201).json({
      message: "Chef rental request created successfully",
      requestId: chefRequest.requestId,
      chefName: chef.name,
      kitchenName: chef.kitchenName,
      estimatedResponseTime: chefRequest.responseTime
    });
  } catch (err) {
    console.error("Create chef rental request error:", err);
    res.status(500).json({ message: "Failed to create chef rental request" });
  }
};

// Create a recipe request
exports.createRecipeRequest = async (req, res) => {
  const userId = req.user.id;
  const { 
    chefId, 
    foodName, 
    description, 
    ingredientsUsed,
    specialItems,
    additionalNotes
  } = req.body;

  // Process uploaded media files
  let media = [];
  if (req.files && req.files.length > 0) {
    media = req.files.map(file => file.path);
  }

  // Validate required fields
  if (!chefId || !foodName) {
    return res.status(400).json({ 
      message: "Chef ID and food name are required" 
    });
  }

  try {
    // Verify chef exists
    const chef = await Chef.findById(chefId);
    if (!chef) {
      return res.status(404).json({ message: "Chef not found" });
    }

    // Create request
    const chefRequest = new ChefRequest({
      user: userId,
      chef: chefId,
      requestType: 'recipe',
      recipeRequest: {
        foodName,
        description,
        ingredientsUsed,
        specialItems,
        media
      },
      additionalNotes,
      responseTime: chef.responseTime || 60 // Use chef's response time or default
    });

    await chefRequest.save();

    // Create notification for chef
    await createNotificationUtil(
      chef._id, 
      `New recipe request for ${foodName}`, 
      userId
    );

    res.status(201).json({
      message: "Recipe request created successfully",
      requestId: chefRequest.requestId,
      chefName: chef.name,
      kitchenName: chef.kitchenName,
      estimatedResponseTime: chefRequest.responseTime
    });
  } catch (err) {
    console.error("Create recipe request error:", err);
    res.status(500).json({ message: "Failed to create recipe request" });
  }
};

// Get all requests for a user
exports.getUserRequests = async (req, res) => {
  const userId = req.user.id;
  const { status, type, page = 1, limit = 10 } = req.query;

  try {
    // Build query
    const query = { user: userId };
    
    // Filter by status if provided
    if (status) {
      query.status = status;
    }
    
    // Filter by request type if provided
    if (type) {
      query.requestType = type;
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get requests with pagination
    const requests = await ChefRequest.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('chef', 'name kitchenName profilePicture responseTime');

    // Get total count for pagination info
    const total = await ChefRequest.countDocuments(query);

    res.status(200).json({
      requests,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        hasMore: skip + requests.length < total
      }
    });
  } catch (err) {
    console.error("Get user requests error:", err);
    res.status(500).json({ message: "Failed to fetch requests" });
  }
};

// Get request details by ID
exports.getRequestById = async (req, res) => {
  const userId = req.user.id;
  const { requestId } = req.params;

  try {
    let request;
    
    // Try to find by MongoDB _id first
    if (mongoose.Types.ObjectId.isValid(requestId)) {
      request = await ChefRequest.findOne({
        _id: requestId,
        user: userId
      });
    }
    
    // If not found, try to find by requestId (string)
    if (!request) {
      request = await ChefRequest.findOne({
        requestId: requestId,
        user: userId
      });
    }
    
    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }
    
    // Populate chef details
    await request.populate('chef', 'name kitchenName profilePicture responseTime verification');
    
    // Populate address if present
    if (request.deliveryAddress) {
      await request.populate('deliveryAddress');
    }

    res.status(200).json({ request });
  } catch (err) {
    console.error("Get request error:", err);
    res.status(500).json({ message: "Failed to fetch request details" });
  }
};

// Cancel a request
exports.cancelRequest = async (req, res) => {
  const userId = req.user.id;
  const { requestId } = req.params;
  const { reason } = req.body;

  try {
    let request;
    
    // Try to find by MongoDB _id first
    if (mongoose.Types.ObjectId.isValid(requestId)) {
      request = await ChefRequest.findOne({
        _id: requestId,
        user: userId
      });
    }
    
    // If not found, try to find by requestId (string)
    if (!request) {
      request = await ChefRequest.findOne({
        requestId: requestId,
        user: userId
      });
    }
    
    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }
    
    // Check if request can be cancelled
    if (request.status !== 'pending') {
      return res.status(400).json({ 
        message: `Cannot cancel a request that is already ${request.status}` 
      });
    }
    
    // Update request status
    request.status = 'cancelled';
    request.additionalNotes = request.additionalNotes 
      ? `${request.additionalNotes}\nCancellation reason: ${reason}` 
      : `Cancellation reason: ${reason}`;
    request.updatedAt = Date.now();
    
    await request.save();

    // Notify chef about cancellation
    await createNotificationUtil(
      request.chef, 
      `Request ${request.requestId} has been cancelled by the user`, 
      userId
    );

    res.status(200).json({
      message: "Request cancelled successfully",
      requestId: request.requestId
    });
  } catch (err) {
    console.error("Cancel request error:", err);
    res.status(500).json({ message: "Failed to cancel request" });
  }
};

// Get chef rental requests by status
exports.getChefRentalRequestsByStatus = async (req, res) => {
  const userId = req.user.id;
  const { status } = req.params;
  const { page = 1, limit = 10 } = req.query;
  
  try {
    // Validate status parameter
    const validStatuses = ['pending', 'accepted', 'rejected', 'cancelled', 'completed'];
    if (status !== 'all' && !validStatuses.includes(status)) {
      return res.status(400).json({ 
        message: "Invalid status parameter. Valid values: pending, accepted, rejected, cancelled, completed, all" 
      });
    }
    
    // Find the chef associated with this user
    const chef = await Chef.findOne({ userId });
    if (!chef) {
      return res.status(403).json({ message: "Only chefs can view rental requests" });
    }
    
    // Build query
    const query = {
      chef: chef._id,
      requestType: 'chef-rental'
    };
    
    // Add status filter if not 'all'
    if (status !== 'all') {
      query.status = status;
    }
    
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Fetch requests
    const requests = await ChefRequest.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('user', 'name profilePicture')
      .populate('deliveryAddress');
    
    // Get total count for pagination info
    const total = await ChefRequest.countDocuments(query);
    
    // Group requests by status for summary
    const statusCounts = {};
    for (const validStatus of validStatuses) {
      const count = await ChefRequest.countDocuments({
        chef: chef._id,
        requestType: 'chef-rental',
        status: validStatus
      });
      statusCounts[validStatus] = count;
    }
    
    res.status(200).json({
      requests,
      statusCounts,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        hasMore: skip + requests.length < total
      }
    });
  } catch (err) {
    console.error("Get chef rental requests error:", err);
    res.status(500).json({ message: "Failed to fetch chef rental requests" });
  }
};

// Get chef rental availability calendar
exports.getChefRentalCalendar = async (req, res) => {
  const { chefId } = req.params;
  const { month, year } = req.query;
  
  try {
    // Validate chef exists
    if (!mongoose.Types.ObjectId.isValid(chefId)) {
      return res.status(400).json({ message: "Invalid chef ID" });
    }
    
    const chef = await Chef.findById(chefId);
    if (!chef) {
      return res.status(404).json({ message: "Chef not found" });
    }
    
    // Parse month and year or use current date
    const currentDate = new Date();
    const selectedMonth = month ? parseInt(month) - 1 : currentDate.getMonth(); // JS months are 0-indexed
    const selectedYear = year ? parseInt(year) : currentDate.getFullYear();
    
    // Validate month and year
    if (selectedMonth < 0 || selectedMonth > 11) {
      return res.status(400).json({ message: "Invalid month. Must be between 1 and 12" });
    }
    
    // Calculate start and end dates for the month
    const startDate = new Date(selectedYear, selectedMonth, 1);
    const endDate = new Date(selectedYear, selectedMonth + 1, 0); // Last day of month
    
    // Find all accepted rental requests for this chef in the given month
    const rentals = await ChefRequest.find({
      chef: chefId,
      requestType: 'chef-rental',
      status: 'accepted',
      'rentalRequest.date': { 
        $gte: startDate,
        $lte: endDate
      }
    }).select('rentalRequest.date rentalRequest.startTime rentalRequest.endTime');
    
    // Format availability calendar
    const daysInMonth = endDate.getDate();
    const calendar = [];
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(selectedYear, selectedMonth, day);
      const dateString = date.toISOString().split('T')[0];
      
      // Find bookings for this day
      const dayBookings = rentals.filter(rental => {
        const rentalDate = new Date(rental.rentalRequest.date);
        return rentalDate.getDate() === day;
      });
      
      // Default availability
      let availability = 'available';
      let bookings = [];
      
      // If there are bookings, collect their times
      if (dayBookings.length > 0) {
        bookings = dayBookings.map(booking => ({
          startTime: booking.rentalRequest.startTime,
          endTime: booking.rentalRequest.endTime
        }));
        
        // Check if fully booked (assuming a chef can only handle one rental per day)
        if (dayBookings.length >= chef.maxBookingsPerDay) {
          availability = 'booked';
        } else {
          availability = 'partially-booked';
        }
      }
      
      calendar.push({
        date: dateString,
        day,
        availability,
        bookings
      });
    }
    
    res.status(200).json({
      calendar,
      chefId,
      month: selectedMonth + 1,
      year: selectedYear
    });
  } catch (err) {
    console.error("Get chef rental calendar error:", err);
    res.status(500).json({ message: "Failed to fetch chef rental calendar" });
  }
};

// Update chef rental request status
exports.updateChefRentalStatus = async (req, res) => {
  const userId = req.user.id;
  const { requestId } = req.params;
  const { status, message } = req.body;
  
  try {
    // Validate status
    const validStatuses = ['accepted', 'rejected'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        message: "Invalid status. Valid values: accepted, rejected" 
      });
    }
    
    // Find the chef associated with this user
    const chef = await Chef.findOne({ userId });
    if (!chef) {
      return res.status(403).json({ message: "Only chefs can update rental requests" });
    }
    
    // Find the request
    let request;
    
    // Try to find by MongoDB _id first
    if (mongoose.Types.ObjectId.isValid(requestId)) {
      request = await ChefRequest.findOne({
        _id: requestId,
        chef: chef._id,
        requestType: 'chef-rental'
      });
    }
    
    // If not found, try to find by requestId (string)
    if (!request) {
      request = await ChefRequest.findOne({
        requestId: requestId,
        chef: chef._id,
        requestType: 'chef-rental'
      });
    }
    
    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }
    
    // Check if request can be updated
    if (request.status !== 'pending') {
      return res.status(400).json({ 
        message: `Cannot update a request that is already ${request.status}` 
      });
    }
    
    // Update request status
    request.status = status;
    request.chefResponse = {
      message: message || '',
      date: new Date()
    };
    request.updatedAt = Date.now();
    
    await request.save();
    
    // Notify user about status update
    const notificationMessage = status === 'accepted' 
      ? `Your chef rental request has been accepted by ${chef.name}`
      : `Your chef rental request has been declined by ${chef.name}`;
      
    await createNotificationUtil(
      request.user, 
      notificationMessage, 
      chef._id,
      { type: 'chef-rental', id: request.requestId }
    );
    
    res.status(200).json({
      message: `Request ${status} successfully`,
      requestId: request.requestId,
      status: request.status
    });
  } catch (err) {
    console.error("Update chef rental status error:", err);
    res.status(500).json({ message: "Failed to update request status" });
  }
};
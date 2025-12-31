const Table = require('../models/tableModel');
const mongoose = require('mongoose');
const QRCode = require('qrcode');

// Helper: convert a timeSlot like "19:00-20:30" to 12-hour format using the provided date
const formatTimeSlotTo12 = (timeSlot, dateObj) => {
  try {
    if (!timeSlot) return timeSlot;
    const parts = timeSlot.split('-').map(p => p.trim());
    const formatPart = (part) => {
      // accept HH:mm or H:mm
      const m = part.match(/^(\d{1,2}):(\d{2})$/);
      if (!m) return part; // unknown format, return as-is
      const hours = parseInt(m[1], 10);
      const minutes = parseInt(m[2], 10);
      // build a date based on dateObj (if provided) or today
      const d = dateObj ? new Date(dateObj) : new Date();
      d.setHours(hours, minutes, 0, 0);
      return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    };
    if (parts.length === 1) return formatPart(parts[0]);
    return parts.map(formatPart).join(' - ');
  } catch (e) {
    return timeSlot;
  }
};

/**
 * Get available tables
 * GET /api/tables
 */
exports.getAvailableTables = async (req, res) => {
  try {
    const { date, timeSlot, capacity, location, status } = req.query;

    const filter = {};
    
    if (status) {
      filter.currentStatus = status;
    } else {
      filter.isAvailable = true;
    }

    if (capacity) {
      filter.capacity = { $gte: parseInt(capacity) };
    }

    if (location) {
      filter.location = location;
    }

    const tables = await Table.find(filter).sort({ displayOrder: 1, tableNumber: 1 });

    // Filter by date and time slot if provided
    let availableTables = tables;
    if (date && timeSlot) {
      availableTables = tables.filter(table => table.isAvailableAt(date, timeSlot));
    }

    res.json({
      success: true,
      // Ensure front-end receives `isAvailableForReservation` (fallback to `isAvailable`)
      data: availableTables.map(t => {
        const obj = typeof t.toObject === 'function' ? t.toObject() : t;
          // Ensure UI fields exist
          if (obj.isAvailableForReservation === undefined) obj.isAvailableForReservation = !!obj.isAvailable;
          // Frontend expects `status` but backend uses `currentStatus` in the model — map it when missing
          if (obj.status === undefined && obj.currentStatus !== undefined) obj.status = obj.currentStatus;
          // Format any reservation timeSlots to 12-hour clock for frontend readability
          if (obj.reservations && Array.isArray(obj.reservations)) {
            obj.reservations = obj.reservations.map(r => {
              const rr = r && r.toObject ? r.toObject() : r;
              rr.timeSlot = formatTimeSlotTo12(rr.timeSlot, rr.date);
              return rr;
            });
          }
        return obj;
      }),
      total: availableTables.length
    });
  } catch (error) {
    console.error('Error fetching available tables:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tables',
      error: error.message
    });
  }
};

/**
 * Get table by ID
 * GET /api/tables/:id
 */
exports.getTableById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid table ID'
      });
    }

    const table = await Table.findById(id)
      .populate('reservations.userId', 'name phone email')
      .populate('reservations.orderId');

    if (!table) {
      return res.status(404).json({
        success: false,
        message: 'Table not found'
      });
    }

    // Normalize table response to include isAvailableForReservation for the admin UI
    const tableObj = typeof table.toObject === 'function' ? table.toObject() : table;
  if (tableObj.isAvailableForReservation === undefined) tableObj.isAvailableForReservation = !!tableObj.isAvailable;
  if (tableObj.status === undefined && tableObj.currentStatus !== undefined) tableObj.status = tableObj.currentStatus;

  // Format reservation timeSlots to 12-hour clock
  if (tableObj.reservations && Array.isArray(tableObj.reservations)) {
    tableObj.reservations = tableObj.reservations.map(r => {
      const rr = r;
      try { rr.timeSlot = formatTimeSlotTo12(rr.timeSlot, rr.date); } catch (e) {}
      return rr;
    });
  }

    res.json({
      success: true,
      data: tableObj
    });
  } catch (error) {
    console.error('Error fetching table:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch table',
      error: error.message
    });
  }
};

/**
 * Reserve a table
 * POST /api/tables/reserve
 */
exports.reserveTable = async (req, res) => {
  try {
    const { tableId, date, timeSlot, guestCount } = req.body;
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(tableId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid table ID'
      });
    }

    // Validate date is in the future
    const reservationDate = new Date(date);
    if (reservationDate < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Reservation date must be in the future'
      });
    }

    // Use an atomic findOneAndUpdate to prevent race conditions / double bookings.
    // Build date range for matching reservation dates (match same day)
    const startOfDay = new Date(reservationDate);
    startOfDay.setHours(0,0,0,0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    // Build new reservation object
    const newReservation = {
      date: reservationDate,
      timeSlot,
      userId,
      guestCount: guestCount || 1,
      createdAt: new Date(),
      status: 'reserved'
    };

    // Only set currentStatus to 'reserved' if reservation is for today
    const today = new Date();
    const isToday = reservationDate.toDateString() === today.toDateString();

    // Prepare update operations
    const update = { $push: { reservations: newReservation } };
    if (isToday) update.$set = { currentStatus: 'reserved' };

    // Perform an atomic update: ensure capacity, availability and no conflicting reservation exists
    const query = {
      _id: tableId,
      capacity: { $gte: parseInt(guestCount || 1) },
      isAvailable: true,
      currentStatus: { $ne: 'maintenance' },
      // Ensure there is NO existing reservation for the same day/time with status 'reserved'
      reservations: { $not: { $elemMatch: {
        date: { $gte: startOfDay, $lt: endOfDay },
        timeSlot: timeSlot,
        status: 'reserved'
      } } }
    };

    const table = await Table.findOneAndUpdate(query, update, { new: true }).populate('reservations.userId', 'name phone email');

    if (!table) {
      // Determine whether table exists at all to give a clearer message
      const exists = await Table.exists({ _id: tableId });
      if (!exists) {
        return res.status(404).json({ success: false, message: 'Table not found' });
      }

      // Table exists but reservation failed. Diagnose the reason with targeted checks
      const tableDoc = await Table.findById(tableId).lean();

      // Capacity check
      if (tableDoc.capacity < (parseInt(guestCount || 1))) {
        return res.status(400).json({
          success: false,
          code: 'CAPACITY_EXCEEDED',
          message: `Requested guest count (${guestCount || 1}) exceeds table capacity (${tableDoc.capacity}).`
        });
      }

      // Availability check
      if (!tableDoc.isAvailable) {
        return res.status(409).json({
          success: false,
          code: 'TABLE_UNAVAILABLE',
          message: 'Table is currently marked unavailable for reservations.'
        });
      }

      // Maintenance / status check
      if (tableDoc.currentStatus === 'maintenance') {
        return res.status(409).json({
          success: false,
          code: 'TABLE_MAINTENANCE',
          message: 'Table is under maintenance and cannot be reserved at this time.'
        });
      }

      // Conflicting reservation check - find any reserved reservation for same day/time
      const conflicts = (tableDoc.reservations || []).filter(r => {
        try {
          const rd = new Date(r.date);
          const start = new Date(startOfDay);
          const end = new Date(endOfDay);
          return rd >= start && rd < end && r.timeSlot === timeSlot && r.status === 'reserved';
        } catch (e) { return false; }
      });

      if (conflicts.length > 0) {
        // Return a conflict with limited info about the conflicting reservation
        const conflict = conflicts[0];
        return res.status(409).json({
          success: false,
          code: 'TIME_CONFLICT',
          message: 'Table already has a reservation at the requested date and time.',
          conflict: {
            reservationId: conflict._id,
            reservationDate: conflict.date,
            timeSlot: conflict.timeSlot,
            guestCount: conflict.guestCount
          }
        });
      }

      // Fallback generic message if none of the above matched
      console.warn('[reserveTable] reservation failed for unknown reason', { tableId, userId, date, timeSlot, guestCount });
      return res.status(400).json({
        success: false,
        message: 'Table is not available at the requested date and time, or capacity/availability constraint failed'
      });
    }

    // Format reservation time slots to 12-hour clock for frontend
    if (table.reservations && Array.isArray(table.reservations)) {
      table.reservations = table.reservations.map(r => {
        // avoid mutating mongoose subdocument's date; create plain object
        const rr = r && r.toObject ? r.toObject() : r;
        rr.timeSlot = formatTimeSlotTo12(rr.timeSlot, rr.date);
        return rr;
      });
    }

    res.status(201).json({
      success: true,
      message: 'Table reserved successfully',
      data: table
    });
  } catch (error) {
    console.error('Error reserving table:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reserve table',
      error: error.message
    });
  }
};

/**
 * Get user's reservations
 * GET /api/tables/reservations
 */
exports.getUserReservations = async (req, res) => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { status, page = 1, limit = 10 } = req.query;

    // Find all tables with reservations by this user
    const tables = await Table.find({
      'reservations.userId': userId
    }).populate('reservations.userId', 'name phone email');

    // Extract and normalize reservations to frontend shape
    let allReservations = [];
    tables.forEach(table => {
      const userReservations = table.reservations
        .filter(r => r.userId._id.toString() === userId.toString())
            .map(r => {
              // Map internal reservation statuses to frontend expected statuses
              const rawStatus = r.status;
              let mappedStatus = rawStatus;
              if (rawStatus === 'reserved' || rawStatus === 'occupied') mappedStatus = 'confirmed';
              else if (rawStatus === 'completed') mappedStatus = 'completed';
              else if (rawStatus === 'cancelled') mappedStatus = 'cancelled';

              return {
                _id: r._id,
                userId: r.userId?._id || r.userId,
                userName: r.userId?.name || r.userName || '',
                userPhone: r.userId?.phone || r.userPhone || '',
                tableId: table._id,
                tableNumber: table.tableNumber,
                reservationDate: r.date,
                reservationTime: formatTimeSlotTo12(r.timeSlot, r.date),
                guestCount: r.guestCount || 1,
                // status mapped to frontend vocabulary, keep rawStatus for reference
                status: mappedStatus,
                rawStatus,
                createdAt: r.createdAt || (r._id && r._id.getTimestamp ? new Date(r._id.getTimestamp()) : undefined),
                updatedAt: r.updatedAt || undefined
              };
            });
      allReservations = allReservations.concat(userReservations);
    });

    // Filter by status if provided
    if (status) {
      allReservations = allReservations.filter(r => r.status === status);
    }

    // Sort by date (newest first)
    allReservations.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const paginatedReservations = allReservations.slice(skip, skip + parseInt(limit));

    res.json({
      success: true,
      data: paginatedReservations,
      pagination: {
        total: allReservations.length,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(allReservations.length / parseInt(limit)),
        hasMore: skip + paginatedReservations.length < allReservations.length
      }
    });
  } catch (error) {
    console.error('Error fetching user reservations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reservations',
      error: error.message
    });
  }
};

/**
 * Create a new table (Admin only)
 * POST /api/tables
 */
exports.createTable = async (req, res) => {
  try {
    const { tableNumber, capacity, location, features, displayOrder } = req.body;

    // Check if table number already exists
    const existingTable = await Table.findOne({ tableNumber });
    if (existingTable) {
      return res.status(409).json({
        success: false,
        message: 'Table number already exists'
      });
    }

    // Generate QR code for the table
    const qrCodeData = JSON.stringify({
      tableNumber,
      tableId: new mongoose.Types.ObjectId().toString()
    });
    const qrCode = await QRCode.toDataURL(qrCodeData);

    const table = new Table({
      tableNumber,
      capacity,
      location,
      features: features || [],
      displayOrder: displayOrder || 0,
      qrCode
    });

    await table.save();

    res.status(201).json({
      success: true,
      message: 'Table created successfully',
      data: table
    });
  } catch (error) {
    console.error('Error creating table:', error);
    // Handle duplicate key error gracefully
    if (error && (error.code === 11000 || error.name === 'MongoServerError')) {
      const dupKey = error.keyValue && error.keyValue.tableNumber ? error.keyValue.tableNumber : undefined;
      const msg = dupKey ? `Table number "${dupKey}" already exists` : 'Duplicate key error'
      return res.status(409).json({
        success: false,
        message: msg,
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create table',
      error: error.message
    });
  }
};

/**
 * Update table (Admin only)
 * PUT /api/tables/:id
 */
exports.updateTable = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid table ID'
      });
    }

    // Don't allow updating reservations through this endpoint
    delete updates.reservations;

    const table = await Table.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    );

    if (!table) {
      return res.status(404).json({
        success: false,
        message: 'Table not found'
      });
    }

    res.json({
      success: true,
      message: 'Table updated successfully',
      data: table
    });
  } catch (error) {
    console.error('Error updating table:', error);
    // Handle Mongo duplicate key error (e.g., updating tableNumber to an existing one)
    if (error && (error.code === 11000 || error.name === 'MongoServerError')) {
      const dupKey = error.keyValue && error.keyValue.tableNumber ? error.keyValue.tableNumber : undefined;
      const msg = dupKey ? `Table number "${dupKey}" already exists` : 'Duplicate key error'
      return res.status(409).json({
        success: false,
        message: msg,
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update table',
      error: error.message
    });
  }
};

/**
 * Delete table (Admin only)
 * DELETE /api/tables/:id
 */
exports.deleteTable = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid table ID'
      });
    }

    const table = await Table.findById(id);

    if (!table) {
      return res.status(404).json({
        success: false,
        message: 'Table not found'
      });
    }

    // Check if table has active reservations
    const hasActiveReservations = table.reservations.some(r => 
      r.status === 'reserved' && new Date(r.date) >= new Date()
    );

    if (hasActiveReservations) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete table with active reservations'
      });
    }

    await Table.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Table deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting table:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete table',
      error: error.message
    });
  }
};

/**
 * Bulk create tables (Admin only)
 * POST /api/tables/bulk
 */
exports.bulkCreateTables = async (req, res) => {
  try {
    const { tables, prefix, startNumber, endNumber, capacity, location } = req.body;

    let tablesToCreate = [];

    if (tables && Array.isArray(tables)) {
      // New format: array of tables
      tablesToCreate = tables.map(table => ({
        tableNumber: table.tableNumber,
        capacity: table.capacity,
        location: table.location,
        features: table.features || [],
        isAvailable: table.isAvailable !== undefined ? table.isAvailable : true,
        displayOrder: table.displayOrder || 0
      }));
    } else {
      // Original format: range with prefix
      if (!prefix || !startNumber || !endNumber || !capacity || !location) {
        return res.status(400).json({
          success: false,
          message: 'All fields (prefix, startNumber, endNumber, capacity, location) are required for range creation'
        });
      }

      if (startNumber > endNumber) {
        return res.status(400).json({
          success: false,
          message: 'Start number must be less than or equal to end number'
        });
      }

      for (let i = startNumber; i <= endNumber; i++) {
        const tableNumber = `${prefix}${i}`;
        tablesToCreate.push({
          tableNumber,
          capacity,
          location,
          displayOrder: i
        });
      }
    }

    const createdTables = [];
    const errors = [];

    for (const tableData of tablesToCreate) {
      try {
        // Check if table already exists
        const existingTable = await Table.findOne({ tableNumber: tableData.tableNumber });
        if (existingTable) {
          errors.push(`Table ${tableData.tableNumber} already exists`);
          continue;
        }

        // Generate QR code
        const qrCodeData = JSON.stringify({
          tableNumber: tableData.tableNumber,
          tableId: new mongoose.Types.ObjectId().toString()
        });
        const qrCode = await QRCode.toDataURL(qrCodeData);

        const table = new Table({
          ...tableData,
          qrCode
        });

        await table.save();
        createdTables.push(table);
      } catch (error) {
        errors.push(`Failed to create table ${tableData.tableNumber}: ${error.message}`);
      }
    }

    res.status(201).json({
      success: true,
      message: `${createdTables.length} tables created successfully`,
      data: createdTables,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Error bulk creating tables:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to bulk create tables',
      error: error.message
    });
  }
};

/**
 * Get all reservations (Admin only)
 * GET /api/tables/reservations/all
 */
exports.getAllReservations = async (req, res) => {
  try {
    const { status, date, page = 1, limit = 20 } = req.query;

    // Find all tables with reservations
    const tables = await Table.find({ 'reservations.0': { $exists: true } })
      .populate('reservations.userId', 'name phone email')
      .populate('reservations.orderId');

    // Extract and normalize all reservations to match admin UI expectations
    let allReservations = [];
    tables.forEach(table => {
      const tableReservations = table.reservations.map(r => {
        const rawStatus = r.status;
        let mappedStatus = rawStatus;
        if (rawStatus === 'reserved' || rawStatus === 'occupied') mappedStatus = 'confirmed';
        else if (rawStatus === 'completed') mappedStatus = 'completed';
        else if (rawStatus === 'cancelled') mappedStatus = 'cancelled';

        return {
          _id: r._id,
          userId: r.userId?._id || r.userId,
          userName: r.userId?.name || r.userName || '',
          userPhone: r.userId?.phone || r.userPhone || '',
          tableId: table._id,
          tableNumber: table.tableNumber,
          reservationDate: r.date,
          reservationTime: formatTimeSlotTo12(r.timeSlot, r.date),
          guestCount: r.guestCount || 1,
          status: mappedStatus,
          rawStatus,
          createdAt: r.createdAt || (r._id && r._id.getTimestamp ? new Date(r._id.getTimestamp()) : undefined),
          updatedAt: r.updatedAt || undefined
        };
      });
      allReservations = allReservations.concat(tableReservations);
    });

    // Filter by status if provided
    if (status) {
      allReservations = allReservations.filter(r => r.status === status);
    }

    // Filter by date if provided
    if (date) {
      const filterDate = new Date(date);
      allReservations = allReservations.filter(r => 
        new Date(r.date).toDateString() === filterDate.toDateString()
      );
    }

    // Sort by date (newest first)
    allReservations.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const paginatedReservations = allReservations.slice(skip, skip + parseInt(limit));

    res.json({
      success: true,
      data: paginatedReservations,
      pagination: {
        total: allReservations.length,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(allReservations.length / parseInt(limit)),
        hasMore: skip + paginatedReservations.length < allReservations.length
      }
    });
  } catch (error) {
    console.error('Error fetching all reservations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reservations',
      error: error.message
    });
  }
};

/**
 * Update reservation status (Admin only)
 * PUT /api/tables/reservations/:id
 */
exports.updateReservationStatus = async (req, res) => {
  try {
    const { id } = req.params; // reservation ID
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid reservation ID'
      });
    }

    const validStatuses = ['reserved', 'occupied', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be one of: ' + validStatuses.join(', ')
      });
    }

    // Find the table containing this reservation
    const table = await Table.findOne({ 'reservations._id': id });

    if (!table) {
      return res.status(404).json({
        success: false,
        message: 'Reservation not found'
      });
    }

    // Update the reservation status
    const reservation = table.reservations.id(id);
    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: 'Reservation not found'
      });
    }

    reservation.status = status;

    // Update table current status based on reservation status
    if (status === 'occupied') {
      table.currentStatus = 'occupied';
    } else if (status === 'completed' || status === 'cancelled') {
      // Check if there are other active reservations for today
      const today = new Date();
      const hasActiveReservations = table.reservations.some(r => 
        r._id.toString() !== id &&
        r.status === 'reserved' &&
        new Date(r.date).toDateString() === today.toDateString()
      );
      
      table.currentStatus = hasActiveReservations ? 'reserved' : 'available';
    }

    await table.save();
    await table.populate('reservations.userId', 'name phone email');

    res.json({
      success: true,
      message: 'Reservation status updated successfully',
      data: {
        table,
        reservation
      }
    });
  } catch (error) {
    console.error('Error updating reservation status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update reservation status',
      error: error.message
    });
  }
};

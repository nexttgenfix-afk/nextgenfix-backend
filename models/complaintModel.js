const mongoose = require('mongoose');


const complaintSchema = new mongoose.Schema({
  complaintId: { type: String, required: true, unique: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subject: { type: String, required: true },
  category: { type: String, required: true },
  status: { type: String, enum: ['Open', 'In-progress', 'Resolved', 'Closed'], default: 'Open' },
  priority: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
  description: { type: String },
  media: [{ type: String }], // Array of media file URLs
  response: { type: String }, // Admin response
  respondedAt: { type: Date } // When admin responded
}, { timestamps: true });

// Pre-save hook to auto-generate complaintId in format CMP123456 if not provided
complaintSchema.pre('validate', async function(next) {
  if (!this.complaintId) {
    // Generate a unique 6-digit number
    let unique = false;
    let newId;
    while (!unique) {
      newId = 'CMP' + Math.floor(100000 + Math.random() * 900000);
      // Check uniqueness in DB
      const existing = await mongoose.models.Complaint.findOne({ complaintId: newId });
      if (!existing) unique = true;
    }
    this.complaintId = newId;
  }
  next();
});

module.exports = mongoose.model('Complaint', complaintSchema);

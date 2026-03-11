const mongoose = require('mongoose');

const bannerSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  mediaType: {
    type: String,
    enum: ['image', 'video'],
    default: 'image'
  },
  image: {
    type: String
  },
  video: {
    type: String
  },
  link: {
    type: String,
    default: ''
  },
  type: {
    type: String,
    enum: ['promotion', 'offer', 'new_item', 'announcement'],
    default: 'promotion'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  displayOrder: {
    type: Number,
    default: 0
  },
  startDate: {
    type: Date
  },
  endDate: {
    type: Date
  }
}, { timestamps: true });

const Banner = mongoose.model('Banner', bannerSchema);
module.exports = Banner;

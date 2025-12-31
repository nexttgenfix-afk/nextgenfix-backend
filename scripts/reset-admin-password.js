// scripts/reset-admin-password.js
require('dotenv').config();
const mongoose = require('mongoose');

const Admin = require('../models/adminModel');

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGODB_URI missing in .env');
    process.exit(1);
  }

  await mongoose.connect(uri, {});

  const args = process.argv.slice(2);
  const email = args[0] || 'admin@example.com';
  const newPassword = args[1] || 'admin123';

  const admin = await Admin.findOne({ email });
  if (!admin) {
    console.error('Admin not found for email=', email);
    await mongoose.disconnect();
    process.exit(1);
  }

  admin.password = newPassword; // pre-save hook on model will hash it
  await admin.save();

  console.log(`Password for ${email} reset to "${newPassword}" (hashed in DB). AdminId=${admin._id}`);
  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
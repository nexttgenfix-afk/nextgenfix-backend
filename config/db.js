const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.MONGODB;
  if (!uri) {
    console.warn('No MongoDB URI provided in environment. Skipping DB connection (running in mock mode).');
    return null;
  }
  try {
    // Allow populating paths that are not defined in the schema when needed
    // This helps during incremental removals of fields like `chefId` without crashing.
    mongoose.set('strictPopulate', false);
    // mongoose v6+ uses sensible defaults; avoid passing deprecated driver options
    const conn = await mongoose.connect(uri);

    // In production, consider disabling auto index builds and manage indexes via migrations:
    // mongoose.set('autoIndex', false);

    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    // don't exit process; return null so server can still run in degraded/mock mode
    return null;
  }
};

module.exports = connectDB;

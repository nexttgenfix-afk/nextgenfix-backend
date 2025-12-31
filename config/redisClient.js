require('dotenv').config();

const redis = require('redis');

let client;

if (process.env.REDIS_URL) {
  client = redis.createClient({
    url: process.env.REDIS_URL,
  });

  client.connect()
    .then(() => console.log("✅ Redis Cloud connected"))
    .catch((err) => console.error("❌ Redis Cloud connection failed:", err));
} else {
  console.warn('No REDIS_URL provided. Redis is disabled (mock mode).');
  // Create a mock client that doesn't fail
  client = {
    get: async () => null,
    set: async () => 'OK',
    del: async () => 1,
    exists: async () => 0,
    expire: async () => 1,
    ttl: async () => -1,
    disconnect: async () => {},
  };
}

module.exports = client;

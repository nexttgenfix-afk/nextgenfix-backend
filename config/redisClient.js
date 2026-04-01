require('dotenv').config();

const redis = require('redis');

let client;

if (process.env.REDIS_URL) {
  client = redis.createClient({
    url: process.env.REDIS_URL,
    socket: {
      connectTimeout: 5000,
      reconnectStrategy: (retries) => {
        if (retries > 4) {
          console.error("❌ Redis reconnection failed after 5 attempts. Falling back to mock.");
          return false; // stop retrying
        }
        return Math.min(retries * 500, 2000);
      }
    }
  });

  client.on('error', (err) => {
    console.error("❌ Redis Error:", err.message);
  });

  client.connect()
    .then(() => console.log("✅ Redis Cloud connected"))
    .catch((err) => {
      console.error("❌ Redis Cloud connection failed:", err.message);
      // Ensure client is usable as a mock if connection fails
      setupMockClient();
    });
} else {
  console.warn('No REDIS_URL provided. Redis is disabled (mock mode).');
  setupMockClient();
}

function setupMockClient() {
  client = {
    get: async () => null,
    set: async () => 'OK',
    del: async () => 1,
    exists: async () => 0,
    expire: async () => 1,
    ttl: async () => -1,
    disconnect: async () => {},
    on: () => {}
  };
}

module.exports = client;

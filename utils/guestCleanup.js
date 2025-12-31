const { cleanupExpiredGuests } = require('../services/guestService');

/**
 * Cleanup expired guest users
 * This function is called by the cron job
 */
const cleanupGuests = async () => {
  try {
    console.log('Starting guest cleanup...');
    const result = await cleanupExpiredGuests();
    console.log('Guest cleanup completed:', result);
  } catch (error) {
    console.error('Guest cleanup failed:', error);
  }
};

module.exports = {
  cleanupGuests
};
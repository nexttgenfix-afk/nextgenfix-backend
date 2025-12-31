const crypto = require('crypto');

module.exports = {
  formatCurrency(amount) {
    if (typeof amount !== 'number') amount = Number(amount) || 0;
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
  },

  generateReferralCode(length = 6) {
    return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length).toUpperCase();
  },

  generateUniqueId(prefix = '') {
    return prefix + crypto.randomBytes(8).toString('hex');
  },

  haversineDistance([lat1, lon1], [lat2, lon2]) {
    // return distance in km
    function toRad(x) { return x * Math.PI / 180; }
    const R = 6371; // km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }
};

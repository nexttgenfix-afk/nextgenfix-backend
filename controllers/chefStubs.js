// Stub for removed chef-specific functions
// This module provides placeholder responses for chef endpoints that have been removed

const chefRemovedResponse = (req, res) => {
  return res.status(410).json({ 
    success: false,
    message: "Chef features have been removed from this platform. Please use restaurant features instead.",
    removed: true
  });
};

module.exports = {
  // For any chef-specific controller that needs stubbing
  stub: chefRemovedResponse,
  
  // Common chef function stubs
  getChefDetails: chefRemovedResponse,
  getPopularChefs: chefRemovedResponse,
  getChefRatings: chefRemovedResponse,
  getTopHomeKitchens: chefRemovedResponse,
  toggleMenuItemSpecial: chefRemovedResponse,
  updateMenuItemsAvailability: chefRemovedResponse,
  getChefMenuItemsAdvanced: chefRemovedResponse,
  addChef: chefRemovedResponse,
  getAllChefs: chefRemovedResponse,
  getChefById: chefRemovedResponse,
  updateChef: chefRemovedResponse,
  deleteChef: chefRemovedResponse
};

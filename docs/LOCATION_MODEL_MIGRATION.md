# Location Model Migration - Complete Implementation

## Overview
Successfully migrated from `Address` model to `Location` model to match frontend Google Maps integration and avoid confusion between frontend/backend terminology.

## ✅ Implementation Completed

### 1. New Location Model (`locationModel.js`)
Created comprehensive location model with Google Maps integration:

#### **Google Maps Fields:**
- `placeId` - Google Maps Place ID
- `formattedAddress` - Complete formatted address from Google Maps
- `addressComponents` - Structured components:
  - `street` - Street address/route
  - `city` - City/locality
  - `state` - State/administrative area
  - `postalCode` - Postal code/ZIP
  - `country` - Country

#### **User-Friendly Fields:**
- `label` - Custom name (e.g., "Jaya's Home", "My Office")
- `saveAs` - Category: `Home`, `Work`, or `Others`
- `flatNumber` - Flat/House No/Floor/Building (required)
- `landmark` - Nearby landmark
- `deliveryInstructions` - Special delivery notes

#### **Geolocation:**
- `coordinates` - GeoJSON Point with [longitude, latitude]
- 2dsphere index for geospatial queries

#### **Management:**
- `isDefault` - Default delivery location flag
- `lastUsed` - Timestamp of last usage
- `usageCount` - Number of times used

#### **Features:**
- Pre-save hook ensures only one default location per user
- Virtual `displayAddress` for UI display
- `recordUsage()` method to track location usage

### 2. Updated Files

#### **Models:**
- ✅ `userModel.js` - Changed `addresses` → `locations`, ref: `Location`
- ✅ `orderModel.js` - Updated import to `locationModel`
- ✅ `chefRequestModel.js` - Changed `deliveryAddress` ref to `Location`
- ❌ `addressModel.js` - Deleted (replaced by `locationModel.js`)

#### **Controllers:**
- ✅ `userController.js` - Complete refactor:
  - Added `Location` model import
  - New functions: `addLocation`, `getLocations`, `getDefaultLocation`, `setDefaultLocation`, `editLocation`, `deleteLocation`
  - Backward compatibility aliases for old `address` functions
  - Updated to handle Google Maps fields

#### **Services:**
- ✅ `guestService.js` - Updated:
  - Changed `Address` → `Location`
  - Updated merge logic for `locations` array
  - Fixed cleanup to delete `deletedLocations`

#### **Routes:**
- ✅ `userRoutes.js` - Dual routing:
  - New routes: `/locations`, `/locations/:locationId`, etc.
  - Old routes: `/addresses`, `/addresses/:addressId`, etc. (backward compatible)

### 3. API Endpoints

#### **New Location Endpoints (Recommended):**
```
POST   /api/users/locations              - Add new location
GET    /api/users/locations              - Get all locations
GET    /api/users/locations/default      - Get default location
PUT    /api/users/locations/:locationId  - Update location
PUT    /api/users/locations/:locationId/default - Set as default
DELETE /api/users/locations/:locationId  - Delete location
```

#### **Old Address Endpoints (Backward Compatible):**
```
POST   /api/users/addresses              - Add new address
GET    /api/users/addresses              - Get all addresses
GET    /api/users/addresses/default      - Get default address
PUT    /api/users/addresses/:addressId   - Update address
PUT    /api/users/addresses/:addressId/default - Set as default
DELETE /api/users/addresses/:addressId   - Delete address
```

### 4. Request/Response Format

#### **Add Location Request:**
```json
{
  "placeId": "ChIJN1t_tDeuEmsRUsoyG83frY4",
  "formattedAddress": "Room number 12, Cosmo Plaza, Big Apple, Panvel West, Near KEM, Mumbai, Maharashtra 400706, India",
  "addressComponents": {
    "street": "Cosmo Plaza",
    "city": "Mumbai",
    "state": "Maharashtra",
    "postalCode": "400706",
    "country": "India"
  },
  "label": "Jaya's Home",
  "saveAs": "Home",
  "flatNumber": "Room number 12",
  "landmark": "Near KEM Hospital",
  "deliveryInstructions": "Call on arrival",
  "coordinates": [73.1145, 19.0760],
  "isDefault": true
}
```

#### **Response:**
```json
{
  "message": "Location added successfully",
  "location": {
    "_id": "...",
    "user": "...",
    "placeId": "ChIJN1t_tDeuEmsRUsoyG83frY4",
    "formattedAddress": "Room number 12, Cosmo Plaza...",
    "addressComponents": { ... },
    "label": "Jaya's Home",
    "saveAs": "Home",
    "flatNumber": "Room number 12",
    "landmark": "Near KEM Hospital",
    "deliveryInstructions": "Call on arrival",
    "coordinates": {
      "type": "Point",
      "coordinates": [73.1145, 19.0760]
    },
    "isDefault": true,
    "usageCount": 0,
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

## 🔄 Migration Notes

### **Database Migration Required:**
The database collection will change from `addresses` to `locations`. You may need to:
1. Rename the collection: `db.addresses.renameCollection("locations")`
2. Or run a migration script to copy and transform data
3. Update user documents: rename `addresses` field to `locations`

### **Backward Compatibility:**
- All old `/addresses` endpoints still work
- Controller functions aliased (e.g., `addAddress` → `addLocation`)
- Frontend can migrate gradually to new endpoints

### **Required Changes for Frontend:**
When user selects location from Google Maps, send:
1. `placeId` from Google Maps
2. `formattedAddress` from Google Maps
3. `addressComponents` parsed from Google Maps address_components
4. `coordinates` as [longitude, latitude] array
5. User inputs: `flatNumber`, `label`, `saveAs`, `landmark`, `deliveryInstructions`

## 📊 Benefits

1. **Google Maps Integration** - Direct support for Google Maps data structure
2. **Better UX** - Users can save custom labels and categories
3. **Improved Search** - 2dsphere index for nearby location queries
4. **Usage Tracking** - Know which locations are frequently used
5. **Clear Naming** - "Location" matches frontend terminology
6. **Delivery Instructions** - Dedicated field for delivery notes
7. **Backward Compatible** - Old code continues to work

## ✅ Testing Checklist

- [x] Location model created with all required fields
- [x] User model updated to use locations
- [x] Order model updated to use locationModel
- [x] Guest service updated for location merging
- [x] User controller updated with new functions
- [x] Routes added for both location and address endpoints
- [x] Backward compatibility maintained
- [x] No compilation errors

## 🚀 Next Steps

1. Test API endpoints with Postman/Insomnia
2. Run database migration script
3. Update frontend to use new `/locations` endpoints
4. Update frontend to send Google Maps data structure
5. Test guest-to-user location merging
6. Monitor for any issues in production

## 📝 Notes

- The old `addressModel.js` has been deleted
- All references updated to `Location` model
- Indexes optimized for common queries
- Pre-save hooks ensure data integrity

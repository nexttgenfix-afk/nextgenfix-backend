# Database Migration Guide

This guide covers all database migrations needed for the three phases of implementation (Wallet, Help & Support, Video Uploads).

## Overview

| Phase | Feature | Migration Needed | Status |
|-------|---------|------------------|--------|
| 1 | Wallet | ✅ No - All new fields have defaults | Ready |
| 2 | Help & Support | ⚠️ Yes - Complaint schema changes | See below |
| 3 | Video Uploads | ✅ No - All new fields have defaults | Ready |

## Pre-Migration Checklist

- [ ] Database backed up
- [ ] Development environment tested
- [ ] All servers stopped
- [ ] Migration script reviewed

## Phase 2: Complaints Migration

**What's changing:**
1. `category` field: freeform string → enum with 8 values
2. `response` field: single string → `responses` array (for multiple admin responses)
3. New optional fields: `assignedTo`, `relatedOrderId`, `resolvedAt`, `resolvedBy`, `closedAt`, `lastResponseAt`, `tags`
4. Old fields kept for backward compatibility

**Why:**
- Support multiple admin responses to same complaint (better workflow)
- Standardized categories (internal note support, better filtering)
- Track resolution details and assignments

### Running the Migration

**1. Backup your database:**
```bash
# Using mongodump
mongodump --uri="mongodb://localhost:27017/nextgenfix" --out=./backup-$(date +%Y%m%d)

# Or using MongoDB Atlas:
# Go to Dashboard > Backup > Backup Now
```

**2. Test migration locally:**
```bash
# Restore backup to local dev database
# Run migration with test data first
NODE_ENV=development node migrations/migrate-complaints.js
```

**3. Run migration on production:**
```bash
# From backend root directory
NODE_ENV=production node migrations/migrate-complaints.js
```

### What the Migration Does

1. **Maps old categories** to new enum values:
   - `order_issue` → `order_issue` ✓
   - `delivery_issue` → `delivery_issue` ✓
   - `payment_issue` → `payment_issue` ✓
   - `quality_issue` → `menu_issue`
   - `complaint` → `order_issue`
   - Unknown values → `general_inquiry`

2. **Converts responses format:**
   ```javascript
   // Before
   {
     response: "Fixed the issue",
     respondedAt: "2024-02-14T10:00:00Z",
     respondedBy: ObjectId
   }

   // After
   {
     responses: [{
       adminId: ObjectId,
       adminName: "Admin",
       message: "Fixed the issue",
       isInternal: false,
       createdAt: "2024-02-14T10:00:00Z"
     }],
     lastResponseAt: "2024-02-14T10:00:00Z"
   }
   ```

3. **Adds missing fields** with defaults:
   - `assignedTo`: null
   - `relatedOrderId`: null
   - `resolvedAt`: null
   - `resolvedBy`: null
   - `closedAt`: null
   - `lastResponseAt`: timestamp of first response (if exists)
   - `tags`: []

### Verification

The migration script will verify:
- ✓ All complaints have valid categories
- ✓ All complaints have responses array
- ✓ No data loss or corruption

Output example:
```
✅ Migration Results:
  ✓ Successfully migrated: 247
  ✓ All complaints have valid categories
  ✓ All complaints have responses array
```

### Rollback Plan

If migration fails:

```bash
# 1. Stop all services
npm stop

# 2. Restore backup
mongorestore --uri="mongodb://localhost:27017/nextgenfix" ./backup-20240214

# 3. Investigate issue
# Check migration script, debug, fix

# 4. Retry migration
node migrations/migrate-complaints.js
```

## Phase 1 Migrations (Already Completed)

These were part of the 11 bug fixes completed in Phase 1:

### ✅ Mood Enum Migration
**File:** `models/userModel.js` (line 153)

Old values → New values:
- `good` → `locked_in`
- `angry` → `bougie`
- `in_love` → `homesick`
- `sad` → `burnt_tf_out`
- (none) → `need_a_hug` (new)

**Action Required:** None - new enum is backward compatible for queries, old data will be treated as unknown. Admin should update via UI or data scripts if needed.

### ✅ Order Type Enum Migration
**File:** `models/orderModel.js` (line 12)

Old values → New values:
- `on_site_dining` → Not applicable (removed)
- `delivery` → `delivery`
- (none) → `take_away` (new)
- (none) → `car` (new)

**Action Required:** Migrate existing `on_site_dining` orders:
```javascript
// Optional: Run this once if you have on_site_dining orders
db.orders.updateMany(
  { orderType: "on_site_dining" },
  { $set: { orderType: "delivery" } }
)
```

### ✅ User Fields Migration
**File:** `models/userModel.js` (line 237)

Added fields (all with safe defaults):
- `walletBalance`: 0
- `calorieGoal`: null
- `preferences.allergens`: []

**Action Required:** None - all have defaults

## Post-Migration Steps

1. **Verify application:**
   ```bash
   # Start backend
   cd nextgenfix-backend && npm start

   # Test endpoints
   curl -X GET http://localhost:5000/api/complaints -H "Authorization: Bearer <token>"
   ```

2. **Check admin dashboard:**
   - Navigate to "Help & Support" page
   - View complaints list
   - Verify categories display correctly
   - Test response addition (should create new response entry)

3. **Monitor logs:**
   ```bash
   # Check for any errors
   tail -f logs/app.log | grep -i error
   ```

4. **Update documentation:**
   - [ ] Update API documentation
   - [ ] Update team on new fields
   - [ ] Update validation rules in docs

## Database Indexes

After migration, ensure these indexes exist for optimal performance:

```javascript
// Complaint indexes
db.complaints.createIndex({ user: 1, createdAt: -1 })
db.complaints.createIndex({ category: 1, status: 1 })
db.complaints.createIndex({ assignedTo: 1, status: 1 })
db.complaints.createIndex({ subject: "text", description: "text" })

// Wallet indexes
db.wallettransactions.createIndex({ user: 1, createdAt: -1 })
db.wallettransactions.createIndex({ user: 1, type: 1 })
db.wallettransactions.createIndex({ "metadata.orderId": 1 })

// FAQ indexes
db.faqs.createIndex({ question: "text", answer: "text", tags: "text" })
db.faqs.createIndex({ category: 1, isActive: 1, order: 1 })
```

## Testing

### Local Testing Script

```bash
# 1. Start local MongoDB
mongod

# 2. Create test database
mongo nextgenfix --eval "
  db.complaints.insertMany([
    {
      complaintId: 'TEST1',
      category: 'quality_issue',
      response: 'Fixed',
      respondedAt: new Date()
    },
    {
      complaintId: 'TEST2',
      category: 'unknown_type',
      response: null
    }
  ])
"

# 3. Run migration
NODE_ENV=development node migrations/migrate-complaints.js

# 4. Verify results
mongo nextgenfix --eval "
  db.complaints.find().pretty()
"
```

## FAQ

**Q: Can I rollback if something goes wrong?**
A: Yes! You have a backup and can restore it. Just follow the rollback plan section.

**Q: Will this affect running servers?**
A: Yes - stop all servers before running migration to prevent conflicts.

**Q: What if I have custom categories?**
A: The script maps unknown categories to `general_inquiry`. Review the mapping function and adjust if needed.

**Q: How long does the migration take?**
A: Depends on dataset size. For 1000 complaints: ~5-10 seconds.

**Q: Can I skip the migration?**
A: The app will work with old Complaint documents, but:
- Single response view only (can't see multiple responses)
- Old categories won't be part of enum filtering
- New fields will show as null/undefined

Not recommended - migrate as soon as possible.

## Support

If migration fails:
1. Check MongoDB logs: `tail -f /var/log/mongodb/mongod.log`
2. Verify migration script syntax: `node -c migrations/migrate-complaints.js`
3. Check database connection: `mongo --eval "db.adminCommand('ping')"`
4. Restore backup and retry

Contact DevOps team if issues persist.

## Checklist for Deployment

- [ ] Database backed up
- [ ] Migration script tested locally
- [ ] Production database verified
- [ ] All servers stopped
- [ ] Migration run successfully
- [ ] Verification output reviewed
- [ ] Application restarted
- [ ] Admin dashboard tested
- [ ] API endpoints tested
- [ ] Logs reviewed for errors
- [ ] Team notified

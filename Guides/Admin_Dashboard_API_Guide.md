  
- **Admin Dashboard Stats (Chart & Summary Data)**
  - `GET /api/admin/stats`
  - **Headers:** `Authorization: Bearer <token>`
  - **Response:**
    - `totals: { users, chefs, orders, issues }`
    - `trends: { months: ["YYYY-MM"...], users: [...], chefs: [...], orders: [...], issues: [...] }`
  - Returns total counts and monthly trends for users, chefs, orders, and issues for dashboard graphs and summary cards.
- **Admin Dashboard Overview Metrics**
  - `GET /api/admin/overview`
  - **Headers:** `Authorization: Bearer <token>`
  - **Response:** `{ users, chefs, orders, pendingChefVerifications, pendingReviews, complaints }`
  - Returns counts for users, chefs, orders, pending chef verifications, pending reviews, and complaints for dashboard summary cards.

- **Admin Dashboard Recent Orders**
  - `GET /api/admin/recent-orders`
  - **Headers:** `Authorization: Bearer <token>`
  - **Response:** `[{ orderId, user, chef, items, total, status, createdAt, ... }]`
  - Returns the last 10 orders for the dashboard recent orders widget.

- **Admin Dashboard Pending Chef Verifications**
  - `GET /api/admin/chef-verifications`
  - **Headers:** `Authorization: Bearer <token>`
  - **Response:** `{ chefs: [...], total }`
  - Returns a paginated list of chefs pending verification for the dashboard widget.

- **Admin Dashboard Reviews Pending Moderation**
  - `GET /api/admin/reviews-pending`
  - **Headers:** `Authorization: Bearer <token>`
  - **Response:** `{ reviews: [...], total }`
  - Returns a paginated list of reviews pending moderation for the dashboard widget.

**Note:** All endpoints require a valid admin JWT token in the `Authorization` header.

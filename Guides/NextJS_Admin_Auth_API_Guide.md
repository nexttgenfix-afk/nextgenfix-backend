# Naanly Backend Authentication Integration Guide (Next.js Admin)

## Overview
This guide explains how to integrate Amazon Cognito authentication with the Naanly backend for the Next.js admin web app. The backend uses Cognito JWT verification for all protected API routes.

---

## 1. Authentication Flow
- **Signup, Login, Logout:** Handled directly in the Next.js app using Cognito SDK or AWS Amplify.
- **API Requests:** After login, send the Cognito JWT token in the `Authorization` header for all protected API requests.

---

## 2. Signup Flow
1. Use Cognito SDK/AWS Amplify to register the admin (email/OTP).
2. On successful signup, obtain the Cognito user ID (`sub`) and user info.
3. Send a POST request to the backend to create an admin record in MongoDB:
   - Endpoint: `/api/admin/register`
   - Body:
     ```json
     {
       "cognitoId": "<Cognito sub>",
       "email": "<admin email>",
       ...other fields
     }
     ```

---

## 3. Login Flow
1. Use Cognito SDK/AWS Amplify to log in and obtain JWT tokens.
2. For protected API requests, include the JWT token in the header:
   - Header:
     ```http
     Authorization: Bearer <Cognito JWT token>
     ```

---

## 4. Protected vs Public API Endpoints
- **Public Endpoints:** No authentication required (e.g., `/api/home`, `/api/categories`, `/api/menu-items`, `/api/chat`, `/api/notifications`).
- **Protected Endpoints:** Require Cognito JWT token (e.g., `/api/admin`, `/api/admin/auth`, `/api/users`, `/api/orders`, etc.).

---

## 5. Error Handling
- If the JWT token is missing or invalid, backend returns HTTP 401 Unauthorized.
- Always check for token expiry and refresh as needed using Cognito SDK/AWS Amplify.

---

## 6. Example: Making a Protected API Request
```js
fetch('https://your-backend-url/api/admin', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${jwtToken}`,
    'Content-Type': 'application/json'
  }
})
.then(res => res.json())
.then(data => { /* handle data */ })
```

---

## 7. Useful Resources
- [AWS Amplify Auth Docs](https://docs.amplify.aws/lib/auth/getting-started/q/platform/js/)
- [Amazon Cognito Docs](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-identity-pools.html)

---

## 8. Contact Backend Team
For questions or issues, contact the backend team via Slack or email.

# Guest authentication (frontend integration)

Short note for frontend engineers on the expected guest flow used by the backend.

Overview
- When the user taps "Skip" on the login screen, the frontend should explicitly request a guest session from the backend.
- The backend returns a signed guest token (JWT) that the frontend should use exactly like a logged-in user's token: include it in the `Authorization` header for subsequent requests.

Why this pattern
- Keeps the server from creating guest accounts silently and helps avoid many orphan guest users.
- Unifies guest and authenticated flows: server middleware expects a token in the Authorization header and will accept either a guest token or a user token.

Endpoint
- POST /api/auth/guest
  - Request: no body required (optional device info may be inferred from headers)
  - Response: 200 {
      token: "<jwt>",
      guestId: "<mongoId>",
      user: { /* guest user doc */ }
    }

Frontend responsibilities
1. When user taps Skip, call `POST /api/auth/guest`.
2. Store the returned `token` in your preferred client storage (secure storage / localStorage / AsyncStorage depending on platform).
3. For all subsequent requests to protected endpoints, send a single header:

   Authorization: Bearer <token>

4. If a request returns 401 with an `expired: true` flag and message "Guest session expired", prompt the user to login or call `POST /api/auth/guest` again to refresh the guest token.

Minimal JavaScript examples

Obtain a guest token (fetch):

```javascript
const res = await fetch('/api/auth/guest', { method: 'POST' });
const data = await res.json();
// save data.token securely
```

Use the token for protected requests:

```javascript
const token = /* loaded token */;
const res = await fetch('/api/cart', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

Axios example:

```javascript
const { data } = await axios.post('/api/auth/guest');
const token = data.token;
axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
```

PowerShell curl example (copyable):

```powershell
# Request guest token
$resp = Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/auth/guest"
$token = $resp.token

# Call protected endpoint
Invoke-RestMethod -Method Get -Uri "http://localhost:3000/api/cart" -Headers @{ Authorization = "Bearer $token" }
```

Notes & edge-cases
- The backend middleware `requireGuestOrUser` requires a token and will respond with 401 and a message telling the client to call `/api/auth/guest` when no token is provided.
- Choose storage appropriate for the platform (web: localStorage or secure cookie; mobile: secure storage). Avoid exposing tokens in logs.
- Guest tokens have a lifetime (see `user.guestExpiresAt` on the returned `user` object). Handle expired guest tokens by prompting the user to re-create a guest session or to login.

If you want, I can add a single-file frontend helper (tiny JS module) to request and manage the guest token for web and mobile.

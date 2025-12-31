  
- **Admin Logout**
  - `POST /admin/auth/logout`
  - **Headers:** `Authorization: Bearer <token>`
  - **Response:** `{ message }`
  - For JWT-based auth, this simply tells the client to delete the token. No server-side session is kept.
- **Admin Signup**
  - `POST /admin/signup`
  - **Body:** `{ name, email, password }`
  - **Response:** `{ message, user }`
  - Use this endpoint to create a new admin account. No authentication required for signup.

- **Admin Login**
  - `POST /admin/login`
  - **Body:** `{ email, password }`
  - **Response:** `{ token, user }`
  - Use the returned JWT token as `Authorization: Bearer <token>` in all subsequent requests.

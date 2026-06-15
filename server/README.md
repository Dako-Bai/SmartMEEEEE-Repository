# Navarro Admin v2

This branch implements a backend (Node.js + Express) for the admin features requested.

Quick start (development):

1. Create .env file in server/ with contents (example in .env.example)
2. cd server && npm install
3. npm start

By default the server seeds demo users (admin/user1/user2/user3) on first run.

Endpoints (examples):
- POST /api/auth/login { username, password } -> { token }
- GET /api/users/me -> requires Bearer token
- CRUD pricing/inventory/orders -> see server routes
- GET /api/notifications/stream -> SSE stream for admin notifications


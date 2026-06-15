# Navarro Admin v2 — Overview

I created an initial backend skeleton (Express + SQLite) on branch admin-v2.

What I added in this commit:
- server/ (Express API)
  - index.js (main server)
  - db.js (SQLite initialization + seeds)
  - package.json
  - .env.example
  - README
- docker-compose.yml

Next steps I will perform after your confirmation:
- Integrate the frontend admin UI with the API (login, CRUD, notifications via SSE)
- Add i18n and translations (kk/ru/en)
- Add PDF/Excel export and improved audit viewer in frontend

To run locally:
- Copy server/.env.example -> server/.env and set SMTP/JWT secrets
- cd server && npm install
- npm start

Seeded users (demo):
- admin / admin123 (role: Admin)
- user1 / user123 (role: Client)
- user2 / user456 (role: Client)
- user3 / user357 (role: Client)


# Student Health & Safety with Disciplinary Monitoring (Node.js + Express + SQLite)

## Windows setup (Node 22.13+ required; uses Node's built-in `node:sqlite`, so no C++ build tools are needed)
```powershell
cd school-system
npm install
copy .env.example .env      # then edit .env: set JWT_SECRET (long random string) and ADMIN_PASSWORD (10+ chars)
npm run create-admin        # creates the first admin; afterwards delete ADMIN_PASSWORD from .env
npm run seed                # adds repeat-safe demo students and related records
npm run build               # installs frontend deps and builds the React app (frontend/dist)
npm start                   # http://localhost:3000
```
To maintain a one-way SQLite-to-Neon replica, set `NEON_DATABASE_URL` in `.env`. SQLite remains
the source of truth; the server creates the Neon schema, performs an initial sync, and schedules
an asynchronous full sync after successful writes. Keep the connection string private and use
Neon's pooled connection string when available.
**Development with hot reload:** run `npm run dev:all` to start the backend and frontend together, then open http://localhost:5173 (Vite proxies `/api` to port 3000). Press `Ctrl+C` to stop both services.

**Production deployment:** install the root dependencies with `npm ci`, set the required environment variables, then run `npm run start:production`. This installs the locked frontend dependencies, creates the production bundle, and starts the backend serving both the API and frontend on `PORT` (default `3000`). For deployments that build during an image/build phase, run `npm run build` during the build phase and use `npm start` as the runtime command.

**Render deployment:** use the included [`render.yaml`](./render.yaml) Blueprint, or configure one Web Service with `Root Directory` blank, `Build Command` set to `npm run render:build`, and `Start Command` set to `npm start`. Render will build the React frontend once, then one Node process will serve the frontend and API together. Add `NEON_DATABASE_URL` in Render's environment variables if using Neon. SQLite data on the free instance is not persistent, so Neon should be configured for data that must survive redeploys or restarts.

The SQLite file (`data/school.db`) and all tables are created automatically on first start.
Back it up by copying that file while the server is stopped.

## What is implemented
- Schema from the ER diagram (STUDENT, PARENT, STUDENT_PARENT with composite PK, STAFF, HEALTH_RECORD, SAFETY_INCIDENT, DISCIPLINE_RECORD, ALERT) plus APP_USER and AUDIT_LOG. Foreign keys are enforced (`PRAGMA foreign_keys=ON`), all `ON DELETE RESTRICT`, with indexes and CHECK constraints for enums.
- REST API: `/api/{students,parents,staff,health,incidents,discipline,alerts}` (GET list with `q`, `page`, `limit`, `sort`, `order`, filters, `from`/`to`; GET/POST/PUT/DELETE by id), `/api/links` (student-parent), `/api/dashboard`, `/api/users`, `/api/audit`.
- DELETE **archives** (soft delete) so records are never lost. Staff/parents are "deactivated"/archived the same way.
- JWT (8h expiry) + bcrypt (cost 12); roles enforced on the backend:
  - admin: everything; staff: students, parents, incidents, discipline, alerts; medical: health records, incidents/alerts read; viewer: students, parents, staff (read-only).
- Audit log for logins, creates/updates/archives, and reads/lists of health and discipline data. Dashboard never returns health details.
- React + Vite + Material UI + Recharts + React Router + Axios frontend in `frontend/`: login, collapsible sidebar, top bar with unresolved-alert badge, dashboard (Recharts line and pie charts, stat cards), sortable/searchable/paginated tables with filters and date ranges, validated add/edit dialogs, archive confirmation dialogs, detail pages (student profile shows parents, incidents, discipline, alerts and health according to role), parent linking/unlinking from the student page, user management, audit log, snackbar toasts, loading and empty states, responsive layout.

## Not done (be aware)
- Frontend tests (Vitest/React Testing Library) and backend tests are not written; only manual smoke tests and a successful production build were run. The UI was not exercised in a real browser.
- Source layout is condensed: pages live in `frontend/src/pages` (a generic `ResourcePage` serves all modules); there are no separate `components/hooks/utils/layouts` folders.
- No Alembic-style migrations (schema is `CREATE TABLE IF NOT EXISTS` in `src/db.js`), no Docker Compose, no Settings page, no global top-bar search box.
- Parents can be linked to students only from the student page (the parent page lists linked students).
- No login rate-limiting; no token revocation on logout. Use HTTPS before exposing beyond localhost.

## Troubleshooting login
- Open http://localhost:3000/api/status : it should show `{"ok":true,"hasUsers":true}`. If `hasUsers` is false, run `npm run create-admin` (it creates the admin, or resets the password if the email already exists).
- Open the app at http://localhost:3000 (not by double-clicking an .html file).
- Use the exact `ADMIN_EMAIL` and `ADMIN_PASSWORD` from `.env`; wrap the password in double quotes if it contains `#`.

# Tixelise Frontend

The Tixelise frontend is a React application built with Vite. It provides
role-based screens for platform administrators and tenant administrators and
communicates with the Django REST API using JSON and JWT authentication.

## Requirements

- Node.js 18 or later
- npm
- The Tixelise backend running locally, or a reachable API URL

## Getting started

From the `frontend` directory, install dependencies and start the development
server:

```powershell
npm ci
npm run dev
```

Vite prints the local URL when the server starts (normally
`http://localhost:5173`).

To run the backend and prepare demo accounts, follow the instructions in
[`../backend/README.md`](../backend/README.md).

## API configuration

By default, the frontend sends API requests to:

```text
http://127.0.0.1:8000/api/v1
```

To use a different backend, create a local `.env` file in `frontend` and set:

```dotenv
VITE_API_URL=http://127.0.0.1:8000/api/v1
```

`VITE_API_URL` should include the API prefix, such as `/api/v1`. Vite exposes
variables prefixed with `VITE_` to browser code, so do not put secrets in this
file.

The API client adds the access token to authenticated requests and attempts to
refresh an expired access token. Login session data is stored in browser
`localStorage`.

## Available scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Vite development server |
| `npm run build` | Create the production build in `dist/` |
| `npm run preview` | Preview the production build locally |

## Current screens

- **Platform admin:** dashboard and tenant management (`/platform`,
  `/platform/tenants`)
- **Tenant admin:** dashboard, setup, events, categories, prices, staff,
  assignments, sales, tickets, reports, and audit (`/tenant/...`)
- **POS staff:** `/pos` is currently a placeholder; the POS API is implemented
  by the backend, but the frontend sales terminal is not yet available.

The frontend route checks improve navigation and user experience. The backend
is responsible for enforcing authentication, permissions, and tenant
isolation.

## Main source layout

```text
src/
  components/   Shared layout and UI components
  pages/        Login, platform admin, tenant admin, and placeholder screens
  lib/          Shared frontend utilities
  api.js        API client and token refresh handling
  auth.js       Login, logout, and role-based redirects
  session.js    Browser session storage
  App.jsx       Application routes and role guards
```

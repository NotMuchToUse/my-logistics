# Vietstar Logistics — Web Customer

React, TypeScript, Vite, Tailwind CSS and Shadcn UI application for Vietstar
Logistics customers. The codebase is organized by feature under `src/features`,
with shared contracts, API configuration, authentication and routing under
`src/core`.

## Development

```sh
npm install
npm run dev
```

Copy `.env.example` to `.env` to configure the API endpoint and mock-data mode.
`VITE_USE_MOCK=true` uses local mock data; it does not call the backend.
For real API testing, set `VITE_USE_MOCK=false` and make sure the PHP API is
running at `VITE_API_BASE_URL` (defaults to `http://localhost:8000` in Vite
development). Configure the backend database and `CORS_ALLOWED_ORIGINS` to
include the frontend origin. Restart Vite after changing `.env`.

## Validation

```sh
npm run build
npm run lint
```

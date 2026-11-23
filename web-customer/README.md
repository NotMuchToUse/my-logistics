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

Set `VITE_API_BASE_URL` and `VITE_USE_MOCK` in `.env` to configure the API
endpoint and mock-data mode. See `.env.example` for local defaults.

## Validation

```sh
npm run build
npm run lint
```

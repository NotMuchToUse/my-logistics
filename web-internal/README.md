# Vietstar Logistics — Web Internal

React, TypeScript, Vite, Tailwind CSS and Shadcn UI application for internal
Vietstar Logistics operations. The application shell includes authenticated
routes, branch context, permission-aware navigation and feature-based pages.

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

# Vietstar Logistics — Web Internal

React, TypeScript, Vite, Tailwind CSS and Shadcn UI application for internal
Vietstar Logistics operations. The application shell includes authenticated
routes, branch context, permission-aware navigation and feature-based pages.

## Development

From the repository root, create the local environment file once:

```powershell
if (-not (Test-Path .\web-internal\.env)) {
  Copy-Item .\web-internal\.env.example .\web-internal\.env
}
```

Then run the app:

```sh
npm ci
npm run dev
```

The example enables Mock mode, so the app can be checked without the PHP API.
Use `reception@vietstar.test` / `Vietstar123!` to sign in as the demo
receptionist. This is a mock account, not a backend user.

For real API testing, set `VITE_USE_MOCK=false`, configure
`VITE_API_BASE_URL`, and run the PHP API with its database and CORS configured.
In Vite development, the API URL defaults to `http://localhost:8000` if it is
not set. Restart Vite after changing `.env`.

## Validation

```sh
npm run build
npm run lint
```

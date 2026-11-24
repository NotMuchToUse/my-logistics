# Vietstar Logistics

The repository contains separate Web Internal, Web Customer, and PHP API
projects. Frontend dependencies and scripts are managed separately; there is no
root npm test command.

## Run the web apps locally

Requirements: Node.js `^20.19.0` or `>=22.12.0`.

From the repository root, create local environment files once. These files are
ignored by Git:

```powershell
if (-not (Test-Path .\web-internal\.env)) {
  Copy-Item .\web-internal\.env.example .\web-internal\.env
}
if (-not (Test-Path .\web-customer\.env)) {
  Copy-Item .\web-customer\.env.example .\web-customer\.env
}
```

Open a terminal for each app:

```powershell
Set-Location .\web-internal
npm ci
npm run dev
```

```powershell
Set-Location .\web-customer
npm ci
npm run dev
```

The example environment files enable Mock mode, which lets teammates run and
check the UI without a backend. Demo accounts:

| App | Login | Password |
| --- | --- | --- |
| Web Internal | `reception@vietstar.test` | `Vietstar123!` |
| Web Customer | `khachhang@vietstar.test` | `Vietstar123!` |

These are mock accounts, not users in the PHP database. Customer registration
requires completing the privacy-consent step.

## Validate frontend changes

Run these commands from each frontend directory:

```powershell
npm run lint
npm run build
```

The frontend projects do not currently define an `npm test` script. In
PowerShell environments where `npm` is blocked by execution policy, use
`npm.cmd` instead.

## Run against the real API

Set `VITE_USE_MOCK=false` in the relevant frontend `.env` and set
`VITE_API_BASE_URL=http://localhost:8000`. The PHP project requires PHP 8.1+,
Composer, the listed PHP extensions, MySQL configuration in
`server-php/.env`, a database schema, and matching `CORS_ALLOWED_ORIGINS`.
After dependencies and the database are ready, start the API from
`server-php` with:

```powershell
php -S 127.0.0.1:8000 -t public public/index.php
```

The repository currently has no SQL migration/schema file under
`server-php/database/migrations`; the checked-in SQL seed only creates roles.
Therefore Mock mode supports frontend checks from a fresh clone, but a full
real-API/database test needs the schema supplied by the team. Do not treat a
successful Mock flow as proof that the real API works.

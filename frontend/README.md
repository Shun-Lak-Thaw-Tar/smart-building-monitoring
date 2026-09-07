# Frontend — Smart Campus Facilities Portal

React / Vite / JavaScript implementation of WBS 3.8, 3.9 and 3.10. Uses the
existing Tailwind v4, React Router, Axios, Recharts and Lucide packages. No new
application dependencies, UI frameworks or backend endpoints were added.

## Run locally

Start the current backend with the existing backend instructions, then from
`frontend/`:

```powershell
npm.cmd ci
npm.cmd run dev
```

Open [the local portal](http://localhost:5173). The fixed frontend port matches
backend development CORS. The Axios base defaults to `http://localhost:8000/api`.
Copy `.env.example` to `.env` to override `VITE_API_BASE_URL` if needed. Vite
configuration is public; never place secrets in `VITE_` variables.

Sign in using a configured account and choose Office Staff or Administrator.
Credentials are never autofilled or displayed. Demo passwords remain in the
ignored backend `.env` and must not be copied into the frontend.

## Routes

| Role | Routes |
| --- | --- |
| Public | `/login` |
| Office Staff | `/staff/dashboard`, `/staff/requests/new`, `/staff/requests`, `/staff/requests/:id`, `/staff/monitoring` |
| Administrator | `/admin/dashboard`, `/admin/requests`, `/admin/requests/:id`, `/admin/equipment`, `/admin/maintenance`, `/admin/monitoring`, `/admin/staff` |

`/` chooses the authenticated role dashboard or login. Unknown URLs display a
Not Found page. Role guards redirect users to their own dashboard. FastAPI RBAC
remains the authorization authority.

## Implementation

- One Axios client attaches the session token; domain services match existing API contracts.
- AuthContext stores only the token in sessionStorage. Refresh validates `/auth/me`.
- Authenticated 401 responses clear the session. Login 401 stays on the form.
- Shared loading/error/empty states, status badges, dates, dialogs and timed toasts.
- Request filters use URL query parameters and an explicit Apply button. Equipment
  search/status filters are local; building and maintenance filters use the API.
- Reads use stable effect keys and sequence checks to reject stale responses.
- Writes prevent duplicate submission, preserve input on ordinary errors and
  refresh relevant resources after success.
- Native modal dialogs provide focus containment, Escape and focus restoration.
- Desktop sidebar, tablet/mobile drawer, mobile record cards, scrollable tables,
  responsive charts and reduced-motion support.
- Building status comes directly from the monitoring API. Environmental readings
  are visibly labelled simulated and read-only. No safety thresholds or trends
  are fabricated. Temperature (°C) and humidity (%) use separate labelled axes;
  energy is displayed in kWh.
- Chart/management pages are loaded separately to keep the initial bundle smaller.

## Verification

```powershell
npm.cmd run build
```

No lint script or lint dependency is configured in the existing package. Available
scripts remain `dev`, `build`, and `preview`. Build verification is not presented
as linting.

The optional `scripts/verify-ui.mjs` checks real browser workflows against a running
frontend and current PostgreSQL backend. It uses Chrome and the Codex bundled
Playwright runtime on this machine; on another machine set `PLAYWRIGHT_MODULE` to
an installed Playwright module path. This is verification tooling, not an app
dependency. It reads local demo credentials into memory, creates uniquely marked
temporary records and removes those records in `finally`. Run against local demo
data with both existing Demo Staff and Demo Admin accounts configured.

```powershell
node scripts/verify-ui.mjs
```

`BROWSER_TEST_URL` optionally changes the frontend address. Screenshots are written
to ignored `.tmp/frontend-qa/`. The script checks both roles, request creation,
assignment/status history, equipment, both maintenance modes, Staff accounts,
responsive layouts and error/session states. Network/503/401 states are injected
only in the test browser; application API calls and successful writes use the real
backend. Do not edit source during a run against Vite development HMR; use the
production preview for final checks.

See `docs/frontend-verification.md` in the repository root for results and limits.
WBS 3.11 is the next stage and has not been started.

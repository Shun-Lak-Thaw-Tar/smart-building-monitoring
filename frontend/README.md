# Frontend

Minimal React application written in JavaScript, built with Vite. Tailwind CSS
uses the `@tailwindcss/vite` plugin and `@import "tailwindcss"` in `src/index.css`.
No legacy Tailwind init command or PostCSS configuration is needed.

```powershell
npm.cmd ci
npm.cmd run dev
npm.cmd run build
```

Open http://localhost:5173. The development server uses a fixed port to match CORS.
The agreed routing, HTTP, chart and icon packages are installed for later features.
No feature routes or API calls are implemented yet.

Optional: copy `.env.example` to `.env` before developing API integration.
`VITE_API_BASE_URL` is reserved for the future Axios client. All `VITE_` values
are public and must never contain passwords or secrets.

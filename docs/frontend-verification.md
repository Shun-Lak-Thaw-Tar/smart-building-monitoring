# Frontend verification — WBS 3.8, 3.9 and 3.10

Verified on 7 September 2026 against the current FastAPI application and real
PostgreSQL database. WBS 3.11 has not been started.

## Initial inspection

Git was clean. The frontend contained the original placeholder App, base CSS and
main entry, with empty component/layout/page/service/context/hook/utility folders.
Existing package scripts: dev, build, preview. No lint configuration or command.
No wireframe/design document was found among repository files; the detailed
campus design brief supplied for this batch guided the implementation. Existing
backend schemas and routers confirmed exact field names and response shapes.
The original frontend build passed after allowing Vite temporary-file access.

## Implementation and dependencies

All requested routes are implemented. The existing React, Vite, JavaScript,
Tailwind v4, React Router, Axios, Recharts and Lucide packages were reused.
No package.json or package-lock.json change. Prettier 3.6.2 was run once as an
external formatting tool; it was not added as a project dependency. Browser QA
used the already bundled Playwright runtime and installed Chrome.

Axios domain services, sessionStorage authentication, `/auth/me` restoration,
role guards, responsive AppShell, shared feedback components and native modal
dialogs provide the foundation. All requested Staff and Admin forms use the
existing backend contracts. Status/priority/date mappings are centralized. Chart
and management pages are loaded separately. Building health always comes from
backend `overall_status`; environmental readings are simulated and read-only.

## Verification results

| Area | Result |
| --- | --- |
| Foundation | Real Staff and Admin sign-in; wrong selected role rejected; refresh restores the session; logout; role navigation and route guards passed |
| Staff | Dashboard, submit general request, My Requests, status filter, detail, initial Pending event, monitoring passed |
| Dependent equipment | Changing building clears the prior selection; matching options reload; general requests work without equipment |
| Admin requests | Search locates temporary request; assignment persists; In Progress update and note appear in the refreshed timeline |
| Equipment | Temporary equipment created; default Operational; edited to Maintenance Required; building is read-only when editing |
| Maintenance | Preventive work and work linked to a resolved request recorded; building/equipment filters passed |
| Staff accounts | Mismatched confirmation rejected; temporary Staff created; real login succeeds; empty request state shown; role fixed by backend |
| Monitoring | Both roles; campus cards; detail dialog; numeric latest reading; separate temperature/humidity axes and energy chart; historical readings |
| Responsive Staff | Dashboard, request form/list/detail and monitoring checked at 1440, 1024, 768 and 375 px |
| Responsive Admin | All seven page types checked at the same widths; monitoring and Staff-account dialogs fit; no document horizontal overflow |
| Keyboard | Form submission; native dialog focus containment; Escape closes; drawer restores focus to menu button |
| Reduced motion | Preference respected by CSS and Recharts; page animation duration verified |
| Errors | Readable 503 and network errors; retry; genuine resource 404; unknown frontend route; authenticated 401 clears token and redirects |
| Production browser | Full combined script passed with no page runtime errors; final visual/keyboard pass also found no console warnings |
| Frontend build | Passed, no bundle warnings after code splitting |
| Lint | Not configured; not claimed as run or passed |
| Backend regression | 141 passed in 17.84s; one sandbox warning about writing pytest's optional cache |

The browser helper uses real backend reads/writes for workflows. Only service,
network and session error cases use browser-local response interception. These
checks are scoped frontend verification, not the broader WBS 3.11 hardening stage.

## Issues corrected during implementation

- Corrected file placement before the Staff-stage build.
- Made an off-screen table label relative to its scroll container; this removed
  document overflow at laptop widths without hiding operational columns.
- Split chart/management bundles to resolve the initial bundle-size warning.
- Removed stale resource data immediately when its selection key changes.
- Allowed chart/page animations to settle before the final visual review.
- A development hot-reload during source formatting briefly invalidated the
  AuthContext in an in-progress test. The final full run used the immutable
  production build and completed with zero runtime errors.

## Data and security

All verification-only request, status-history, equipment, maintenance and Staff
records were removed using exact generated IDs and matching verification markers.
Final counts: 3 buildings, 9 equipment, 15 environmental readings, 3 users,
4 requests, 7 request-status events, 3 maintenance records. Existing demo data
was preserved. No backend models, routers, schemas, migrations or other backend
files changed. Existing FastAPI RBAC remains authoritative.

Passwords and JWTs were never written to browser logs, screenshots or tracked
files. Staff creation passwords are cleared on success and otherwise exist only
in the live form. No localStorage auth, role escalation controls or extra
functional scope were added. Screenshots and temporary diagnostics stay under
ignored `.tmp/frontend-qa/`.

## File inventory

Modified:

- `.gitignore` — ignore local QA artifacts.
- `README.md` — current implementation and next stage.
- `frontend/README.md` — startup, architecture and verification guide.
- `frontend/index.html` — portal metadata.
- `frontend/src/App.jsx` — routes, guards and lazy page loading.
- `frontend/src/index.css` — campus visual system and responsive/motion rules.
- `frontend/src/main.jsx` — formatting only.

Created:

- `frontend/src/components/BuildingCards.jsx`
- `frontend/src/components/Charts.jsx`
- `frontend/src/components/RequestList.jsx`
- `frontend/src/components/RouteGuards.jsx`
- `frontend/src/components/UI.jsx`
- `frontend/src/context/AuthContext.jsx`
- `frontend/src/context/ToastContext.jsx`
- `frontend/src/hooks/useAction.js`
- `frontend/src/hooks/useReducedMotion.js`
- `frontend/src/hooks/useResource.js`
- `frontend/src/layouts/AppShell.jsx`
- `frontend/src/pages/AdminDashboard.jsx`
- `frontend/src/pages/Equipment.jsx`
- `frontend/src/pages/Login.jsx`
- `frontend/src/pages/Maintenance.jsx`
- `frontend/src/pages/Monitoring.jsx`
- `frontend/src/pages/NewRequest.jsx`
- `frontend/src/pages/RequestDetail.jsx`
- `frontend/src/pages/Requests.jsx`
- `frontend/src/pages/StaffAccounts.jsx`
- `frontend/src/pages/StaffDashboard.jsx`
- `frontend/src/services/apiClient.js`
- `frontend/src/services/authService.js`
- `frontend/src/services/buildingService.js`
- `frontend/src/services/equipmentService.js`
- `frontend/src/services/maintenanceService.js`
- `frontend/src/services/monitoringService.js`
- `frontend/src/services/requestService.js`
- `frontend/src/services/userService.js`
- `frontend/src/utils/format.js`
- `frontend/scripts/verify-ui.mjs`
- `docs/frontend-verification.md`

No commit, push, branch change or remote change was performed.

## Outcome

WBS 3.8, 3.9 and 3.10 are functionally complete for the requested prototype.
No known blocking frontend issue remains. Lint is unavailable in the existing
package; pytest's cache warning concerns sandbox filesystem access, not a failed
test. The next stage is WBS 3.11, which remains unstarted.

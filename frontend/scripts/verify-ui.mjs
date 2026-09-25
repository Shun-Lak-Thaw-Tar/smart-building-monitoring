import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import assert from "node:assert/strict";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { trackBrowserFailures } from "./browser-verification.mjs";
process.chdir(fileURLToPath(new URL("../", import.meta.url)));
const require = createRequire(import.meta.url);
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE ||
    join(
      homedir(),
      ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
    ),
);
const credentials = JSON.parse(
  execFileSync(
    "../backend/.venv/Scripts/python.exe",
    [
      "-c",
      'import json; from app.core.config import settings; print(json.dumps({"staff":settings.demo_staff_password,"admin":settings.demo_admin_password}))',
    ],
    { cwd: "../backend", encoding: "utf8" },
  ),
);
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const verification = trackBrowserFailures(page, "UI verification");
const base = process.env.BROWSER_TEST_URL || "http://localhost:5173",
  marker = "UI verification " + Date.now(),
  staffName = marker + " Staff",
  initialPassword = crypto.randomUUID() + "Aa1!";
let equipmentId, linkedId, userId, generalId, alertId, alertMaintenanceRequestId, safetyEventId;
await page.goto(base + "/login");
await page.evaluate(() => localStorage.setItem("smart-building-language", "en"));
async function login(role, name, password) {
  await page.goto(base + "/login");
  await page
    .getByLabel(/^Name/)
    .fill(name || (role === "ADMIN" ? "Demo Admin" : "Demo Staff"));
  await page
    .getByLabel(/^Password/)
    .fill(
      password || (role === "ADMIN" ? credentials.admin : credentials.staff),
    );
  await page.getByLabel("Sign in as").selectOption(role);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/" + role.toLowerCase() + "/dashboard");
  await ready();
}
async function ready() {
  await page.getByRole("heading", { level: 1 }).waitFor();
  await page
    .getByText("Loading…", { exact: true })
    .waitFor({ state: "hidden" });
  await page.waitForTimeout(650);
}
async function go(path) {
  // The app's API calls are intentionally awaited by ready(); do not make the
  // navigation itself depend on every long-running dev-server resource.
  await page.goto(base + path, { waitUntil: "domcontentloaded" });
  await ready();
}
async function logout() {
  await page
    .locator("aside.sidebar")
    .getByRole("button", { name: "Sign out" })
    .evaluate((button) => button.click());
  await page.waitForURL("**/login");
}
async function saveResponse(path, click) {
  const pending = page.waitForResponse(
    (r) =>
      r.url().endsWith(path) &&
      ["POST", "PATCH"].includes(r.request().method()),
  );
  await click();
  const response = await pending;
  assert.ok(response.ok(), "Write failed: " + path + " " + response.status());
  return response.json();
}
try {
  await page.goto(base + "/login");
  assert.equal(
    await page.getByRole("button", { name: "Show password" }).count(),
    1,
  );
  await page.getByLabel(/^Name/).fill("Demo Staff");
  await page.getByLabel(/^Password/).fill(credentials.staff);
  await page.getByLabel("Sign in as").selectOption("ADMIN");
  verification.expectResponse("POST", "/api/auth/login", 401);
  verification.expectConsole(
    /Failed to load resource: the server responded with a status of 401/,
    "/api/auth/login",
  );
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page
    .getByRole("alert")
    .filter({ hasText: /Invalid login credentials or role|ဝင်ရောက်ရန် အချက်အလက်/ })
    .waitFor();
  verification.assertClean("wrong-role login");
  await login("STAFF");
  await page.locator(".skip-link").focus();
  await page.keyboard.press("Enter");
  assert.equal(
    await page.evaluate(() => document.activeElement?.id),
    "main-content",
    "Skip link moves keyboard focus to main content",
  );
  await page.reload();
  await ready();
  await page.goto(base + "/admin/requests");
  await page.waitForURL("**/staff/dashboard");
  assert.equal(
    await page
      .locator("aside.sidebar")
      .getByRole("link", { name: "Equipment", exact: true })
      .count(),
    0,
  );
  await go("/staff/requests/new");
  await page.getByLabel(/^Building/).selectOption({ label: "Building 216" });
  await page.getByLabel("Room / Location").fill(marker + " general");
  await page.getByLabel("Fault Category").selectOption("Other");
  await page.getByLabel("Description").fill(marker + " general request");
  const general = await saveResponse("/requests", () =>
    page.getByRole("button", { name: "Submit request", exact: true }).click(),
  );
  generalId = general.request_id;
  await page.waitForURL("**/staff/requests/" + generalId);
  await page.getByText("Request submitted", { exact: true }).waitFor();
  await go("/staff/requests");
  await page
    .locator(".request-table")
    .getByRole("link", { name: "#" + generalId, exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Resolved", exact: true }).click();
  assert.equal(
    await page
      .locator(".request-table")
      .getByRole("link", { name: "#" + generalId, exact: true })
      .count(),
    0,
  );
  for (const width of [1440, 1280, 1024, 768, 375]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const path of [
      "/staff/dashboard",
      "/staff/requests/new",
      "/staff/requests",
      "/staff/requests/" + generalId,
      "/staff/monitoring",
    ]) {
      await go(path);
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        "Staff overflow " + width + " " + path,
      );
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await logout();
  await login("ADMIN");
  await page.getByText("Requests by status", { exact: true }).waitFor();
  await go("/admin/energy");
  await page.getByRole("heading", { name: "Energy Intelligence", exact: true }).waitFor();
  await page.getByText(/latest reading is 20% or more above/i).waitFor();
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  console.log("Energy Intelligence summary, explanation and refresh passed.");
  await go("/admin/safety");
  await page.getByRole("heading", { name: "Safety & Security Centre", exact: true }).waitFor();
  await page.getByText("SIMULATION / DEMONSTRATION MODE", { exact: true }).first().waitFor();
  await page.getByLabel(/^Building/).selectOption({ label: "Building 216" });
  await page.getByLabel(/^Device \/ access point \/ advisory name/).fill(marker + " detector");
  await page.getByLabel(/^Status/).selectOption("ALARM");
  safetyEventId = (await saveResponse("/api/safety/events", () => page.getByRole("button", { name: "Trigger demonstration event", exact: true }).click())).event_id;
  await page.getByText("Demonstration event recorded.", { exact: true }).waitFor();
  console.log("Safety & Security simulation controls, persistence and alert trigger passed.");
  await go("/admin/reports");
  await page.getByRole("heading", { name: "Reports", exact: true }).waitFor();
  await page.getByLabel("Report type", { exact: true }).selectOption("EQUIPMENT_HEALTH");
  await page.getByText("Report results", { exact: true }).waitFor();
  const reportDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV", exact: true }).click();
  assert.match((await reportDownload).suggestedFilename(), /equipment_health-report\.csv/);
  console.log("Reports filters, on-screen results and CSV export passed.");
  await go("/admin/comfort");
  await page.getByRole("heading", { name: "Comfort Intelligence", exact: true }).waitFor();
  await page.getByText(/Comfortable: 20–26°C and 40–60% humidity/i).waitFor();
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  console.log("Comfort Intelligence summary, explanation and refresh passed.");
  await go("/admin/operations");
  await page.getByRole("heading", { name: "Campus Operations", exact: true }).waitFor();
  await page.getByRole("link", { name: "Requests", exact: true }).first().waitFor();
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  console.log("Campus Operations overview, links and refresh passed.");
  await go("/admin/equipment-intelligence");
  await page.getByRole("heading", { name: "Equipment Intelligence", exact: true }).waitFor();
  await page.getByText("Smart Fault Assistant", { exact: true }).first().waitFor();
  await page.getByLabel("Health band", { exact: true }).selectOption("HEALTHY");
  await page.locator(".intelligence-card").first().waitFor();
  console.log("Equipment Intelligence score, guidance and filters passed.");
  await go("/admin/rooms");
  await page.getByRole("heading", { name: "Room Dashboard", exact: true }).waitFor();
  await page.getByLabel("Search rooms", { exact: true }).fill("Admissions");
  await page.getByRole("heading", { name: "Admissions Office", exact: true }).waitFor();
  assert.equal(await page.locator(".room-card").count(), 1, "Room search narrows the card list");
  await page.getByRole("button", { name: "Clear filters", exact: true }).click();
  await page.getByLabel("Room type", { exact: true }).selectOption("COMPUTER_LAB");
  await page.getByRole("heading", { name: "Computer Lab 216", exact: true }).waitFor();
  assert.equal(await page.locator(".room-card").count(), 3, "Room type filter narrows the card list");
  await page.getByRole("button", { name: "Clear filters", exact: true }).click();
  console.log("Room Dashboard search, filters and card layout passed.");
  await go("/admin/requests");
  await page.getByLabel("Search", { exact: true }).fill(marker + " general");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await page
    .locator(".request-table")
    .getByRole("link", { name: "#" + generalId, exact: true })
    .click();
  await page
    .getByLabel("Assign administrator")
    .selectOption({ label: "Maintenance Admin" });
  await page.getByRole("button", { name: "Update assignment" }).click();
  await page
    .getByText("Request assignment updated.", { exact: true })
    .waitFor();
  await page.getByLabel("Request Status").selectOption("IN_PROGRESS");
  await page
    .getByLabel("Optional Note")
    .fill("Frontend verification: inspection started.");
  await page
    .getByRole("button", { name: "Update status", exact: true })
    .click();
  await page
    .locator(".timeline")
    .getByText("Frontend verification: inspection started.", { exact: true })
    .waitFor();
  console.log("Admin search, assignment and timeline update passed.");
  await go("/admin/equipment");
  const addEquipment = page.getByRole("button", {
    name: "Add Equipment",
    exact: true,
  });
  await addEquipment.click();
  let modal = page.getByRole("dialog");
  assert.equal(
    await modal.evaluate((element) => element.contains(document.activeElement)),
    true,
    "Opening a dialog moves focus inside it",
  );
  await page.keyboard.press("Escape");
  await modal.waitFor({ state: "hidden" });
  await page.waitForTimeout(200);
  assert.equal(await addEquipment.evaluate((element) => element === document.activeElement), true);
  await addEquipment.click();
  modal = page.getByRole("dialog");
  await modal.getByLabel(/^Building/).selectOption({ label: "Building 216" });
  await modal.getByLabel("Room", { exact: true }).selectOption({ label: "201 · Admissions Office" });
  await modal.getByLabel(/^Equipment Name/).fill(marker);
  await modal.getByLabel(/^Equipment Type/).fill("Verification device");
  await modal.getByLabel(/^Location/).fill("Temporary test room");
  const equipment = await saveResponse("/equipment", () =>
    modal.getByRole("button", { name: "Add equipment", exact: true }).click(),
  );
  equipmentId = equipment.equipment_id;
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await go("/admin/rooms");
  await page.getByLabel("Search rooms", { exact: true }).fill("Admissions");
  await page.getByText(marker, { exact: true }).waitFor();
  await page.getByRole("button", { name: "View room details", exact: true }).click();
  modal = page.getByRole("dialog");
  await modal.getByText(marker, { exact: true }).waitFor();
  await page.keyboard.press("Escape");
  await modal.waitFor({ state: "hidden" });
  console.log("Equipment-to-room selection and Room Dashboard detail passed.");
  await go("/admin/alerts");
  await page.getByRole("button", { name: "Create alert", exact: true }).click();
  modal = page.getByRole("dialog");
  await modal.getByLabel(/^Building/).selectOption({ label: "Building 216" });
  await modal.getByLabel(/^Equipment/).selectOption(String(equipmentId));
  await modal.getByLabel(/^Category/).selectOption("EQUIPMENT");
  await modal.getByLabel(/^Severity/).selectOption("WARNING");
  await modal.getByLabel(/^Alert title/).fill(marker + " alert");
  await modal.getByLabel(/^Description/).fill(marker + " alert description");
  const alert = await saveResponse("/alerts", () =>
    modal.getByRole("button", { name: "Create alert", exact: true }).click(),
  );
  alertId = alert.alert_id;
  modal = page.getByRole("dialog");
  await saveResponse(`/alerts/${alertId}/acknowledge`, () => modal.getByRole("button", { name: "Acknowledge alert", exact: true }).click());
  await modal.locator(".badge-acknowledged").waitFor();
  await modal.getByRole("button", { name: "Create maintenance request", exact: true }).click();
  modal = page.getByRole("dialog");
  await modal.getByLabel(/^Room \/ location/).fill("Room 201");
  await modal.getByLabel(/^Fault category/).fill("Cooling");
  await modal.getByLabel(/^Description/).fill(marker + " alert maintenance request");
  const alertRequest = await saveResponse(`/alerts/${alertId}/maintenance-request`, () => modal.getByRole("button", { name: "Create maintenance request", exact: true }).click());
  alertMaintenanceRequestId = alertRequest.maintenance_request.request_id;
  modal = page.getByRole("dialog");
  await modal.getByText("View maintenance request", { exact: true }).waitFor();
  await saveResponse(`/alerts/${alertId}/resolve`, () => modal.getByRole("button", { name: "Resolve alert", exact: true }).click());
  await modal.locator(".badge-resolved").waitFor();
  await page.keyboard.press("Escape");
  console.log("Alert acknowledgement, linked maintenance request, detail and resolution passed.");
  await go("/admin/equipment");
  await page
    .locator(".management-table")
    .getByRole("button", { name: "Edit " + marker, exact: true })
    .click();
  modal = page.getByRole("dialog");
  assert.equal(await modal.getByLabel(/^Building/).count(), 0);
  await modal
    .getByLabel("Status", { exact: true })
    .selectOption("MAINTENANCE_REQUIRED");
  await modal.getByRole("button", { name: "Save changes" }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await go("/admin/maintenance");
  await page
    .getByRole("button", { name: "Record Maintenance", exact: true })
    .click();
  modal = page.getByRole("dialog");
  await modal.getByLabel(/^Equipment/).selectOption(String(equipmentId));
  await modal
    .getByLabel(/^Action Details/)
    .fill(marker + " preventive maintenance");
  await saveResponse("/maintenance-history", () =>
    modal
      .getByRole("button", { name: "Record maintenance", exact: true })
      .click(),
  );
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page
    .getByLabel("Building", { exact: true })
    .selectOption({ label: "Building 216" });
  await page
    .getByLabel("Equipment", { exact: true })
    .selectOption(String(equipmentId));
  await page
    .locator(".management-table")
    .getByText(marker + " preventive maintenance", { exact: true })
    .waitFor();
  console.log(
    "Equipment add/edit and preventive maintenance with filters passed.",
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await logout();
  await login("STAFF");
  await go("/staff/requests/new");
  await page.getByLabel(/^Building/).selectOption({ label: "Building 216" });
  await page.getByLabel(/^Equipment/).selectOption(String(equipmentId));
  await page.getByLabel("Room / Location").fill(marker);
  await page.getByLabel("Fault Category").selectOption("Equipment");
  await page.getByLabel("Description").fill(marker + " linked request");
  const request = await saveResponse("/requests", () =>
    page.getByRole("button", { name: "Submit request", exact: true }).click(),
  );
  linkedId = request.request_id;
  await page.waitForURL("**/staff/requests/" + linkedId);
  await logout();
  await login("ADMIN");
  await go("/admin/rooms");
  await page.getByLabel("Search rooms", { exact: true }).fill("Admissions");
  await page.getByRole("button", { name: "View room details", exact: true }).click();
  modal = page.getByRole("dialog");
  await modal.getByText("#" + linkedId + " · Equipment", { exact: true }).waitFor();
  await page.keyboard.press("Escape");
  await modal.waitFor({ state: "hidden" });
  await go("/admin/requests/" + linkedId);
  await page.getByLabel("Request Status").selectOption("RESOLVED");
  await page.getByLabel("Optional Note").fill(marker + " resolved");
  await page
    .getByRole("button", { name: "Update status", exact: true })
    .click();
  await page
    .locator(".timeline")
    .getByText(marker + " resolved", { exact: true })
    .waitFor();
  await go("/admin/maintenance");
  await page
    .getByRole("button", { name: "Record Maintenance", exact: true })
    .click();
  modal = page.getByRole("dialog");
  await modal.getByLabel(/^Equipment/).selectOption(String(equipmentId));
  await modal
    .getByLabel("Linked Resolved Request")
    .selectOption(String(linkedId));
  await modal
    .getByLabel(/^Action Details/)
    .fill(marker + " linked maintenance");
  await saveResponse("/maintenance-history", () =>
    modal
      .getByRole("button", { name: "Record maintenance", exact: true })
      .click(),
  );
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await go("/admin/staff");
  await page
    .getByRole("button", { name: "Create Staff Account", exact: true })
    .click();
  modal = page.getByRole("dialog");
  await modal.getByLabel(/^Name/).fill(staffName);
  await modal.getByLabel(/^Initial Password/).fill(initialPassword);
  await modal.getByLabel(/^Confirm Password/).fill("non-matching password");
  await modal
    .getByRole("button", { name: "Create Staff account", exact: true })
    .click();
  await modal
    .getByRole("alert")
    .filter({ hasText: "Passwords must match." })
    .waitFor();
  await modal.getByLabel(/^Confirm Password/).fill(initialPassword);
  const user = await saveResponse("/users/staff", () =>
    modal
      .getByRole("button", { name: "Create Staff account", exact: true })
      .click(),
  );
  userId = user.user_id;
  assert.equal(user.role, "STAFF");
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.getByText(staffName, { exact: true }).waitFor();
  console.log(
    "Linked resolved-request maintenance and Staff account creation passed.",
  );
  await logout();
  await login("STAFF", staffName, initialPassword);
  await page
    .getByText("No maintenance requests yet.", { exact: true })
    .waitFor();
  await logout();
  await login("ADMIN");
  mkdirSync("../.tmp/frontend-qa", { recursive: true });
  for (const width of [1440, 1280, 1024, 768, 375]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const path of [
      "/admin/dashboard",
      "/admin/requests",
      "/admin/requests/" + linkedId,
      "/admin/equipment",
      "/admin/maintenance",
      "/admin/staff",
      "/admin/alerts",
      "/admin/energy",
      "/admin/comfort",
      "/admin/operations",
      "/admin/rooms",
      "/admin/equipment-intelligence",
      "/admin/safety",
      "/admin/reports",
      "/admin/monitoring",
    ]) {
      await go(path);
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        "Horizontal overflow " + width + " " + path,
      );
      if (path.endsWith("/dashboard")) {
        await page.waitForTimeout(600);
        await page.screenshot({
          path: "../.tmp/frontend-qa/admin-" + width + ".png",
          fullPage: true,
        });
      }
    }
    await page.getByRole("button").filter({ hasText: "Building 216" }).click();
    await page.getByRole("dialog").waitFor();
    assert.equal(await page.evaluate(() => getComputedStyle(document.body).overflow), "hidden");
    await page.getByText("Temperature & humidity", { exact: true }).waitFor();
    assert.ok(
      await page
        .getByRole("dialog")
        .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      "Modal overflow " + width,
    );
    await page.waitForTimeout(600);
    await page.screenshot({
      path: "../.tmp/frontend-qa/monitoring-" + width + ".png",
      fullPage: true,
    });
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    if (width < 900) {
      await page.getByRole("button", { name: "Open menu" }).click();
      await page
        .getByRole("dialog")
        .getByRole("link", { name: "Staff Accounts", exact: true })
        .click();
      await page.waitForURL("**/admin/staff");
    } else await go("/admin/staff");
    await page
      .getByRole("button", { name: "Create Staff Account", exact: true })
      .click();
    modal = page.getByRole("dialog");
    assert.ok(
      await modal.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      "Staff modal overflow " + width,
    );
    await page.waitForTimeout(600);
    await page.screenshot({
      path: "../.tmp/frontend-qa/staff-modal-" + width + ".png",
      fullPage: true,
    });
    await page.keyboard.press("Escape");
    await modal.waitFor({ state: "hidden" });
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await go("/admin/dashboard");
  assert.ok(
    await page
      .locator(".page")
      .evaluate(
        (el) => parseFloat(getComputedStyle(el).animationDuration) < 0.01,
      ),
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await logout();
  await login("STAFF");
  await page.route("**/api/requests/my", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: '{"detail":"Database service unavailable"}',
    }),
  );
  verification.expectResponse("GET", "/api/requests/my", 503);
  verification.expectConsole(
    /Failed to load resource: the server responded with a status of 503/,
    "/api/requests/my",
  );
  await go("/staff/requests");
  await page
    .getByRole("alert")
    .filter({
      hasText: "The service is temporarily unavailable. Please try again.",
    })
    .waitFor();
  await page.unroute("**/api/requests/my");
  verification.assertClean("simulated unavailable service");
  await page.getByRole("button", { name: "Try again" }).click();
  await page
    .getByText("Loading…", { exact: true })
    .waitFor({ state: "hidden" });
  await page.route("**/api/requests/my", (route) => route.abort());
  verification.expectRequestFailure("GET", "/api/requests/my");
  verification.expectConsole(/Failed to load resource: net::ERR_FAILED/, "/api/requests/my");
  await go("/staff/requests");
  await page
    .getByRole("alert")
    .filter({ hasText: "Unable to connect to the server." })
    .waitFor();
  await page.unroute("**/api/requests/my");
  verification.assertClean("simulated connection failure");
  verification.expectResponse("GET", "/api/requests/999999999", 404);
  verification.expectResponse("GET", "/api/requests/999999999/history", 404);
  verification.expectConsole(
    /Failed to load resource: the server responded with a status of 404/,
    "/api/requests/999999999",
  );
  verification.expectConsole(
    /Failed to load resource: the server responded with a status of 404/,
    "/api/requests/999999999/history",
  );
  await go("/staff/requests/999999999");
  await page
    .getByRole("alert")
    .filter({ hasText: "Maintenance request not found" })
    .waitFor();
  verification.assertClean("missing request");
  await page.route("**/api/requests/my", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: '{"detail":"Invalid or expired token"}',
    }),
  );
  verification.expectResponse("GET", "/api/requests/my", 401);
  verification.expectConsole(
    /Failed to load resource: the server responded with a status of 401/,
    "/api/requests/my",
  );
  await page.goto(base + "/staff/requests");
  await page.waitForURL("**/login");
  await page
    .getByRole("alert")
    .filter({ hasText: "Your session has expired." })
    .waitFor();
  assert.equal(
    await page.evaluate(() => sessionStorage.getItem("smart-building-token")),
    null,
  );
  await page.unroute("**/api/requests/my");
  verification.assertClean("session expiry");
  await login("STAFF");
  const restoredToken = await page.evaluate(() =>
    sessionStorage.getItem("smart-building-token"),
  );
  assert.ok(restoredToken, "Login stores a session token");
  await page.reload();
  await page.waitForURL("**/staff/dashboard");
  assert.equal(
    await page.evaluate(() => sessionStorage.getItem("smart-building-token")),
    restoredToken,
    "A valid session is restored after reload",
  );
  await page.route("**/api/auth/me", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({
          status: 503,
          contentType: "application/json",
          body: '{"detail":"Database service unavailable"}',
        })
      : route.continue(),
  );
  verification.expectResponse("GET", "/api/auth/me", 503);
  verification.expectConsole(
    /Failed to load resource: the server responded with a status of 503/,
    "/api/auth/me",
  );
  await page.reload();
  await page
    .getByRole("heading", { name: "Unable to verify your session right now." })
    .waitFor();
  assert.equal(
    await page.evaluate(() => sessionStorage.getItem("smart-building-token")),
    restoredToken,
    "A temporary server failure preserves the stored token",
  );
  await page.unroute("**/api/auth/me");
  verification.assertClean("temporary restoration failure");
  await page.getByRole("button", { name: "Retry session check" }).click();
  await page.waitForURL("**/staff/dashboard");
  await page.route("**/api/auth/me", (route) =>
    route.request().method() === "GET" ? route.abort() : route.continue(),
  );
  verification.expectRequestFailure("GET", "/api/auth/me");
  verification.expectConsole(/Failed to load resource: net::ERR_FAILED/, "/api/auth/me");
  await page.reload();
  await page
    .getByRole("heading", { name: "Unable to verify your session right now." })
    .waitFor();
  assert.equal(
    await page.evaluate(() => sessionStorage.getItem("smart-building-token")),
    restoredToken,
    "A network failure preserves the stored token",
  );
  await page.unroute("**/api/auth/me");
  verification.assertClean("network restoration failure");
  await page.getByRole("button", { name: "Retry session check" }).click();
  await page.waitForURL("**/staff/dashboard");
  await page.route("**/api/auth/me", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({
          status: 401,
          contentType: "application/json",
          body: '{"detail":"Invalid or expired token"}',
        })
      : route.continue(),
  );
  verification.expectResponse("GET", "/api/auth/me", 401);
  verification.expectConsole(
    /Failed to load resource: the server responded with a status of 401/,
    "/api/auth/me",
  );
  await page.reload();
  await page.waitForURL("**/login");
  await page
    .getByRole("alert")
    .filter({ hasText: "Your session has expired." })
    .waitFor();
  assert.equal(
    await page.evaluate(() => sessionStorage.getItem("smart-building-token")),
    null,
    "A rejected restoration removes the invalid token",
  );
  await page.unroute("**/api/auth/me");
  verification.assertClean("invalid-token restoration");
  await page.goto(base + "/not-a-page");
  await page.getByRole("heading", { name: "Page not found" }).waitFor();
  verification.assertClean("successful and expected-error workflows");
  console.log(
    "Readable service/network/404 errors, retry and global session expiry passed.",
  );
  console.log(
    "All Admin pages and monitoring/Staff dialogs passed at 1440, 1280, 1024, 768 and 375px; reduced motion passed; no runtime errors.",
  );
} finally {
  await browser.close();
  const cleanup =
    'import sys; from sqlalchemy import delete; from app.db.session import get_engine; from app.models import Alert, Equipment, MaintenanceHistory, MaintenanceRequest, SafetyEvent, User; from sqlalchemy.orm import Session; eq, req, uid, marker, general, alert, alert_request, safety=sys.argv[1:]; s=Session(get_engine()); eid=int(eq) if eq else None; rid=int(req) if req else None; user_id=int(uid) if uid else None; alert_id=int(alert) if alert else None; alert_request_id=int(alert_request) if alert_request else None; safety_id=int(safety) if safety else None; e=s.get(Equipment,eid) if eid else None; assert not e or e.equipment_name==marker; s.execute(delete(MaintenanceRequest).where(MaintenanceRequest.request_id==alert_request_id,MaintenanceRequest.description==marker+" alert maintenance request")) if alert_request_id else None; s.execute(delete(Alert).where(Alert.alert_id==alert_id,Alert.title==marker+" alert")) if alert_id else None; s.execute(delete(Alert).where(Alert.title=="[SIMULATION] "+marker+" detector: SMOKE_DETECTOR")); s.execute(delete(SafetyEvent).where(SafetyEvent.event_id==safety_id)) if safety_id else None; s.execute(delete(MaintenanceHistory).where(MaintenanceHistory.equipment_id==eid)) if e else None; s.execute(delete(MaintenanceRequest).where(MaintenanceRequest.request_id==rid,MaintenanceRequest.description==marker+" linked request")) if rid else None; s.execute(delete(Equipment).where(Equipment.equipment_id==eid,Equipment.equipment_name==marker)) if e else None; s.execute(delete(User).where(User.user_id==user_id,User.name==marker+" Staff")) if user_id else None; s.execute(delete(MaintenanceRequest).where(MaintenanceRequest.request_id==int(general or 0),MaintenanceRequest.description==marker+" general request")); s.commit(); s.close(); print("Temporary verification records cleaned.")';
  console.log(
    execFileSync(
      "../backend/.venv/Scripts/python.exe",
      [
        "-c",
        cleanup,
        String(equipmentId || ""),
        String(linkedId || ""),
        String(userId || ""),
        marker,
        String(generalId || ""),
        String(alertId || ""),
        String(alertMaintenanceRequestId || ""),
        String(safetyEventId || ""),
      ],
      { cwd: "../backend", encoding: "utf8" },
    ).trim(),
  );
}

import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import assert from "node:assert/strict";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
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
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const base = process.env.BROWSER_TEST_URL || "http://localhost:5173",
  marker = "UI verification " + Date.now(),
  staffName = marker + " Staff",
  initialPassword = crypto.randomUUID() + "Aa1!";
let equipmentId, linkedId, userId, generalId;
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
  await page.goto(base + path);
  await ready();
}
async function logout() {
  await page
    .locator("aside.sidebar")
    .getByRole("button", { name: "Sign out" })
    .click();
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
  await page.getByLabel(/^Name/).fill("Demo Staff");
  await page.getByLabel(/^Password/).fill(credentials.staff);
  await page.getByLabel("Sign in as").selectOption("ADMIN");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Invalid login credentials or role" })
    .waitFor();
  await login("STAFF");
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
  for (const width of [1440, 1024, 768, 375]) {
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
  await page
    .getByRole("button", { name: "Add Equipment", exact: true })
    .click();
  let modal = page.getByRole("dialog");
  await modal.getByLabel(/^Building/).selectOption({ label: "Building 216" });
  await modal.getByLabel(/^Equipment Name/).fill(marker);
  await modal.getByLabel(/^Equipment Type/).fill("Verification device");
  await modal.getByLabel(/^Location/).fill("Temporary test room");
  const equipment = await saveResponse("/equipment", () =>
    modal.getByRole("button", { name: "Add equipment", exact: true }).click(),
  );
  equipmentId = equipment.equipment_id;
  await page.getByRole("dialog").waitFor({ state: "hidden" });
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
  for (const width of [1440, 1024, 768, 375]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const path of [
      "/admin/dashboard",
      "/admin/requests",
      "/admin/requests/" + linkedId,
      "/admin/equipment",
      "/admin/maintenance",
      "/admin/staff",
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
  await go("/staff/requests");
  await page
    .getByRole("alert")
    .filter({
      hasText: "The service is temporarily unavailable. Please try again.",
    })
    .waitFor();
  await page.unroute("**/api/requests/my");
  await page.getByRole("button", { name: "Try again" }).click();
  await page
    .getByText("Loading…", { exact: true })
    .waitFor({ state: "hidden" });
  await page.route("**/api/requests/my", (route) => route.abort());
  await go("/staff/requests");
  await page
    .getByRole("alert")
    .filter({ hasText: "Unable to connect to the server." })
    .waitFor();
  await page.unroute("**/api/requests/my");
  await go("/staff/requests/999999999");
  await page
    .getByRole("alert")
    .filter({ hasText: "Maintenance request not found" })
    .waitFor();
  await page.route("**/api/requests/my", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: '{"detail":"Invalid or expired token"}',
    }),
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
  await page.goto(base + "/not-a-page");
  await page.getByRole("heading", { name: "Page not found" }).waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "Readable service/network/404 errors, retry and global session expiry passed.",
  );
  console.log(
    "All Admin pages and monitoring/Staff dialogs passed at 1440, 1024, 768 and 375px; reduced motion passed; no runtime errors.",
  );
} finally {
  await browser.close();
  const cleanup =
    'import sys; from sqlalchemy import delete; from app.db.session import get_engine; from app.models import Equipment, MaintenanceHistory, MaintenanceRequest, User; from sqlalchemy.orm import Session; eq, req, uid, marker, general=sys.argv[1:]; s=Session(get_engine()); eid=int(eq) if eq else None; rid=int(req) if req else None; user_id=int(uid) if uid else None; e=s.get(Equipment,eid) if eid else None; assert not e or e.equipment_name==marker; s.execute(delete(MaintenanceHistory).where(MaintenanceHistory.equipment_id==eid)) if e else None; s.execute(delete(MaintenanceRequest).where(MaintenanceRequest.request_id==rid,MaintenanceRequest.description==marker+" linked request")) if rid else None; s.execute(delete(Equipment).where(Equipment.equipment_id==eid,Equipment.equipment_name==marker)) if e else None; s.execute(delete(User).where(User.user_id==user_id,User.name==marker+" Staff")) if user_id else None; s.execute(delete(MaintenanceRequest).where(MaintenanceRequest.request_id==int(general or 0),MaintenanceRequest.description==marker+" general request")); s.commit(); s.close(); print("Temporary verification records cleaned.")';
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
      ],
      { cwd: "../backend", encoding: "utf8" },
    ).trim(),
  );
}

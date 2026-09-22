import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
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
// Credentials are read into process memory only, never logged or written to files.
const credentials = JSON.parse(
  execFileSync(
    "../backend/.venv/Scripts/python.exe",
    [
      "-c",
      'import json; from app.core.config import settings; print(json.dumps({"STAFF":settings.demo_staff_password,"ADMIN":settings.demo_admin_password}))',
    ],
    { cwd: "../backend", encoding: "utf8" },
  ),
);
const browser = await chromium.launch({ channel: "chrome", headless: true });
const staffContext = await browser.newContext();
const adminContext = await browser.newContext();
const staff = await staffContext.newPage();
const admin = await adminContext.newPage();
const base = process.env.BROWSER_TEST_URL || "http://localhost:5173";
const marker = "Equipment freshness " + crypto.randomUUID();
const baseline = process.argv.includes("--expect-stale");
const staffFailures = trackBrowserFailures(staff, "Staff");
const adminFailures = trackBrowserFailures(admin, "Admin");
let equipmentId, requestId;
async function login(page, role) {
  await page.goto(base + "/login");
  await page
    .getByLabel(/^Name/)
    .fill(role === "ADMIN" ? "Demo Admin" : "Demo Staff");
  await page.getByLabel(/^Password/).fill(credentials[role]);
  await page.getByLabel("Sign in as").selectOption(role);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/" + role.toLowerCase() + "/dashboard");
}
async function selectBuilding(page, label) {
  const read = page.waitForResponse(
    (r) =>
      r.request().method() === "GET" &&
      new URL(r.url()).pathname === "/api/equipment" &&
      new URL(r.url()).searchParams.has("building_id"),
  );
  await page.getByLabel(/^Building/).selectOption({ label });
  const response = await read;
  assert.equal(response.status(), 200);
  await page.waitForFunction(() => {
    const labels = [...document.querySelectorAll("label")];
    const label = labels.find((l) => l.textContent === "Equipment");
    return label && !document.getElementById(label.htmlFor).disabled;
  });
  return response.json();
}
try {
  await login(staff, "STAFF");
  await staff.getByRole("link", { name: "New Request", exact: true }).click();
  const initial = await selectBuilding(staff, "Building 216");
  assert.ok(initial.length > 0, "Existing equipment remains available");
  const seededId = String(initial[0].equipment_id);
  await staff.getByLabel(/^Equipment/).selectOption(seededId);
  await login(admin, "ADMIN");
  await admin.getByRole("link", { name: "Equipment", exact: true }).click();
  await admin
    .getByRole("button", { name: "Add Equipment", exact: true })
    .click();
  let modal = admin.getByRole("dialog");
  await modal.getByLabel(/^Building/).selectOption({ label: "Building 216" });
  await modal.getByLabel(/^Equipment Name/).fill(marker);
  await modal.getByLabel(/^Equipment Type/).fill("Sensor");
  await modal.getByLabel(/^Location/).fill("Room 210");
  const created = admin.waitForResponse(
    (r) => r.request().method() === "POST" && r.url().endsWith("/equipment"),
  );
  await modal
    .getByRole("button", { name: "Add equipment", exact: true })
    .click();
  const response = await created;
  assert.equal(response.status(), 201);
  equipmentId = (await response.json()).equipment_id;
  await modal.waitFor({ state: "hidden" });
  await admin
    .locator(".management-table")
    .getByText(marker, { exact: true })
    .waitFor();
  await admin
    .locator(".management-table")
    .getByRole("button", { name: "Edit " + marker, exact: true })
    .click();
  modal = admin.getByRole("dialog");
  await modal.getByLabel(/^Location/).fill("Room 210 updated");
  await modal.getByRole("button", { name: "Save changes" }).click();
  await modal.waitFor({ state: "hidden" });
  await staff.bringToFront();
  // Dispatch a focus notification deterministically in headless Chrome, like returning to the form.
  await staff.evaluate(() => window.dispatchEvent(new Event("focus")));
  if (baseline) {
    await staff.waitForTimeout(800);
    assert.equal(
      await staff.locator(`select option[value="${equipmentId}"]`).count(),
      0,
    );
    console.log(
      "Reproduced: an already-open Staff form retains its pre-creation equipment list.",
    );
  } else {
    await staff
      .locator(`select option[value="${equipmentId}"]`)
      .waitFor({ state: "attached" });
    assert.equal(
      await staff.getByLabel(/^Equipment/).inputValue(),
      seededId,
      "Refetch preserves a valid equipment selection",
    );
    console.log(
      "Already-open Staff form refetches current PostgreSQL equipment on return.",
    );
  }
  const other = await selectBuilding(staff, "JS Building");
  assert.ok(other.every((eq) => eq.equipment_id !== equipmentId));
  assert.equal(await staff.getByLabel(/^Equipment/).inputValue(), "");
  const refreshed = await selectBuilding(staff, "Building 216");
  assert.ok(refreshed.some((eq) => eq.equipment_id === equipmentId));
  console.log(
    "Switching buildings resets selection and retrieves the new equipment correctly.",
  );
  // Exact reported flow: Admin logout -> Staff login -> navigate through the SPA, without a reload.
  await admin.bringToFront();
  await admin
    .locator("aside.sidebar")
    .getByRole("button", { name: "Sign out" })
    .click();
  await admin.waitForURL("**/login");
  await admin.getByLabel(/^Name/).fill("Demo Staff");
  await admin.getByLabel(/^Password/).fill(credentials.STAFF);
  await admin.getByLabel("Sign in as").selectOption("STAFF");
  await admin.getByRole("button", { name: "Sign in", exact: true }).click();
  await admin.waitForURL("**/staff/dashboard");
  await admin.getByRole("link", { name: "New Request", exact: true }).click();
  const exact = await selectBuilding(admin, "Building 216");
  assert.ok(exact.some((eq) => eq.equipment_id === equipmentId));
  await admin.getByLabel(/^Equipment/).selectOption(String(equipmentId));
  await admin.getByLabel("Room / Location").fill("Room 210");
  await admin.getByLabel("Fault Category").selectOption("Equipment");
  await admin.getByLabel("Description").fill(marker);
  const submitted = admin.waitForResponse(
    (r) => r.request().method() === "POST" && r.url().endsWith("/requests"),
  );
  await admin
    .getByRole("button", { name: "Submit request", exact: true })
    .click();
  const submittedResponse = await submitted;
  assert.equal(submittedResponse.status(), 201);
  requestId = (await submittedResponse.json()).request_id;
  await admin.waitForURL("**/staff/requests/" + requestId);
  await admin.getByText(marker, { exact: true }).first().waitFor();
  await admin
    .getByRole("link", { name: "Building Monitoring", exact: true })
    .click();
  await admin.getByRole("button").filter({ hasText: "Building 216" }).waitFor();
  staffFailures.assertClean("equipment freshness workflow");
  adminFailures.assertClean("equipment freshness workflow");
  console.log(
    "Admin creation/edit, sequential logout/login, Staff dynamic selector/submission, monitoring and runtime checks passed.",
  );
} finally {
  await browser.close();
  const cleanup = `import sys
from sqlalchemy import delete
from sqlalchemy.orm import Session
from app.db.session import get_engine
from app.models import Equipment,MaintenanceRequest
eid,rid,marker=sys.argv[1:]
with Session(get_engine()) as session:
    if rid: session.execute(delete(MaintenanceRequest).where(MaintenanceRequest.request_id==int(rid),MaintenanceRequest.description==marker))
    if eid: session.execute(delete(Equipment).where(Equipment.equipment_id==int(eid),Equipment.equipment_name==marker))
    session.commit()
print('Temporary verification records removed.')`;
  console.log(
    execFileSync(
      "../backend/.venv/Scripts/python.exe",
      [
        "-c",
        cleanup,
        String(equipmentId || ""),
        String(requestId || ""),
        marker,
      ],
      { cwd: "../backend", encoding: "utf8" },
    ).trim(),
  );
}

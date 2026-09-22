import assert from "node:assert/strict";

function matches(entry, request, status) {
  return (
    entry.method === request.method() &&
    entry.path === new URL(request.url()).pathname &&
    (status === undefined || entry.status === status)
  );
}

// Records every browser failure unless the current test step has allowed it exactly.
export function trackBrowserFailures(page, label) {
  const failures = [];
  const warnings = [];
  const expectedResponses = [];
  const expectedRequestFailures = [];
  const expectedConsole = [];

  page.on("pageerror", (error) =>
    failures.push(`${label} page error: ${error.message}`),
  );
  page.on("console", (message) => {
    if (message.type() === "warning") {
      warnings.push(`${label}: ${message.text()}`);
      return;
    }
    if (message.type() !== "error") return;
    const location = message.location().url;
    const index = expectedConsole.findIndex(
      (entry) =>
        entry.text.test(message.text()) &&
        (!entry.path || new URL(location).pathname === entry.path),
    );
    if (index >= 0) expectedConsole.splice(index, 1);
    else failures.push(`${label} console error: ${message.text()} (${location})`);
  });
  page.on("response", (response) => {
    if (response.status() < 400) return;
    const index = expectedResponses.findIndex((entry) =>
      matches(entry, response.request(), response.status()),
    );
    if (index >= 0) expectedResponses.splice(index, 1);
    else
      failures.push(
        `${label} HTTP ${response.status()}: ${response.request().method()} ${response.url()}`,
      );
  });
  page.on("requestfailed", (request) => {
    const index = expectedRequestFailures.findIndex((entry) =>
      matches(entry, request),
    );
    if (index >= 0) expectedRequestFailures.splice(index, 1);
    else
      failures.push(
        `${label} request failed: ${request.method()} ${request.url()} (${request.failure()?.errorText || "unknown error"})`,
      );
  });

  return {
    expectResponse(method, path, status) {
      expectedResponses.push({ method, path, status });
    },
    expectRequestFailure(method, path) {
      expectedRequestFailures.push({ method, path });
    },
    expectConsole(text, path) {
      expectedConsole.push({ text, path });
    },
    assertClean(step) {
      assert.deepEqual(
        expectedResponses,
        [],
        `${label} expected HTTP failure was not observed during ${step}`,
      );
      assert.deepEqual(
        expectedRequestFailures,
        [],
        `${label} expected failed request was not observed during ${step}`,
      );
      assert.deepEqual(
        expectedConsole,
        [],
        `${label} expected console error was not observed during ${step}`,
      );
      assert.deepEqual(failures, [], failures.join("\n"));
    },
    warnings,
  };
}

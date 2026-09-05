import assert from "node:assert/strict";
import test from "node:test";

import { createVisitsHandler, parseVisitCount } from "../src/index.js";

test("parseVisitCount excludes GoatCounter events", () => {
  assert.equal(parseVisitCount({ total: 19, total_events: 4 }), 15);
  assert.equal(parseVisitCount({ total: 15 }), 15);
});

test("parseVisitCount rejects malformed totals", () => {
  assert.throws(() => parseVisitCount({ total: "nope" }), /invalid total/);
  assert.throws(() => parseVisitCount({ total: null }), /invalid total/);
  assert.throws(() => parseVisitCount({ total: 2, total_events: 3 }), /invalid total/);
});

test("the handler returns and caches a sanitized count", async () => {
  let upstreamCalls = 0;
  let cachedResponse;
  const cache = {
    async match() {
      return cachedResponse?.clone();
    },
    async put(_key, response) {
      cachedResponse = response.clone();
    },
  };
  const fetcher = async (url, options) => {
    upstreamCalls += 1;
    assert.equal(url.searchParams.get("start"), "2026-09-05T00:00:00Z");
    assert.equal(options.headers.Authorization, "Bearer test-token");
    return Response.json({ total: 18, total_events: 3 });
  };
  const pending = [];
  const handler = createVisitsHandler({
    fetcher,
    cache,
    now: () => new Date("2026-09-05T15:00:00Z"),
  });
  const ctx = { waitUntil(promise) { pending.push(promise); } };

  const first = await handler.fetch(new Request("https://visits.example/"), { GOATCOUNTER_API_TOKEN: "test-token" }, ctx);
  assert.equal(first.status, 200);
  assert.equal(first.headers.get("access-control-allow-origin"), "*");
  assert.deepEqual(await first.json(), { count: 15, updatedAt: "2026-09-05T15:00:00.000Z" });
  await Promise.all(pending);

  const second = await handler.fetch(new Request("https://visits.example/api/visits"), { GOATCOUNTER_API_TOKEN: "test-token" }, ctx);
  assert.deepEqual(await second.json(), { count: 15, updatedAt: "2026-09-05T15:00:00.000Z" });
  assert.equal(upstreamCalls, 1);
});

test("the handler does not expose upstream failures", async () => {
  const handler = createVisitsHandler({
    fetcher: async () => new Response("private upstream details", { status: 401 }),
    cache: undefined,
    logger: { error() {} },
  });
  const response = await handler.fetch(
    new Request("https://visits.example/"),
    { GOATCOUNTER_API_TOKEN: "bad-token" },
    {},
  );

  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { error: "Visit count is temporarily unavailable" });
});

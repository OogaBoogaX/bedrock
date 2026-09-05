const GOATCOUNTER_TOTAL_URL = "https://oogabooga.goatcounter.com/api/v0/stats/total";
const COUNTER_START = "2026-09-05T00:00:00Z";
const CACHE_CONTROL = "public, max-age=30, s-maxage=60, stale-while-revalidate=300";

const commonHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
};

function jsonResponse(body, { status = 200, cacheControl = "no-store" } = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...commonHeaders, "Cache-Control": cacheControl },
  });
}

function withoutBody(response) {
  return new Response(null, { status: response.status, headers: response.headers });
}

export function parseVisitCount(data) {
  const total = data?.total;
  const events = data?.total_events ?? 0;
  const count = total - events;

  if (
    typeof total !== "number" ||
    typeof events !== "number" ||
    !Number.isSafeInteger(total) ||
    !Number.isSafeInteger(events) ||
    events < 0 ||
    count < 0
  ) {
    throw new Error("GoatCounter returned an invalid total");
  }

  return count;
}

export function createVisitsHandler({
  fetcher = globalThis.fetch,
  cache = globalThis.caches?.default,
  now = () => new Date(),
  logger = console,
} = {}) {
  return {
    async fetch(request, env, ctx) {
      const url = new URL(request.url);

      if (url.pathname !== "/" && url.pathname !== "/api/visits") {
        return jsonResponse({ error: "Not found" }, { status: 404 });
      }

      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: commonHeaders });
      }

      if (request.method !== "GET" && request.method !== "HEAD") {
        const response = jsonResponse({ error: "Method not allowed" }, { status: 405 });
        response.headers.set("Allow", "GET, HEAD, OPTIONS");
        return response;
      }

      if (!env.GOATCOUNTER_API_TOKEN) {
        return jsonResponse({ error: "Visit counter is not configured" }, { status: 503 });
      }

      const cacheKey = new Request(`${url.origin}/api/visits`, { method: "GET" });
      const cached = cache ? await cache.match(cacheKey) : undefined;
      if (cached) return request.method === "HEAD" ? withoutBody(cached) : cached;

      try {
        const upstreamUrl = new URL(GOATCOUNTER_TOTAL_URL);
        upstreamUrl.searchParams.set("start", COUNTER_START);

        const upstream = await fetcher(upstreamUrl, {
          cache: "no-store",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${env.GOATCOUNTER_API_TOKEN}`,
            "Content-Type": "application/json",
          },
        });

        if (!upstream.ok) throw new Error(`GoatCounter returned ${upstream.status}`);

        const count = parseVisitCount(await upstream.json());
        const response = jsonResponse(
          { count, updatedAt: now().toISOString() },
          { cacheControl: CACHE_CONTROL },
        );

        if (cache && ctx?.waitUntil) ctx.waitUntil(cache.put(cacheKey, response.clone()));
        return request.method === "HEAD" ? withoutBody(response) : response;
      } catch (error) {
        logger.error("Unable to refresh GoatCounter total", error);
        return jsonResponse({ error: "Visit count is temporarily unavailable" }, { status: 502 });
      }
    },
  };
}

export default createVisitsHandler();

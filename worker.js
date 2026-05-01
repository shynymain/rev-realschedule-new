const headers = {
  "content-type": "application/json;charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type"
};

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(JSON.stringify({ ok: true }), { headers });
    }

    const url = new URL(request.url);

    if (url.pathname === "/" || url.pathname === "/api/health") {
      return new Response(JSON.stringify({
        ok: true,
        service: "rev-realschedule-new",
        source: "clean-route-test",
        endpoints: ["/api/schedule"]
      }), { headers });
    }

    if (url.pathname === "/api/schedule") {
      return new Response(JSON.stringify({
        ok: true,
        count: 0,
        generatedAt: new Date().toISOString(),
        source: "clean-route-test",
        races: []
      }), { headers });
    }

    return new Response(JSON.stringify({
      ok: false,
      error: "not found",
      path: url.pathname
    }), { status: 404, headers });
  }
};

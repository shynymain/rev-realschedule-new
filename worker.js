export default {
  async fetch(request) {

    const headers = {
      "content-type": "application/json;charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type"
    };

    if (request.method === "OPTIONS") {
      return new Response(JSON.stringify({ ok: true }), { headers });
    }

    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return new Response(JSON.stringify({
        ok: true,
        service: "rev-realschedule-new",
        mode: "direct-raceid"
      }), { headers });
    }

    if (url.pathname === "/api/schedule") {
      return new Response(JSON.stringify({
        ok: true,
        count: 1,
        races: [{
          id: "test",
          race: { place: "東京", raceNo: "1" },
          horses: []
        }]
      }), { headers });
    }

    return new Response(JSON.stringify({ ok: false }), { status: 404, headers });
  }
};

const headers = {
  "content-type": "application/json;charset=utf-8",
  "access-control-allow-origin": "*"
};

const PLACES = [
  { code: "05", name: "東京" },
  { code: "06", name: "中山" },
  { code: "08", name: "京都" },
  { code: "09", name: "阪神" }
];

function pad(n) {
  return String(n).padStart(2, "0");
}

function getNextSaturday() {
  const now = new Date();
  const day = now.getDay();
  const diff = (6 - day + 7) % 7;
  now.setDate(now.getDate() + diff);
  return now;
}

function formatDate(d) {
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}`;
}

function formatSlash(d) {
  return `${d.getFullYear()}/${pad(d.getMonth()+1)}/${pad(d.getDate())}`;
}

function generateRaceIds(date) {
  const ymd = formatDate(date);
  const races = [];

  for (const p of PLACES) {
    for (let r = 1; r <= 12; r++) {
      const raceId = `${ymd}${p.code}${pad(r)}`;
      races.push({
        id: `${formatSlash(date)}_${p.name}_${pad(r)}`,
        race: {
          date: formatSlash(date),
          place: p.name,
          raceNo: String(r),
          raceName: `${p.name}${r}R`,
          grade: "",
          condition: "",
          age: "",
          sex: "",
          surface: "",
          distance: "",
          headcount: ""
        },
        horses: [],
        source: "auto-generated",
        sourceRaceId: raceId
      });
    }
  }

  return races;
}

export default {
  async fetch(request) {

    if (request.method === "OPTIONS") {
      return new Response(JSON.stringify({ ok: true }), { headers });
    }

    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return new Response(JSON.stringify({
        ok: true,
        service: "rev-realschedule-new",
        mode: "stable-id-generate"
      }), { headers });
    }

    if (url.pathname === "/api/schedule") {

      const sat = getNextSaturday();
      const sun = new Date(sat);
      sun.setDate(sat.getDate() + 1);

      const races = [
        ...generateRaceIds(sat),
        ...generateRaceIds(sun)
      ];

      return new Response(JSON.stringify({
        ok: true,
        count: races.length,
        generatedAt: new Date().toISOString(),
        source: "stable-id-generate",
        races
      }), { headers });
    }

    return new Response(JSON.stringify({
      ok: false,
      error: "not found"
    }), { status: 404, headers });
  }
};

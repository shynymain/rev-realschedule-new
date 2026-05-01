const headers = {
  "content-type": "application/json;charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type"
};

const PLACE_NAMES = {
  "01": "札幌",
  "02": "函館",
  "03": "福島",
  "04": "新潟",
  "05": "東京",
  "06": "中山",
  "07": "中京",
  "08": "京都",
  "09": "阪神",
  "10": "小倉"
};

function pad2(n) {
  return String(n).padStart(2, "0");
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function nextWeekend(base = new Date()) {
  const day = base.getDay();
  const toSat = day === 6 ? 0 : (6 - day + 7) % 7;
  const sat = addDays(base, toSat);
  return [sat, addDays(sat, 1)];
}

function ymdSlash(d) {
  return `${d.getFullYear()}/${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}`;
}

function ymdCompact(d) {
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;
}

function stripHtml(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 Rev-VAN Worker",
      "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "ja,en-US;q=0.9,en;q=0.8"
    }
  });

  if (!res.ok) {
    throw new Error(`fetch failed ${res.status} ${url}`);
  }

  return await res.text();
}

function extractRaceIds(html) {
  const ids = [];
  const patterns = [
    /race_id=(\d{12})/g,
    /\/race\/shutuba\.html\?race_id=(\d{12})/g,
    /\/race\/result\.html\?race_id=(\d{12})/g
  ];

  for (const re of patterns) {
    let m;
    while ((m = re.exec(html))) {
      if (!ids.includes(m[1])) ids.push(m[1]);
    }
  }

  return ids;
}

function inferFromRaceId(raceId, dateText) {
  const placeCode = raceId.slice(4, 6);
  const raceNo = Number(raceId.slice(10, 12));

  return {
    date: dateText,
    place: PLACE_NAMES[placeCode] || "",
    raceNo: String(raceNo)
  };
}

function normalizeSurface(text) {
  if (/芝/.test(text)) return "芝";
  if (/ダート|ダ/.test(text)) return "ダート";
  return "";
}

function normalizeDistance(text) {
  const m = String(text || "").match(/(?:芝|ダート|ダ)\s*(\d{3,4})m?/);
  return m ? `${m[1]}m` : "";
}

function normalizeGrade(text) {
  if (/G1|Ｇ１|GI/.test(text)) return "G1";
  if (/G2|Ｇ２|GII/.test(text)) return "G2";
  if (/G3|Ｇ３|GIII/.test(text)) return "G3";
  if (/リステッド|L\b/.test(text)) return "L";
  if (/オープン|OP/.test(text)) return "OP";
  if (/3勝/.test(text)) return "3勝";
  if (/2勝/.test(text)) return "2勝";
  if (/1勝/.test(text)) return "1勝";
  if (/未勝利/.test(text)) return "未勝利";
  if (/新馬/.test(text)) return "新馬";
  return "";
}

function normalizeAge(text) {
  if (/4歳以上/.test(text)) return "4歳以上";
  if (/3歳以上/.test(text)) return "3歳以上";
  if (/3歳/.test(text)) return "3歳";
  if (/2歳/.test(text)) return "2歳";
  return "";
}

function normalizeCondition(text) {
  if (/ハンデ/.test(text)) return "ハンデ";
  if (/別定/.test(text)) return "別定";
  if (/定量/.test(text)) return "定量";
  return "";
}

function normalizeSex(text) {
  if (/牝/.test(text)) return "牝馬";
  return "混合";
}

function parseRaceName(text, fallback) {
  const t = String(text || "");

  const patterns = [
    /(\S+ステークス)/,
    /(\S+賞)/,
    /(\S+特別)/,
    /(\S+カップ)/,
    /(\S+記念)/
  ];

  for (const p of patterns) {
    const m = t.match(p);
    if (m && m[1]) return m[1];
  }

  return fallback;
}

function parseHorses(html) {
  const horses = [];

  const rowRe = /<tr[\s\S]*?<\/tr>/gi;
  const rows = String(html || "").match(rowRe) || [];

  for (const row of rows) {
    const text = stripHtml(row);

    const noMatch = text.match(/\b([1-9]|1[0-8])\b/);
    const nameMatch =
      row.match(/horse\/(\d+)["'][^>]*>([^<]+)</i) ||
      row.match(/HorseName[^>]*>[\s\S]*?<a[^>]*>([^<]+)</i);

    if (!noMatch || !nameMatch) continue;

    const no = noMatch[1];
    const name = stripHtml(nameMatch[2] || nameMatch[1] || "");

    if (!name || horses.some(h => h.no === no)) continue;

    horses.push({
      frame: String(Math.ceil(Number(no) / 2)),
      no,
      name,
      last1: "",
      last2: "",
      last3: "",
      odds: "",
      popularity: ""
    });
  }

  return horses.sort((a, b) => Number(a.no) - Number(b.no));
}

async function getRaceIdsByDate(dateObj) {
  const date = ymdCompact(dateObj);
  const url = `https://race.netkeiba.com/top/race_list.html?kaisai_date=${date}`;
  const html = await fetchText(url);
  return extractRaceIds(html);
}

async function parseRaceById(raceId, dateText) {
  const base = inferFromRaceId(raceId, dateText);

  const url = `https://race.netkeiba.com/race/shutuba.html?race_id=${raceId}`;
  const html = await fetchText(url);
  const text = stripHtml(html);

  const fallbackName = `${base.place}${base.raceNo}R`;

  const race = {
    date: base.date,
    place: base.place,
    raceNo: base.raceNo,
    raceName: parseRaceName(text, fallbackName),
    grade: normalizeGrade(text),
    condition: normalizeCondition(text),
    age: normalizeAge(text),
    sex: normalizeSex(text),
    surface: normalizeSurface(text),
    distance: normalizeDistance(text),
    headcount: ""
  };

  const horses = parseHorses(html);
  race.headcount = horses.length ? String(horses.length) : "";

  return {
    id: `${base.date.replaceAll("/", "-")}_${base.place}_${pad2(base.raceNo)}_${raceId}`,
    race,
    horses,
    source: "netkeiba-jp-realdata",
    sourceRaceId: raceId,
    sourceUrl: url
  };
}

async function getUpcomingRealRaces() {
  const [sat, sun] = nextWeekend(new Date());
  const dates = [sat, sun];

  const raceIdItems = [];

  for (const d of dates) {
    const dateText = ymdSlash(d);

    try {
      const ids = await getRaceIdsByDate(d);

      for (const raceId of ids) {
        if (!raceIdItems.some(x => x.raceId === raceId)) {
          raceIdItems.push({ raceId, dateText });
        }
      }
    } catch (e) {
      console.log("race list failed", dateText, e.message);
    }
  }

  const races = [];

  for (const item of raceIdItems.slice(0, 72)) {
    try {
      const race = await parseRaceById(item.raceId, item.dateText);
      races.push(race);
    } catch (e) {
      console.log("race parse failed", item.raceId, e.message);
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

    if (url.pathname === "/api/schedule") {
      try {
        const races = await getUpcomingRealRaces();

        return new Response(JSON.stringify({
          ok: true,
          count: races.length,
          generatedAt: new Date().toISOString(),
          source: "netkeiba-jp-realdata",
          races
        }), { headers });
      } catch (e) {
        return new Response(JSON.stringify({
          ok: false,
          error: String(e.message || e),
          source: "netkeiba-jp-realdata",
          races: []
        }), { status: 500, headers });
      }
    }

    if (url.pathname === "/" || url.pathname === "/api/health") {
      return new Response(JSON.stringify({
        ok: true,
        service: "rev-realschedule-new",
        source: "netkeiba-jp-realdata",
        endpoints: ["/api/schedule"]
      }), { headers });
    }

    return new Response(JSON.stringify({
      ok: false,
      error: "not found",
      path: url.pathname
    }), { status: 404, headers });
  }
};

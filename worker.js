const headers = {
  "content-type": "application/json;charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type"
};

const PLACES = [
  { code: "05", name: "東京" },
  { code: "08", name: "京都" },
  { code: "04", name: "新潟" },
  { code: "06", name: "中山" },
  { code: "09", name: "阪神" },
  { code: "07", name: "中京" },
  { code: "10", name: "小倉" },
  { code: "03", name: "福島" }
];

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
  const sun = addDays(sat, 1);
  return [sat, sun];
}

function ymdCompact(d) {
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;
}

function ymdSlashFromCompact(s) {
  return `${s.slice(0, 4)}/${s.slice(4, 6)}/${s.slice(6, 8)}`;
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
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
      "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "ja,en-US;q=0.9,en;q=0.8"
    }
  });
  if (!res.ok) throw new Error(`fetch failed ${res.status} ${url}`);
  return await res.text();
}

function normalizeSurface(text) {
  if (/芝/.test(text)) return "芝";
  if (/ダート|ダ/.test(text)) return "ダート";
  if (/Turf/i.test(text)) return "芝";
  if (/Dirt/i.test(text)) return "ダート";
  return "";
}

function normalizeDistance(text) {
  const jp = String(text || "").match(/(?:芝|ダート|ダ)\s*(\d{3,4})m?/);
  if (jp) return `${jp[1]}m`;
  const en = String(text || "").match(/(?:Turf|Dirt)\s*(\d{3,4})m?/i);
  return en ? `${en[1]}m` : "";
}

function normalizeGrade(text) {
  if (/G1|Ｇ１|GI|Grade\s*1/i.test(text)) return "G1";
  if (/G2|Ｇ２|GII|Grade\s*2/i.test(text)) return "G2";
  if (/G3|Ｇ３|GIII|Grade\s*3/i.test(text)) return "G3";
  if (/リステッド|Listed|\bL\b/i.test(text)) return "L";
  if (/オープン|OP|Open/i.test(text)) return "OP";
  if (/3勝|3 Win|3-Win/i.test(text)) return "3勝";
  if (/2勝|2 Win|2-Win/i.test(text)) return "2勝";
  if (/1勝|1 Win|1-Win|Allowance/i.test(text)) return "1勝";
  if (/未勝利|Maiden/i.test(text)) return "未勝利";
  if (/新馬|Debut|Newcomer/i.test(text)) return "新馬";
  return "";
}

function normalizeAge(text) {
  if (/4歳以上|4yo\+|4yo and up/i.test(text)) return "4歳以上";
  if (/3歳以上|3yo\+|3yo and up/i.test(text)) return "3歳以上";
  if (/3歳|3yo/i.test(text)) return "3歳";
  if (/2歳|2yo/i.test(text)) return "2歳";
  return "";
}

function normalizeCondition(text) {
  if (/ハンデ|Handicap|Hcap/i.test(text)) return "ハンデ";
  if (/別定/i.test(text)) return "別定";
  if (/定量/i.test(text)) return "定量";
  return "";
}

function normalizeSex(text) {
  if (/牝|Fillies|Mares|Filly|Mare/i.test(text)) return "牝馬";
  return "混合";
}

function parseRaceName(text, fallback) {
  const t = String(text || "");
  const patterns = [
    /(\S+ステークス)/,
    /(\S+賞)/,
    /(\S+特別)/,
    /(\S+カップ)/,
    /(\S+記念)/,
    /\b\d{1,2}R\s+([^|｜]+?)\s+(?:Race|Racing|Entries|Odds|Results)/i,
    /Race\s+\d{1,2}\s+([^|｜]+?)\s+(?:Entries|Odds|Results)/i
  ];
  for (const p of patterns) {
    const m = t.match(p);
    if (m && m[1]) {
      const name = m[1].trim();
      if (name && !/^News$/i.test(name)) return name;
    }
  }
  return fallback;
}

function parseJpHorses(html) {
  const horses = [];
  const rows = String(html || "").match(/<tr[\s\S]*?<\/tr>/gi) || [];
  for (const row of rows) {
    const text = stripHtml(row);
    const nameMatch =
      row.match(/class=["'][^"']*HorseName[^"']*["'][\s\S]*?<a[^>]*>([^<]+)<\/a>/i) ||
      row.match(/horse\/\d+[^>]*>([^<]+)<\/a>/i);
    const noMatch =
      row.match(/class=["'][^"']*(?:Umaban|Horse_Num|Num)[^"']*["'][^>]*>\s*(\d{1,2})\s*</i) ||
      text.match(/\b([1-9]|1[0-8])\b/);
    if (!nameMatch || !noMatch) continue;
    const no = noMatch[1];
    const name = stripHtml(nameMatch[1]);
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

function parseEnHorses(html) {
  const horses = [];
  const rows = String(html || "").match(/<tr[\s\S]*?<\/tr>/gi) || [];
  for (const row of rows) {
    const noMatch =
      row.match(/Horse_Num[^>]*>\s*(\d{1,2})\s*</i) ||
      row.match(/<td[^>]*>\s*(\d{1,2})\s*<\/td>/i);
    const nameMatch =
      row.match(/Horse_Name[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/i) ||
      row.match(/horse\/\d+[^>]*>([^<]+)<\/a>/i) ||
      row.match(/<a[^>]*>([A-Za-z][A-Za-z0-9' .\-]{2,40})<\/a>/i);
    if (!noMatch || !nameMatch) continue;
    const no = noMatch[1];
    const name = stripHtml(nameMatch[1]);
    if (Number(no) < 1 || Number(no) > 18 || !name || horses.some(h => h.no === no)) continue;
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

async function parseRace(dateCompact, place, raceNo) {
  const raceId = `${dateCompact}${place.code}${pad2(raceNo)}`;
  const jpUrl = `https://race.netkeiba.com/race/shutuba.html?race_id=${raceId}`;
  const enUrl = `https://en.netkeiba.com/race/racecard.html?race_id=${raceId}`;
  const enNewspaperUrl = `https://en.netkeiba.com/race/newspaper.html?race_id=${raceId}`;

  let html = "";
  let usedUrl = "";
  let source = "netkeiba-jp-realdata";

  try {
    html = await fetchText(jpUrl);
    usedUrl = jpUrl;
  } catch (e) {
    html = "";
  }

  let text = stripHtml(html);
  let horses = parseJpHorses(html);

  if (!horses.length) {
    try {
      html = await fetchText(enUrl);
      usedUrl = enUrl;
      source = "netkeiba-en-realdata";
      text = stripHtml(html);
      horses = parseEnHorses(html);
    } catch (e) {}
  }

  if (!horses.length) {
    try {
      html = await fetchText(enNewspaperUrl);
      usedUrl = enNewspaperUrl;
      source = "netkeiba-en-newspaper-realdata";
      text = stripHtml(html);
      horses = parseEnHorses(html);
    } catch (e) {}
  }

  if (!text || text.length < 500) return null;

  const fallbackName = `${place.name}${raceNo}R`;
  return {
    id: `${dateCompact}_${place.name}_${pad2(raceNo)}`,
    race: {
      date: ymdSlashFromCompact(dateCompact),
      place: place.name,
      raceNo: String(raceNo),
      raceName: parseRaceName(text, fallbackName),
      grade: normalizeGrade(text),
      condition: normalizeCondition(text),
      age: normalizeAge(text),
      sex: normalizeSex(text),
      surface: normalizeSurface(text),
      distance: normalizeDistance(text),
      headcount: String(horses.length)
    },
    horses,
    source,
    sourceRaceId: raceId,
    sourceUrl: usedUrl
  };
}

async function getUpcomingRealRaces() {
  const [sat, sun] = nextWeekend(new Date());
  const dates = [ymdCompact(sat), ymdCompact(sun)];
  const races = [];

  for (const dateCompact of dates) {
    for (const place of PLACES) {
      for (let raceNo = 1; raceNo <= 12; raceNo++) {
        try {
          const race = await parseRace(dateCompact, place, raceNo);
          if (race) races.push(race);
        } catch (e) {
          console.log("parse failed", dateCompact, place.name, raceNo, e.message);
        }
      }
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
      const races = await getUpcomingRealRaces();
      return new Response(JSON.stringify({
        ok: true,
        count: races.length,
        generatedAt: new Date().toISOString(),
        source: "netkeiba-realdata-direct-raceid",
        races
      }), { headers });
    }

    if (url.pathname === "/" || url.pathname === "/api/health") {
      return new Response(JSON.stringify({
        ok: true,
        service: "rev-realschedule-new",
        mode: "direct-raceid",
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

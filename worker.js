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

function pad2(n){ return String(n).padStart(2, "0"); }
function addDays(d,n){ const x = new Date(d); x.setDate(x.getDate()+n); return x; }
function ymdCompact(d){ return `${d.getFullYear()}${pad2(d.getMonth()+1)}${pad2(d.getDate())}`; }
function ymdSlashFromRaceId(raceId){ return `${raceId.slice(0,4)}/${raceId.slice(4,6)}/${raceId.slice(6,8)}`; }
function nextWeekend(base = new Date()){
  const day = base.getDay();
  const toSat = day === 6 ? 0 : (6 - day + 7) % 7;
  const sat = addDays(base, toSat);
  return [sat, addDays(sat, 1)];
}

function stripHtml(html){
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchText(url){
  const res = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 Rev-VAN RealSchedule Worker",
      "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "ja,en-US;q=0.9,en;q=0.8"
    }
  });
  if(!res.ok) throw new Error(`fetch failed ${res.status} ${url}`);
  return await res.text();
}

function extractRaceIds(html){
  const ids = [];
  const re = /race_id=(\d{12})/g;
  let m;
  while((m = re.exec(html))){ if(!ids.includes(m[1])) ids.push(m[1]); }
  return ids;
}

function normalizeSurface(text){
  if(/芝|Turf|T\b/i.test(text)) return "芝";
  if(/ダ|Dirt|D\b/i.test(text)) return "ダート";
  return "";
}
function normalizeDistance(text){
  const m = String(text || "").match(/(?:芝|ダ|Turf|Dirt|T|D)?\s*(\d{3,4})m?/i);
  return m ? `${m[1]}m` : "";
}
function normalizeGrade(text){
  if(/G1|GI|Grade\s*1/i.test(text)) return "G1";
  if(/G2|GII|Grade\s*2/i.test(text)) return "G2";
  if(/G3|GIII|Grade\s*3/i.test(text)) return "G3";
  if(/Listed|\bL\b/i.test(text)) return "L";
  if(/OP|Open/i.test(text)) return "OP";
  if(/3勝|3 Win|3-Win/i.test(text)) return "3勝";
  if(/2勝|2 Win|2-Win/i.test(text)) return "2勝";
  if(/1勝|1 Win|1-Win|Allowance/i.test(text)) return "1勝";
  if(/未勝利|Maiden/i.test(text)) return "未勝利";
  if(/新馬|Debut|Newcomer/i.test(text)) return "新馬";
  return "";
}
function normalizeAge(text){
  if(/4歳以上|4yo\+|4yo and up/i.test(text)) return "4歳以上";
  if(/3歳以上|3yo\+|3yo and up/i.test(text)) return "3歳以上";
  if(/3歳|3yo/i.test(text)) return "3歳";
  if(/2歳|2yo/i.test(text)) return "2歳";
  return "";
}
function normalizeCondition(text){
  if(/ハンデ|Handicap|Hcap/i.test(text)) return "ハンデ";
  if(/別定/i.test(text)) return "別定";
  if(/定量/i.test(text)) return "定量";
  return "";
}
function normalizeSex(text){ return /牝|Fillies|Mares|Filly|Mare/i.test(text) ? "牝馬" : "混合"; }

function inferRaceInfoFromRaceId(raceId){
  const placeCode = raceId.slice(8,10);
  const raceNo = Number(raceId.slice(10,12));
  return { date: ymdSlashFromRaceId(raceId), place: PLACE_NAMES[placeCode] || "", raceNo: String(raceNo) };
}

function parseRaceName(text, fallback){
  const t = String(text || "");
  const patterns = [
    /(?:\d{1,2}R\s+)?([^\s|｜]{2,40}(?:ステークス|賞|特別|カップ|記念|S|C))/,
    /Race\s*\d{1,2}\s+(.+?)\s+(?:Entries|Odds|Results|Racecard)/i,
    /\d{1,2}R\s+(.+?)\s+(?:Race|Racing|Entries|Odds)/i
  ];
  for(const p of patterns){ const m = t.match(p); if(m && m[1]) return m[1].trim(); }
  return fallback;
}

function parseHorses(text){
  const clean = String(text || "").replace(/\s+/g, " ");
  const horses = [];
  const re = /(?:^|\s)([1-8])\s+(\d{1,2})\s+([A-Za-z][A-Za-z0-9' .\-]{2,40}?)(?=\s+(?:\d{1,2}\.\d|[MFHC]\d|牡|牝|セ|---|\*\*|Jockey|Trainer|Odds|Weight))/g;
  let m;
  while((m = re.exec(clean))){
    const frame = m[1];
    const no = m[2];
    const name = m[3].trim();
    if(!horses.some(h => h.no === no) && Number(no) >= 1 && Number(no) <= 18){
      horses.push({ frame, no, name, last1:"", last2:"", last3:"", odds:"", popularity:"" });
    }
  }
  return horses.sort((a,b) => Number(a.no) - Number(b.no));
}

async function getRaceIdsByDate(dateObj){
  const date = ymdCompact(dateObj);
  const urls = [
    `https://race.netkeiba.com/top/race_list.html?kaisai_date=${date}`,
    `https://en.netkeiba.com/race/race_list.html?date=${date}`
  ];
  for(const url of urls){
    try{
      const html = await fetchText(url);
      const ids = extractRaceIds(html);
      if(ids.length) return ids;
    }catch(e){ console.log("list failed", url, e.message); }
  }
  return [];
}

async function parseRaceById(raceId){
  const base = inferRaceInfoFromRaceId(raceId);
  const urls = [
    `https://race.netkeiba.com/race/shutuba.html?race_id=${raceId}`,
    `https://en.netkeiba.com/race/newspaper.html?race_id=${raceId}`,
    `https://en.netkeiba.com/race/racecard.html?race_id=${raceId}`
  ];
  let html = "";
  let usedUrl = "";
  for(const u of urls){
    try{ html = await fetchText(u); usedUrl = u; if(html && html.length > 500) break; }catch(e){}
  }
  if(!html) throw new Error(`no race html ${raceId}`);
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
  const horses = parseHorses(text);
  race.headcount = horses.length ? String(horses.length) : "";
  return {
    id: `${base.date.replaceAll("/", "-")}_${base.place}_${pad2(base.raceNo)}_${raceId}`,
    race,
    horses,
    source: "netkeiba-realdata",
    sourceRaceId: raceId,
    sourceUrl: usedUrl
  };
}

async function getUpcomingRealRaces(){
  const [sat, sun] = nextWeekend(new Date());
  const dates = [sat, sun];
  const ids = [];
  for(const d of dates){
    const dayIds = await getRaceIdsByDate(d);
    for(const id of dayIds){ if(!ids.includes(id)) ids.push(id); }
  }
  const races = [];
  for(const raceId of ids.slice(0,72)){
    try{ races.push(await parseRaceById(raceId)); }
    catch(e){ console.log("race parse failed", raceId, e.message); }
  }
  return races;
}

export default {
  async fetch(request){
    if(request.method === "OPTIONS") return new Response(JSON.stringify({ ok:true }), { headers });
    const url = new URL(request.url);
    if(url.pathname === "/" || url.pathname === "/api/health"){
      return new Response(JSON.stringify({ ok:true, service:"rev-realschedule-new", source:"netkeiba-realdata", endpoints:["/api/schedule"] }), { headers });
    }
    if(url.pathname === "/api/schedule"){
      try{
        const races = await getUpcomingRealRaces();
        return new Response(JSON.stringify({ ok:true, count:races.length, generatedAt:new Date().toISOString(), source:"netkeiba-realdata", races }), { headers });
      }catch(e){
        return new Response(JSON.stringify({ ok:false, error:String(e.message || e), source:"netkeiba-realdata" }), { status:500, headers });
      }
    }
    return new Response(JSON.stringify({ ok:false, error:"not found", path:url.pathname }), { status:404, headers });
  }
};

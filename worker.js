const headers = {
  "content-type": "application/json;charset=utf-8",
  "access-control-allow-origin": "*"
};

function pad(n){ return String(n).padStart(2,"0"); }

function ymd(d){
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}`;
}

function nextWeekend(){
  const now = new Date();
  const day = now.getDay();
  const toSat = day === 6 ? 0 : (6 - day + 7) % 7;
  const sat = new Date(now);
  sat.setDate(now.getDate()+toSat);
  const sun = new Date(sat);
  sun.setDate(sat.getDate()+1);
  return [sat,sun];
}

const PLACE_CODES = [
  {code:"05", name:"東京"},
  {code:"08", name:"京都"},
  {code:"04", name:"新潟"},
  {code:"09", name:"阪神"},
  {code:"06", name:"中山"}
];

async function fetchText(url){
  const res = await fetch(url,{
    headers:{
      "user-agent":"Mozilla/5.0"
    }
  });
  if(!res.ok) throw new Error(url);
  return await res.text();
}

function strip(html){
  return html.replace(/<[^>]+>/g," ").replace(/\s+/g," ");
}

function getRaceName(text, fallback){
  const m = text.match(/(\S+ステークス|\S+特別|\S+記念|\S+カップ)/);
  return m ? m[1] : fallback;
}

function getSurface(text){
  if(text.includes("芝")) return "芝";
  if(text.includes("ダ")) return "ダート";
  return "";
}

function getDistance(text){
  const m = text.match(/(\d{3,4})m/);
  return m ? m[1]+"m" : "";
}

function getGrade(text){
  if(text.includes("G1")) return "G1";
  if(text.includes("G2")) return "G2";
  if(text.includes("G3")) return "G3";
  return "";
}

function parseHorses(html){
  const rows = html.match(/<tr[\s\S]*?<\/tr>/g) || [];
  const horses=[];

  for(const r of rows){
    const t = strip(r);
    const no = t.match(/\b([1-9]|1[0-8])\b/);
    const name = r.match(/<a[^>]*>([^<]{2,40})<\/a>/);

    if(no && name){
      const num = no[1

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
      const num = no[1];
      if(!horses.find(h=>h.no===num)){
        horses.push({
          frame:String(Math.ceil(num/2)),
          no:num,
          name:name[1].trim(),
          last1:"",last2:"",last3:"",
          odds:"",popularity:""
        });
      }
    }
  }

  return horses.sort((a,b)=>a.no-b.no);
}

async function buildRace(dateObj, place){
  const date = ymd(dateObj);
  const races=[];

  for(let r=1;r<=12;r++){
    const raceId = `${date}${place.code}${pad(r)}`;
    const url = `https://race.netkeiba.com/race/shutuba.html?race_id=${raceId}`;

    try{
      const html = await fetchText(url);
      const text = strip(html);

      if(text.length < 1000) continue; // 存在しないレース除外

      const horses = parseHorses(html);

      races.push({
        id:`${date}_${place.name}_${pad(r)}`,
        race:{
          date:`${date.slice(0,4)}/${date.slice(4,6)}/${date.slice(6,8)}`,
          place:place.name,
          raceNo:String(r),
          raceName:getRaceName(text,`${place.name}${r}R`),
          grade:getGrade(text),
          condition:"",
          age:"",
          sex:"",
          surface:getSurface(text),
          distance:getDistance(text),
          headcount:String(horses.length)
        },
        horses,
        source:"realdata"
      });

    }catch(e){}
  }

  return races;
}

export default {
  async fetch(req){
    const url = new URL(req.url);

    if(url.pathname === "/api/health"){
      return new Response(JSON.stringify({
        ok:true,
        service:"rev-realschedule-new",
        mode:"direct-raceid"
      }),{headers});
    }

    if(url.pathname === "/api/schedule"){
      const [sat,sun] = nextWeekend();
      let races=[];

      for(const d of [sat,sun]){
        for(const p of PLACE_CODES){
          const r = await buildRace(d,p);
          races.push(...r);
        }
      }

      return new Response(JSON.stringify({
        ok:true,
        count:races.length,
        races
      }),{headers});
    }

    return new Response(JSON.stringify({ok:false}),{headers});
  }
};

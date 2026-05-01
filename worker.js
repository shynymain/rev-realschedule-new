const headers = {
  "content-type": "application/json;charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type"
};

const PLACE_NAMES = {
  "01":"札幌","02":"函館","03":"福島","04":"新潟","05":"東京",
  "06":"中山","07":"中京","08":"京都","09":"阪神","10":"小倉"
};

function pad2(n){ return String(n).padStart(2,"0"); }

async function fetchText(url){
  const res = await fetch(url,{
    headers:{
      "user-agent":"Mozilla/5.0",
      "accept":"text/html"
    }
  });
  return await res.text();
}

function extractRaceIds(html){
  const ids=[];
  const re=/race_id=(\d{12})/g;
  let m;
  while((m=re.exec(html))){
    if(!ids.includes(m[1])) ids.push(m[1]);
  }
  return ids;
}

async function getRaceIds(date){
  const url=`https://race.netkeiba.com/top/race_list.html?kaisai_date=${date}`;
  const html=await fetchText(url);
  return extractRaceIds(html);
}

async function parseRace(id){
  const place=PLACE_NAMES[id.slice(8,10)]||"";
  const raceNo=Number(id.slice(10,12));

  return {
    id,
    race:{
      date:`${id.slice(0,4)}/${id.slice(4,6)}/${id.slice(6,8)}`,
      place,
      raceNo:String(raceNo),
      raceName:`${place}${raceNo}R`
    },
    horses:[]
  };
}

export default {
  async fetch(request){

    if(request.method==="OPTIONS"){
      return new Response(JSON.stringify({ok:true}),{headers});
    }

    const url=new URL(request.url);

    if(url.pathname==="/api/health"){
      return new Response(JSON.stringify({
        ok:true,
        service:"rev-realschedule-new",
        mode:"realdata"
      }),{headers});
    }

    if(url.pathname==="/api/schedule"){
      try{
        const today=new Date();
        const y=today.getFullYear();
        const m=pad2(today.getMonth()+1);
        const d=pad2(today.getDate());
        const date=`${y}${m}${d}`;

        const ids=await getRaceIds(date);
        const races=[];

        for(const id of ids.slice(0,72)){
          races.push(await parseRace(id));
        }

        return new Response(JSON.stringify({
          ok:true,
          count:races.length,
          races
        }),{headers});

      }catch(e){
        return new Response(JSON.stringify({
          ok:false,
          error:String(e)
        }),{headers});
      }
    }

    return new Response(JSON.stringify({ok:false}),{status:404,headers});
  }
};

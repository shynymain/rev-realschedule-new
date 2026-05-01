async function buildRace(dateObj, place){
  const date = ymd(dateObj);
  const races=[];

  for(let r=1;r<=12;r++){
    const raceId = `${date}${place.code}${pad(r)}`;

    const url = `https://en.netkeiba.com/race/racecard.html?race_id=${raceId}`;

    try{
      const html = await fetchText(url);
      const text = strip(html);

      if(text.length < 1000) continue;

      const horses = [];

      const rows = html.match(/<tr[\s\S]*?<\/tr>/g) || [];

      for(const row of rows){
        const m = row.match(/<a[^>]*>([^<]{2,40})<\/a>/);
        const no = row.match(/<td[^>]*>(\d{1,2})<\/td>/);

        if(m && no){
          const num = no[1];
          if(Number(num) >= 1 && Number(num) <= 18){
            if(!horses.find(h=>h.no===num)){
              horses.push({
                frame:String(Math.ceil(num/2)),
                no:num,
                name:m[1].trim(),
                last1:"",last2:"",last3:"",
                odds:"",popularity:""
              });
            }
          }
        }
      }

      races.push({
        id:`${date}_${place.name}_${pad(r)}`,
        race:{
          date:`${date.slice(0,4)}/${date.slice(4,6)}/${date.slice(6,8)}`,
          place:place.name,
          raceNo:String(r),
          raceName:`${place.name}${r}R`,
          grade:"",
          condition:"",
          age:"",
          sex:"",
          surface:"",
          distance:"",
          headcount:String(horses.length)
        },
        horses,
        source:"realdata-en"
      });

    }catch(e){}
  }

  return races;
}

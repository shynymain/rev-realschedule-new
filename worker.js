function parseHorses(html){
  const horses = [];

  const rows = html.match(/<tr[\s\S]*?<\/tr>/g) || [];

  for(const row of rows){

    const noMatch = row.match(/Horse_Num[^>]*>(\d{1,2})</);
    const nameMatch = row.match(/Horse_Name[^>]*>\s*<a[^>]*>([^<]+)</);

    if(noMatch && nameMatch){
      const no = noMatch[1];
      const name = nameMatch[1].trim();

      if(!horses.find(h=>h.no===no)){
        horses.push({
          frame:String(Math.ceil(no/2)),
          no,
          name,
          last1:"",
          last2:"",
          last3:"",
          odds:"",
          popularity:""
        });
      }
    }
  }

  return horses.sort((a,b)=>a.no-b.no);
}

export function parseTimestamp(value){
  const text=String(value??'').normalize('NFKC').trim();
  const match=/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s]+(?:(上午|下午|AM|PM)\s*)?(\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?\s*(AM|PM)?\s*(Z|[+-]\d{2}:?\d{2})?)?$/i.exec(text);
  if(!match){const us=/^(\d{1,2})\/(\d{1,2})\/(\d{4})(.*)$/.exec(text);return us?parseTimestamp(`${us[3]}/${us[1]}/${us[2]}${us[4]}`):null;}
  const [,year,month,day,prefix,hour,minute,second,fraction,suffix,zone]=match;
  const y=Number(year),m=Number(month),d=Number(day),ampm=(prefix||suffix||'').toUpperCase();
  let h=Number(hour||0);const min=Number(minute||0),sec=Number(second||0);
  if(m<1||m>12||d<1||d>new Date(Date.UTC(y,m,0)).getUTCDate()||min>59||sec>59||h>23)return null;
  if(ampm){if(h<1||h>12||zone||prefix&&suffix)return null;h=h%12+(['下午','PM'].includes(ampm)?12:0);}
  let offset=480;
  if(zone){if(zone.toUpperCase()==='Z')offset=0;else{const z=/^([+-])(\d{2}):?(\d{2})$/.exec(zone);if(Number(z[2])>23||Number(z[3])>59)return null;offset=(Number(z[2])*60+Number(z[3]))*(z[1]==='+'?1:-1);}}
  return Date.UTC(y,m-1,d,h,min,sec,Number((fraction||'').padEnd(3,'0')))-offset*60000;
}

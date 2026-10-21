export const normalized = (value:number|null, maximum:number) => value == null || maximum <= 0 ? 0 : Math.max(0,Math.min(value/maximum,1));
export const difficultyFill = (value:number|null, maximum:number) => value == null || maximum <= 1 ? 0 : Math.max(0,Math.min(Math.log10(Math.max(value,1))/Math.log10(maximum),1));
export const paceFill = (count:number|null) => normalized(count,144);
export function formatMetric(value:number|null, digits=0, suffix='') {
  if(value==null || !Number.isFinite(value))return '— unavailable';
  const text=value>0&&value<0.01?value.toExponential(2):value.toLocaleString('en-US',{minimumFractionDigits:digits,maximumFractionDigits:digits});
  return text+suffix;
}
export function randomFor(index:number, lane=0){
  let value=(Math.imul(index+1,2654435761)^Math.imul(lane+1,1597334677))>>>0;
  value=Math.imul(value^(value>>>16),2246822507)>>>0;
  return value/4294967296;
}

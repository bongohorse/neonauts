'use strict';
const steamStats={
 history(data,now=Date.now()){
  const points=new Map();
  const candidates=Array.isArray(data?.history)?data.history.slice(-200):[];
  for(const p of [...candidates,data]){
   const time=Date.parse(p?.checkedAt);
   if(Number.isSafeInteger(p?.players)&&p.players>=0&&Number.isFinite(time)&&time>=now-86400000&&time<=now+60000)
    points.set(time,{time,players:p.players});
  }
  return [...points.values()].sort((a,b)=>a.time-b.time).slice(-120);
 },
 summary(points){
  if(!points.length)return {peak:null,min:null,average:null,change:null};
  const values=points.map(p=>p.players);
  return {peak:Math.max(...values),min:Math.min(...values),average:Math.round(values.reduce((a,b)=>a+b,0)/values.length),
   change:points.length>1?values.at(-1)-values.at(-2):null};
 },
 plot(points,now=Date.now()){
  const max=Math.max(1,...points.map(p=>p.players))*1.1;
  const x=time=>48+Math.max(0,Math.min(1,(time-(now-86400000))/86400000))*532;
  const y=count=>154-count/max*130;
  const path=points.map((p,i)=>`${!i||p.time-points[i-1].time>2700000?'M':'L'}${x(p.time).toFixed(2)},${y(p.players).toFixed(2)}`).join(' ');
  return {path,max,x,y};
 }
};

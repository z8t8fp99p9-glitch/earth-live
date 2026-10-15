/* EARTH // LIVE v1.56 — cached astronomical trajectories, single renderer. */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const NS = 'http://www.w3.org/2000/svg';
const DEG = Math.PI / 180, RAD = 180 / Math.PI, SUN_HORIZON = -0.833, MOON_HORIZON = -0.3;
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
const wrap360 = v => ((v % 360) + 360) % 360;
const wrap180 = v => ((v + 180) % 360 + 360) % 360 - 180;
let locationFix = null, frame = 0;
const pathCache = new Map();
const MAX_PATHS = 4;

function gmst(date) {
  const jd = date.getTime()/86400000 + 2440587.5, T = (jd-2451545)/36525;
  return wrap360(280.46061837 + 360.98564736629*(jd-2451545) + .000387933*T*T - T*T*T/38710000);
}
function horizontal(lat, dec, H) {
  const altitude = Math.asin(clamp(Math.sin(lat)*Math.sin(dec)+Math.cos(lat)*Math.cos(dec)*Math.cos(H),-1,1))*RAD;
  const azimuth = wrap360(Math.atan2(Math.sin(H),Math.cos(H)*Math.sin(lat)-Math.tan(dec)*Math.cos(lat))*RAD+180);
  return { altitude, azimuth };
}
function solar(date, loc) {
  const n=date.getTime()/86400000+2440587.5-2451545;
  const g=(357.529+.98560028*n)*DEG, q=(280.459+.98564736*n)*DEG;
  const L=q+(1.915*Math.sin(g)+.020*Math.sin(2*g))*DEG, e=(23.439-.00000036*n)*DEG;
  const ra=Math.atan2(Math.cos(e)*Math.sin(L),Math.cos(L))*RAD;
  const dec=Math.asin(Math.sin(e)*Math.sin(L))*RAD;
  const H=wrap180(gmst(date)+loc.longitude-ra)*DEG;
  return horizontal(loc.latitude*DEG,dec*DEG,H);
}
function lunar(date, loc) {
  if (!window.EarthLiveMoon || typeof window.EarthLiveMoon.calculate !== 'function') return null;
  const m=window.EarthLiveMoon.calculate(date);
  const H=wrap180(gmst(date)+loc.longitude-m.rightAscensionDeg)*DEG;
  const p=horizontal(loc.latitude*DEG,m.declinationDeg*DEG,H);
  // Topocentric altitude correction using lunar horizontal parallax.
  const parallax=Math.asin(Math.min(1,6378.14/Math.max(1,m.distanceKm)))*RAD;
  p.altitude -= parallax*Math.cos(p.altitude*DEG);
  return p;
}
/* Match the live object's projection. In landscape, reserve the right-side timeline
   so the path cannot run underneath it or appear to leave the visible sky. */
function projectedX(skyId,azimuth) {
  const sky=$(skyId), normalized=clamp((azimuth-90)/180,0,1);
  if(sky&&window.matchMedia&&window.matchMedia('(orientation: landscape) and (min-width: 600px)').matches){
    const panel=$(skyId==='sunSky'?'sunPanel':'moonPanel');
    if(panel&&!panel.hidden){
      const width=sky.clientWidth||window.innerWidth;
      const reserved=(panel.getBoundingClientRect().width||116)+24;
      const usable=Math.max(width*.55,width-reserved);
      return ((12+normalized*Math.max(0,usable-24))/width)*100;
    }
  }
  return 6+88*normalized;
}
function project(p,skyId) {
  return { x:projectedX(skyId,p.azimuth), bottom:34+clamp(p.altitude,0,75)*.48 };
}
function locationKey(loc) {
  if (!loc || !Number.isFinite(Number(loc.latitude)) || !Number.isFinite(Number(loc.longitude))) return '';
  // Cache in 0.001 degree bins (~111 m latitude); exact coordinates remain in use for the active object.
  return `${Math.round(Number(loc.latitude)*1000)/1000},${Math.round(Number(loc.longitude)*1000)/1000}`;
}
function removeDuplicateSvgs(sky,id) {
  const all = Array.from(sky.querySelectorAll('svg.celestial-real-trajectory'));
  let svg = $(id);
  if (!svg || !sky.contains(svg)) {
    svg = document.createElementNS(NS,'svg');
    svg.id=id; svg.setAttribute('viewBox','0 0 1000 1000');
    svg.setAttribute('preserveAspectRatio','none'); svg.setAttribute('aria-hidden','true');
    svg.classList.add('celestial-real-trajectory');
    const horizon=sky.querySelector('.sky-horizon');
    sky.insertBefore(svg,horizon || sky.firstChild);
  }
  // Enforce one trajectory SVG per sky and one path per visible segment.
  for (const other of all) if (other !== svg) other.remove();
  return svg;
}
function makePath(skyId,pathId,kind,startMs,endMs,loc) {
  const sky=$(skyId);
  if (!sky || !loc || !Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs<=startMs) return;
  const locKey=locationKey(loc);
  const key=[kind,locKey,new Date(startMs).toISOString().slice(0,10),startMs,endMs].join('|');
  let chunks=pathCache.get(key);
  if (!chunks) {
    const horizon=kind==='sun'?SUN_HORIZON:MOON_HORIZON;
    const span=endMs-startMs, steps=Math.max(80,Math.min(160,Math.ceil(span/(3*60000))));
    chunks=[]; let chunk=[];
    for(let i=0;i<=steps;i++){
      const t=startMs+span*i/steps, p=kind==='sun'?solar(new Date(t),loc):lunar(new Date(t),loc);
      if(!p || p.altitude<horizon) {
        if(chunk.length>1) chunks.push(chunk);
        chunk=[]; continue;
      }
      const q=project(p,skyId); chunk.push({x:q.x*10,y:(100-q.bottom)*10});
    }
    if(chunk.length>1) chunks.push(chunk);
    pathCache.set(key,chunks);
    while(pathCache.size>MAX_PATHS) pathCache.delete(pathCache.keys().next().value);
  }
  const svg=removeDuplicateSvgs(sky,pathId);
  svg.replaceChildren();
  for(const points of chunks){
    const d=points.map((p,i)=>(i?'L':'M')+p.x.toFixed(2)+' '+p.y.toFixed(2)).join(' ');
    const line=document.createElementNS(NS,'path');
    line.setAttribute('d',d); line.setAttribute('class','trajectory-line '+kind);
    line.setAttribute('fill','none'); svg.appendChild(line);
  }
}
function parseClock(el) {
  if(!el)return null;
  const m=el.textContent.trim().match(/(\d{1,2}):(\d{2})/);
  return m?{h:Number(m[1]),m:Number(m[2])}:null;
}
function windowDates(startId,endId,moon) {
  const s=parseClock($(startId)), e=parseClock($(endId));
  if(!s||!e)return null;
  const now=new Date(), start=new Date(now), end=new Date(now);
  start.setHours(s.h,s.m,0,0); end.setHours(e.h,e.m,0,0);
  if(end<=start)end.setDate(end.getDate()+1);
  if(moon) {
    // Moonrise/set labels may describe the next window; align to the current selected local date.
    if(start.getTime()>now.getTime()+12*3600000)start.setDate(start.getDate()-1);
    if(end.getTime()<now.getTime()-12*3600000)end.setDate(end.getDate()+1);
  }
  return {start,end};
}
function refresh() {
  cancelAnimationFrame(frame);
  frame=requestAnimationFrame(()=>{
    if(!locationFix)return;
    const sun=$('sunSky'),moon=$('moonSky');
    if(sun&&!sun.hidden) {
      const w=windowDates('sunStartLabel','sunEndLabel',false);
      if(w)makePath('sunSky','sunRealTrajectory','sun',w.start.getTime(),w.end.getTime(),locationFix);
    }
    if(moon&&!moon.hidden) {
      const w=windowDates('moonRiseLabel','moonSetLabel',true);
      if(w)makePath('moonSky','moonRealTrajectory','moon',w.start.getTime(),w.end.getTime(),locationFix);
    }
  });
}
async function init() {
  try {
    if(window.EarthLiveLocation&&typeof window.EarthLiveLocation.getCurrentLocation==='function')
      locationFix=await window.EarthLiveLocation.getCurrentLocation({refresh:false});
  } catch(_) {}
  if(locationFix)refresh();
}
const observer=new MutationObserver(records=>{
  // Only react to view visibility and actual window-label changes; slider movement never rebuilds paths.
  if(!locationFix && window.EarthLiveLocation) init();
  else if(records.some(r=>r.type==='attributes' || r.target.id==='sunStartLabel' || r.target.id==='sunEndLabel' || r.target.id==='moonRiseLabel' || r.target.id==='moonSetLabel')) refresh();
});
['sunSky','moonSky'].forEach(id=>{const n=$(id);if(n)observer.observe(n,{attributes:true,attributeFilter:['hidden']});});
['sunStartLabel','sunEndLabel','moonRiseLabel','moonSetLabel'].forEach(id=>{const n=$(id);if(n)observer.observe(n,{childList:true,characterData:true,subtree:true});});
window.addEventListener('resize',refresh,{passive:true});
window.addEventListener('orientationchange',refresh,{passive:true});
window.addEventListener('earthlive:foreground',refresh);
init();
})();

/* EARTH // LIVE v1.92 — Sun View uses the Moon View layout/scroller foundation.
   Preserve solar calculations and button/location behavior; decorative tail is deferred. */
(() => {
'use strict';
const $=id=>document.getElementById(id);
const sunBtn=$('sunBtn'),moonBtn=$('moonBtn'),layersBtn=$('layersBtn');
const sunPanel=$('sunPanel'),sunSky=$('sunSky'),sunRange=$('sunTimeRange'),sunReadout=$('sunTimeReadout');
let viewer=null,active=false,locationFix=null,sunWindow=null;
const DEG=Math.PI/180, RAD=180/Math.PI, HORIZON=-0.833;
const fmt=d=>d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',hour12:false});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function solarPosition(date,loc){
  const n=date.getTime()/86400000+2440587.5-2451545;
  const g=(357.529+0.98560028*n)*DEG, q=(280.459+0.98564736*n)*DEG;
  const L=q+(1.915*Math.sin(g)+0.020*Math.sin(2*g))*DEG;
  const e=(23.439-0.00000036*n)*DEG;
  const ra=Math.atan2(Math.cos(e)*Math.sin(L),Math.cos(L))*RAD;
  const dec=Math.asin(Math.sin(e)*Math.sin(L))*RAD;
  const jd=date.getTime()/86400000+2440587.5,T=(jd-2451545)/36525;
  const gmst=((280.46061837+360.98564736629*(jd-2451545)+0.000387933*T*T-T*T*T/38710000)%360+360)%360;
  const H=((gmst+loc.longitude-ra+540)%360-180)*DEG,lat=loc.latitude*DEG,d=dec*DEG;
  const altitude=Math.asin(clamp(Math.sin(lat)*Math.sin(d)+Math.cos(lat)*Math.cos(d)*Math.cos(H),-1,1))*RAD;
  const azimuth=(Math.atan2(Math.sin(H),Math.cos(H)*Math.sin(lat)-Math.tan(d)*Math.cos(lat))*RAD+180+360)%360;
  return {altitude,azimuth};
}
function findSunWindow(loc){
  const now=new Date(),startDay=new Date(now);startDay.setHours(0,0,0,0);const endDay=new Date(startDay.getTime()+86400000);
  let previous=startDay.getTime(),prevAlt=solarPosition(new Date(previous),loc).altitude,rise=null,set=null;
  for(let t=previous+60000;t<=endDay.getTime();t+=60000){const alt=solarPosition(new Date(t),loc).altitude;
    if(prevAlt<HORIZON&&alt>=HORIZON&&!rise)rise=new Date(t);
    if(prevAlt>=HORIZON&&alt<HORIZON&&!set)set=new Date(t);
    previous=t;prevAlt=alt;
  }
  if(!rise||!set||set<=rise){
    const noon=new Date(startDay);noon.setHours(12,0,0,0);
    if(solarPosition(noon,loc).altitude>HORIZON)return {start:startDay,end:endDay,alwaysUp:true};
    return null;
  }
  return {start:rise,end:set,alwaysUp:false};
}
function setTime(date){if(viewer&&window.Cesium){viewer.clock.currentTime=Cesium.JulianDate.fromDate(date);viewer.clock.shouldAnimate=false;viewer.scene.requestRender();}}
function compass(az){return ['N','NE','E','SE','S','SW','W','NW'][Math.round(az/45)%8];}
function updateSun(date){if(!active||!locationFix)return;const p=solarPosition(date,locationFix),x=6+88*clamp((p.azimuth-90)/180,0,1),y=34+clamp(p.altitude,0,75)*0.48;
  const orb=$('skySun');orb.style.left=x+'%';orb.style.bottom=y+'%';orb.style.opacity=p.altitude>=HORIZON?'1':'.3';
  $('sunSkyDirection').textContent=`${Math.round(p.azimuth)}° ${compass(p.azimuth)} · ${Math.max(0,p.altitude).toFixed(0)}° altitude`;
  $('sunSkyStatus').textContent=`${fmt(date)} · ${p.altitude>=HORIZON?'SUN ABOVE HORIZON':'SUN BELOW HORIZON'}`;
  sunReadout.value=fmt(date);sunReadout.textContent=fmt(date);setTime(date);
}
function showSky(loc){locationFix=loc;sunWindow=findSunWindow(loc);if(!sunWindow){if(window.EarthLiveLocation)window.EarthLiveLocation.showStatus('Sun Sky View could not find today’s daylight window for this location.');return false;}
  const duration=Math.max(1,Math.round((sunWindow.end-sunWindow.start)/60000));sunRange.min='0';sunRange.max=String(duration);sunRange.step='1';
  $('sunStartLabel').textContent=fmt(sunWindow.start);$('sunEndLabel').textContent=fmt(sunWindow.end);
  $('sunSkyWindowLabel').textContent=sunWindow.alwaysUp?'LOCAL DAY · SUN ABOVE HORIZON':'SUNRISE → SUNSET';
  const now=Date.now(),offset=clamp(Math.round((now-sunWindow.start.getTime())/60000),0,duration);sunRange.value=String(offset);
  active=true;sunPanel.hidden=false;sunSky.hidden=false;document.getElementById('app').classList.add('sun-active','time-panel-active');
  sunBtn.classList.add('active');sunBtn.setAttribute('aria-pressed','true');sunBtn.setAttribute('aria-label','Close Sun Sky View');
  if(window.EarthLiveLocation){window.EarthLiveLocation.holdForMoon(true);window.EarthLiveLocation.placeLocation(loc,{fly:false});}
  updateSun(new Date(sunWindow.start.getTime()+offset*60000));return true;
}
function closeSun(){active=false;sunSky.hidden=true;sunPanel.hidden=true;document.getElementById('app').classList.remove('sun-active');document.getElementById('app').classList.toggle('time-panel-active',false);sunBtn.classList.remove('active');sunBtn.setAttribute('aria-pressed','false');sunBtn.setAttribute('aria-label','Open Sun Sky View');sunWindow=null;if(window.EarthLiveLocation)window.EarthLiveLocation.holdForMoon(false);}
async function toggleSun(){if(active){closeSun();return;}if(window.EarthLiveCelestial&&window.EarthLiveCelestial.isMoonActive&&window.EarthLiveCelestial.isMoonActive())window.EarthLiveCelestial.closeMoon();if(window.EarthLiveLocation)window.EarthLiveLocation.showStatus('Anchoring your Sun view…');try{const loc=window.EarthLiveLocation&&await window.EarthLiveLocation.getCurrentLocation({refresh:false});if(!loc)throw new Error('Location unavailable');if(!showSky(loc))throw new Error('No daylight window');}catch(e){if(window.EarthLiveLocation)window.EarthLiveLocation.showStatus(e&&e.code===1?'Allow location access to open Sun Sky View.':'Sun Sky View needs your location. Tap Sun again after allowing access.');}}
// Capture the Sun tap before the legacy shading-only click handler; Moon's handler remains untouched.
sunBtn.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();toggleSun();},true);
sunRange.addEventListener('input',e=>{if(!active||!sunWindow)return;e.stopImmediatePropagation();const date=new Date(sunWindow.start.getTime()+Number(sunRange.value)*60000);updateSun(date);},true);
moonBtn.addEventListener('click',()=>{if(active)closeSun();},true);
layersBtn.addEventListener('click',()=>{if(active)closeSun();},true);
window.addEventListener('earthlive:viewer-ready',e=>{viewer=e.detail.viewer;if(viewer&&viewer.scene&&viewer.scene.globe){viewer.scene.globe.enableLighting=true;viewer.scene.globe.dynamicAtmosphereLighting=true;viewer.scene.globe.dynamicAtmosphereLightingFromSun=true;viewer.scene.requestRender();}});
window.addEventListener('earthlive:foreground',()=>{if(active&&sunWindow)updateSun(new Date(sunWindow.start.getTime()+Number(sunRange.value)*60000));});
window.EarthLiveSunSky={isActive:()=>active,close:closeSun};
})();
/* EARTH // LIVE Sun/Moon Tracker v1.17
 * Sun/Moon buttons toggle live tracking independently.
 * Past/Future enters a 24-hour (±12 h) simulation window with a horizontal scrubber.
 * Moon visibility threshold remains a fixed internal 40° default.
 */
(() => {
'use strict';
const $=id=>document.getElementById(id);
const panel=$('astroPanel'),button=$('lightingBtn'),close=$('astroClose'),sunTab=$('sunTab'),moonTab=$('moonTab');
const objectRow=$('astroObjectRow'),pastFutureBtn=$('pastFutureBtn'),timeline=$('astroTimeline'),scrubber=$('astroTimeScrubber');
const info=$('astroInfo'),summary=$('astroSummary'),title=$('astroTitle'),readout=$('astroTimeReadout');
let viewer=null,activeObject=null,simulation=false,simTime=new Date(),overlayEntities=[],liveTimer=null,lastOverlayBucket=null;
const DEG=Math.PI/180,MOON_ALTITUDE_THRESHOLD=40,OVERLAY_STEP=10,OVERLAY_ALPHA=34;
function wrap360(v){return ((v%360)+360)%360;}
function sinD(v){return Math.sin(v*DEG);}
function cosD(v){return Math.cos(v*DEG);}
function gmstDeg(date){const jd=date.getTime()/86400000+2440587.5,T=(jd-2451545)/36525;return wrap360(280.46061837+360.98564736629*(jd-2451545)+0.000387933*T*T-T*T*T/38710000);}
function sunPosition(date){
 const jd=date.getTime()/86400000+2440587.5,T=(jd-2451545)/36525,L=wrap360(280.46646+36000.76983*T+0.0003032*T*T),M=wrap360(357.52911+35999.05029*T-0.0001537*T*T);
 const C=(1.914602-0.004817*T-0.000014*T*T)*sinD(M)+(0.019993-0.000101*T)*sinD(2*M)+0.000289*sinD(3*M),lambda=wrap360(L+C),eps=23.439291-0.0130042*T;
 const ra=wrap360(Math.atan2(cosD(eps)*sinD(lambda),cosD(lambda))/DEG),dec=Math.asin(sinD(eps)*sinD(lambda))/DEG;
 return {ra,dec,latitude:dec,longitude:((ra-gmstDeg(date)+540)%360)-180};
}
function moonPosition(date){
 if(window.EarthLiveMoon&&typeof window.EarthLiveMoon.calculate==='function'){const m=window.EarthLiveMoon.calculate(date);return {ra:m.rightAscensionDeg,dec:m.declinationDeg,illumination:m.illuminationPercent,phase:m.phaseName,distance:m.distanceKm};}
 return null;
}
function fmt(d){return d.toLocaleString(undefined,{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});}
function setClock(date){if(viewer&&window.Cesium){viewer.clock.currentTime=Cesium.JulianDate.fromDate(date);viewer.clock.shouldAnimate=false;viewer.scene.requestRender();}}
function moonAltitude(lat,lon,moon,date){const hour=wrap360(gmstDeg(date)+lon-moon.ra),s=sinD(lat)*sinD(moon.dec)+cosD(lat)*cosD(moon.dec)*Math.cos(hour*DEG);return Math.asin(Math.max(-1,Math.min(1,s)))/DEG;}
function clearOverlay(){if(!viewer)return;for(const e of overlayEntities)viewer.entities.remove(e);overlayEntities=[];}
function renderMoonOverlay(date,moon){
 if(!viewer||!window.Cesium||!moon||activeObject!=='moon')return;
 const bucket=Math.floor(date.getTime()/600000);if(bucket===lastOverlayBucket&&overlayEntities.length)return;
 lastOverlayBucket=bucket;clearOverlay();
 for(let lat=-85;lat<90;lat+=OVERLAY_STEP){for(let lon=-180;lon<180;lon+=OVERLAY_STEP){
  if(moonAltitude(lat+OVERLAY_STEP/2,lon+OVERLAY_STEP/2,moon,date)<MOON_ALTITUDE_THRESHOLD)continue;
  overlayEntities.push(viewer.entities.add({rectangle:{coordinates:Cesium.Rectangle.fromDegrees(lon,lat,lon+OVERLAY_STEP,Math.min(90,lat+OVERLAY_STEP)),material:Cesium.Color.fromBytes(88,180,255,OVERLAY_ALPHA),outline:false,height:0}}));
 }}
 viewer.scene.requestRender();
}
function update(){
 if(!viewer)return;
 const date=simulation?new Date(simTime):new Date();setClock(date);
 if(simulation)readout.textContent=fmt(date);
 if(!activeObject){info.hidden=true;clearOverlay();lastOverlayBucket=null;return;}
 info.hidden=false;
 if(activeObject==='sun'){
  const sun=sunPosition(date);title.textContent='SUN';summary.textContent=simulation?'Past / Future position':'Live Sun tracking';
  info.innerHTML='<strong>Sun position</strong><br>Subsolar point: '+sun.latitude.toFixed(1)+'° latitude, '+sun.longitude.toFixed(1)+'° longitude';
  clearOverlay();lastOverlayBucket=null;
 }else{
  const moon=moonPosition(date);title.textContent='MOON';summary.textContent=simulation?'Past / Future position':'Live Moon tracking';
  if(moon){info.innerHTML='<strong>'+moon.phase+'</strong> · '+moon.illumination.toFixed(0)+'% illuminated<br>Approx. distance: '+Math.round(moon.distance).toLocaleString()+' km';renderMoonOverlay(date,moon);}
  else info.textContent='Moon calculator unavailable. Check moon-dataset.js.';
 }
 syncObjectButtons();
}
function syncObjectButtons(){
 sunTab.classList.toggle('active',activeObject==='sun');moonTab.classList.toggle('active',activeObject==='moon');
 sunTab.setAttribute('aria-pressed',String(activeObject==='sun'));moonTab.setAttribute('aria-pressed',String(activeObject==='moon'));
}
function chooseLiveObject(which){
 simulation=false;timeline.hidden=true;pastFutureBtn.classList.remove('active');
 if(activeObject===which){activeObject=null;title.textContent='SUN / MOON';summary.textContent='Choose Sun or Moon';info.hidden=true;clearOverlay();lastOverlayBucket=null;}
 else{activeObject=which;update();}
 syncObjectButtons();
}
function enterSimulation(){
 simulation=true;simTime=new Date();scrubber.value='0';timeline.hidden=false;
 pastFutureBtn.classList.add('active');summary.textContent='Past / Future · 24-hour window';
 update();readout.textContent=fmt(simTime);
}
function returnLive(){
 simulation=false;timeline.hidden=true;pastFutureBtn.classList.remove('active');
 activeObject=null;title.textContent='SUN / MOON';summary.textContent='Choose Sun or Moon';info.hidden=true;
 clearOverlay();lastOverlayBucket=null;syncObjectButtons();
}
function scrubTo(value){const offset=Math.max(-720,Math.min(720,Number(value)));simTime=new Date(Date.now()+offset*60000);update();}
function openPanel(){panel.hidden=false;button.classList.add('active');returnLive();summary.textContent='Choose Sun or Moon';}
function closePanel(){panel.hidden=true;button.classList.remove('active');activeObject=null;simulation=false;timeline.hidden=true;info.hidden=true;clearOverlay();lastOverlayBucket=null;syncObjectButtons();}
button.addEventListener('click',()=>panel.hidden?openPanel():closePanel());
close.addEventListener('click',closePanel);
sunTab.addEventListener('click',()=>chooseLiveObject('sun'));
moonTab.addEventListener('click',()=>chooseLiveObject('moon'));
pastFutureBtn.addEventListener('click',()=>timeline.hidden?enterSimulation():returnLive());
scrubber.addEventListener('input',()=>scrubTo(scrubber.value));
$('timeMinus').addEventListener('click',()=>{simTime=new Date(simTime.getTime()-3600000);scrubber.value=String(Math.max(-720,Math.min(720,(simTime.getTime()-Date.now())/60000)));update();});
$('timePlus').addEventListener('click',()=>{simTime=new Date(simTime.getTime()+3600000);scrubber.value=String(Math.max(-720,Math.min(720,(simTime.getTime()-Date.now())/60000)));update();});
$('backToLive').addEventListener('click',returnLive);
window.addEventListener('earthlive:viewer-ready',event=>{viewer=event.detail.viewer;update();liveTimer=setInterval(()=>{if(!document.hidden)update();},30000);});
window.addEventListener('earthlive:foreground',()=>{if(!simulation&&activeObject)update();});
window.addEventListener('pagehide',()=>{if(liveTimer!==null)clearInterval(liveTimer);clearOverlay();});
})();

/* EARTH // LIVE Sun/Moon Tracker v1.20
 * Closed and inactive on launch; orientation-aware, touch-friendly simulation slider.
 */
(() => {
'use strict';
const $=id=>document.getElementById(id);
const panel=$('astroPanel'),button=$('lightingBtn'),close=$('astroClose'),sunTab=$('sunTab'),moonTab=$('moonTab');
const normalHeader=$('astroNormalHeader'),normalControls=$('astroNormalControls'),simOnly=$('astroSimOnly'),pastFutureBtn=$('pastFutureBtn'),scrubber=$('astroTimeScrubber');
const info=$('astroInfo'),summary=$('astroSummary'),title=$('astroTitle'),readout=$('astroTimeReadout');
let viewer=null,activeObject=null,simulation=false,simTime=new Date(),simulationAnchor=new Date(),overlayEntities=[],liveTimer=null,lastOverlayBucket=null,moonOrbitEntities=[];
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
// Temporary visual diagnostic: a 10-day Moon orbital arc sampled from the
// existing local lunar calculator. Positions are expressed in one fixed inertial
// orientation anchored at the current time, so the orbit does not rotate with Earth's texture.
// The radius is deliberately enlarged for inspection; this is a visual preview, not scale.
function clearMoonOrbitPath(){
 if(!viewer)return;
 for(const entity of moonOrbitEntities)viewer.entities.remove(entity);
 moonOrbitEntities=[];
}
function renderMoonOrbitPath(){
 if(!viewer||!window.Cesium||!window.EarthLiveMoon||typeof window.EarthLiveMoon.calculate!=='function')return;
 clearMoonOrbitPath();
 const now=new Date(),anchorGmst=gmstDeg(now),halfWindowMs=5*86400000,stepMs=6*3600000;
 const points=[];
 for(let offset=-halfWindowMs;offset<=halfWindowMs;offset+=stepMs){
  const sampleDate=new Date(now.getTime()+offset),moon=moonPosition(sampleDate);
  if(!moon)continue;
  const longitude=((moon.ra-anchorGmst+540)%360)-180;
  const latitude=moon.dec;
  // Keep the real calculated orbital direction and distance variation, but use a
  // display radius suitable for the existing globe camera rather than true scale.
  const displayRadius=19000000*(moon.distance/384400);
  const altitude=Math.max(250000,displayRadius-6378137);
  const position=Cesium.Cartesian3.fromDegrees(longitude,latitude,altitude);
  points.push({position,offset});
 }
 for(let i=0;i<points.length;i++){
  const current=points[i],isNow=Math.abs(current.offset)<stepMs/2;
  moonOrbitEntities.push(viewer.entities.add({
   position:current.position,
   point:{pixelSize:isNow?9:4,color:isNow?Cesium.Color.fromCssColorString('#e8f7ff'):Cesium.Color.fromCssColorString('#9bd8ff').withAlpha(0.76),outlineColor:Cesium.Color.fromCssColorString('#14364d'),outlineWidth:isNow?2:1,disableDepthTestDistance:Number.POSITIVE_INFINITY},
   properties:{earthLiveMoonOrbit:true,offsetHours:current.offset/3600000}
  }));
 }
 viewer.scene.requestRender();
}
function fmt(d){return d.toLocaleString(undefined,{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});}
function currentLocalTime(){return new Date(Date.now());}
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
  const sun=sunPosition(date);title.textContent='SUN';summary.textContent='Live Sun tracking';
  info.innerHTML='<strong>Sun position</strong><br>Subsolar point: '+sun.latitude.toFixed(1)+'° latitude, '+sun.longitude.toFixed(1)+'° longitude';
  clearOverlay();lastOverlayBucket=null;
 }else{
  const moon=moonPosition(date);title.textContent='MOON';summary.textContent='Live Moon tracking';
  if(moon){info.innerHTML='<strong>'+moon.phase+'</strong> · '+moon.illumination.toFixed(0)+'% illuminated<br>Approx. distance: '+Math.round(moon.distance).toLocaleString()+' km';renderMoonOverlay(date,moon);}
  else info.textContent='Moon calculator unavailable.';
 }
 syncObjectButtons();
}
function syncObjectButtons(){sunTab.classList.toggle('active',activeObject==='sun'&&!simulation);moonTab.classList.toggle('active',activeObject==='moon'&&!simulation);sunTab.setAttribute('aria-pressed',String(activeObject==='sun'&&!simulation));moonTab.setAttribute('aria-pressed',String(activeObject==='moon'&&!simulation));}
function chooseLiveObject(which){
 if(simulation)return;
 if(activeObject===which){activeObject=null;title.textContent='SUN / MOON';summary.textContent='Choose Sun or Moon';info.hidden=true;clearOverlay();lastOverlayBucket=null;}
 else{activeObject=which;update();}
 syncObjectButtons();
}
function enterSimulation(){
 simulation=true;simulationAnchor=currentLocalTime();simTime=new Date(simulationAnchor.getTime());scrubber.value='0';panel.classList.add('simulation-mode');simOnly.hidden=false;normalHeader.hidden=true;normalControls.hidden=true;readout.textContent=fmt(simTime);update();
}
function returnLive(){
 simulation=false;panel.classList.remove('simulation-mode');simOnly.hidden=true;normalHeader.hidden=false;normalControls.hidden=false;
 activeObject=null;title.textContent='SUN / MOON';summary.textContent='Choose Sun or Moon';info.hidden=true;
 clearOverlay();lastOverlayBucket=null;syncObjectButtons();
}
function scrubTo(value){
 const raw=Number(value);
 const offset=Math.max(-720,Math.min(720,Number.isFinite(raw)?raw:0));
 // Native range values are always chronological: negative = past, positive = future.
 // CSS is reset to LTR/horizontal; landscape rotates that same control once, so up = future.
 simTime=new Date(simulationAnchor.getTime()+offset*60000);
 readout.textContent=fmt(simTime);
 update();
}
function openPanel(){panel.hidden=false;button.classList.add('active');returnLive();summary.textContent='Choose Sun or Moon';}
function closePanel(){panel.hidden=true;button.classList.remove('active');activeObject=null;simulation=false;panel.classList.remove('simulation-mode');simOnly.hidden=true;normalHeader.hidden=false;normalControls.hidden=false;info.hidden=true;clearOverlay();lastOverlayBucket=null;syncObjectButtons();}
button.addEventListener('click',()=>panel.hidden?openPanel():closePanel());
close.addEventListener('click',closePanel);
sunTab.addEventListener('click',()=>chooseLiveObject('sun'));
moonTab.addEventListener('click',()=>chooseLiveObject('moon'));
pastFutureBtn.addEventListener('click',enterSimulation);
scrubber.addEventListener('input',()=>scrubTo(scrubber.value));
scrubber.addEventListener('change',()=>scrubTo(scrubber.value));
$('backToLive').addEventListener('click',returnLive);
window.addEventListener('earthlive:viewer-ready',event=>{viewer=event.detail.viewer;panel.hidden=true;simOnly.hidden=true;button.classList.remove('active');activeObject=null;simulation=false;syncObjectButtons();renderMoonOrbitPath();liveTimer=setInterval(()=>{if(!document.hidden)update();},30000);});
window.addEventListener('earthlive:foreground',()=>{if(!simulation&&activeObject)update();});
window.addEventListener('pagehide',()=>{if(liveTimer!==null)clearInterval(liveTimer);clearOverlay();clearMoonOrbitPath();});
})();

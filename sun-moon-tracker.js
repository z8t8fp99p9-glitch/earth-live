/* EARTH // LIVE Sun/Moon Tracker v1.20
 * Closed and inactive on launch; orientation-aware, touch-friendly simulation slider.
 */
(() => {
'use strict';
const $=id=>document.getElementById(id);
const panel=$('astroPanel'),button=$('lightingBtn'),close=$('astroClose'),sunTab=$('sunTab'),moonTab=$('moonTab');
const normalHeader=$('astroNormalHeader'),normalControls=$('astroNormalControls'),simOnly=$('astroSimOnly'),pastFutureBtn=$('pastFutureBtn'),scrubber=$('astroTimeScrubber');
const info=$('astroInfo'),summary=$('astroSummary'),title=$('astroTitle'),readout=$('astroTimeReadout');
let viewer=null,activeObject=null,simulation=false,simTime=new Date(),simulationAnchor=new Date(),overlayEntities=[],celestialEntity=null,liveTimer=null,lastOverlayBucket=null;
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
 if(window.EarthLiveMoon&&typeof window.EarthLiveMoon.calculate==='function'){const m=window.EarthLiveMoon.calculate(date);return {ra:m.rightAscensionDeg,dec:m.declinationDeg,longitude:((m.rightAscensionDeg-gmstDeg(date)+540)%360)-180,illumination:m.illuminationPercent,phase:m.phaseName,distance:m.distanceKm,phaseAngle:m.phaseAngleDeg};}
 return null;
}
function svgData(svg){return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);}
function sunIcon(){return svgData('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><defs><radialGradient id="g"><stop stop-color="#fffbd5"/><stop offset=".28" stop-color="#ffe99a"/><stop offset=".62" stop-color="#ffb83d"/><stop offset="1" stop-color="#ff8a22" stop-opacity="0"/></radialGradient></defs><circle cx="48" cy="48" r="47" fill="url(#g)"/><circle cx="48" cy="48" r="19" fill="#fff2b2" stroke="#ffffff" stroke-opacity=".85" stroke-width="2"/></svg>');}
function moonIcon(illumination){const lit=Math.max(0,Math.min(1,illumination/100));const offset=(1-lit)*34;const shadow=lit<0.04?'<circle cx="48" cy="48" r="34" fill="#101b2b"/>':lit>0.96?'':'<ellipse cx="'+(48-offset)+'" cy="48" rx="'+Math.max(1,34*(1-lit))+'" ry="34" fill="#101b2b"/>';return svgData('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><defs><radialGradient id="m" cx="35%" cy="28%"><stop stop-color="#ffffff"/><stop offset=".62" stop-color="#dce8f4"/><stop offset="1" stop-color="#9aaaba"/></radialGradient><filter id="glow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="3"/></filter></defs><circle cx="48" cy="48" r="43" fill="#7fcfff" opacity=".22" filter="url(#glow)"/><circle cx="48" cy="48" r="34" fill="#101b2b" stroke="#8b9baa" stroke-width="2"/><circle cx="48" cy="48" r="34" fill="url(#m)"/>'+shadow+'</svg>');}
function clearCelestial(){if(viewer&&celestialEntity){viewer.entities.remove(celestialEntity);}celestialEntity=null;}
function renderCelestial(which,date,data){
 if(!viewer||!window.Cesium||!data)return;
 clearCelestial();
 const lon=data.longitude,lat=which==='sun'?data.latitude:data.dec;
 // Distances are deliberately visually scaled for this globe camera; coordinates track the calculated celestial direction.
 const height=which==='sun'?1600000:3500000;
 celestialEntity=viewer.entities.add({id:'earth-live-'+which+'-visual',position:Cesium.Cartesian3.fromDegrees(lon,lat,height),billboard:{image:which==='sun'?sunIcon():moonIcon(data.illumination),width:which==='sun'?54:46,height:which==='sun'?54:46,verticalOrigin:Cesium.VerticalOrigin.CENTER,horizontalOrigin:Cesium.HorizontalOrigin.CENTER,scaleByDistance:new Cesium.NearFarScalar(7000000,1.15,45000000,0.58),disableDepthTestDistance:0},label:{text:which==='sun'?'SUN':'MOON',font:'600 12px sans-serif',fillColor:which==='sun'?Cesium.Color.fromCssColorString('#ffe8a6'):Cesium.Color.fromCssColorString('#e7f1ff'),outlineColor:Cesium.Color.BLACK,outlineWidth:3,style:Cesium.LabelStyle.FILL_AND_OUTLINE,pixelOffset:new Cesium.Cartesian2(0,35),scaleByDistance:new Cesium.NearFarScalar(7000000,1,45000000,0.6)}});
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
 if(!activeObject){info.hidden=true;clearOverlay();clearCelestial();lastOverlayBucket=null;return;}
 info.hidden=false;
 if(activeObject==='sun'){
  const sun=sunPosition(date);title.textContent='SUN';summary.textContent='Live Sun tracking';
  info.innerHTML='<strong>Sun position</strong><br>Subsolar point: '+sun.latitude.toFixed(1)+'° latitude, '+sun.longitude.toFixed(1)+'° longitude<br><span class="astro-note">Directional marker is visually scaled; Earth lighting follows the selected time.</span>';
  renderCelestial('sun',date,sun);clearOverlay();lastOverlayBucket=null;
 }else{
  const moon=moonPosition(date);title.textContent='MOON';summary.textContent='Live Moon tracking';
  if(moon){info.innerHTML='<strong>'+moon.phase+'</strong> · '+moon.illumination.toFixed(0)+'% illuminated<br>Approx. distance: '+Math.round(moon.distance).toLocaleString()+' km<br><span class="astro-note">Moon marker is visually scaled for this globe view.</span>';renderCelestial('moon',date,moon);renderMoonOverlay(date,moon);}
  else {info.textContent='Moon calculator unavailable.';clearCelestial();}
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
 clearOverlay();clearCelestial();lastOverlayBucket=null;syncObjectButtons();
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
function closePanel(){panel.hidden=true;button.classList.remove('active');activeObject=null;simulation=false;panel.classList.remove('simulation-mode');simOnly.hidden=true;normalHeader.hidden=false;normalControls.hidden=false;info.hidden=true;clearOverlay();clearCelestial();lastOverlayBucket=null;syncObjectButtons();}
button.addEventListener('click',()=>panel.hidden?openPanel():closePanel());
close.addEventListener('click',closePanel);
sunTab.addEventListener('click',()=>chooseLiveObject('sun'));
moonTab.addEventListener('click',()=>chooseLiveObject('moon'));
pastFutureBtn.addEventListener('click',enterSimulation);
scrubber.addEventListener('input',()=>scrubTo(scrubber.value));
scrubber.addEventListener('change',()=>scrubTo(scrubber.value));
$('backToLive').addEventListener('click',returnLive);
window.addEventListener('earthlive:viewer-ready',event=>{viewer=event.detail.viewer;panel.hidden=true;simOnly.hidden=true;button.classList.remove('active');activeObject=null;simulation=false;clearCelestial();syncObjectButtons();liveTimer=setInterval(()=>{if(!document.hidden)update();},30000);});
window.addEventListener('earthlive:foreground',()=>{if(!simulation&&activeObject)update();});
window.addEventListener('pagehide',()=>{if(liveTimer!==null)clearInterval(liveTimer);clearOverlay();});
})();

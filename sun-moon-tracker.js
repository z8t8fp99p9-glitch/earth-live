/* EARTH // LIVE Sun/Moon Tracker v1.20
 * Closed and inactive on launch; orientation-aware, touch-friendly simulation slider.
 */
(() => {
'use strict';
const $=id=>document.getElementById(id);
const panel=$('astroPanel'),button=$('lightingBtn'),close=$('astroClose'),sunTab=$('sunTab'),moonTab=$('moonTab');
const normalHeader=$('astroNormalHeader'),normalControls=$('astroNormalControls'),simOnly=$('astroSimOnly'),pastFutureBtn=$('pastFutureBtn'),scrubber=$('astroTimeScrubber');
const info=$('astroInfo'),summary=$('astroSummary'),title=$('astroTitle'),readout=$('astroTimeReadout');
let viewer=null,activeObject=null,simulation=false,simTime=new Date(),simulationAnchor=new Date(),overlayEntities=[],celestialEntities={sun:null,moon:null},liveTimer=null,lastOverlayBucket=null;
let celestialActive=false,celestialAnchor=null,lastSceneTime=null,savedCamera=null,sceneAutoExit=false,sceneCameraGuard=false;
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
function saveCamera(){
 if(!viewer)return null;
 const c=viewer.camera;
 return {position:c.positionWC.clone(),direction:c.directionWC.clone(),up:c.upWC.clone()};
}
function restoreCamera(state){
 if(!viewer||!state)return;
 try{viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);viewer.camera.setView({destination:state.position,orientation:{direction:state.direction,up:state.up}});viewer.scene.requestRender();}catch(e){console.warn('Camera restore skipped',e);}
}
function clearCelestial(){
 if(viewer){Object.keys(celestialEntities).forEach(k=>{if(celestialEntities[k])viewer.entities.remove(celestialEntities[k]);celestialEntities[k]=null;});}
}
function celestialImage(which,data){return which==='sun'?sunIcon():moonIcon(data.illumination);}
function upsertCelestial(which,date,data){
 if(!viewer||!window.Cesium||!data)return;
 const id='earth-live-'+which+'-visual';
 const lon=data.longitude,lat=which==='sun'?data.latitude:data.dec;
 // In Celestial View these are intentionally visually scaled, but their directions follow the astronomy model.
 // Sun is fixed at the scene's anchor time; Moon follows the selected simulation time.
 const altitude=which==='sun'?24000000:3500000;
 const position=Cesium.Cartesian3.fromDegrees(lon,lat,altitude);
 const image=celestialImage(which,data);
 let entity=celestialEntities[which];
 if(!entity){
  entity=viewer.entities.add({id,position,billboard:{image,width:which==='sun'?112:88,height:which==='sun'?112:88,verticalOrigin:Cesium.VerticalOrigin.CENTER,horizontalOrigin:Cesium.HorizontalOrigin.CENTER,scaleByDistance:new Cesium.NearFarScalar(12000000,1.0,90000000,0.85),disableDepthTestDistance:Number.POSITIVE_INFINITY},label:{text:which==='sun'?'SUN':'MOON',font:'600 13px sans-serif',fillColor:which==='sun'?Cesium.Color.fromCssColorString('#ffe7a0'):Cesium.Color.fromCssColorString('#e7f1ff'),outlineColor:Cesium.Color.fromCssColorString('#030509'),outlineWidth:3,style:Cesium.LabelStyle.FILL_AND_OUTLINE,pixelOffset:new Cesium.Cartesian2(0,60),scaleByDistance:new Cesium.NearFarScalar(12000000,1.0,90000000,0.85),disableDepthTestDistance:Number.POSITIVE_INFINITY}});
  celestialEntities[which]=entity;
 }else{
  entity.position=position;entity.billboard.image=image;entity.label.text=which==='sun'?'SUN':'MOON';
 }
}
function beginCelestialScene(){
 if(!viewer||celestialActive)return;
 celestialActive=true;sceneAutoExit=false;celestialAnchor=new Date();lastSceneTime=new Date(celestialAnchor);savedCamera=saveCamera();
 // Freeze Cesium's lighting clock at scene entry. The camera then moves around the globe as time is scrubbed,
 // making the Earth visibly rotate under a fixed Sun rather than moving the Sun around the screen.
 setClock(celestialAnchor);
 try{
  const anchorSun=sunPosition(celestialAnchor);
  viewer.camera.lookAt(Cesium.Cartesian3.ZERO,new Cesium.HeadingPitchRange(Cesium.Math.toRadians(wrap360(anchorSun.longitude+90)),Cesium.Math.toRadians(-12),40000000));
  viewer.scene.requestRender();
 }catch(e){console.warn('Celestial camera framing fallback',e);}
}
function endCelestialScene(restore){
 if(!celestialActive)return;
 celestialActive=false;simulation=false;lastSceneTime=null;celestialAnchor=null;
 clearCelestial();
 if(restore&&savedCamera)restoreCamera(savedCamera);
 savedCamera=null;
 if(viewer){setClock(new Date());viewer.scene.requestRender();}
}
function updateCelestialScene(date,sun,moon){
 if(!celestialActive||!viewer)return;
 if(!sun)sun=sunPosition(celestialAnchor||date);
 // Keep the Sun anchored to the scene's starting solar direction.
 const fixedSun=sunPosition(celestialAnchor||date);
 upsertCelestial('sun',celestialAnchor||date,fixedSun);
 if(moon)upsertCelestial('moon',date,moon);
 // Rotate the view by elapsed sidereal time, preserving camera gesture changes between scrub events.
 // This creates the visual impression of Earth rotating beneath a stationary Sun.
 const previous=lastSceneTime||date,deltaMs=date.getTime()-previous.getTime();
 if(deltaMs&&Math.abs(deltaMs)<86400000){
  try{sceneCameraGuard=true;viewer.camera.rotate(Cesium.Cartesian3.UNIT_Z,deltaMs/86164090*2*Math.PI);}
  catch(e){console.warn('Celestial time rotation skipped',e);}finally{sceneCameraGuard=false;}
 }
 lastSceneTime=new Date(date);
 viewer.scene.requestRender();
}
function checkZoomExit(){
 if(!celestialActive||!viewer||sceneAutoExit||sceneCameraGuard)return;
 // Close the celestial layer when the camera is close enough to Earth for normal globe exploration.
 const distance=Cesium.Cartesian3.magnitude(viewer.camera.positionWC);
 if(Number.isFinite(distance)&&distance<10500000){
  sceneAutoExit=true;const currentCamera=saveCamera();endCelestialScene(false);restoreCamera(currentCamera);activeObject=null;simulation=false;panel.hidden=true;button.classList.remove('active');panel.classList.remove('simulation-mode');simOnly.hidden=true;normalHeader.hidden=false;normalControls.hidden=false;info.hidden=true;clearOverlay();lastOverlayBucket=null;syncObjectButtons();
 }
}
function renderCelestial(which,date,data){
 // Compatibility shim: the scene always renders both bodies after either one is selected.
 if(!celestialActive)beginCelestialScene();
 const sun=sunPosition(celestialAnchor||date),moon=moonPosition(date);
 updateCelestialScene(date,sun,moon);
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
 const date=simulation?new Date(simTime):new Date();
 if(celestialActive){
  // The globe's lighting clock stays at the scene anchor while the camera rotates to show Earth's spin.
  setClock(celestialAnchor||date);
 }else setClock(date);
 if(simulation)readout.textContent=fmt(date);
 if(!activeObject){info.hidden=true;clearOverlay();if(!celestialActive)clearCelestial();lastOverlayBucket=null;return;}
 info.hidden=false;
 const sun=sunPosition(date),moon=moonPosition(date);
 if(activeObject==='sun'){
  const fixedSun=sunPosition(celestialAnchor||date);title.textContent='SUN';summary.textContent='Fixed Sun · rotating Earth';
  info.innerHTML='<strong>Sun position</strong><br>Fixed light source · Earth rotates with the selected time<br><span class="astro-note">Sun is visually scaled; lighting is held to the scene direction.</span>';
  if(celestialActive)updateCelestialScene(date,fixedSun,moon);else renderCelestial('sun',date,fixedSun);
  clearOverlay();lastOverlayBucket=null;
 }else{
  title.textContent='MOON';summary.textContent='Moon orbit · rotating Earth';
  if(moon){info.innerHTML='<strong>'+moon.phase+'</strong> · '+moon.illumination.toFixed(0)+'% illuminated<br>Approx. distance: '+Math.round(moon.distance).toLocaleString()+' km<br><span class="astro-note">Moon is visually scaled; orbital direction follows the selected time.</span>';if(celestialActive){updateCelestialScene(date,sunPosition(celestialAnchor||date),moon);clearOverlay();lastOverlayBucket=null;}else {renderCelestial('moon',date,moon);renderMoonOverlay(date,moon);}}
  else {info.textContent='Moon calculator unavailable.';clearCelestial();}
 }
 syncObjectButtons();
}
function syncObjectButtons(){sunTab.classList.toggle('active',activeObject==='sun'&&!simulation);moonTab.classList.toggle('active',activeObject==='moon'&&!simulation);sunTab.setAttribute('aria-pressed',String(activeObject==='sun'&&!simulation));moonTab.setAttribute('aria-pressed',String(activeObject==='moon'&&!simulation));}
function chooseLiveObject(which){
 if(simulation)return;
 // Selection is sticky: tapping the already-selected tab must not hide the marker.
 // The main Sun/Moon dock control is the single exit that clears it.
 if(activeObject!==which){activeObject=which;if(!celestialActive)beginCelestialScene();update();}
 syncObjectButtons();
}
function enterSimulation(){
 simulation=true;simulationAnchor=currentLocalTime();simTime=new Date(simulationAnchor.getTime());lastSceneTime=new Date(simTime);scrubber.value='0';panel.classList.add('simulation-mode');simOnly.hidden=false;normalHeader.hidden=true;normalControls.hidden=true;readout.textContent=fmt(simTime);update();
}
function returnLive(){
 simulation=false;panel.classList.remove('simulation-mode');simOnly.hidden=true;normalHeader.hidden=false;normalControls.hidden=false;
 lastSceneTime=new Date();lastOverlayBucket=null;
 // Keep the selected Sun/Moon active and immediately recalculate its live position.
 update();
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
function closePanel(){panel.hidden=true;button.classList.remove('active');activeObject=null;simulation=false;panel.classList.remove('simulation-mode');simOnly.hidden=true;normalHeader.hidden=false;normalControls.hidden=false;info.hidden=true;clearOverlay();endCelestialScene(true);clearCelestial();lastOverlayBucket=null;syncObjectButtons();}
button.addEventListener('click',()=>panel.hidden?openPanel():closePanel());
close.addEventListener('click',closePanel);
sunTab.addEventListener('click',()=>chooseLiveObject('sun'));
moonTab.addEventListener('click',()=>chooseLiveObject('moon'));
pastFutureBtn.addEventListener('click',enterSimulation);
scrubber.addEventListener('input',()=>scrubTo(scrubber.value));
scrubber.addEventListener('change',()=>scrubTo(scrubber.value));
$('backToLive').addEventListener('click',returnLive);
window.addEventListener('earthlive:viewer-ready',event=>{viewer=event.detail.viewer;panel.hidden=true;simOnly.hidden=true;button.classList.remove('active');activeObject=null;simulation=false;clearCelestial();syncObjectButtons();viewer.camera.changed.addEventListener(checkZoomExit);liveTimer=setInterval(()=>{if(!document.hidden)update();},30000);});
window.addEventListener('earthlive:foreground',()=>{if(!simulation&&activeObject)update();});
window.addEventListener('pagehide',()=>{if(liveTimer!==null)clearInterval(liveTimer);clearOverlay();clearCelestial();});
})();

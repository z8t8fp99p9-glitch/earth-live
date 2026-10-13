/* EARTH // LIVE Sun/Moon Tracker v1.15
 * Local calculations only. Low-rate updates; never runs a per-frame astronomy loop.
 */
(() => {
'use strict';
const $=id=>document.getElementById(id);
const panel=$('astroPanel'),button=$('lightingBtn'),close=$('astroClose'),sunTab=$('sunTab'),moonTab=$('moonTab');
const liveMode=$('liveMode'),simulateMode=$('simulateMode'),simBox=$('astroSim'),dateInput=$('astroDate'),info=$('astroInfo'),summary=$('astroSummary');
const moonRow=$('moonOverlayRow'),moonToggle=$('moonOverlayToggle');
let viewer=null,objectMode='sun',timeMode='live',simTime=new Date(),overlayEntities=[],overlayEnabled=true,playTimer=null,liveTimer=null,lastOverlayAt=0,cache={};
const TWO_PI=Math.PI*2,DEG=Math.PI/180;
function wrap360(v){return ((v%360)+360)%360;}
function sinD(v){return Math.sin(v*DEG);}
function cosD(v){return Math.cos(v*DEG);}
function dateValue(d){const p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;}
function parseInput(){const d=new Date(dateInput.value);return Number.isFinite(d.getTime())?d:new Date();}
function julian(date){return date.getTime()/86400000+2440587.5;}
function sunPosition(date){
 const jd=julian(date),T=(jd-2451545)/36525;
 const L=wrap360(280.46646+36000.76983*T+0.0003032*T*T);
 const M=wrap360(357.52911+35999.05029*T-0.0001537*T*T);
 const C=(1.914602-0.004817*T-0.000014*T*T)*sinD(M)+(0.019993-0.000101*T)*sinD(2*M)+0.000289*sinD(3*M);
 const lambda=wrap360(L+C),eps=23.439291-0.0130042*T;
 const ra=wrap360(Math.atan2(cosD(eps)*sinD(lambda),cosD(lambda))/DEG);
 const dec=Math.asin(sinD(eps)*sinD(lambda))/DEG;
 const subLon=wrap360(ra-gmstDeg(date)+180)-180;
 return {ra,dec,subLon,latitude:dec,longitude:subLon};
}
function gmstDeg(date){
 const jd=julian(date),T=(jd-2451545)/36525;
 return wrap360(280.46061837+360.98564736629*(jd-2451545)+0.000387933*T*T-T*T*T/38710000);
}
function moonPosition(date){
 if(window.EarthLiveMoon&&typeof window.EarthLiveMoon.calculate==='function'){
   const m=window.EarthLiveMoon.calculate(date);
   return {ra:m.rightAscensionDeg,dec:m.declinationDeg,illumination:m.illuminationPercent,phase:m.phaseName,distance:m.distanceKm,accuracy:m.accuracy};
 }
 return null;
}
function activeTime(){return timeMode==='live'?new Date():new Date(simTime.getTime());}
function setClock(date){
 if(!viewer||!window.Cesium)return;
 viewer.clock.currentTime=Cesium.JulianDate.fromDate(date);
 viewer.clock.shouldAnimate=false;
 viewer.scene.requestRender();
}
function clearOverlay(){if(!viewer)return;for(const e of overlayEntities){viewer.entities.remove(e);}overlayEntities=[];}
function moonAltitude(lat,lon,moon,date){
 const hour=wrap360(gmstDeg(date)+lon-moon.ra);
 const s=sinD(lat)*sinD(moon.dec)+cosD(lat)*cosD(moon.dec)*cosD(hour);
 return Math.asin(Math.max(-1,Math.min(1,s)))/DEG;
}
function renderMoonOverlay(date,moon){
 if(!viewer||!window.Cesium||!overlayEnabled||!moon)return;
 const stamp=Math.floor(date.getTime()/600000);
 if(stamp===lastOverlayAt&&overlayEntities.length)return;
 lastOverlayAt=stamp;clearOverlay();
 // 10-degree cells keep entity count low; this is a readable, approximate viewing zone, not a scientific boundary product.
 for(let lat=-85;lat<90;lat+=10){
   for(let lon=-180;lon<180;lon+=10){
     const alt=moonAltitude(lat+5,lon+5,moon,date);
     if(alt<40)continue;
     const entity=viewer.entities.add({
       rectangle:{coordinates:Cesium.Rectangle.fromDegrees(lon,lat,lon+10,Math.min(90,lat+10)),
         material:Cesium.Color.fromBytes(88,180,255,42),outline:false,height:0}
     });
     overlayEntities.push(entity);
   }
 }
 viewer.scene.requestRender();
}
function formatTime(d){return d.toLocaleString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});}
function update(){
 if(!viewer)return;
 const date=activeTime();setClock(date);
 const sun=sunPosition(date),moon=moonPosition(date);
 const modeLabel=timeMode==='live'?'Live time':'Simulated time';
 if(objectMode==='sun'){
   summary.textContent=modeLabel+' · Sun position';
   info.innerHTML=`<strong>Day / night</strong><br>Subsolar point: ${sun.latitude.toFixed(1)}° latitude, ${sun.longitude.toFixed(1)}° longitude<br><span class="astro-muted">Sun position is calculated locally for the selected time.</span>`;
   moonRow.hidden=true;
 }else{
   summary.textContent=modeLabel+' · Moon position';
   if(moon){
     info.innerHTML=`<strong>${moon.phase}</strong> · ${moon.illumination.toFixed(0)}% illuminated<br>Approx. distance: ${Math.round(moon.distance).toLocaleString()} km<br><span class="astro-muted">Moon position: RA ${moon.ra.toFixed(1)}°, Dec ${moon.dec.toFixed(1)}°</span>`;
   }else info.textContent='Moon calculator is unavailable. Check that moon-dataset.js loaded.';
   moonRow.hidden=false;
   renderMoonOverlay(date,moon);
 }
}
function setObject(which){objectMode=which;sunTab.classList.toggle('active',which==='sun');moonTab.classList.toggle('active',which==='moon');sunTab.setAttribute('aria-pressed',String(which==='sun'));moonTab.setAttribute('aria-pressed',String(which==='moon'));update();}
function setTimeMode(which){
 timeMode=which;liveMode.classList.toggle('active',which==='live');simulateMode.classList.toggle('active',which==='simulate');
 liveMode.setAttribute('aria-pressed',String(which==='live'));simulateMode.setAttribute('aria-pressed',String(which==='simulate'));
 simBox.hidden=which!=='simulate';
 if(which==='simulate'){simTime=parseInput();dateInput.value=dateValue(simTime);stopPlay();}
 else stopPlay();
 update();
}
function stopPlay(){if(playTimer!==null)clearInterval(playTimer);playTimer=null;$('playPause').textContent='▶ Play';}
function startPlay(){
 if(playTimer!==null){stopPlay();return;}
 $('playPause').textContent='Ⅱ Pause';
 playTimer=setInterval(()=>{simTime=new Date(simTime.getTime()+60000);dateInput.value=dateValue(simTime);update();},1000);
}
function openPanel(){panel.hidden=false;button.classList.add('active');if(timeMode==='simulate')dateInput.value=dateValue(simTime);update();}
function closePanel(){panel.hidden=true;button.classList.remove('active');}
button.addEventListener('click',()=>panel.hidden?openPanel():closePanel());
close.addEventListener('click',closePanel);
sunTab.addEventListener('click',()=>setObject('sun'));moonTab.addEventListener('click',()=>setObject('moon'));
liveMode.addEventListener('click',()=>setTimeMode('live'));simulateMode.addEventListener('click',()=>setTimeMode('simulate'));
dateInput.addEventListener('change',()=>{simTime=parseInput();update();});
$('minusHour').addEventListener('click',()=>{simTime=new Date(simTime.getTime()-3600000);dateInput.value=dateValue(simTime);update();});
$('plusHour').addEventListener('click',()=>{simTime=new Date(simTime.getTime()+3600000);dateInput.value=dateValue(simTime);update();});
$('playPause').addEventListener('click',startPlay);
$('returnLive').addEventListener('click',()=>setTimeMode('live'));
moonToggle.addEventListener('change',()=>{overlayEnabled=moonToggle.checked;lastOverlayAt=0;update();if(!overlayEnabled)clearOverlay();});
window.addEventListener('earthlive:viewer-ready',event=>{
 viewer=event.detail.viewer;update();
 liveTimer=setInterval(()=>{if(timeMode==='live'&&!document.hidden)update();},30000);
});
window.addEventListener('earthlive:foreground',()=>{if(timeMode==='live')update();});
window.addEventListener('pagehide',()=>{if(liveTimer!==null)clearInterval(liveTimer);stopPlay();clearOverlay();});
})();

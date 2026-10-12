(() => {
'use strict';
const $ = id => document.getElementById(id);
const status = document.querySelector('.status');
const loading = $('loading'), count = $('eventCount'), updated = $('updated');
const quakeBtn = $('quakeBtn'), citiesBtn = $('citiesBtn'), orbitBtn = $('orbitBtn'), refreshBtn = $('refresh');
if (!window.Cesium) {
  loading.textContent = 'THE GLOBE LIBRARY COULD NOT LOAD. CHECK YOUR CONNECTION AND RELOAD.';
  count.textContent = 'OFFLINE'; updated.textContent = 'Map engine unavailable'; status.textContent = '● OFFLINE'; return;
}
const C = Cesium;
const viewer = new C.Viewer('globe', {
  animation:false, timeline:false, geocoder:false, homeButton:false,
  sceneModePicker:false, baseLayerPicker:false, navigationHelpButton:false,
  fullscreenButton:false, vrButton:false, infoBox:false, selectionIndicator:false,
  shouldAnimate:true, requestRenderMode:false,
  imageryProvider:false, terrainProvider:new C.EllipsoidTerrainProvider()
});
viewer.scene.globe.enableLighting = false;
viewer.scene.globe.showGroundAtmosphere = true;
viewer.scene.globe.baseColor = C.Color.fromCssColorString('#07172a');
viewer.scene.backgroundColor = C.Color.fromCssColorString('#060a12');
viewer.scene.screenSpaceCameraController.minimumZoomDistance = 70000;
viewer.scene.screenSpaceCameraController.maximumZoomDistance = 30000000;
viewer.camera.setView({destination:C.Cartesian3.fromDegrees(78,22,17500000)});
viewer.imageryLayers.removeAll();
const imagery = new C.UrlTemplateImageryProvider({
  url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  maximumLevel:19,
  credit:new C.Credit('World Imagery © Esri, Maxar, Earthstar Geographics, and the GIS User Community')
});
viewer.imageryLayers.addImageryProvider(imagery);
let quakes=[], quakeEntities=[], cityEntities=[], showQuakes=true, showCities=false, orbital=false, orbitListener=null, refreshTimer=null;
const cities=[
{name:'New Delhi',lat:28.6139,lng:77.2090,description:'India · capital region'},
{name:'Mumbai',lat:19.076,lng:72.8777,description:'India · major city'},
{name:'Tokyo',lat:35.6762,lng:139.6503,description:'Japan · major city'},
{name:'London',lat:51.5072,lng:-0.1276,description:'United Kingdom · major city'},
{name:'New York',lat:40.7128,lng:-74.006,description:'United States · major city'},
{name:'São Paulo',lat:-23.5505,lng:-46.6333,description:'Brazil · major city'},
{name:'Cairo',lat:30.0444,lng:31.2357,description:'Egypt · major city'},
{name:'Sydney',lat:-33.8688,lng:151.2093,description:'Australia · major city'},
{name:'Singapore',lat:1.3521,lng:103.8198,description:'Singapore · major city'},
{name:'Dubai',lat:25.2048,lng:55.2708,description:'United Arab Emirates · major city'}
];
function openDetail(d){
 $('detail').style.display='block'; $('detailTitle').textContent=d.title||d.name||'LOCATION';
 $('detailText').textContent=d.description||d.label||'Map location';
 const a=$('detailLink'); if(d.url){a.href=d.url;a.style.display='inline-block';}else{a.style.display='none';}
}
viewer.selectedEntityChanged.addEventListener(entity=>{if(entity&&entity.properties){const p=entity.properties;openDetail({title:p.title?.getValue?.()||entity.name,description:p.description?.getValue?.()||'',url:p.url?.getValue?.()||null});}});
function clearEntities(list){list.forEach(e=>viewer.entities.remove(e));list.length=0;}
function renderQuakes(){
 clearEntities(quakeEntities);
 if(!showQuakes)return;
 for(const q of quakes){
   const color=q.magnitude>=5?C.Color.fromCssColorString('#ff5d73'):q.magnitude>=3?C.Color.fromCssColorString('#ffb15e'):C.Color.fromCssColorString('#6be7ff');
   const pos=C.Cartesian3.fromDegrees(q.lng,q.lat,Math.max(8000,Math.min(45000,q.magnitude*5000)));
   const entity=viewer.entities.add({name:q.title,position:pos,properties:{title:q.title,description:q.description,url:q.url||''},
     point:{pixelSize:Math.max(5,Math.min(12,5+q.magnitude)),color,outlineColor:C.Color.fromCssColorString('#06101c'),outlineWidth:1,disableDepthTestDistance:Number.POSITIVE_INFINITY},
     ellipse:{semiMajorAxis:Math.max(18000,Math.min(180000,q.magnitude*26000)),semiMinorAxis:Math.max(18000,Math.min(180000,q.magnitude*26000)),height:5000,material:color.withAlpha(.09),outline:true,outlineColor:color.withAlpha(.65),outlineWidth:1}});
   quakeEntities.push(entity);
 }
}
function renderCities(){
 clearEntities(cityEntities); if(!showCities)return;
 for(const c of cities){cityEntities.push(viewer.entities.add({name:c.name,position:C.Cartesian3.fromDegrees(c.lng,c.lat,15000),properties:{title:c.name,description:c.description},
 point:{pixelSize:6,color:C.Color.fromCssColorString('#6be7ff'),outlineColor:C.Color.BLACK,outlineWidth:1,disableDepthTestDistance:Number.POSITIVE_INFINITY},label:{text:c.name,font:'12px sans-serif',fillColor:C.Color.WHITE,outlineColor:C.Color.BLACK,outlineWidth:3,style:C.LabelStyle.FILL_AND_OUTLINE,pixelOffset:new C.Cartesian2(0,-13),disableDepthTestDistance:Number.POSITIVE_INFINITY}}));}
}
function setActive(btn,on){btn.classList.toggle('active',on);btn.setAttribute('aria-pressed',String(on));}
async function loadQuakes(){
 refreshBtn.disabled=true; updated.textContent='Refreshing USGS public feed…';
 try{
 const res=await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson',{cache:'no-store'});if(!res.ok)throw Error('USGS '+res.status);
 const data=await res.json();
 quakes=(data.features||[]).filter(f=>f.geometry&&f.geometry.coordinates).map(f=>{
 const p=f.properties||{},c=f.geometry.coordinates,mag=Number(p.mag)||0,place=p.place||'Location unavailable';
 const eventDate=p.time?new Date(p.time):null;
 const time=eventDate?eventDate.toLocaleString(undefined,{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:true,timeZoneName:'short'}):'Time unavailable';
 const depth=Number.isFinite(c[2])?c[2].toFixed(1)+' km':'Unavailable';
 return {lat:c[1],lng:c[0],magnitude:mag,title:'EARTHQUAKE · M'+mag.toFixed(1),description:'Magnitude: '+mag.toFixed(1)+'\nLocation: '+place+'\nDepth: '+depth+'\nLocal event time: '+time,url:p.url||null};
 });
 renderQuakes();count.textContent=quakes.length+' QUAKES';
 updated.textContent='USGS refreshed '+new Date().toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit',hour12:true,timeZoneName:'short'});
 }catch(e){updated.textContent='Live feed unavailable. Try refresh when online.';count.textContent='FEED OFFLINE';}
 finally{refreshBtn.disabled=false;}
}
quakeBtn.addEventListener('click',()=>{showQuakes=!showQuakes;setActive(quakeBtn,showQuakes);renderQuakes();});
citiesBtn.addEventListener('click',()=>{showCities=!showCities;setActive(citiesBtn,showCities);renderCities();});
orbitBtn.addEventListener('click',()=>{
 orbital=!orbital;setActive(orbitBtn,orbital);
 if(orbitListener){viewer.clock.onTick.removeEventListener(orbitListener);orbitListener=null;}
 if(orbital){orbitListener=()=>{if(!viewer.isDestroyed())viewer.camera.rotateRight(0.00012);};viewer.clock.onTick.addEventListener(orbitListener);}
});
refreshBtn.addEventListener('click',loadQuakes);
viewer.scene.globe.tileLoadProgressEvent.addEventListener(n=>{if(n===0){loading.style.display='none';status.textContent='● SYSTEM READY';}});
viewer.imageryLayers.layerAdded.addEventListener(()=>{});
viewer.scene.camera.moveEnd.addEventListener(()=>{ $('detail').style.display='none'; });
loadQuakes();refreshTimer=setInterval(loadQuakes,5*60*1000);
window.addEventListener('pagehide',()=>{clearInterval(refreshTimer);if(orbitListener)viewer.clock.onTick.removeEventListener(orbitListener);},{once:true});
})();
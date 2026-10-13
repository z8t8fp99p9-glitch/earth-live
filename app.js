(() => {
'use strict';
const $=id=>document.getElementById(id),errorEl=$('errorMessage'),basicBtn=$('basicBtn'),hdBtn=$('hdBtn'),app=$('app');
const IMAGERY='https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const HILLSHADE='https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}';
let viewer,imageryLayer,hillshadeLayer=null,quality='basic',resizeFrame=0;
function provider(url,max,credit){return new Cesium.UrlTemplateImageryProvider({url,minimumLevel:0,maximumLevel:max,credit:new Cesium.Credit(credit)});}
function imagery(mode){return provider(IMAGERY,mode==='basic'?3:19,'Imagery © Esri and contributors');}
function hillshade(){return provider(HILLSHADE,13,'World Hillshade © Esri, USGS, NGA, NASA, CGIAR, and GIS contributors');}
function updateButtons(){basicBtn.classList.toggle('active',quality==='basic');hdBtn.classList.toggle('active',quality==='hd');basicBtn.setAttribute('aria-pressed',String(quality==='basic'));hdBtn.setAttribute('aria-pressed',String(quality==='hd'));}
function setQuality(mode){
 if(!viewer||mode===quality)return;
 const cam=viewer.camera,saved={position:cam.position.clone(),direction:cam.direction.clone(),up:cam.up.clone()};
 try{
  const next=viewer.imageryLayers.addImageryProvider(imagery(mode)),old=imageryLayer;imageryLayer=next;if(old)viewer.imageryLayers.remove(old,true);
  if(mode==='hd'&&!hillshadeLayer){hillshadeLayer=viewer.imageryLayers.addImageryProvider(hillshade());hillshadeLayer.alpha=.26;}
  if(mode==='basic'&&hillshadeLayer){viewer.imageryLayers.remove(hillshadeLayer,true);hillshadeLayer=null;}
  quality=mode;updateButtons();viewer.camera.setView({destination:saved.position,orientation:{direction:saved.direction,up:saved.up}});viewer.scene.requestRender();
 }catch(e){console.error('Map mode change failed',e);}
}
function syncViewport(){
 if(resizeFrame)cancelAnimationFrame(resizeFrame);
 resizeFrame=requestAnimationFrame(()=>{
  resizeFrame=0;
  const vv=window.visualViewport;
  const visualHeight=vv&&Number.isFinite(vv.height)?vv.height:0;
  const innerHeight=window.innerHeight||0;
  const screenHeight=(window.screen&&window.screen.height)||0;
  const standalone=(window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches)||window.navigator.standalone===true;
  const landscape=(window.innerWidth||0)>(window.innerHeight||0);
  let target;
  if(standalone){
   // In standalone portrait, screen.height is the physical long edge on iOS.
   // In landscape, screen.height can remain the portrait value; use live viewport height.
   target=landscape?Math.max(visualHeight,innerHeight):screenHeight;
  }else{
   // Safari must fit the actual webpage area, not the physical screen behind browser chrome.
   target=Math.max(visualHeight,innerHeight);
  }
  if(!Number.isFinite(target)||target<100)target=innerHeight||screenHeight||100;
  app.style.setProperty('--earth-live-height',`${Math.ceil(target)}px`);
  if(viewer){viewer.resize();viewer.scene.requestRender();}
 });
}
function init(){
 if(!window.Cesium){errorEl.hidden=false;return;}
 try{
  viewer=new Cesium.Viewer('globe',{imageryProvider:false,terrainProvider:new Cesium.EllipsoidTerrainProvider(),animation:false,timeline:false,baseLayerPicker:false,geocoder:false,homeButton:false,sceneModePicker:false,navigationHelpButton:false,fullscreenButton:false,infoBox:false,selectionIndicator:false,shouldAnimate:false,requestRenderMode:true,maximumRenderTimeChange:Infinity,scene3DOnly:true,contextOptions:{webgl:{alpha:false,antialias:true,powerPreference:'high-performance'}}});
  viewer.imageryLayers.removeAll(false);imageryLayer=viewer.imageryLayers.addImageryProvider(imagery('basic'));
  viewer.scene.backgroundColor=Cesium.Color.fromCssColorString('#030509');viewer.scene.globe.baseColor=Cesium.Color.fromCssColorString('#101820');
  viewer.scene.globe.enableLighting=true;viewer.scene.globe.dynamicAtmosphereLighting=true;viewer.scene.globe.dynamicAtmosphereLightingFromSun=true;viewer.scene.globe.showGroundAtmosphere=true;viewer.scene.skyAtmosphere.show=true;viewer.scene.fog.enabled=true;viewer.scene.globe.depthTestAgainstTerrain=false;
  viewer.scene.screenSpaceCameraController.enableInputs=true;viewer.scene.screenSpaceCameraController.minimumZoomDistance=1;viewer.scene.screenSpaceCameraController.maximumZoomDistance=10000000000;viewer.scene.screenSpaceCameraController.zoomFactor=8;viewer.scene.screenSpaceCameraController.maximumMovementRatio=0.15;
  viewer.camera.setView({destination:Cesium.Cartesian3.fromDegrees(12,18,24500000),orientation:{heading:0,pitch:Cesium.Math.toRadians(-90),roll:0}});
  updateButtons();syncViewport();
  if(window.visualViewport){
   window.visualViewport.addEventListener('resize',syncViewport,{passive:true});
   window.visualViewport.addEventListener('scroll',syncViewport,{passive:true});
  }
  window.addEventListener('resize',syncViewport,{passive:true});
  window.addEventListener('orientationchange',()=>setTimeout(syncViewport,150),{passive:true});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){syncViewport();setTimeout(syncViewport,200);}}, {passive:true});
  window.addEventListener('pageshow',()=>{syncViewport();setTimeout(syncViewport,200);},{passive:true});
  if('ResizeObserver' in window){
   const observer=new ResizeObserver(()=>{if(viewer){viewer.resize();viewer.scene.requestRender();}});
   observer.observe(app);
  }
 }catch(e){console.error(e);errorEl.hidden=false;}
}
basicBtn.addEventListener('click',()=>setQuality('basic'));hdBtn.addEventListener('click',()=>setQuality('hd'));
['locateBtn','lightingBtn','layersBtn'].forEach(id=>$(id).setAttribute('aria-disabled','true'));
init();
})();
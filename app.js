(() => {
'use strict';
const $=id=>document.getElementById(id),errorEl=$('errorMessage'),basicBtn=$('basicBtn'),hdBtn=$('hdBtn');
const IMAGERY='https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const HILLSHADE='https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}';
let viewer,imageryLayer,hillshadeLayer=null,quality='basic';
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
function init(){
 if(!window.Cesium){errorEl.hidden=false;return;}
 try{
  viewer=new Cesium.Viewer('globe',{imageryProvider:false,terrainProvider:new Cesium.EllipsoidTerrainProvider(),animation:false,timeline:false,baseLayerPicker:false,geocoder:false,homeButton:false,sceneModePicker:false,navigationHelpButton:false,fullscreenButton:false,infoBox:false,selectionIndicator:false,shouldAnimate:false,requestRenderMode:true,maximumRenderTimeChange:Infinity,scene3DOnly:true,contextOptions:{webgl:{alpha:false,antialias:true,powerPreference:'high-performance'}}});
  viewer.imageryLayers.removeAll(false);imageryLayer=viewer.imageryLayers.addImageryProvider(imagery('basic'));
  viewer.scene.backgroundColor=Cesium.Color.fromCssColorString('#030509');viewer.scene.globe.baseColor=Cesium.Color.fromCssColorString('#101820');
  viewer.scene.globe.enableLighting=true;viewer.scene.globe.dynamicAtmosphereLighting=true;viewer.scene.globe.dynamicAtmosphereLightingFromSun=true;viewer.scene.globe.showGroundAtmosphere=true;viewer.scene.skyAtmosphere.show=true;viewer.scene.fog.enabled=true;viewer.scene.globe.depthTestAgainstTerrain=false;
  /* Native Cesium gestures only; no custom touch handler or Live Location camera flight. */
  viewer.scene.screenSpaceCameraController.enableInputs=true;viewer.scene.screenSpaceCameraController.minimumZoomDistance=1;viewer.scene.screenSpaceCameraController.maximumZoomDistance=10000000000;viewer.scene.screenSpaceCameraController.zoomFactor=8;viewer.scene.screenSpaceCameraController.maximumMovementRatio=0.15;
  viewer.camera.setView({destination:Cesium.Cartesian3.fromDegrees(12,18,24500000),orientation:{heading:0,pitch:Cesium.Math.toRadians(-90),roll:0}});
  updateButtons();
 }catch(e){console.error(e);errorEl.hidden=false;}
}
basicBtn.addEventListener('click',()=>setQuality('basic'));hdBtn.addEventListener('click',()=>setQuality('hd'));
['locateBtn','lightingBtn','layersBtn'].forEach(id=>$(id).setAttribute('aria-disabled','true'));
init();
})();
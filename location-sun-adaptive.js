/* EARTH // LIVE — shared, device-only location source + adaptive Sun Sky View.
   Coordinates remain in memory; no database, analytics, or location history is written. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const locationButton = document.querySelector('[data-orb="location"]');
  const sunButton = document.querySelector('[data-orb="sun"]');
  const view = $('sunAdaptiveView');
  const range = $('sunAdaptiveRange');
  if (!locationButton || !sunButton || !view || !range) return;

  const HORIZON = -0.833, DEG = Math.PI / 180, RAD = 180 / Math.PI;
  let latestFix = null, watchId = null, locationTimer = null, locationEntity = null;
  let locationActive = false, sunActive = false, sunWindow = null;
  const viewer = () => window.EarthLiveViewer && !window.EarthLiveViewer.isDestroyed() ? window.EarthLiveViewer : null;
  const status = text => { $('sunAdaptiveStatus').textContent = text; };
  const validFix = p => p && Number.isFinite(p.latitude) && Math.abs(p.latitude) <= 90 && Number.isFinite(p.longitude) && Math.abs(p.longitude) <= 180;

  function requestFix({fresh = true} = {}) {
    if (!fresh && validFix(latestFix)) return Promise.resolve(latestFix);
    if (!navigator.geolocation) return Promise.reject(new Error('Location is unavailable in this browser.'));
    if (window.isSecureContext === false) return Promise.reject(new Error('Location requires a secure connection (HTTPS).'));
    return new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(position => {
      const c = position.coords;
      const fix = { latitude:c.latitude, longitude:c.longitude, accuracy:c.accuracy, capturedAt:position.timestamp || Date.now() };
      if (!validFix(fix)) { reject(new Error('The device returned an invalid location.')); return; }
      latestFix = fix; resolve(fix);
    }, error => reject(new Error(error.code === 1 ? 'Allow location access to use this feature.' : error.code === 3 ? 'Location request timed out. Please try again.' : 'Your location is temporarily unavailable.')), {
      enableHighAccuracy:true, timeout:15000, maximumAge:fresh ? 0 : 30000
    }));
  }

  function removeMarker() {
    const v = viewer();
    if (v && locationEntity) v.entities.remove(locationEntity);
    locationEntity = null;
  }
  function placeMarker(loc, fly) {
    const v = viewer(); if (!v || !validFix(loc)) return;
    if (locationEntity) v.entities.remove(locationEntity);
    locationEntity = v.entities.add({
      name:'Your location', position:Cesium.Cartesian3.fromDegrees(loc.longitude,loc.latitude,0),
      point:{pixelSize:12,color:Cesium.Color.fromCssColorString('#ff4747'),outlineColor:Cesium.Color.WHITE,outlineWidth:2,disableDepthTestDistance:0},
      label:{text:'YOU ARE HERE',font:'600 12px system-ui',fillColor:Cesium.Color.WHITE,outlineColor:Cesium.Color.BLACK,outlineWidth:3,style:Cesium.LabelStyle.FILL_AND_OUTLINE,verticalOrigin:Cesium.VerticalOrigin.BOTTOM,pixelOffset:new Cesium.Cartesian2(0,-16),disableDepthTestDistance:0}
    });
    if (fly) v.camera.flyTo({destination:Cesium.Cartesian3.fromDegrees(loc.longitude,loc.latitude,Math.max(1400000,v.camera.positionCartographic.height)),duration:1.7});
    v.scene.requestRender();
  }
  function stopWatching() { if (watchId !== null && navigator.geolocation) navigator.geolocation.clearWatch(watchId); watchId=null; if(locationTimer) clearTimeout(locationTimer); locationTimer=null; }
  function beginWatching() {
    if (!navigator.geolocation || watchId !== null) return;
    watchId=navigator.geolocation.watchPosition(p=>{const c=p.coords,fix={latitude:c.latitude,longitude:c.longitude,accuracy:c.accuracy,capturedAt:p.timestamp||Date.now()};if(validFix(fix)){latestFix=fix;if(locationActive||sunActive)placeMarker(fix,false);if(sunActive)refreshSunForLocation(fix);}},()=>{}, {enableHighAccuracy:true,maximumAge:5000,timeout:15000});
  }
  function stopLocationIfUnused() { if (!sunActive) { locationActive=false; stopWatching(); locationButton.setAttribute('aria-pressed','false'); removeMarker(); } }
  function startLocation() {
    stopWatching(); locationActive=true; locationButton.setAttribute('aria-pressed','true');
    requestFix().then(loc => { placeMarker(loc,true); beginWatching(); }).catch(e=>{locationActive=false;locationButton.setAttribute('aria-pressed','false');status(e.message);});
    locationTimer=setTimeout(()=>{locationActive=false;locationButton.setAttribute('aria-pressed','false');if(!sunActive){stopWatching();removeMarker();}},20000);
  }

  function solarPosition(date,loc) {
    const n=date.getTime()/86400000+2440587.5-2451545, g=(357.529+0.98560028*n)*DEG, q=(280.459+0.98564736*n)*DEG;
    const L=q+(1.915*Math.sin(g)+0.020*Math.sin(2*g))*DEG, e=(23.439-0.00000036*n)*DEG;
    const ra=Math.atan2(Math.cos(e)*Math.sin(L),Math.cos(L))*RAD, dec=Math.asin(Math.sin(e)*Math.sin(L))*RAD;
    const jd=date.getTime()/86400000+2440587.5,T=(jd-2451545)/36525;
    const gmst=((280.46061837+360.98564736629*(jd-2451545)+0.000387933*T*T-T*T*T/38710000)%360+360)%360;
    const H=((gmst+loc.longitude-ra+540)%360-180)*DEG, lat=loc.latitude*DEG,d=dec*DEG;
    const altitude=Math.asin(Math.max(-1,Math.min(1,Math.sin(lat)*Math.sin(d)+Math.cos(lat)*Math.cos(d)*Math.cos(H))))*RAD;
    const azimuth=(Math.atan2(Math.sin(H),Math.cos(H)*Math.sin(lat)-Math.tan(d)*Math.cos(lat))*RAD+180+360)%360;
    return {altitude,azimuth};
  }
  function findSunWindow(loc) {
    const now=new Date(), start=new Date(now);start.setHours(0,0,0,0);const end=new Date(start.getTime()+86400000);
    let prevT=start.getTime(),prevA=solarPosition(new Date(prevT),loc).altitude,rise=null,set=null;
    for(let t=prevT+60000;t<=end.getTime();t+=60000){const a=solarPosition(new Date(t),loc).altitude;if(prevA<HORIZON&&a>=HORIZON&&!rise)rise=refineCrossing(prevT,t,loc,true);if(prevA>=HORIZON&&a<HORIZON&&!set)set=refineCrossing(prevT,t,loc,false);prevT=t;prevA=a;}
    if(!rise||!set||set<=rise){const noon=new Date(start);noon.setHours(12,0,0,0);if(solarPosition(noon,loc).altitude>HORIZON)return {start,end,alwaysUp:true};return null;}
    return {start:rise,end:set,alwaysUp:false};
  }
  function refineCrossing(lo,hi,loc,rising){while(hi-lo>1000){const mid=Math.floor((lo+hi)/2),above=solarPosition(new Date(mid),loc).altitude>=HORIZON;if(above===rising)hi=mid;else lo=mid;}return new Date(Math.round((lo+hi)/2));}
  const fmt = d => d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',hour12:false});
  function updateSunFromRange() {
    if(!sunActive||!sunWindow||!latestFix)return;
    const date=new Date(sunWindow.start.getTime()+Number(range.value)*60000),p=solarPosition(date,latestFix);
    const x=6+88*Math.max(0,Math.min(1,(p.azimuth-90)/180)),y=10+Math.max(0,Math.min(75,p.altitude))*0.78;
    $('sunAdaptiveOrb').style.left=x+'%';$('sunAdaptiveOrb').style.bottom=y+'%';$('sunAdaptiveOrb').style.opacity=p.altitude>=HORIZON?'1':'.32';
    $('sunAdaptiveReadout').textContent=fmt(date);status(`${p.altitude>=HORIZON?'SUN ABOVE HORIZON':'SUN BELOW HORIZON'} · ${Math.round(p.azimuth)}° ${['N','NE','E','SE','S','SW','W','NW'][Math.round(p.azimuth/45)%8]}`);
    const v=viewer();if(v){v.clock.currentTime=Cesium.JulianDate.fromDate(date);v.clock.shouldAnimate=false;v.scene.requestRender();}
  }
  function refreshSunForLocation(loc) { if(!sunActive)return;latestFix=loc;const oldValue=Number(range.value);sunWindow=findSunWindow(loc);if(!sunWindow){status('Could not calculate today’s daylight window for this location.');return;}configureSun(oldValue); }
  function configureSun(preferredOffset=0) {
    const duration=Math.max(1,Math.round((sunWindow.end-sunWindow.start)/60000));range.min='0';range.max=String(duration);range.step='1';
    $('sunAdaptiveRise').textContent=sunWindow.alwaysUp?'Local day':`Rise ${fmt(sunWindow.start)}`;$('sunAdaptiveSet').textContent=sunWindow.alwaysUp?'Sun above horizon':`Set ${fmt(sunWindow.end)}`;
    range.value=String(Math.max(0,Math.min(duration,preferredOffset||Math.round((Date.now()-sunWindow.start.getTime())/60000))));updateSunFromRange();
  }
  async function openSun() {
    if(sunActive){closeSun();return;}sunActive=true;sunButton.setAttribute('aria-pressed','true');sunButton.classList.add('active');view.hidden=false;status('Getting your location…');
    try{const loc=await requestFix({fresh:true});placeMarker(loc,false);beginWatching();sunWindow=findSunWindow(loc);if(!sunWindow)throw new Error('Could not calculate today’s daylight window for this location.');configureSun(Math.round((Date.now()-sunWindow.start.getTime())/60000));}
    catch(e){status(e.message);sunActive=false;sunButton.setAttribute('aria-pressed','false');sunButton.classList.remove('active');view.hidden=true;}
  }
  function closeSun(){sunActive=false;view.hidden=true;sunButton.setAttribute('aria-pressed','false');sunButton.classList.remove('active');if(!locationActive){stopWatching();removeMarker();}}
  locationButton.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();startLocation();},true);
  sunButton.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();openSun();},true);
  $('closeSunAdaptive').addEventListener('click',closeSun);
  range.addEventListener('input',updateSunFromRange);
  window.addEventListener('resize',()=>{if(sunActive)document.documentElement.style.setProperty('--sun-view-vh',`${window.visualViewport?.height||window.innerHeight}px`);},{passive:true});
  window.EarthLiveLocation=Object.freeze({getCurrentLocation:opts=>requestFix({fresh:!!(opts&&opts.refresh)}),placeLocation:placeMarker,holdForMoon:held=>{if(held){locationActive=true;locationButton.setAttribute('aria-pressed','true');}else if(!sunActive)stopLocationIfUnused();},showStatus:status,getLatestLocation:()=>latestFix?{...latestFix}:null});
  window.EarthLiveSunView=Object.freeze({isActive:()=>sunActive,close:closeSun,getLocation:()=>latestFix?{...latestFix}:null});
})();

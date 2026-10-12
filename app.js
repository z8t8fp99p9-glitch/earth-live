(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const statusEl = $('status');
  const errorEl = $('errorMessage');
  const basicBtn = $('basicBtn');
  const hdBtn = $('hdBtn');
  const lightingBtn = $('lightingBtn');
  const layersBtn = $('layersBtn');
  const layersPanel = $('layersPanel');
  const quakeToggle = $('quakeToggle');
  const quakeCount = $('quakeCount');
  const hint = $('gestureHint');
  const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
  let viewer, imageryLayer, quality = 'basic', lighting = 'day', quakeTimer = null, quakeEntities = [], hintTimer = null;
  const quakeSource = new Map();

  function setStatus(message) { statusEl.textContent = message || ''; }
  function updateQualityButtons() {
    basicBtn.classList.toggle('active', quality === 'basic');
    hdBtn.classList.toggle('active', quality === 'hd');
    basicBtn.setAttribute('aria-pressed', String(quality === 'basic'));
    hdBtn.setAttribute('aria-pressed', String(quality === 'hd'));
  }
  function imageryProvider(mode) {
    return new Cesium.UrlTemplateImageryProvider({
      url: ESRI,
      maximumLevel: mode === 'basic' ? 5 : 19,
      credit: new Cesium.Credit('Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community')
    });
  }
  async function setQuality(mode) {
    if (!viewer || mode === quality) return;
    const camera = viewer.camera;
    const saved = { position: camera.position.clone(), direction: camera.direction.clone(), up: camera.up.clone() };
    quality = mode;
    updateQualityButtons();
    setStatus(mode === 'basic' ? 'BASIC MAP' : 'HD IMAGERY');
    try {
      const provider = imageryProvider(mode);
      if (imageryLayer) viewer.imageryLayers.remove(imageryLayer, false);
      imageryLayer = viewer.imageryLayers.addImageryProvider(provider);
      imageryLayer.alpha = 1;
      viewer.camera.setView({ destination: saved.position, orientation: { direction: saved.direction, up: saved.up } });
      viewer.scene.requestRender();
    } catch (e) {
      setStatus('Map mode unavailable');
    }
    window.setTimeout(() => setStatus(''), 1800);
  }
  function setLighting() {
    lighting = lighting === 'day' ? 'night' : 'day';
    viewer.scene.globe.enableLighting = lighting === 'night';
    viewer.scene.globe.showGroundAtmosphere = true;
    viewer.scene.skyAtmosphere.show = true;
    $('lightingIcon').textContent = lighting === 'day' ? '☼' : '☾';
    lightingBtn.setAttribute('aria-label', lighting === 'day' ? 'Switch to night lighting' : 'Switch to day lighting');
    lightingBtn.style.background = lighting === 'night' ? 'rgba(103,157,220,.23)' : '';
    setStatus(lighting === 'night' ? 'SOLAR NIGHT SHADING' : 'DAY VIEW');
    window.setTimeout(() => setStatus(''), 1600);
  }
  function pulseEntity(feature) {
    const p = feature.properties || {};
    const coords = feature.geometry && feature.geometry.coordinates;
    if (!coords || coords.length < 2) return null;
    const lon = Number(coords[0]), lat = Number(coords[1]), depthKm = Math.max(0, Number(coords[2] || 0));
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
    const mag = Number(p.mag || 0);
    const id = String(feature.id || `${lon}:${lat}:${p.time || ''}`);
    const now = Date.now();
    const position = Cesium.Cartesian3.fromDegrees(lon, lat, 1500);
    const entity = viewer.entities.add({
      id: 'quake-' + id,
      position,
      point: { pixelSize: Math.max(5, Math.min(12, 4 + mag * 1.15)), color: Cesium.Color.fromCssColorString('#ff716b'), outlineColor: Cesium.Color.WHITE.withAlpha(.9), outlineWidth: 1.2, heightReference: Cesium.HeightReference.NONE },
      ellipse: {
        semiMajorAxis: new Cesium.CallbackProperty(() => {
          const t = ((Date.now() - now) % 2400) / 2400;
          return 18000 + t * (Math.max(1, mag) * 90000);
        }, false),
        semiMinorAxis: new Cesium.CallbackProperty(() => {
          const t = ((Date.now() - now) % 2400) / 2400;
          return 18000 + t * (Math.max(1, mag) * 90000);
        }, false),
        height: 1600,
        material: new Cesium.ColorMaterialProperty(new Cesium.CallbackProperty(() => {
          const t = ((Date.now() - now) % 2400) / 2400;
          return Cesium.Color.fromCssColorString('#ff655f').withAlpha(.20 * (1 - t));
        }, false)),
        outline: true,
        outlineColor: new Cesium.CallbackProperty(() => {
          const t = ((Date.now() - now) % 2400) / 2400;
          return Cesium.Color.fromCssColorString('#ff8179').withAlpha(.78 * (1 - t));
        }, false),
        outlineWidth: 2,
        heightReference: Cesium.HeightReference.NONE
      },
      label: { text: `M${mag.toFixed(1)}`, font: '11px sans-serif', fillColor: Cesium.Color.WHITE, outlineColor: Cesium.Color.BLACK.withAlpha(.8), outlineWidth: 2, style: Cesium.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new Cesium.Cartesian2(0, -18), scaleByDistance: new Cesium.NearFarScalar(2e5, 1, 1.5e7, .45), show: mag >= 4.5 }
    });
    entity.description = `${p.title || 'Earthquake'}<br>Magnitude: ${mag.toFixed(1)}<br>Depth: ${depthKm.toFixed(1)} km`;
    return entity;
  }
  async function loadQuakes() {
    if (!viewer || !quakeToggle.checked) return;
    quakeCount.hidden = false; quakeCount.textContent = 'Loading USGS feed…';
    try {
      const response = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson', { cache: 'no-store' });
      if (!response.ok) throw new Error('USGS response ' + response.status);
      const data = await response.json();
      const features = (data.features || []).filter(f => f.geometry && f.geometry.coordinates);
      const currentIds = new Set(features.map(f => String(f.id)));
      for (const [id, entity] of quakeSource.entries()) if (!currentIds.has(id)) { viewer.entities.remove(entity); quakeSource.delete(id); }
      for (const feature of features) {
        const id = String(feature.id);
        if (!quakeSource.has(id)) {
          const entity = pulseEntity(feature);
          if (entity) quakeSource.set(id, entity);
        }
      }
      quakeCount.textContent = `${features.length.toLocaleString()} earthquakes · last 7 days`;
      setStatus('EARTHQUAKES LIVE');
      window.setTimeout(() => setStatus(''), 1500);
    } catch (err) {
      quakeCount.textContent = 'Could not reach USGS. Tap off/on to retry.';
    }
  }
  function clearQuakes() {
    if (quakeTimer) { clearInterval(quakeTimer); quakeTimer = null; }
    for (const entity of quakeSource.values()) viewer.entities.remove(entity);
    quakeSource.clear(); quakeEntities = [];
    quakeCount.hidden = true;
  }
  function toggleQuakes() {
    if (quakeToggle.checked) {
      loadQuakes();
      if (quakeTimer) clearInterval(quakeTimer);
      quakeTimer = setInterval(loadQuakes, 5 * 60 * 1000);
    } else clearQuakes();
  }
  function installTouchGestures() {
    const canvas = viewer.canvas;
    canvas.style.touchAction = 'none';
    let gesture = null;
    const pt = t => ({ x: t.clientX, y: t.clientY });
    const metrics = touches => {
      const a = pt(touches[0]), b = pt(touches[1]);
      return { x: (a.x+b.x)/2, y: (a.y+b.y)/2, distance: Math.hypot(b.x-a.x,b.y-a.y), angle: Math.atan2(b.y-a.y,b.x-a.x) };
    };
    canvas.addEventListener('touchstart', e => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const m = metrics(e.touches);
        gesture = { ...m };
        viewer.scene.screenSpaceCameraController.enableInputs = false;
      } else if (e.touches.length > 2) { e.preventDefault(); gesture = null; }
    }, { passive: false });
    canvas.addEventListener('touchmove', e => {
      if (e.touches.length !== 2 || !gesture) return;
      e.preventDefault();
      const m = metrics(e.touches);
      const dy = m.y - gesture.y;
      const dx = m.x - gesture.x;
      const dd = m.distance - gesture.distance;
      let da = m.angle - gesture.angle;
      while (da > Math.PI) da -= 2*Math.PI;
      while (da < -Math.PI) da += 2*Math.PI;
      try {
        if (Math.abs(dy) > .1) viewer.camera.rotateUp(Cesium.Math.clamp(-dy * .0045, -.09, .09));
        if (Math.abs(dx) > .1) viewer.camera.rotateRight(Cesium.Math.clamp(-dx * .0035, -.08, .08));
        if (Math.abs(dd) > .1) {
          const amount = Math.max(2000, Math.min(250000, Math.abs(dd) * viewer.camera.positionCartographic.height * .004));
          if (dd > 0) viewer.camera.zoomOut(amount); else viewer.camera.zoomIn(amount);
        }
        if (Math.abs(da) > .003) viewer.camera.twistRight(-da * .7);
        viewer.scene.requestRender();
      } catch (_) { /* Keep the gesture responsive if the camera reaches a limit. */ }
      gesture = m;
    }, { passive: false });
    const end = e => {
      if (e.touches.length < 2 && gesture) {
        gesture = null;
        viewer.scene.screenSpaceCameraController.enableInputs = true;
      }
    };
    canvas.addEventListener('touchend', end, { passive: true });
    canvas.addEventListener('touchcancel', end, { passive: true });
  }
  function init() {
    if (!window.Cesium) { errorEl.hidden = false; setStatus(''); return; }
    try {
      viewer = new Cesium.Viewer('globe', {
        imageryProvider: false,
        terrainProvider: new Cesium.EllipsoidTerrainProvider(),
        animation: false, timeline: false, baseLayerPicker: false, geocoder: false,
        homeButton: false, sceneModePicker: false, navigationHelpButton: false,
        fullscreenButton: false, infoBox: true, selectionIndicator: false,
        shouldAnimate: true, requestRenderMode: false,
        scene3DOnly: true, contextOptions: { webgl: { alpha: false, antialias: true, powerPreference: 'high-performance' } }
      });
      viewer.imageryLayers.removeAll(false);
      imageryLayer = viewer.imageryLayers.addImageryProvider(imageryProvider('basic'));
      viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#030509');
      viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#101820');
      viewer.scene.globe.enableLighting = false;
      viewer.scene.globe.showGroundAtmosphere = true;
      viewer.scene.skyAtmosphere.show = true;
      viewer.scene.fog.enabled = true;
      viewer.scene.screenSpaceCameraController.enableTilt = true;
      viewer.scene.screenSpaceCameraController.enableLook = true;
      viewer.scene.screenSpaceCameraController.minimumZoomDistance = 650000;
      viewer.scene.screenSpaceCameraController.maximumZoomDistance = 35000000;
      viewer.camera.setView({ destination: Cesium.Cartesian3.fromDegrees(12, 18, 24500000), orientation: { heading: 0, pitch: Cesium.Math.toRadians(-90), roll: 0 } });
      viewer.camera.percentageChanged = .01;
      viewer.scene.globe.depthTestAgainstTerrain = false;
      installTouchGestures();
      setStatus('EARTH ONLINE');
      window.setTimeout(() => setStatus(''), 2200);
      hintTimer = setTimeout(() => hint.classList.add('hide'), 8000);
    } catch (err) {
      console.error(err); errorEl.hidden = false; setStatus('');
    }
  }
  basicBtn.addEventListener('click', () => setQuality('basic'));
  hdBtn.addEventListener('click', () => setQuality('hd'));
  lightingBtn.addEventListener('click', setLighting);
  layersBtn.addEventListener('click', () => { layersPanel.hidden = !layersPanel.hidden; layersBtn.setAttribute('aria-expanded', String(!layersPanel.hidden)); });
  $('closeLayers').addEventListener('click', () => { layersPanel.hidden = true; layersBtn.setAttribute('aria-expanded', 'false'); });
  quakeToggle.addEventListener('change', toggleQuakes);
  document.addEventListener('visibilitychange', () => { if (document.hidden && quakeTimer) clearInterval(quakeTimer); else if (!document.hidden && quakeToggle.checked) { loadQuakes(); quakeTimer = setInterval(loadQuakes, 5 * 60 * 1000); } });
  init();
})();

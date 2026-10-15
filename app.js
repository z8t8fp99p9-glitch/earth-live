(() => {
  "use strict";
  const errorMessage = document.getElementById("errorMessage");
  const nasaPane = document.getElementById("nasaPane");
  const esriPane = document.getElementById("esriPane");
  const nasaElement = document.getElementById("nasaGlobe");
  const esriElement = document.getElementById("esriGlobe");
  const tabs = [...document.querySelectorAll(".mapTab")];
  let viewers = {};
  let resizeFrame = 0;
  let activeProfile = "portrait";
  let syncingCamera = false;
  const nasaTextureUrl = "https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-topography/january/world.topo.200401.3x5400x2700.jpg";
  const esriImageryUrl = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
  const profiles = {
    portrait: { initialHeight: 18500000, zoomFactor: 8, movementRatio: 0.075 },
    compact: { initialHeight: 21000000, zoomFactor: 6.5, movementRatio: 0.085 },
    landscape: { initialHeight: 24500000, zoomFactor: 5, movementRatio: 0.1 },
    ultrawide: { initialHeight: 28000000, zoomFactor: 5, movementRatio: 0.1 }
  };

  function showError(error) {
    console.error("EARTH // LIVE Map Lab failed to start:", error);
    errorMessage.hidden = false;
  }
  function detectDisplayProfile(element) {
    const width = Math.max(1, element.clientWidth || window.innerWidth || 1);
    const height = Math.max(1, element.clientHeight || window.innerHeight || 1);
    const ratio = width / height;
    if (ratio < 0.82) return "portrait";
    if (ratio < 1.12) return "compact";
    if (ratio > 2.15) return "ultrawide";
    return "landscape";
  }
  function applySettings(viewer, element, initial = false) {
    if (!viewer || viewer.isDestroyed()) return;
    const profile = detectDisplayProfile(element);
    activeProfile = profile;
    const settings = profiles[profile];
    const controller = viewer.scene.screenSpaceCameraController;
    controller.zoomFactor = settings.zoomFactor;
    controller.maximumMovementRatio = settings.movementRatio;
    // Test unlock: allow zoom to within 1 km of the ellipsoid surface.
    // We intentionally retain a minimum distance to avoid accidental camera clipping.
    controller.minimumZoomDistance = 1000;
    controller.maximumZoomDistance = 40000000;
    if (initial) {
      viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(12, 18, settings.initialHeight),
        orientation: { heading: 0, pitch: Cesium.Math.toRadians(-90), roll: 0 }
      });
    }
    viewer.scene.requestRender();
  }
  function makeViewer(element, imagery) {
    const viewer = new Cesium.Viewer(element, {
      imageryProvider: false,
      terrainProvider: new Cesium.EllipsoidTerrainProvider(),
      animation: false, timeline: false, baseLayerPicker: false,
      geocoder: false, homeButton: false, sceneModePicker: false,
      navigationHelpButton: false, fullscreenButton: false, infoBox: false,
      selectionIndicator: false, shouldAnimate: false, scene3DOnly: true,
      requestRenderMode: true, maximumRenderTimeChange: Infinity,
      contextOptions: { webgl: { alpha: false, antialias: true, powerPreference: "high-performance" } }
    });
    viewer.imageryLayers.removeAll(false);
    if (imagery === "nasa") {
      const provider = new Cesium.SingleTileImageryProvider({
        url: nasaTextureUrl,
        credit: new Cesium.Credit("NASA Blue Marble: Next Generation — shaded topography")
      });
      viewer.imageryLayers.addImageryProvider(provider);
      provider.errorEvent.addEventListener(error => console.warn("NASA Blue Marble imagery failed to load.", error));
    } else {
      viewer.imageryLayers.addImageryProvider(new Cesium.UrlTemplateImageryProvider({
        url: esriImageryUrl,
        minimumLevel: 0,
        maximumLevel: 19,
        credit: new Cesium.Credit("Imagery © Esri and contributors")
      }));
    }
    viewer.scene.backgroundColor = Cesium.Color.fromCssColorString("#030509");
    viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString("#101820");
    viewer.scene.globe.enableLighting = false;
    viewer.scene.globe.dynamicAtmosphereLighting = false;
    viewer.scene.globe.showGroundAtmosphere = true;
    viewer.scene.skyAtmosphere.show = true;
    viewer.scene.fog.enabled = true;
    viewer.scene.globe.depthTestAgainstTerrain = false;
    const controller = viewer.scene.screenSpaceCameraController;
    controller.enableInputs = true;
    controller.enableRotate = true;
    controller.enableTilt = true;
    controller.enableTranslate = true;
    controller.enableZoom = true;
    controller.enableLook = true;
    applySettings(viewer, element, true);
    return viewer;
  }
  function syncCamera(sourceName) {
    if (syncingCamera) return;
    const source = viewers[sourceName];
    const targetName = sourceName === "nasa" ? "esri" : "nasa";
    const target = viewers[targetName];
    if (!source || !target || source.isDestroyed() || target.isDestroyed()) return;
    syncingCamera = true;
    try {
      target.camera.setView({
        destination: source.camera.positionWC,
        orientation: { direction: source.camera.directionWC, up: source.camera.upWC }
      });
      target.scene.requestRender();
    } catch (error) {
      console.warn("Map camera sync skipped:", error);
    } finally {
      syncingCamera = false;
    }
  }
  function chooseMap(name) {
    const showBoth = window.matchMedia("(min-width: 760px) and (orientation: landscape)").matches;
    nasaPane.classList.toggle("mobile-active", name === "nasa");
    esriPane.classList.toggle("mobile-active", name === "esri");
    tabs.forEach(tab => {
      const active = tab.dataset.map === name;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-pressed", String(active));
    });
    if (showBoth) {
      nasaPane.classList.remove("mobile-active");
      esriPane.classList.remove("mobile-active");
    }
    requestAnimationFrame(() => Object.values(viewers).forEach(viewer => {
      if (viewer && !viewer.isDestroyed()) { viewer.resize(); viewer.scene.requestRender(); }
    }));
  }
  function resizeGlobe() {
    if (resizeFrame) cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = 0;
      Object.entries(viewers).forEach(([name, viewer]) => {
        if (!viewer || viewer.isDestroyed()) return;
        viewer.resize();
        const element = name === "nasa" ? nasaElement : esriElement;
        applySettings(viewer, element, false);
      });
    });
  }
  function start() {
    if (!window.Cesium) { showError(new Error("Cesium did not load.")); return; }
    try {
      viewers.nasa = makeViewer(nasaElement, "nasa");
      viewers.esri = makeViewer(esriElement, "esri");
      // Keep the camera views aligned when the user finishes a pan, rotate, or zoom.
      viewers.nasa.camera.moveEnd.addEventListener(() => syncCamera("nasa"));
      viewers.esri.camera.moveEnd.addEventListener(() => syncCamera("esri"));
      window.EarthLiveViewers = viewers;
      window.EarthLiveAdaptiveDisplay = { get profile() { return activeProfile; }, zoomMinimumMeters: 1000 };
      tabs.forEach(tab => tab.addEventListener("click", () => chooseMap(tab.dataset.map)));
      chooseMap("nasa");
      window.addEventListener("resize", resizeGlobe, { passive: true });
      window.addEventListener("orientationchange", () => setTimeout(resizeGlobe, 180), { passive: true });
      window.addEventListener("pageshow", resizeGlobe, { passive: true });
      document.addEventListener("visibilitychange", () => { if (!document.hidden) resizeGlobe(); }, { passive: true });
      if ("ResizeObserver" in window) {
        const observer = new ResizeObserver(resizeGlobe);
        observer.observe(document.getElementById("app"));
      }
      if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
        navigator.serviceWorker.register("./service-worker.js").catch(error => console.warn("Service worker was not registered:", error));
      }
    } catch (error) { showError(error); }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();

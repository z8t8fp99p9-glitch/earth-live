(() => {
  "use strict";

  const globeElement = document.getElementById("globe");
  const errorMessage = document.getElementById("errorMessage");
  let viewer = null;
  let resizeFrame = 0;
  let hasInitialFrame = false;
  let activeProfile = "portrait";
  let nasaLayer = null;
  let esriFallbackAdded = false;

  // NASA Blue Marble: Next Generation, global base map with shaded topography.
  // NASA publishes this 5400 x 2700 equirectangular JPEG for public use.
  const nasaTextureUrl =
    "https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-topography/january/world.topo.200401.3x5400x2700.jpg";
  const esriImageryUrl =
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

  const profiles = {
    portrait: { initialHeight: 18500000, zoomFactor: 8, movementRatio: 0.075 },
    compact:  { initialHeight: 21000000, zoomFactor: 6.5, movementRatio: 0.085 },
    landscape:{ initialHeight: 24500000, zoomFactor: 5, movementRatio: 0.1 },
    ultrawide:{ initialHeight: 28000000, zoomFactor: 5, movementRatio: 0.1 }
  };

  function showError(error) {
    console.error("EARTH // LIVE globe failed to start:", error);
    errorMessage.hidden = false;
  }

  function detectDisplayProfile() {
    const width = Math.max(1, globeElement.clientWidth || window.innerWidth || 1);
    const height = Math.max(1, globeElement.clientHeight || window.innerHeight || 1);
    const ratio = width / height;
    if (ratio < 0.82) return "portrait";
    if (ratio < 1.12) return "compact";
    if (ratio > 2.15) return "ultrawide";
    return "landscape";
  }

  function applyDisplayProfile({ initial = false } = {}) {
    if (!viewer || viewer.isDestroyed()) return;
    const nextProfile = detectDisplayProfile();
    activeProfile = nextProfile;
    const settings = profiles[nextProfile];
    const controller = viewer.scene.screenSpaceCameraController;

    // Adaptive touch/camera response. Preserve the user's existing zoom-out limit.
    controller.zoomFactor = settings.zoomFactor;
    controller.maximumMovementRatio = settings.movementRatio;
    controller.minimumZoomDistance = 700000;
    controller.maximumZoomDistance = 40000000;

    // Frame the initial globe for the display shape. Later rotations/resizes never
    // reset the user's camera position or undo their zoom.
    if (initial && !hasInitialFrame) {
      viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(12, 18, settings.initialHeight),
        orientation: {
          heading: 0,
          pitch: Cesium.Math.toRadians(-90),
          roll: 0
        }
      });
      hasInitialFrame = true;
    }
    document.documentElement.dataset.displayProfile = nextProfile;
  }

  function addEsriFallback(reason) {
    if (esriFallbackAdded || !viewer || viewer.isDestroyed()) return;
    esriFallbackAdded = true;
    console.warn("NASA imagery could not be loaded; switching to Esri World Imagery.", reason || "");
    try {
      if (nasaLayer) {
        viewer.imageryLayers.remove(nasaLayer, true);
        nasaLayer = null;
      }
      const provider = new Cesium.UrlTemplateImageryProvider({
        url: esriImageryUrl,
        minimumLevel: 0,
        maximumLevel: 8,
        credit: new Cesium.Credit("Imagery © Esri and contributors")
      });
      viewer.imageryLayers.addImageryProvider(provider);
      viewer.scene.requestRender();
    } catch (error) {
      console.error("Esri fallback failed:", error);
    }
  }

  function addNasaImagery() {
    const provider = new Cesium.SingleTileImageryProvider({
      url: nasaTextureUrl,
      credit: new Cesium.Credit("NASA Blue Marble: Next Generation — shaded topography")
    });
    nasaLayer = viewer.imageryLayers.addImageryProvider(provider);
    if (provider.errorEvent && typeof provider.errorEvent.addEventListener === "function") {
      let firstErrorHandled = false;
      provider.errorEvent.addEventListener(error => {
        if (!firstErrorHandled) {
          firstErrorHandled = true;
          addEsriFallback(error);
        }
      });
    }
    if (provider.readyPromise && typeof provider.readyPromise.catch === "function") {
      provider.readyPromise.catch(addEsriFallback);
    }
  }

  function resizeGlobe() {
    if (resizeFrame) cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = 0;
      if (viewer && !viewer.isDestroyed()) {
        viewer.resize();
        applyDisplayProfile();
        viewer.scene.requestRender();
      }
    });
  }

  function startGlobe() {
    if (!window.Cesium) {
      showError(new Error("Cesium did not load."));
      return;
    }

    try {
      viewer = new Cesium.Viewer(globeElement, {
        imageryProvider: false,
        terrainProvider: new Cesium.EllipsoidTerrainProvider(),
        animation: false,
        timeline: false,
        baseLayerPicker: false,
        geocoder: false,
        homeButton: false,
        sceneModePicker: false,
        navigationHelpButton: false,
        fullscreenButton: false,
        infoBox: false,
        selectionIndicator: false,
        shouldAnimate: false,
        scene3DOnly: true,
        requestRenderMode: true,
        maximumRenderTimeChange: Infinity,
        contextOptions: {
          webgl: { alpha: false, antialias: true, powerPreference: "high-performance" }
        }
      });

      viewer.imageryLayers.removeAll(false);
      addNasaImagery();

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
      controller.minimumZoomDistance = 700000;
      controller.maximumZoomDistance = 40000000;

      applyDisplayProfile({ initial: true });

      window.EarthLiveViewer = viewer;
      window.EarthLiveAdaptiveDisplay = {
        get profile() { return activeProfile; },
        get settings() { return { ...profiles[activeProfile] }; },
        get imagery() { return esriFallbackAdded ? "Esri World Imagery (fallback)" : "NASA Blue Marble shaded topography"; }
      };

      window.addEventListener("resize", resizeGlobe, { passive: true });
      window.addEventListener("orientationchange", () => setTimeout(resizeGlobe, 180), { passive: true });
      window.addEventListener("pageshow", resizeGlobe, { passive: true });
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) resizeGlobe();
      }, { passive: true });

      if ("ResizeObserver" in window) {
        const observer = new ResizeObserver(resizeGlobe);
        observer.observe(document.getElementById("app"));
      }

      resizeGlobe();

      if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
        navigator.serviceWorker.register("./service-worker.js").catch(error => {
          console.warn("Service worker was not registered:", error);
        });
      }
    } catch (error) {
      showError(error);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startGlobe, { once: true });
  } else {
    startGlobe();
  }
})();

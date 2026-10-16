(() => {
  "use strict";

  const globeElement = document.getElementById("globe");
  const errorMessage = document.getElementById("errorMessage");
  let viewer = null;
  let resizeFrame = 0;
  let hasInitialFrame = false;
  let activeProfile = "portrait";
  let esriLayer = null;
  let hasUserInteracted = false;
  let lastAppliedProfile = null;

  const esriImageryUrl =
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

  // Adaptive display targets: size is derived from the actual viewport and Cesium frustum.
  // Portrait targets 80% of viewport width; landscape targets 75% of usable height.
  const EARTH_RADIUS_METERS = 6378137;
  const profiles = {
    portrait: { sizeFraction: 0.80, sizeAxis: "width", topFraction: 0.025, zoomFactor: 8.63, movementRatio: 0.075 },
    compact:  { sizeFraction: 0.80, sizeAxis: "width", topFraction: 0.025, zoomFactor: 6.5, movementRatio: 0.085 },
    landscape:{ sizeFraction: 0.75, sizeAxis: "height", topFraction: 0.025, zoomFactor: 5, movementRatio: 0.1 },
    ultrawide:{ sizeFraction: 0.75, sizeAxis: "height", topFraction: 0.025, zoomFactor: 5, movementRatio: 0.1 }
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

  function applyLandscapeComposition(nextProfile) {
    const wantsLandscape = nextProfile === "landscape" || nextProfile === "ultrawide";
    if (!viewer || viewer.isDestroyed() || hasUserInteracted) return;

    if (wantsLandscape && !landscapeOffsetApplied) {
      const height = profiles[nextProfile].initialHeight;
      viewer.camera.moveUp(-height * LANDSCAPE_LIFT_RATIO);
      landscapeOffsetApplied = true;
    } else if (!wantsLandscape && landscapeOffsetApplied) {
      const height = profiles.portrait.initialHeight;
      viewer.camera.moveUp(height * LANDSCAPE_LIFT_RATIO);
      landscapeOffsetApplied = false;
    }
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

  function calculateCameraHeight(settings) {
    const width = Math.max(1, globeElement.clientWidth || window.innerWidth || 1);
    const height = Math.max(1, globeElement.clientHeight || window.innerHeight || 1);
    const frustum = viewer.camera.frustum;
    const verticalFov = Number.isFinite(frustum.fovy) ? frustum.fovy : Cesium.Math.toRadians(60);
    const aspect = width / height;
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * aspect);
    const targetFov = settings.sizeAxis === "width" ? horizontalFov : verticalFov;
    const halfAngle = Math.atan(settings.sizeFraction * Math.tan(targetFov / 2));
    const cameraDistance = EARTH_RADIUS_METERS / Math.sin(halfAngle);
    return Math.max(1000, cameraDistance - EARTH_RADIUS_METERS);
  }

  function applyDisplayProfile({ initial = false, forceLayout = false } = {}) {
    if (!viewer || viewer.isDestroyed()) return;
    const nextProfile = detectDisplayProfile();
    activeProfile = nextProfile;
    const settings = profiles[nextProfile];
    const controller = viewer.scene.screenSpaceCameraController;

    controller.minimumZoomDistance = 1000;
    controller.maximumZoomDistance = 40000000;
    controller.zoomFactor = settings.zoomFactor;
    controller.maximumMovementRatio = settings.movementRatio;

    // Reframe only before the user takes control, or on the first render. Never reset a manually moved globe.
    const mayReframe = initial || (!hasUserInteracted && (forceLayout || lastAppliedProfile !== nextProfile));
    if (mayReframe) {
      const cameraHeight = calculateCameraHeight(settings);
      viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(12, 18, cameraHeight),
        orientation: { heading: 0, pitch: Cesium.Math.toRadians(-90), roll: 0 }
      });

      // In landscape, place the globe's top edge near the top safe boundary.
      // Translate the camera downward in camera coordinates; keep canvas and gesture surface full-screen.
      if (settings.sizeAxis === "height") {
        const width = Math.max(1, globeElement.clientWidth || window.innerWidth || 1);
        const height = Math.max(1, globeElement.clientHeight || window.innerHeight || 1);
        const fovy = viewer.camera.frustum.fovy || Cesium.Math.toRadians(60);
        const targetCenterY = settings.topFraction + settings.sizeFraction / 2;
        const verticalShiftFraction = 0.5 - targetCenterY;
        const shiftAngle = Math.atan(verticalShiftFraction * 2 * Math.tan(fovy / 2));
        const cameraDistance = EARTH_RADIUS_METERS + cameraHeight;
        viewer.camera.moveDown(cameraDistance * Math.tan(shiftAngle));
      }
      lastAppliedProfile = nextProfile;
      hasInitialFrame = true;
    }
    document.documentElement.dataset.displayProfile = nextProfile;
  }

  function addEsriImagery() {
    const provider = new Cesium.UrlTemplateImageryProvider({
      url: esriImageryUrl,
      minimumLevel: 0,
      maximumLevel: 19,
      credit: new Cesium.Credit("Imagery © Esri", true)
    });
    esriLayer = viewer.imageryLayers.addImageryProvider(provider);
    if (provider.errorEvent && typeof provider.errorEvent.addEventListener === "function") {
      provider.errorEvent.addEventListener(error => {
        console.warn("Esri World Imagery tile request failed:", error);
      });
    }
  }

  function resizeGlobe() {
    if (resizeFrame) cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = 0;
      if (viewer && !viewer.isDestroyed()) {
        viewer.resize();
        applyDisplayProfile({ forceLayout: true });
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
      addEsriImagery();

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

      // If the user has started moving/zooming the globe, never override their camera position on rotation.
      ["pointerdown", "touchstart", "wheel"].forEach(eventName => {
        globeElement.addEventListener(eventName, () => { hasUserInteracted = true; }, { passive: true });
      });

      applyDisplayProfile({ initial: true });

      window.EarthLiveViewer = viewer;
      window.EarthLiveAdaptiveDisplay = {
        get profile() { return activeProfile; },
        get settings() { return { ...profiles[activeProfile] }; },
        get imagery() { return "Esri World Imagery"; },
        zoomMinimumMeters: 1000,
        targets: { portraitWidth: 0.80, landscapeHeight: 0.75, landscapeTopInset: 0.025 }
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

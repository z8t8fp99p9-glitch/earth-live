(() => {
  "use strict";

  const globeElement = document.getElementById("globe");
  const errorMessage = document.getElementById("errorMessage");
  let viewer = null;
  let resizeFrame = 0;

  const imageryUrl =
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

  function showError(error) {
    console.error("EARTH // LIVE globe failed to start:", error);
    errorMessage.hidden = false;
  }

  function resizeGlobe() {
    if (resizeFrame) cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = 0;
      if (viewer && !viewer.isDestroyed()) {
        viewer.resize();
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
      const imageryProvider = new Cesium.UrlTemplateImageryProvider({
        url: imageryUrl,
        minimumLevel: 0,
        maximumLevel: 8,
        credit: new Cesium.Credit("Imagery © Esri and contributors")
      });
      viewer.imageryLayers.addImageryProvider(imageryProvider);

      viewer.scene.backgroundColor = Cesium.Color.fromCssColorString("#030509");
      viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString("#101820");
      viewer.scene.globe.enableLighting = false;
      viewer.scene.globe.dynamicAtmosphereLighting = false;
      viewer.scene.globe.showGroundAtmosphere = true;
      viewer.scene.skyAtmosphere.show = true;
      viewer.scene.fog.enabled = true;
      viewer.scene.globe.depthTestAgainstTerrain = false;

      const cameraController = viewer.scene.screenSpaceCameraController;
      cameraController.enableInputs = true;
      cameraController.enableRotate = true;
      cameraController.enableTilt = true;
      cameraController.enableTranslate = true;
      cameraController.enableZoom = true;
      cameraController.enableLook = true;
      cameraController.minimumZoomDistance = 700000;
      cameraController.maximumZoomDistance = 40000000;
      cameraController.zoomFactor = 5;
      cameraController.maximumMovementRatio = 0.1;

      // A simple, centered globe with space around it. No app controls or overlays.
      viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(12, 18, 24500000),
        orientation: {
          heading: 0,
          pitch: Cesium.Math.toRadians(-90),
          roll: 0
        }
      });

      window.EarthLiveViewer = viewer;
      window.addEventListener("resize", resizeGlobe, { passive: true });
      window.addEventListener("orientationchange", () => {
        setTimeout(resizeGlobe, 180);
      }, { passive: true });
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

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
  let touchGestureState = null;

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

    controller.minimumZoomDistance = 10;
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

  // Gesture arbitration is deliberately separate from adaptive framing.
  // Two-finger actions lock to one mode until the fingers lift: pinch, twist, or tilt.
  function installGestureArbitration() {
    const controller = viewer.scene.screenSpaceCameraController;
    const base = {
      rotate: controller.enableRotate,
      tilt: controller.enableTilt,
      translate: controller.enableTranslate,
      zoom: controller.enableZoom,
      look: controller.enableLook
    };
    const distance = (a, b) => Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
    const angle = (a, b) => Math.atan2(b.clientY - a.clientY, b.clientX - a.clientX);
    const center = (a, b) => ({ x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 });
    const angleDelta = (a, b) => {
      let d = b - a;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      return d;
    };
    function setMode(mode) {
      if (mode === "single" || mode === "idle") {
        controller.enableRotate = base.rotate;
        controller.enableTilt = base.tilt;
        controller.enableTranslate = base.translate;
        controller.enableZoom = base.zoom;
        controller.enableLook = base.look;
      } else if (mode === "pinch") {
        controller.enableRotate = false;
        controller.enableTilt = false;
        controller.enableTranslate = false;
        controller.enableZoom = base.zoom;
        controller.enableLook = false;
      } else if (mode === "undecided" || mode === "twist") {
        controller.enableRotate = false;
        controller.enableTilt = false;
        controller.enableTranslate = false;
        controller.enableZoom = false;
        controller.enableLook = false;
      } else if (mode === "tilt") {
        controller.enableRotate = false;
        controller.enableTilt = base.tilt;
        controller.enableTranslate = false;
        controller.enableZoom = false;
        controller.enableLook = false;
      }
    }
    globeElement.addEventListener("touchstart", event => {
      hasUserInteracted = true;
      if (event.touches.length === 1) {
        touchGestureState = { mode: "single" };
        setMode("single");
      } else if (event.touches.length >= 2) {
        const a = event.touches[0], b = event.touches[1], c = center(a, b);
        touchGestureState = {
          mode: "undecided", startDistance: distance(a, b), lastDistance: distance(a, b),
          startAngle: angle(a, b), lastAngle: angle(a, b), startCenter: c, lastCenter: c
        };
        // Pause camera actions briefly until the dominant two-finger movement is clear.
        setMode("undecided");
      }
    }, { passive: true, capture: true });

    globeElement.addEventListener("touchmove", event => {
      if (!touchGestureState || event.touches.length < 2 || !viewer || viewer.isDestroyed()) return;
      const a = event.touches[0], b = event.touches[1], state = touchGestureState;
      const d = distance(a, b), ang = angle(a, b), c = center(a, b);
      const totalDistanceChange = Math.abs(d - state.startDistance);
      const totalTwist = Math.abs(angleDelta(state.startAngle, ang));
      const totalVertical = Math.abs(c.y - state.startCenter.y);
      const rotationChange = angleDelta(state.lastAngle, ang);

      if (state.mode === "undecided") {
        // A clear angular movement wins twist; vertical centroid travel wins tilt.
        // Otherwise, distance change wins pinch, which is safest for shaky hands.
        if (totalTwist > 0.10 && totalTwist * Math.max(24, d) > totalDistanceChange * 1.15 && totalTwist * Math.max(24, d) > totalVertical * 1.2) {
          state.mode = "twist";
          setMode("twist");
        } else if (totalVertical > 24 && totalVertical > totalDistanceChange * 1.5 && totalVertical > totalTwist * Math.max(24, d) * 1.35) {
          state.mode = "tilt";
          setMode("tilt");
        } else if (totalDistanceChange > 8 || totalTwist > 0.18 || totalVertical > 28) {
          state.mode = "pinch";
          setMode("pinch");
        }
      } else if (state.mode === "twist") {
        // Custom twist only; native zoom and tilt remain disabled for this touch sequence.
        viewer.camera.rotateRight(-rotationChange * 0.85);
      }
      state.lastDistance = d;
      state.lastAngle = ang;
      state.lastCenter = c;
    }, { passive: true, capture: true });

    const finish = event => {
      if (!event.touches || event.touches.length === 0) {
        touchGestureState = null;
        setMode("idle");
      } else if (event.touches.length === 1) {
        touchGestureState = { mode: "single" };
        setMode("single");
      }
    };
    globeElement.addEventListener("touchend", finish, { passive: true, capture: true });
    globeElement.addEventListener("touchcancel", finish, { passive: true, capture: true });
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
    // A viewport resize must resize Cesium's drawing surface only. It must never
    // recalculate the camera composition during a pinch or ordinary zoom gesture.
    if (resizeFrame) cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = 0;
      if (!viewer || viewer.isDestroyed()) return;

      viewer.resize();
      const nextProfile = detectDisplayProfile();
      activeProfile = nextProfile;
      const settings = profiles[nextProfile];
      const controller = viewer.scene.screenSpaceCameraController;
      controller.zoomFactor = settings.zoomFactor;
      controller.maximumMovementRatio = settings.movementRatio;
      document.documentElement.dataset.displayProfile = nextProfile;
      viewer.scene.requestRender();
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
      installGestureArbitration();

      // Any deliberate touch permanently hands camera framing to the user for this session.
      // Resize events below never call setView or reapply the adaptive camera composition.
      ["pointerdown", "touchstart", "wheel"].forEach(eventName => {
        globeElement.addEventListener(eventName, () => { hasUserInteracted = true; }, { passive: true });
      });

      applyDisplayProfile({ initial: true });

      window.EarthLiveViewer = viewer;
      window.EarthLiveAdaptiveDisplay = {
        get profile() { return activeProfile; },
        get settings() { return { ...profiles[activeProfile] }; },
        get imagery() { return "Esri World Imagery"; },
        zoomMinimumMeters: 10,
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

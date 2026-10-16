(() => {
  "use strict";

  const globeElement = document.getElementById("globe");
  const errorMessage = document.getElementById("errorMessage");
  let viewer = null;
  let resizeFrame = 0;
  let activeProfile = "portrait";
  let lastOrientation = null;
  // Single source of truth for the selected display rectangle and its live dimensions.
  window.EarthLiveDisplay = window.EarthLiveDisplay || { mode: "full", orientation: "portrait", viewport: { width: 0, height: 0 }, area: { x: 0, y: 0, width: 0, height: 0 } };
  let esriLayer = null;
  let hasUserInteracted = false;
  let lastAppliedProfile = null;

  const esriImageryUrl =
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

  // Adaptive sizing is calculated from the current selected display rectangle, never
  // from dimensions cached while the device was in the other orientation.
  const EARTH_RADIUS_METERS = 6378137;
  // One shared Earth sizing standard: 75% of the relevant display dimension.
  // Portrait measures against width; landscape measures against height so the
  // globe remains comfortably inside the display. Rotation itself never reframes.
  const profiles = {
    portrait: { sizeFraction: 0.75, sizeAxis: "width", topFraction: 0.00, zoomFactor: 8.63, movementRatio: 0.075 },
    landscape:{ sizeFraction: 0.75, sizeAxis: "height", topFraction: 0.02, zoomFactor: 5, movementRatio: 0.1 }
  };

  function measureDisplayArea() {
    const root = document.documentElement;
    const mode = root.dataset.displayMode || "full";
    const rect = globeElement.getBoundingClientRect();
    // The globe container already reflects the selected mode's CSS safe-area bounds.
    // Read its current rectangle after every rotation or mode change.
    const width = Math.max(1, Math.round(rect.width || window.innerWidth || 1));
    const height = Math.max(1, Math.round(rect.height || window.innerHeight || 1));
    const x = Number.isFinite(rect.left) ? rect.left : 0;
    const y = Number.isFinite(rect.top) ? rect.top : 0;
    const orientation = height > width ? "portrait" : "landscape";
    window.EarthLiveDisplay.mode = mode;
    window.EarthLiveDisplay.orientation = orientation;
    window.EarthLiveDisplay.viewport = {
      width: Math.max(1, Math.round(window.visualViewport?.width || window.innerWidth || width)),
      height: Math.max(1, Math.round(window.visualViewport?.height || window.innerHeight || height))
    };
    window.EarthLiveDisplay.area = { x, y, width, height };
    return window.EarthLiveDisplay;
  }

  function detectDisplayProfile() {
    // Only two layout profiles exist. Wide/ultrawide landscape devices still use
    // the landscape rules; never return a profile with no sizing configuration.
    return measureDisplayArea().orientation === "portrait" ? "portrait" : "landscape";
  }

  function showError(error) {
    console.error("EARTH // LIVE globe failed to start:", error);
    errorMessage.hidden = false;
  }


  function synchronizeCesiumViewport() {
    // iOS can dispatch orientation/viewport events before the CSS layout and
    // Cesium canvas have both settled. Measure the actual globe box, resize
    // Cesium, and explicitly synchronize the perspective-frustum aspect ratio.
    const display = measureDisplayArea();
    if (viewer && !viewer.isDestroyed()) viewer.resize();
    const area = measureDisplayArea().area;
    const width = Math.max(1, area.width || globeElement.clientWidth || 1);
    const height = Math.max(1, area.height || globeElement.clientHeight || 1);
    const frustum = viewer && !viewer.isDestroyed() ? viewer.camera.frustum : null;
    if (frustum && "aspectRatio" in frustum) frustum.aspectRatio = width / height;
    return { ...display, area: { ...area, width, height } };
  }

  function calculateCameraHeight(settings, area = measureDisplayArea().area) {
    const width = Math.max(1, area.width);
    const height = Math.max(1, area.height);
    const aspect = width / height;
    const frustum = viewer.camera.frustum;
    // Cesium's PerspectiveFrustum.fov is horizontal on landscape (aspect > 1)
    // and vertical on portrait (aspect <= 1). Do not reuse a stale fovy value
    // from the previous orientation while iOS is rotating the viewport.
    const fallbackFov = Cesium.Math.toRadians(60);
    const fov = Number.isFinite(frustum.fov) ? frustum.fov : fallbackFov;
    const verticalFov = aspect > 1
      ? 2 * Math.atan(Math.tan(fov / 2) / aspect)
      : fov;
    const horizontalFov = aspect > 1
      ? fov
      : 2 * Math.atan(Math.tan(verticalFov / 2) * aspect);
    const targetFov = settings.sizeAxis === "width" ? horizontalFov : verticalFov;
    const halfAngle = Math.atan(settings.sizeFraction * Math.tan(targetFov / 2));
    const cameraDistance = EARTH_RADIUS_METERS / Math.sin(halfAngle);
    return Math.max(1000, cameraDistance - EARTH_RADIUS_METERS);
  }

  function applyDisplayProfile({ initial = false, forceLayout = false } = {}) {
    if (!viewer || viewer.isDestroyed()) return;
    const display = synchronizeCesiumViewport();
    const nextProfile = display.orientation;
    activeProfile = nextProfile;
    const settings = profiles[nextProfile];
    const controller = viewer.scene.screenSpaceCameraController;

    controller.minimumZoomDistance = 10;
    controller.maximumZoomDistance = 40000000;
    controller.zoomFactor = settings.zoomFactor;
    controller.maximumMovementRatio = settings.movementRatio;

    // Initial framing establishes the designed composition. Later explicit layout
    // changes resize the camera range but preserve the user's current location and
    // orientation instead of snapping the globe back to the startup view.
    const profileChanged = lastAppliedProfile !== nextProfile;
    const mayReframe = initial || forceLayout || (!hasUserInteracted && profileChanged);
    if (mayReframe) {
      const cameraHeight = calculateCameraHeight(settings, display.area);
      const fovy = viewer.camera.frustum.fovy || Cesium.Math.toRadians(60);
      let destination;
      let heading = 0;
      let pitch = -Math.PI / 2;
      let roll = 0;

      if (initial) {
        destination = Cesium.Cartesian3.fromDegrees(12, 18, cameraHeight);
      } else {
        const current = viewer.camera.positionCartographic;
        const orientation = viewer.camera;
        destination = Cesium.Cartesian3.fromRadians(current.longitude, current.latitude, cameraHeight);
        heading = orientation.heading;
        pitch = orientation.pitch;
        roll = orientation.roll;
      }

      // Only the initial composition applies the design top inset. On rotation or
      // mode changes after interaction, preserve the user's camera orientation.
      if (initial && settings.sizeAxis === "height") {
        const targetCenterY = settings.topFraction + settings.sizeFraction / 2;
        const verticalShiftFraction = 0.5 - targetCenterY;
        pitch += Math.atan(2 * verticalShiftFraction * Math.tan(fovy / 2));
      }
      viewer.camera.setView({ destination, orientation: { heading, pitch, roll } });
      lastAppliedProfile = nextProfile;
    }
    lastOrientation = display.orientation;
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
    // Wait two animation frames: on iOS the first resize/orientation event can
    // arrive before the final viewport dimensions have reached CSS and canvas.
    if (resizeFrame) cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = requestAnimationFrame(() => {
        resizeFrame = 0;
        if (!viewer || viewer.isDestroyed()) return;
        const display = synchronizeCesiumViewport();
        const nextProfile = display.orientation;
        activeProfile = nextProfile;
        const settings = profiles[nextProfile];
        const controller = viewer.scene.screenSpaceCameraController;
        controller.zoomFactor = settings.zoomFactor;
        controller.maximumMovementRatio = settings.movementRatio;
        // Rotation is a viewport resize, NOT a camera command. Cesium keeps the
        // existing camera position, heading, pitch, and zoom; only its drawing
        // surface/frustum is synchronized to the new display rectangle.
        lastOrientation = nextProfile;
        document.documentElement.dataset.displayProfile = nextProfile;
        viewer.scene.requestRender();
      });
    });
  }

  function setupDisplayPersonalisation() {
    const moreButton = document.getElementById("moreOptionsButton");
    const panel = document.getElementById("personalisationPanel");
    const closeButton = document.getElementById("closePersonalisation");
    const choices = Array.from(document.querySelectorAll('input[name="displayMode"]'));
    if (!moreButton || !panel || !closeButton || !choices.length) return;

    const stored = (() => { try { return localStorage.getItem("earthLiveDisplayMode"); } catch (_) { return null; } })();
    const validModes = new Set(["full", "top", "bottom", "both"]);
    const mode = validModes.has(stored) ? stored : "full";
    document.documentElement.dataset.displayMode = mode;
    window.EarthLiveDisplay.mode = mode;
    choices.forEach(choice => { choice.checked = choice.value === mode; });

    moreButton.addEventListener("click", () => {
      panel.hidden = !panel.hidden;
      moreButton.setAttribute("aria-expanded", String(!panel.hidden));
    });
    closeButton.addEventListener("click", () => {
      panel.hidden = true;
      moreButton.setAttribute("aria-expanded", "false");
    });
    choices.forEach(choice => choice.addEventListener("change", () => {
      if (!choice.checked) return;
      document.documentElement.dataset.displayMode = choice.value;
      window.EarthLiveDisplay.mode = choice.value;
      try { localStorage.setItem("earthLiveDisplayMode", choice.value); } catch (_) {}
      // A display-mode choice changes the viewport bounds, not the user's view.
      // Resize Cesium after CSS settles; never call setView or alter camera range.
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (!viewer || viewer.isDestroyed()) return;
        synchronizeCesiumViewport();
        const display = measureDisplayArea();
        activeProfile = display.orientation;
        lastOrientation = display.orientation;
        document.documentElement.dataset.displayProfile = display.orientation;
        viewer.scene.requestRender();
      }));
    }));
  }


  let activeScreenEffectTimer = null;
  let particleFrame = null;
  function stopEffectParticles() {
    if (particleFrame !== null) cancelAnimationFrame(particleFrame);
    particleFrame = null;
    const canvas = document.getElementById("effect-particles");
    const ctx = canvas?.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  function runFallingParticles(kind, duration) {
    const canvas = document.getElementById("effect-particles");
    if (!canvas) return;
    stopEffectParticles();
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const isSnow = kind === "snow";
    const count = Math.min(isSnow ? 54 : 36, Math.max(22, Math.round(w / 12)));
    const particles = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: -Math.random() * h * .8,
      vx: (Math.random() - .5) * (isSnow ? 0.7 : 0.35),
      vy: isSnow ? 1.2 + Math.random() * 2.0 : 1.8 + Math.random() * 2.8,
      size: isSnow ? 1.2 + Math.random() * 2.6 : 1.2 + Math.random() * 3.1,
      alpha: .35 + Math.random() * .6,
      drift: Math.random() * Math.PI * 2
    }));
    const started = performance.now();
    function frame(now) {
      if (now - started >= duration) {
        stopEffectParticles();
        return;
      }
      ctx.clearRect(0, 0, w, h);
      const fade = Math.min(1, (duration - (now - started)) / 360);
      for (const p of particles) {
        p.drift += .025;
        p.x += p.vx + (isSnow ? Math.sin(p.drift) * .42 : Math.sin(p.drift) * .12);
        p.y += p.vy;
        if (p.y > h + 8) { p.y = -8; p.x = Math.random() * w; }
        if (p.x < -8) p.x = w + 8;
        if (p.x > w + 8) p.x = -8;
        ctx.globalAlpha = p.alpha * fade;
        if (isSnow) {
          ctx.fillStyle = "#e7f8ff";
          ctx.shadowColor = "#8bdfff";
          ctx.shadowBlur = 5;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.strokeStyle = p.size > 3 ? "#ffd76a" : "#ff7b26";
          ctx.fillStyle = p.size > 3 ? "#ffe7a0" : "#ff4b16";
          ctx.shadowColor = "#ff5b13";
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, p.size * .55, p.size * 1.9, .15, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = p.alpha * fade * .7;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y - p.size * 2);
          ctx.lineTo(p.x - p.vx * 2, p.y - p.size * 5);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      particleFrame = requestAnimationFrame(frame);
    }
    particleFrame = requestAnimationFrame(frame);
  }

  function triggerOrbPersonality(button) {
    const orb = button?.dataset?.orb;
    if (!orb) return;
    const overlay = document.getElementById("screen-effect");
    if (!overlay) return;
    const effectByOrb = {
      basic: "cosmic",
      hd: "cosmic",
      location: "location",
      sun: "magma",
      moon: "frost",
      stacks: "electric"
    };
    const effect = effectByOrb[orb] || "cosmic";
    const rect = button.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    if (activeScreenEffectTimer) window.clearTimeout(activeScreenEffectTimer);
    stopEffectParticles();
    overlay.className = "screen-effect";
    overlay.style.setProperty("--effect-x", `${x}px`);
    overlay.style.setProperty("--effect-y", `${y}px`);
    overlay.classList.add(`screen-effect-${effect}`);
    if (effect === "magma" || effect === "frost") overlay.classList.add("screen-effect-long");
    void overlay.offsetWidth;
    overlay.classList.add("screen-effect-playing");
    const durations = { cosmic: 1800, magma: 4000, frost: 3650, electric: 1000, location: 1900 };
    const duration = durations[effect] || 1800;
    if (effect === "magma") runFallingParticles("lava", duration);
    if (effect === "frost") runFallingParticles("snow", duration);
    activeScreenEffectTimer = window.setTimeout(() => {
      overlay.className = "screen-effect";
      overlay.style.removeProperty("--effect-x");
      overlay.style.removeProperty("--effect-y");
      stopEffectParticles();
      activeScreenEffectTimer = null;
    }, duration);
  }

  function setupOrbDeck() {
    const dock = document.getElementById("primaryDock");
    if (!dock) return;
    const buttons = Array.from(dock.querySelectorAll(".orb-button"));
    buttons.forEach(button => button.addEventListener("click", () => {
      window.setTimeout(() => {
        if (button.getAttribute("aria-pressed") === "true") triggerOrbPersonality(button);
      }, 0);
    }, { passive: true }));
    const stacksPanel = document.getElementById("stacksPanel");
    const stacksHome = document.getElementById("stacksHome");
    const customiseView = document.getElementById("customiseView");
    const stackNotice = document.getElementById("stackNotice");
    const closeStacks = document.getElementById("closeStacks");
    const backToStacks = document.getElementById("backToStacks");
    const displayChoices = Array.from(document.querySelectorAll('input[name="displayMode"]'));
    const themeChoices = Array.from(document.querySelectorAll("[data-deck-theme]"));

    const openStacks = () => {
      stacksPanel.hidden = false;
      stacksHome.hidden = false;
      customiseView.hidden = true;
      stackNotice.hidden = true;
      const stackButton = buttons.find(item => item.dataset.orb === "stacks");
      if (stackButton) stackButton.setAttribute("aria-pressed", "true");
    };
    const closeStacksPanel = () => {
      stacksPanel.hidden = true;
      const stackButton = buttons.find(item => item.dataset.orb === "stacks");
      if (stackButton) stackButton.setAttribute("aria-pressed", "false");
    };

    buttons.forEach(button => button.addEventListener("click", () => {
      const key = button.dataset.orb;
      if (key === "stacks") {
        if (stacksPanel.hidden) openStacks(); else closeStacksPanel();
        return;
      }
      if (key === "basic" || key === "hd") {
        buttons.filter(item => item.dataset.orb === "basic" || item.dataset.orb === "hd")
          .forEach(item => item.setAttribute("aria-pressed", String(item === button)));
      } else {
        button.setAttribute("aria-pressed", String(button.getAttribute("aria-pressed") !== "true"));
      }
    }));

    closeStacks?.addEventListener("click", closeStacksPanel);
    backToStacks?.addEventListener("click", () => {
      customiseView.hidden = true;
      stacksHome.hidden = false;
      stackNotice.hidden = true;
    });
    document.querySelectorAll('[data-stack-view="customise"]').forEach(button => button.addEventListener("click", () => {
      stacksHome.hidden = true;
      customiseView.hidden = false;
      stackNotice.hidden = true;
    }));
    document.querySelectorAll("[data-stack-feature]").forEach(button => button.addEventListener("click", () => {
      const labels = { weather: "Weather & Clouds", "air-traffic": "Air Traffic", "road-traffic": "Road Traffic", imagery: "Imagery" };
      stackNotice.textContent = labels[button.dataset.stackFeature] + " is reserved in Stacks. Its live dataset connection will be added in a later milestone.";
      stackNotice.hidden = false;
    }));

    const deckAssets = {
      "clear-glass":"deck-clear-glass.png",
      "desert-sand":"deck-desert-sand.png"
    };
    const deckArt = document.querySelector(".orb-deck-art");
    const applyDeckTheme = theme => {
      const safeTheme = Object.prototype.hasOwnProperty.call(deckAssets, theme) ? theme : "clear-glass";
      document.documentElement.dataset.deckTheme = safeTheme;
      if (deckArt) deckArt.src = "./" + deckAssets[safeTheme];
      themeChoices.forEach(item => {
        const selected = item.dataset.deckTheme === safeTheme;
        item.classList.toggle("selected", selected);
        item.setAttribute("aria-pressed", String(selected));
      });
      return safeTheme;
    };
    let savedTheme = "clear-glass";
    try { savedTheme = localStorage.getItem("earthLiveDeckTheme") || savedTheme; } catch (_) {}
    savedTheme = applyDeckTheme(savedTheme);
    themeChoices.forEach(choice => choice.addEventListener("click", () => {
      const theme = applyDeckTheme(choice.dataset.deckTheme);
      try { localStorage.setItem("earthLiveDeckTheme", theme); } catch (_) {}
    }));

    let savedMode = "full";
    try { savedMode = localStorage.getItem("earthLiveDisplayMode") || savedMode; } catch (_) {}
    document.documentElement.dataset.displayMode = savedMode;
    displayChoices.forEach(choice => {
      choice.checked = choice.value === savedMode;
      choice.addEventListener("change", () => {
        if (!choice.checked) return;
        document.documentElement.dataset.displayMode = choice.value;
        window.EarthLiveDisplay.mode = choice.value;
        try { localStorage.setItem("earthLiveDisplayMode", choice.value); } catch (_) {}
        requestAnimationFrame(() => requestAnimationFrame(() => {
          if (!viewer || viewer.isDestroyed()) return;
          synchronizeCesiumViewport();
          const display = measureDisplayArea();
          activeProfile = display.orientation;
          lastOrientation = display.orientation;
          document.documentElement.dataset.displayProfile = display.orientation;
          viewer.scene.requestRender();
        }));
      });
    });
    document.addEventListener("keydown", event => { if (event.key === "Escape" && !stacksPanel.hidden) closeStacksPanel(); });
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

      // Any deliberate touch permanently hands camera framing to the user for this session.
      // Resize events below never call setView or reapply the adaptive camera composition.
      ["pointerdown", "touchstart", "wheel"].forEach(eventName => {
        globeElement.addEventListener(eventName, () => { hasUserInteracted = true; }, { passive: true });
      });

      setupDisplayPersonalisation();
      setupOrbDeck();
      applyDisplayProfile({ initial: true });

      window.EarthLiveViewer = viewer;
      window.EarthLiveAdaptiveDisplay = {
        get profile() { return activeProfile; },
        get settings() { return { ...profiles[activeProfile] }; },
        get imagery() { return "Esri World Imagery"; },
        zoomMinimumMeters: 10,
        targets: { portraitWidth: 0.80, landscapeHeight: 0.60, portraitCentered: true, landscapeTopInset: 0.02, viewport: "window.EarthLiveDisplay.area; remeasured on orientation/mode changes; safe edges rotate in landscape" }
      };

      window.addEventListener("resize", resizeGlobe, { passive: true });
      if (window.visualViewport) window.visualViewport.addEventListener("resize", resizeGlobe, { passive: true });
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

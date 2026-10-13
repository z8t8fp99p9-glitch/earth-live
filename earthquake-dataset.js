/* EARTH // LIVE — Earthquake Dataset v1.0
 * Global USGS event collector. Local-first persistence; no UI changes.
 */
(function (root) {
  "use strict";

  const COLLECTION = "earthquakes";
  const FEED_URL = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson";
  const INTERVAL_MS = 5 * 60 * 1000;
  const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

  let timer = null;
  let inFlight = false;
  let lastSuccessAt = null;
  let lastError = null;
  let lastCount = 0;
  let lastUpdatedCount = 0;
  let stoppedReason = "not started";
  let lastFetchAt = 0;

  function store() { return root.EarthLiveCollections || null; }
  function iso(ms) { return new Date(ms).toISOString(); }

  function normalize(feature, capturedAt) {
    if (!feature || !feature.id || !feature.geometry ||
        !Array.isArray(feature.geometry.coordinates)) return null;
    const coords = feature.geometry.coordinates;
    const lon = Number(coords[0]), lat = Number(coords[1]), depth = Number(coords[2]);
    if (!Number.isFinite(lon) || !Number.isFinite(lat) ||
        lon < -180 || lon > 180 || lat < -90 || lat > 90) return null;
    const p = feature.properties || {};
    const time = Number(p.time);
    const updated = Number(p.updated);
    return {
      schemaVersion: 1,
      eventId: String(feature.id),
      title: typeof p.title === "string" ? p.title : null,
      magnitude: Number.isFinite(Number(p.mag)) ? Number(p.mag) : null,
      magnitudeType: p.magType || null,
      place: p.place || null,
      longitude: lon,
      latitude: lat,
      depthKm: Number.isFinite(depth) ? depth : null,
      eventTime: Number.isFinite(time) && time > 0 ? iso(time) : null,
      updatedAt: Number.isFinite(updated) && updated > 0 ? iso(updated) : null,
      status: p.status || null,
      eventType: p.type || null,
      tsunami: p.tsunami == null ? null : Number(p.tsunami),
      felt: p.felt == null ? null : Number(p.felt),
      alert: p.alert || null,
      significance: p.sig == null ? null : Number(p.sig),
      detailUrl: p.url || null,
      source: "USGS",
      capturedAt
    };
  }

  async function saveEvent(event) {
    const db = store();
    if (!db || typeof db.save !== "function") {
      throw new Error("EarthLiveCollections.save is unavailable. Load data-store.js first.");
    }
    await db.save(COLLECTION, event.eventId, event, {
      source: "USGS",
      capturedAt: event.capturedAt,
      observedAt: event.eventTime || event.capturedAt,
      geometry: { type: "Point", coordinates: [event.longitude, event.latitude] },
      tags: ["earthquake", event.magnitudeType || "unknown-magnitude-type"]
    });
  }

  async function pruneOldEvents() {
    const db = store();
    if (!db || typeof db.list !== "function" || typeof db.remove !== "function") return;
    const cutoff = Date.now() - RETENTION_MS;
    const rows = await db.list(COLLECTION, { limit: 5000 });
    for (const row of (Array.isArray(rows) ? rows : [])) {
      const id = String(row.id || row.key || "");
      const payload = row.payload || row.data || row;
      const time = Date.parse(payload.eventTime || payload.capturedAt || "");
      if (id && Number.isFinite(time) && time < cutoff) {
        await db.remove(COLLECTION, id);
      }
    }
  }

  async function refresh() {
    if (inFlight) return { skipped: true, reason: "fetch already in progress" };
    const db = store();
    if (!db) throw new Error("EarthLiveCollections is not loaded.");
    inFlight = true;
    lastFetchAt = Date.now();
    try {
      const response = await fetch(FEED_URL, {
        method: "GET",
        mode: "cors",
        credentials: "omit",
        cache: "no-store",
        headers: { "Accept": "application/geo+json, application/json" }
      });
      if (response.status === 429) throw new Error("USGS feed rate-limited this request (HTTP 429).");
      if (!response.ok) throw new Error("USGS feed returned HTTP " + response.status);
      const data = await response.json();
      if (!data || !Array.isArray(data.features)) throw new Error("USGS feed response was not valid GeoJSON.");
      const capturedAt = iso(Date.now());
      let saved = 0;
      for (const feature of data.features) {
        const event = normalize(feature, capturedAt);
        if (!event) continue;
        await saveEvent(event);
        saved++;
      }
      await pruneOldEvents();
      lastSuccessAt = iso(Date.now());
      lastError = null;
      lastCount = data.features.length;
      lastUpdatedCount = saved;
      return { fetched: lastCount, saved: saved, capturedAt };
    } catch (error) {
      lastError = String(error && error.message || error);
      throw error;
    } finally {
      inFlight = false;
    }
  }

  function start() {
    stop();
    if (!store()) {
      stoppedReason = "waiting for EarthLiveCollections";
      return health();
    }
    stoppedReason = "active-app polling";
    if (!root.document || root.document.visibilityState !== "hidden") {
      refresh().catch(function () {});
    }
    timer = root.setInterval(function () {
      if (root.document && root.document.visibilityState === "hidden") return;
      refresh().catch(function () {});
    }, INTERVAL_MS);
    if (root.document && root.document.addEventListener) {
      root.document.addEventListener("visibilitychange", onVisibilityChange);
    }
    return health();
  }

  function onVisibilityChange() {
    if (!root.document || root.document.visibilityState !== "visible") return;
    if (Date.now() - lastFetchAt >= INTERVAL_MS) refresh().catch(function () {});
  }

  function stop() {
    if (timer !== null) root.clearInterval(timer);
    timer = null;
    if (root.document && root.document.removeEventListener) {
      root.document.removeEventListener("visibilitychange", onVisibilityChange);
    }
    stoppedReason = "stopped by caller";
    return health();
  }

  function health() {
    return {
      ready: !!store(),
      running: timer !== null,
      intervalMs: INTERVAL_MS,
      retentionDays: 7,
      source: "USGS all_day GeoJSON feed",
      lastSuccessAt,
      lastError,
      lastFeatureCount: lastCount,
      lastSavedCount: lastUpdatedCount,
      inFlight,
      stoppedReason
    };
  }

  root.EarthLiveEarthquakes = { version: "1.0", health, refresh, start, stop };

  if (store()) start();
})(window);

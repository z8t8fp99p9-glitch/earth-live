/* EARTH // LIVE — Flight Dataset v1.0
 * Local-first foundation. No UI modifications.
 * Optional public source adapter: adsb.fi. Personal/non-commercial use only.
 */
(function (root) {
  "use strict";

  const COLLECTION = "flights";
  const DEFAULT_INTERVAL_MS = 15000;
  const MIN_INTERVAL_MS = 10000;
  const DEFAULT_HISTORY_HOURS = 6;
  const ADSBFI_BASE = "https://opendata.adsb.fi/api/v2";
  let timer = null;
  let activeTarget = null;
  let activeOptions = null;
  let inFlight = false;
  let lastError = null;
  let lastSuccessAt = null;
  let lastObservation = null;
  let nextAllowedAt = 0;
  let stoppedReason = "not started";

  function store() {
    return root.EarthLiveCollections || null;
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function cleanCallsign(value) {
    return String(value || "").trim().toUpperCase().replace(/\s+/g, "");
  }

  function cleanHex(value) {
    return String(value || "").trim().toLowerCase().replace(/[^0-9a-f]/g, "").slice(0, 6);
  }

  function normalizeAircraft(raw, capturedAt) {
    if (!raw || typeof raw !== "object") return null;
    const hex = cleanHex(raw.hex || raw.icao24 || raw.icao);
    const lat = Number(raw.lat);
    const lon = Number(raw.lon);
    if (!hex || !Number.isFinite(lat) || !Number.isFinite(lon) ||
        lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;

    const sourceTimestampSeconds = Number(raw.seen_pos != null ? null : raw.timestamp);
    const sourceTimestamp = Number.isFinite(sourceTimestampSeconds) && sourceTimestampSeconds > 0
      ? new Date(sourceTimestampSeconds * 1000).toISOString()
      : null;
    const seenPos = Number(raw.seen_pos);
    const observation = {
      schemaVersion: 1,
      icao24: hex,
      callsign: cleanCallsign(raw.flight || raw.callsign || ""),
      registration: raw.r || raw.registration || null,
      aircraftType: raw.t || raw.type || null,
      latitude: lat,
      longitude: lon,
      baroAltitudeM: Number.isFinite(Number(raw.alt_baro)) ? Number(raw.alt_baro) * 0.3048 : null,
      geoAltitudeM: Number.isFinite(Number(raw.alt_geom)) ? Number(raw.alt_geom) * 0.3048 : null,
      velocityMps: Number.isFinite(Number(raw.gs)) ? Number(raw.gs) * 0.514444 : null,
      trackDeg: Number.isFinite(Number(raw.track)) ? Number(raw.track) : null,
      verticalRateMps: Number.isFinite(Number(raw.baro_rate)) ? Number(raw.baro_rate) * 0.00508 : null,
      onGround: raw.alt_baro === "ground" || raw.gnd === true,
      squawk: raw.squawk || null,
      source: "adsb.fi",
      sourceTimestamp,
      seenPositionSecondsAgo: Number.isFinite(seenPos) ? seenPos : null,
      capturedAt,
      rawSource: {
        category: raw.category || null,
        emergency: raw.emergency || null
      }
    };
    return observation;
  }

  async function saveObservation(observation, historyHours) {
    const db = store();
    if (!db || typeof db.save !== "function") {
      throw new Error("EarthLiveCollections.save is unavailable. Load data-store.js first.");
    }
    const hex = observation.icao24;
    const latestId = "latest:" + hex;
    await db.save(COLLECTION, latestId, observation, {
      source: observation.source,
      capturedAt: observation.capturedAt,
      observedAt: observation.sourceTimestamp || observation.capturedAt,
      geometry: { type: "Point", coordinates: [observation.longitude, observation.latitude] },
      tags: ["aircraft", "latest", hex]
    });

    const sampleTime = observation.sourceTimestamp || observation.capturedAt;
    const sampleId = "sample:" + hex + ":" + sampleTime;
    await db.save(COLLECTION, sampleId, observation, {
      source: observation.source,
      capturedAt: observation.capturedAt,
      observedAt: sampleTime,
      geometry: { type: "Point", coordinates: [observation.longitude, observation.latitude] },
      tags: ["aircraft", "history", hex]
    });

    await pruneHistory(hex, historyHours);
    return observation;
  }

  async function pruneHistory(hex, historyHours) {
    const db = store();
    if (!db || typeof db.list !== "function" || typeof db.remove !== "function") return;
    const cutoff = Date.now() - Math.max(1, Number(historyHours) || DEFAULT_HISTORY_HOURS) * 3600000;
    const rows = await db.list(COLLECTION, { limit: 2000 });
    for (const row of (Array.isArray(rows) ? rows : [])) {
      const id = String(row.id || row.key || "");
      if (!id.startsWith("sample:" + hex + ":")) continue;
      const record = row.payload || row.data || row;
      const stamp = Date.parse(record.sourceTimestamp || record.capturedAt || "");
      if (Number.isFinite(stamp) && stamp < cutoff) {
        await db.remove(COLLECTION, id);
      }
    }
  }

  async function requestJson(url) {
    const response = await fetch(url, { method: "GET", mode: "cors", credentials: "omit", cache: "no-store" });
    if (response.status === 429) {
      const err = new Error("Provider rate limit reached (HTTP 429). Tracking has paused temporarily.");
      err.retryAfter = Number(response.headers.get("Retry-After")) || 60;
      throw err;
    }
    if (!response.ok) throw new Error("Flight provider returned HTTP " + response.status);
    return response.json();
  }

  async function lookupCallsign(callsign) {
    const query = cleanCallsign(callsign);
    if (!query) throw new Error("Enter a flight callsign first.");
    const data = await requestJson(ADSBFI_BASE + "/callsign/" + encodeURIComponent(query));
    const aircraft = Array.isArray(data && data.aircraft) ? data.aircraft : [];
    return aircraft.map(x => normalizeAircraft(x, nowIso())).filter(Boolean);
  }

  async function lookupIcao24(hex) {
    const query = cleanHex(hex);
    if (!query || query.length !== 6) throw new Error("ICAO24 must be a six-character hexadecimal address.");
    const data = await requestJson(ADSBFI_BASE + "/hex/" + encodeURIComponent(query));
    const aircraft = Array.isArray(data && data.aircraft) ? data.aircraft : [];
    return aircraft.map(x => normalizeAircraft(x, nowIso())).filter(Boolean);
  }

  async function fetchTarget(target) {
    if (!target || !target.type || !target.value) throw new Error("A selected callsign or ICAO24 target is required.");
    if (target.type === "callsign") return lookupCallsign(target.value);
    if (target.type === "icao24") return lookupIcao24(target.value);
    throw new Error("Target type must be 'callsign' or 'icao24'.");
  }

  async function pollOnce() {
    if (!activeTarget || inFlight) return null;
    const waitMs = nextAllowedAt - Date.now();
    if (waitMs > 0) return null;
    inFlight = true;
    try {
      const observations = await fetchTarget(activeTarget);
      const match = activeTarget.type === "icao24"
        ? observations.find(x => x.icao24 === cleanHex(activeTarget.value))
        : observations.find(x => x.callsign === cleanCallsign(activeTarget.value)) || observations[0];
      if (!match) throw new Error("No current aircraft position found for the selected target.");
      await saveObservation(match, activeOptions.historyHours);
      lastObservation = match;
      lastSuccessAt = nowIso();
      lastError = null;
      nextAllowedAt = Date.now() + activeOptions.intervalMs;
      return match;
    } catch (error) {
      lastError = String(error && error.message || error);
      const backoff = Math.max(60000, (Number(error && error.retryAfter) || 0) * 1000);
      nextAllowedAt = Date.now() + backoff;
      throw error;
    } finally {
      inFlight = false;
    }
  }

  function clearTimer() {
    if (timer !== null) root.clearInterval(timer);
    timer = null;
  }

  function startTracking(target, options) {
    stopTracking();
    if (!target || !target.type || !target.value) throw new Error("Choose a callsign or ICAO24 target.");
    const intervalMs = Math.max(MIN_INTERVAL_MS, Number(options && options.intervalMs) || DEFAULT_INTERVAL_MS);
    activeTarget = { type: target.type, value: target.type === "callsign" ? cleanCallsign(target.value) : cleanHex(target.value) };
    activeOptions = {
      intervalMs,
      historyHours: Math.max(1, Number(options && options.historyHours) || DEFAULT_HISTORY_HOURS)
    };
    stoppedReason = "tracking " + activeTarget.type;
    nextAllowedAt = 0;
    pollOnce().catch(function () {});
    timer = root.setInterval(function () {
      if (root.document && root.document.visibilityState === "hidden") return;
      pollOnce().catch(function () {});
    }, intervalMs);
    return health();
  }

  function stopTracking() {
    clearTimer();
    activeTarget = null;
    activeOptions = null;
    stoppedReason = "stopped by caller";
    inFlight = false;
    return health();
  }

  async function getLatest(icao24) {
    const db = store();
    if (!db || typeof db.get !== "function") throw new Error("EarthLiveCollections.get is unavailable.");
    return db.get(COLLECTION, "latest:" + cleanHex(icao24));
  }

  function health() {
    return {
      ready: !!store(),
      tracking: !!activeTarget,
      target: activeTarget ? Object.assign({}, activeTarget) : null,
      intervalMs: activeOptions ? activeOptions.intervalMs : null,
      historyHours: activeOptions ? activeOptions.historyHours : null,
      inFlight,
      lastSuccessAt,
      lastError,
      lastObservation,
      stoppedReason,
      source: "adsb.fi public API (best-effort; personal/non-commercial)"
    };
  }

  root.EarthLiveFlights = {
    version: "1.0",
    health,
    lookupCallsign,
    lookupIcao24,
    startTracking,
    stopTracking,
    pollOnce,
    getLatest
  };
})(window);

/* EARTH // LIVE — Moon Dataset v1.0
 * Performance-first local approximation. No network, timers, or automatic writes.
 * Intended for visualization; not a precision ephemeris.
 */
(function (root) {
  "use strict";

  let cacheTimestamp = null;
  let cacheResult = null;

  const RAD = Math.PI / 180;
  const DEG = 180 / Math.PI;
  const AU_KM = 149597870.7;

  function wrap360(x) { return ((x % 360) + 360) % 360; }
  function sinD(x) { return Math.sin(x * RAD); }
  function cosD(x) { return Math.cos(x * RAD); }
  function asinD(x) { return Math.asin(Math.max(-1, Math.min(1, x))) * DEG; }
  function atan2D(y, x) { return Math.atan2(y, x) * DEG; }

  function toDate(value) {
    if (value instanceof Date) return new Date(value.getTime());
    if (typeof value === "number") return new Date(value);
    if (value == null) return new Date();
    return new Date(value);
  }

  function calculate(value) {
    const date = toDate(value);
    const ms = date.getTime();
    if (!Number.isFinite(ms)) throw new Error("Invalid timestamp supplied to Moon calculator.");
    if (cacheTimestamp === ms && cacheResult) return cacheResult;

    const jd = ms / 86400000 + 2440587.5;
    const T = (jd - 2451545.0) / 36525;

    // Low-cost Meeus-style mean elements (degrees).
    const Lp = wrap360(218.3164477 + 481267.88123421 * T - 0.0015786 * T * T);
    const D = wrap360(297.8501921 + 445267.1114034 * T - 0.0018819 * T * T);
    const M = wrap360(357.5291092 + 35999.0502909 * T - 0.0001536 * T * T);
    const Mp = wrap360(134.9633964 + 477198.8675055 * T + 0.0087414 * T * T);
    const F = wrap360(93.2720950 + 483202.0175233 * T - 0.0036539 * T * T);

    // Dominant periodic terms for ecliptic longitude, latitude and distance.
    const lon = wrap360(
      Lp
      + 6.289 * sinD(Mp)
      + 1.274 * sinD(2 * D - Mp)
      + 0.658 * sinD(2 * D)
      + 0.214 * sinD(2 * Mp)
      - 0.186 * sinD(M)
      - 0.114 * sinD(2 * F)
      + 0.059 * sinD(2 * D - 2 * Mp)
      + 0.057 * sinD(2 * D - M - Mp)
      + 0.053 * sinD(2 * D + Mp)
    );
    const lat =
      5.128 * sinD(F)
      + 0.280 * sinD(Mp + F)
      + 0.277 * sinD(Mp - F)
      + 0.173 * sinD(2 * D - F)
      + 0.055 * sinD(2 * D + F - Mp)
      + 0.046 * sinD(2 * D - F - Mp);
    const distanceKm =
      385000.56
      - 20905.0 * cosD(Mp)
      - 3699.0 * cosD(2 * D - Mp)
      - 2956.0 * cosD(2 * D)
      - 570.0 * cosD(2 * Mp)
      + 246.0 * cosD(2 * Mp - 2 * D)
      - 205.0 * cosD(M - 2 * D)
      - 171.0 * cosD(Mp + 2 * D);

    // Ecliptic to equatorial coordinates using mean obliquity.
    const epsilon = 23.439291 - 0.0130042 * T;
    const x = cosD(lon) * cosD(lat);
    const y = sinD(lon) * cosD(lat) * cosD(epsilon) - sinD(lat) * sinD(epsilon);
    const z = sinD(lon) * cosD(lat) * sinD(epsilon) + sinD(lat) * cosD(epsilon);
    const ra = wrap360(atan2D(y, x));
    const dec = asinD(z);

    // Approximate solar ecliptic longitude for phase/illumination.
    const sunMeanLon = wrap360(280.46646 + 36000.76983 * T + 0.0003032 * T * T);
    const sunMeanAnomaly = wrap360(357.52911 + 35999.05029 * T - 0.0001537 * T * T);
    const sunLon = wrap360(
      sunMeanLon
      + 1.914602 * sinD(sunMeanAnomaly)
      + 0.019993 * sinD(2 * sunMeanAnomaly)
      + 0.000289 * sinD(3 * sunMeanAnomaly)
    );
    const elongation = wrap360(lon - sunLon);
    const phaseAngle = Math.acos(Math.max(-1, Math.min(1,
      (AU_KM * cosD(lat) * cosD(elongation) - distanceKm) /
      Math.sqrt(AU_KM * AU_KM + distanceKm * distanceKm -
        2 * AU_KM * distanceKm * cosD(lat) * cosD(elongation))
    ))) * DEG;
    const illumination = Math.max(0, Math.min(1, (1 + cosD(180 - phaseAngle)) / 2));

    let phaseName;
    const phase = wrap360(elongation);
    if (phase < 22.5 || phase >= 337.5) phaseName = "New Moon";
    else if (phase < 67.5) phaseName = "Waxing Crescent";
    else if (phase < 112.5) phaseName = "First Quarter";
    else if (phase < 157.5) phaseName = "Waxing Gibbous";
    else if (phase < 202.5) phaseName = "Full Moon";
    else if (phase < 247.5) phaseName = "Waning Gibbous";
    else if (phase < 292.5) phaseName = "Last Quarter";
    else phaseName = "Waning Crescent";

    const result = Object.freeze({
      timestamp: date.toISOString(),
      julianDate: jd,
      rightAscensionDeg: ra,
      declinationDeg: dec,
      eclipticLongitudeDeg: lon,
      eclipticLatitudeDeg: lat,
      distanceKm: distanceKm,
      phaseAngleDeg: phaseAngle,
      illuminationFraction: illumination,
      illuminationPercent: illumination * 100,
      phaseName: phaseName,
      source: "local-calculation",
      accuracy: "lightweight-approximation"
    });

    cacheTimestamp = ms;
    cacheResult = result;
    return result;
  }

  async function saveSnapshot(value, id) {
    const db = root.EarthLiveCollections;
    if (!db || typeof db.save !== "function") {
      throw new Error("EarthLiveCollections.save is unavailable. Load data-store.js first.");
    }
    const result = calculate(value);
    const snapshotId = String(id || ("snapshot:" + result.timestamp));
    await db.save("moon", snapshotId, result, {
      source: "local-calculation",
      capturedAt: new Date().toISOString(),
      observedAt: result.timestamp,
      tags: ["moon", "ephemeris", "snapshot"]
    });
    return result;
  }

  async function getSnapshot(id) {
    const db = root.EarthLiveCollections;
    if (!db || typeof db.get !== "function") {
      throw new Error("EarthLiveCollections.get is unavailable. Load data-store.js first.");
    }
    return db.get("moon", String(id));
  }

  function health() {
    return {
      ready: true,
      networkRequests: 0,
      permanentTimers: 0,
      cachedTimestamp: cacheResult ? cacheResult.timestamp : null,
      method: "lightweight analytical approximation",
      accuracy: "visualization only"
    };
  }

  root.EarthLiveMoon = { version: "1.0", calculate, saveSnapshot, getSnapshot, health };
})(window);

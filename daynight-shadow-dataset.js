/* EARTH // LIVE day/night solar dataset. Calculation and storage only; no UI changes. */
(() => {
  'use strict';
  const CFG = Object.freeze({
    collection: 'solar-shadow',
    schemaVersion: 1,
    intervalMs: 30 * 60 * 1000,
    historyMs: 7 * 24 * 60 * 60 * 1000,
    algorithm: 'EARTH-LIVE-SOLAR-LOW-PRECISION-v1'
  });
  let timer = null;
  let busy = false;

  function api() { return window.EarthLiveCollections; }
  const rad = d => d * Math.PI / 180;
  const deg = r => r * 180 / Math.PI;
  const norm360 = d => ((d % 360) + 360) % 360;
  const norm180 = d => ((d + 180) % 360 + 360) % 360 - 180;

  function solarGeometry(date) {
    const jd = date.getTime() / 86400000 + 2440587.5;
    const T = (jd - 2451545.0) / 36525.0;
    const L0 = norm360(280.46646 + T * (36000.76983 + 0.0003032 * T));
    const M = norm360(357.52911 + T * (35999.05029 - 0.0001537 * T));
    const Mr = rad(M);
    const C = Math.sin(Mr) * (1.914602 - T * (0.004817 + 0.000014 * T))
      + Math.sin(2 * Mr) * (0.019993 - 0.000101 * T)
      + Math.sin(3 * Mr) * 0.000289;
    const trueLong = L0 + C;
    const omega = 125.04 - 1934.136 * T;
    const lambda = trueLong - 0.00569 - 0.00478 * Math.sin(rad(omega));
    const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
    const eps = eps0 + 0.00256 * Math.cos(rad(omega));
    const lam = rad(lambda), er = rad(eps);
    const ra = norm360(deg(Math.atan2(Math.cos(er) * Math.sin(lam), Math.cos(lam))));
    const dec = deg(Math.asin(Math.sin(er) * Math.sin(lam)));
    const gmst = norm360(280.46061837 + 360.98564736629 * (jd - 2451545.0)
      + 0.000387933 * T * T - T * T * T / 38710000);
    const subLon = norm180(ra - gmst);
    const subLat = dec;
    const lat = rad(subLat), lon = rad(subLon);
    const sun = {
      x: Math.cos(lat) * Math.cos(lon),
      y: Math.cos(lat) * Math.sin(lon),
      z: Math.sin(lat)
    };

    // Create 180 evenly spaced points on the terminator great circle.
    const ref = Math.abs(sun.z) < 0.9 ? { x: 0, y: 0, z: 1 } : { x: 1, y: 0, z: 0 };
    const cross = {
      x: sun.y * ref.z - sun.z * ref.y,
      y: sun.z * ref.x - sun.x * ref.z,
      z: sun.x * ref.y - sun.y * ref.x
    };
    const mag = Math.hypot(cross.x, cross.y, cross.z);
    const u = { x: cross.x / mag, y: cross.y / mag, z: cross.z / mag };
    const v = {
      x: sun.y * u.z - sun.z * u.y,
      y: sun.z * u.x - sun.x * u.z,
      z: sun.x * u.y - sun.y * u.x
    };
    const terminator = [];
    for (let i = 0; i < 180; i++) {
      const a = 2 * Math.PI * i / 180;
      const x = u.x * Math.cos(a) + v.x * Math.sin(a);
      const y = u.y * Math.cos(a) + v.y * Math.sin(a);
      const z = u.z * Math.cos(a) + v.z * Math.sin(a);
      terminator.push({
        latitudeDeg: deg(Math.asin(Math.max(-1, Math.min(1, z)))),
        longitudeDeg: norm180(deg(Math.atan2(y, x)))
      });
    }
    return {
      julianDay: jd,
      sunRightAscensionDeg: ra,
      sunDeclinationDeg: dec,
      greenwichSiderealAngleDeg: gmst,
      subsolarLatitudeDeg: subLat,
      subsolarLongitudeDeg: subLon,
      sunDirectionEcef: sun,
      terminator
    };
  }

  async function prune() {
    const store = api();
    if (!store || typeof store.list !== 'function' || typeof store.remove !== 'function') return;
    const cutoff = Date.now() - CFG.historyMs;
    const rows = await store.list(CFG.collection);
    for (const row of rows) {
      const time = Number(row.observedAt || row.capturedAt || 0);
      if (time < cutoff) await store.remove(CFG.collection, row.id);
    }
  }

  async function calculateAndSave(force = false) {
    const store = api();
    if (busy || document.hidden || !store || typeof store.save !== 'function') return;
    busy = true;
    try {
      await store.open();
      const now = Date.now();
      const bucket = Math.floor(now / CFG.intervalMs) * CFG.intervalMs;
      const id = new Date(bucket).toISOString();
      const geometry = solarGeometry(new Date(now));
      const payload = {
        schemaVersion: CFG.schemaVersion,
        algorithm: CFG.algorithm,
        calculatedAt: now,
        calculatedAtUtc: new Date(now).toISOString(),
        ...geometry,
        illumination: {
          model: 'geometric-solar-terminator',
          atmosphereIncluded: false,
          terrainOcclusionIncluded: false
        }
      };
      await store.save(CFG.collection, id, payload, {
        schemaVersion: CFG.schemaVersion,
        source: 'local-solar-calculation',
        capturedAt: now,
        observedAt: now,
        validUntil: now + CFG.historyMs,
        tags: ['global', 'solar-geometry', 'terminator']
      });
      await prune();
      try { localStorage.setItem('earth-live-solar-shadow-status', JSON.stringify({ lastCalculatedAt: now, nextCheckAt: now + CFG.intervalMs })); } catch (_) {}
    } catch (e) {
      console.warn('[EARTH // LIVE solar shadow] Calculation/storage failed; previous records preserved.', e);
    } finally {
      busy = false;
    }
  }

  function start() {
    calculateAndSave(true);
    timer = setInterval(() => calculateAndSave(false), CFG.intervalMs);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) calculateAndSave(false); });
    window.addEventListener('pageshow', () => calculateAndSave(false));
  }

  window.EarthLiveSolarShadowDataset = Object.freeze({
    config: CFG,
    calculate: date => solarGeometry(date instanceof Date ? date : new Date(date || Date.now())),
    calculateAndSave: () => calculateAndSave(true),
    prune
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
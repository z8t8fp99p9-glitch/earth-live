/* EARTH // LIVE one-shot live location dataset. No visible UI changes. */
(() => {
  'use strict';
  const COLLECTION = 'location';
  const RECORD_ID = 'current';
  const SCHEMA_VERSION = 1;
  let inFlight = false;
  let lastStatus = 'idle';

  function db() {
    const api = window.EarthLiveCollections;
    return api && typeof api.save === 'function' && typeof api.get === 'function' ? api : null;
  }

  function setStatus(value) {
    lastStatus = value;
    // Deliberately do not log coordinates or other precise location data.
    window.dispatchEvent(new CustomEvent('earthlive:location-status', { detail: { status: value } }));
  }

  function finiteOrNull(v) {
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  }

  function validate(position) {
    const c = position && position.coords;
    return !!c &&
      Number.isFinite(c.latitude) && c.latitude >= -90 && c.latitude <= 90 &&
      Number.isFinite(c.longitude) && c.longitude >= -180 && c.longitude <= 180 &&
      Number.isFinite(c.accuracy) && c.accuracy >= 0;
  }

  async function capture() {
    if (inFlight) return { ok: false, status: 'request-in-progress' };
    if (!db()) {
      setStatus('local-database-unavailable');
      return { ok: false, status: lastStatus };
    }
    if (!navigator.geolocation) {
      setStatus('geolocation-unavailable');
      return { ok: false, status: lastStatus };
    }
    if (window.isSecureContext === false) {
      setStatus('secure-context-required');
      return { ok: false, status: lastStatus };
    }

    inFlight = true;
    setStatus('requesting-permission-or-fix');
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0
        });
      });

      if (!validate(position)) throw new Error('invalid-position');
      const c = position.coords;
      const capturedAt = Number.isFinite(position.timestamp) ? position.timestamp : Date.now();
      const payload = {
        schemaVersion: SCHEMA_VERSION,
        latitude: c.latitude,
        longitude: c.longitude,
        accuracyMeters: c.accuracy,
        altitudeMeters: finiteOrNull(c.altitude),
        altitudeAccuracyMeters: finiteOrNull(c.altitudeAccuracy),
        headingDegrees: finiteOrNull(c.heading),
        speedMetersPerSecond: finiteOrNull(c.speed),
        capturedAt,
        source: 'browser-device-geolocation',
        permissionMode: 'one-shot'
      };

      await db().save(COLLECTION, RECORD_ID, payload, {
        schemaVersion: SCHEMA_VERSION,
        source: 'device-geolocation',
        capturedAt,
        observedAt: capturedAt,
        validUntil: null,
        geometry: { type: 'Point', coordinates: [c.longitude, c.latitude] },
        tags: ['user-requested', 'latest-fix-only']
      });
      setStatus('saved-locally');
      return { ok: true, status: lastStatus, capturedAt };
    } catch (error) {
      const code = error && typeof error.code === 'number' ? error.code : null;
      let status = 'capture-failed';
      if (code === 1) status = 'permission-denied';
      else if (code === 2) status = 'position-unavailable';
      else if (code === 3) status = 'request-timeout';
      else if (error && error.message === 'invalid-position') status = 'invalid-position';
      setStatus(status);
      return { ok: false, status };
    } finally {
      inFlight = false;
    }
  }

  async function getSavedLocation() {
    if (!db()) return null;
    const record = await db().get(COLLECTION, RECORD_ID);
    return record ? record.payload : null;
  }

  function connectButton() {
    const button = document.getElementById('locateBtn');
    if (!button || button.dataset.earthLiveLocationBound === 'true') return;
    button.dataset.earthLiveLocationBound = 'true';
    button.addEventListener('click', () => { capture(); });
    // The app's existing aria-disabled text is not changed; no visible UI changes.
  }

  window.EarthLiveLocationDataset = Object.freeze({
    capture,
    getSavedLocation,
    getStatus: () => lastStatus
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', connectButton, { once: true });
  } else {
    connectButton();
  }
})();
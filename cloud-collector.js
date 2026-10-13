/* EARTH // LIVE cloud dataset foundation.
   No UI changes. Uses the existing local IndexedDB wrapper. */
(() => {
  'use strict';

  const CONFIG = Object.freeze({
    collection: 'clouds',
    schemaVersion: 1,
    intervalMs: 30 * 60 * 1000,
    historyMs: 7 * 24 * 60 * 60 * 1000,
    maxRecordBytes: 1_500_000,
    sourceIds: Object.freeze({
      imagery: 'NASA-GIBS',
      science: 'NASA-MODIS-MOD06-MYD06'
    })
  });

  const STATE_KEY = 'earth-live-cloud-collector-state-v1';
  let intervalId = null;
  let running = false;
  let lastCheck = 0;

  function dbApi() {
    return window.EarthLiveCollections &&
      typeof window.EarthLiveCollections.save === 'function' &&
      typeof window.EarthLiveCollections.list === 'function' &&
      typeof window.EarthLiveCollections.remove === 'function'
      ? window.EarthLiveCollections : null;
  }

  function state() {
    try {
      return JSON.parse(sessionStorage.getItem(STATE_KEY) || '{}');
    } catch (_) {
      return {};
    }
  }

  function saveState(patch) {
    try {
      sessionStorage.setItem(STATE_KEY, JSON.stringify({ ...state(), ...patch }));
    } catch (_) {}
  }

  function stableId(parts) {
    return parts.map(v => String(v == null ? '' : v).trim().replaceAll(':', '_')).join(':');
  }

  function validTimestamp(value) {
    if (value == null) return null;
    const n = typeof value === 'number' ? value : Date.parse(value);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  function byteSize(value) {
    try {
      return new Blob([JSON.stringify(value)]).size;
    } catch (_) {
      return Infinity;
    }
  }

  function validateRecord(record) {
    if (!record || typeof record !== 'object') return false;
    if (!record.id || !record.source || !record.productId) return false;
    if (!record.payload || typeof record.payload !== 'object') return false;
    if (byteSize(record) > CONFIG.maxRecordBytes) return false;
    if (record.observedAt != null && !validTimestamp(record.observedAt)) return false;
    return true;
  }

  async function storeRecord(record) {
    const db = dbApi();
    if (!db) throw new Error('EarthLiveCollections is not available');
    if (!validateRecord(record)) throw new Error('Cloud record failed validation');
    const observed = validTimestamp(record.observedAt);
    const capturedAt = Date.now();
    const validUntil = observed ? observed + CONFIG.historyMs : capturedAt + CONFIG.historyMs;
    return db.save(CONFIG.collection, record.id, {
      schemaVersion: CONFIG.schemaVersion,
      kind: record.kind,
      productId: record.productId,
      observedAt: observed,
      publishedAt: validTimestamp(record.publishedAt),
      sourceUrl: record.sourceUrl || null,
      geometry: record.geometry || null,
      measurements: record.measurements || null,
      imagery: record.imagery || null,
      quality: record.quality || null,
      attribution: record.attribution || null,
      ingestionStatus: record.ingestionStatus || 'metadata-only'
    }, {
      schemaVersion: CONFIG.schemaVersion,
      source: record.source,
      capturedAt,
      observedAt: observed,
      validUntil,
      geometry: record.geometry || null,
      tags: Array.isArray(record.tags) ? record.tags : []
    });
  }

  async function pruneExpired() {
    const db = dbApi();
    if (!db) return;
    const cutoff = Date.now() - CONFIG.historyMs;
    const records = await db.list(CONFIG.collection);
    for (const r of records) {
      const time = validTimestamp(r.observedAt) || validTimestamp(r.capturedAt) || 0;
      if (time < cutoff) await db.remove(CONFIG.collection, r.id);
    }
  }

  async function checkSourceAdapters() {
    // Source selection is recorded explicitly. Do not mistake rendered imagery for measurements.
    // NASA GIBS: time-aware visualization tiles (imagery only).
    // NASA MODIS MOD06_L2 / MYD06_L2: scientific HDF-EOS granules; raw ingestion remains disabled
    // until a browser-compatible granule download and parser is verified.
    saveState({
      sourceIds: CONFIG.sourceIds,
      lastSourceCheckAt: Date.now(),
      imageryStatus: 'adapter-not-yet-enabled',
      scientificStatus: 'parser-not-yet-verified'
    });
  }

  async function checkNow(force = false) {
    if (running || document.hidden) return;
    const db = dbApi();
    if (!db) {
      console.info('[EARTH // LIVE clouds] Waiting for local database module.');
      return;
    }
    if (!force && Date.now() - lastCheck < CONFIG.intervalMs) return;
    running = true;
    try {
      await checkSourceAdapters();
      await pruneExpired();
      lastCheck = Date.now();
      saveState({ lastCheckAt: lastCheck, nextCheckAt: lastCheck + CONFIG.intervalMs });
      console.info('[EARTH // LIVE clouds] Local policy check complete. Scientific ingestion remains safely disabled pending parser verification.');
    } catch (error) {
      console.warn('[EARTH // LIVE clouds] Check failed; existing local records were preserved.', error);
    } finally {
      running = false;
    }
  }

  function start() {
    if (intervalId) clearInterval(intervalId);
    checkNow(true);
    intervalId = setInterval(() => checkNow(false), CONFIG.intervalMs);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) checkNow(false);
    });
    window.addEventListener('pageshow', () => checkNow(false));
  }

  window.EarthLiveCloudDataset = Object.freeze({
    config: CONFIG,
    checkNow,
    pruneExpired,
    storeRecord,
    getStatus: () => state()
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
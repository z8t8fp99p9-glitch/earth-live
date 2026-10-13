/* EARTH // LIVE satellite dataset collector. No visible UI changes. */
(() => {
  'use strict';
  const CFG = Object.freeze({
    collection: 'satellites',
    schemaVersion: 1,
    checkMs: 30 * 60 * 1000,
    fetchMs: 2 * 60 * 60 * 1000,
    historyMs: 7 * 24 * 60 * 60 * 1000,
    groups: Object.freeze(['STATIONS', 'WEATHER', 'EARTH-RESOURCES', 'GPS-OPS']),
    baseUrl: 'https://celestrak.org/NORAD/elements/gp.php?GROUP='
  });
  const STATE_KEY = 'earth-live-satellite-collector-v1';
  let busy = false;
  let timer = null;

  const db = () => window.EarthLiveCollections;
  const satlib = () => window.satellite;
  const readState = () => { try { return JSON.parse(localStorage.getItem(STATE_KEY) || '{}'); } catch (_) { return {}; } };
  const writeState = p => { try { localStorage.setItem(STATE_KEY, JSON.stringify({ ...readState(), ...p })); } catch (_) {} };
  const validDate = s => { const n = Date.parse(s); return Number.isFinite(n) ? n : null; };
  const clean = x => x == null || x === '' ? null : x;
  const recordId = (cat, epoch) => `${String(cat)}:${String(epoch).replaceAll(':','_')}`;

  function validateOmm(o) {
    return o && (o.NORAD_CAT_ID != null || o.OBJECT_ID) &&
      o.EPOCH && Number.isFinite(Date.parse(o.EPOCH)) &&
      Number.isFinite(Number(o.MEAN_MOTION)) &&
      Number.isFinite(Number(o.ECCENTRICITY));
  }

  function normalize(o, group, url, capturedAt) {
    const cat = String(o.NORAD_CAT_ID ?? o.OBJECT_ID);
    const epoch = new Date(Date.parse(o.EPOCH)).toISOString();
    const payload = {
      schemaVersion: CFG.schemaVersion,
      kind: 'orbital-elements',
      catalogId: cat,
      objectName: clean(o.OBJECT_NAME),
      internationalDesignator: clean(o.OBJECT_ID),
      group,
      format: 'OMM-JSON',
      epoch,
      elements: {
        meanMotion: Number(o.MEAN_MOTION),
        eccentricity: Number(o.ECCENTRICITY),
        inclinationDeg: clean(o.INCLINATION) == null ? null : Number(o.INCLINATION),
        rightAscensionAscendingNodeDeg: clean(o.RA_OF_ASC_NODE) == null ? null : Number(o.RA_OF_ASC_NODE),
        argumentOfPericenterDeg: clean(o.ARG_OF_PERICENTER) == null ? null : Number(o.ARG_OF_PERICENTER),
        meanAnomalyDeg: clean(o.MEAN_ANOMALY) == null ? null : Number(o.MEAN_ANOMALY),
        bstar: clean(o.BSTAR) == null ? null : Number(o.BSTAR),
        ephemerisType: clean(o.EPHEMERIS_TYPE),
        elementSetNumber: clean(o.ELEMENT_SET_NO),
        revolutionNumber: clean(o.REV_AT_EPOCH)
      },
      metadata: {
        classificationType: clean(o.CLASSIFICATION_TYPE),
        centerName: clean(o.CENTER_NAME) || 'EARTH',
        referenceFrame: clean(o.REF_FRAME) || 'TEME',
        timeSystem: clean(o.TIME_SYSTEM) || 'UTC',
        meanElementTheory: clean(o.MEAN_ELEMENT_THEORY) || 'SGP4'
      },
      source: { provider: 'CelesTrak', group, url },
      capturedAt,
      validUntil: Date.parse(epoch) + CFG.historyMs,
      validation: 'passed'
    };
    return { id: recordId(cat, epoch), cat, epoch, payload };
  }

  async function saveGroup(group, rows) {
    const api = db();
    const now = Date.now();
    const url = CFG.baseUrl + encodeURIComponent(group) + '&FORMAT=JSON';
    let saved = 0;
    for (const o of rows) {
      if (!validateOmm(o)) continue;
      const n = normalize(o, group, url, now);
      await api.save(CFG.collection, n.id, n.payload, {
        schemaVersion: CFG.schemaVersion,
        source: 'CelesTrak-GP-OMM',
        capturedAt: now,
        observedAt: Date.parse(n.epoch),
        validUntil: n.payload.validUntil,
        tags: [group, 'OMM-JSON']
      });
      saved++;
    }
    return saved;
  }

  async function prune() {
    const api = db();
    const cutoff = Date.now() - CFG.historyMs;
    const rows = await api.list(CFG.collection);
    for (const r of rows) {
      const t = Number(r.observedAt || r.capturedAt || 0);
      if (t < cutoff) await api.remove(CFG.collection, r.id);
    }
  }

  async function fetchDue(force) {
    if (busy || document.hidden || !db() || typeof db().save !== 'function') return;
    busy = true;
    try {
      await db().open();
      const now = Date.now();
      const st = readState();
      const last = st.groupFetchedAt || {};
      let total = 0;
      for (const group of CFG.groups) {
        if (!force && now - Number(last[group] || 0) < CFG.fetchMs) continue;
        const url = CFG.baseUrl + encodeURIComponent(group) + '&FORMAT=JSON';
        try {
          const response = await fetch(url, { cache: 'no-store', headers: { 'Accept': 'application/json' } });
          if (!response.ok) {
            writeState({ lastError: { group, status: response.status, at: Date.now() } });
            // Never hammer a source on redirects, throttling, or missing groups.
            continue;
          }
          const raw = await response.json();
          const rows = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.data) ? raw.data : null);
          if (!rows) throw new Error('Unexpected OMM JSON response shape');
          const saved = await saveGroup(group, rows);
          total += saved;
          last[group] = Date.now();
          writeState({ groupFetchedAt: last, lastSuccessAt: Date.now(), lastGroup: group, lastSavedCount: saved });
        } catch (e) {
          writeState({ lastError: { group, message: String(e && e.message || e), at: Date.now() } });
          console.warn('[EARTH // LIVE satellites] Source check failed; prior local data preserved.', group, e);
        }
      }
      await prune();
      writeState({ lastCheckAt: Date.now(), lastRunSavedCount: total, nextLocalCheckAt: Date.now() + CFG.checkMs });
      if (total) console.info('[EARTH // LIVE satellites] Updated local orbital records:', total);
    } finally {
      busy = false;
    }
  }

  function propagate(catalogId, date = new Date()) {
    const lib = satlib();
    if (!lib || typeof lib.json2satrec !== 'function' || !db()) {
      throw new Error('satellite.js or local database is unavailable');
    }
    return db().list(CFG.collection).then(rows => {
      const candidates = rows.filter(r => String(r.payload && r.payload.catalogId) === String(catalogId))
        .sort((a,b) => Date.parse(b.payload.epoch) - Date.parse(a.payload.epoch));
      if (!candidates.length) throw new Error('No local orbital elements for catalog ID ' + catalogId);
      const p = candidates[0].payload;
      const o = {
        OBJECT_NAME: p.objectName, OBJECT_ID: p.internationalDesignator,
        NORAD_CAT_ID: Number(p.catalogId), EPOCH: p.epoch,
        MEAN_MOTION: p.elements.meanMotion, ECCENTRICITY: p.elements.eccentricity,
        INCLINATION: p.elements.inclinationDeg, RA_OF_ASC_NODE: p.elements.rightAscensionAscendingNodeDeg,
        ARG_OF_PERICENTER: p.elements.argumentOfPericenterDeg, MEAN_ANOMALY: p.elements.meanAnomalyDeg,
        BSTAR: p.elements.bstar, EPHEMERIS_TYPE: p.elements.ephemerisType,
        ELEMENT_SET_NO: p.elements.elementSetNumber, REV_AT_EPOCH: p.elements.revolutionNumber,
        CENTER_NAME: 'EARTH', REF_FRAME: 'TEME', TIME_SYSTEM: 'UTC', MEAN_ELEMENT_THEORY: 'SGP4'
      };
      const satrec = lib.json2satrec(o);
      const result = lib.propagate(satrec, date);
      if (!result || !result.position || !result.velocity) throw new Error('SGP4 propagation failed for this element set');
      return { catalogId: p.catalogId, objectName: p.objectName, epoch: p.epoch, time: date.toISOString(), frame: 'TEME', positionKm: result.position, velocityKmPerSecond: result.velocity };
    });
  }

  window.EarthLiveSatelliteDataset = Object.freeze({
    config: CFG,
    checkNow: () => fetchDue(true),
    propagate,
    prune,
    getStatus: readState
  });

  function start() {
    fetchDue(false);
    timer = setInterval(() => fetchDue(false), CFG.checkMs);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) fetchDue(false); });
    window.addEventListener('pageshow', () => fetchDue(false));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
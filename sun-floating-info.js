/* EARTH // LIVE v1.97.1 — refined horizon Sun icons with a quiet, transparent ember finish. */
(() => {
  'use strict';
  const range = document.getElementById('sunTimeRange');
  const panel = document.getElementById('sunPanel');
  const readout = document.getElementById('sunTimeReadout');
  if (!range || !panel) return;

  const timer = document.createElement('output');
  timer.id = 'sunScrollerFloatingTimer';
  timer.className = 'sun-scroller-floating-timer';
  timer.setAttribute('aria-live', 'off');
  timer.setAttribute('aria-label', 'Selected celestial time');
  Object.assign(timer.style, {
    position: 'fixed', zIndex: '1000', display: 'none', pointerEvents: 'none',
    transform: 'translate(-50%, -100%)', padding: '3px 8px', borderRadius: '999px',
    color: '#ffb0a5', background: 'transparent',
    border: 'none',
    boxShadow: 'none',
    font: '600 12px/1.2 -apple-system, BlinkMacSystemFont, sans-serif',
    letterSpacing: '0.04em', whiteSpace: 'nowrap', textShadow: '0 0 3px rgba(255, 105, 91, 0.95), 0 0 8px rgba(255, 92, 76, 0.68), 0 0 14px rgba(255, 75, 62, 0.35)'
  });
  document.body.appendChild(timer);

  // Compact paired celestial markers: sunrise at the start, sunset at the end.
  function makeEndpointMarker(id, ariaLabel, title, timeId, iconSvg, color, glow) {
    const marker = document.createElement('div');
    marker.id = id;
    marker.setAttribute('aria-label', ariaLabel);
    Object.assign(marker.style, {
      position: 'fixed', zIndex: '999', display: 'none', pointerEvents: 'none',
      transform: 'translate(-50%, -100%)', padding: '0', margin: '0',
      color: '#fff0dc', background: 'transparent', border: 'none', boxShadow: 'none',
      font: '800 8px/1.15 -apple-system, BlinkMacSystemFont, sans-serif',
      letterSpacing: '0.055em', whiteSpace: 'nowrap', textAlign: 'center',
      textShadow: `0 0 2px ${glow}, 0 0 5px ${glow}, 0 0 9px ${color}`
    });
    marker.innerHTML = `<span aria-hidden="true" style="display:block;width:20px;height:14px;margin:0 auto 2px;filter:drop-shadow(0 0 3px ${glow})">${iconSvg}</span><span style="display:block;font-weight:800">${title}</span><span id="${timeId}" style="display:block;font-size:10px;font-weight:800;letter-spacing:.025em;margin-top:2px">—</span>`;
    document.body.appendChild(marker);
    return marker;
  }
  const sunrise = makeEndpointMarker(
    'sunriseScrollerMarker', 'Sunrise time', 'SUNRISE', 'sunriseScrollerTime',
    '<svg viewBox="0 0 24 16" width="20" height="14" xmlns="http://www.w3.org/2000/svg"><path d="M1 10.5H23M5.5 10.5a6.5 6.5 0 0 1 13 0" fill="none" stroke="#FFC77A" stroke-width="1.5" stroke-linecap="round"/><path d="M12 0.8v3M5.1 3.2l1.8 1.9M18.9 3.2l-1.8 1.9M2.5 7.1l2.6 1M21.5 7.1l-2.6 1" stroke="#FFC77A" stroke-width="1.25" stroke-linecap="round"/></svg>',
    'rgba(255,160,92,.45)', 'rgba(255,184,113,.85)'
  );
  const sunset = makeEndpointMarker(
    'sunsetScrollerMarker', 'Sunset time', 'SUNSET', 'sunsetScrollerTime',
    '<svg viewBox="0 0 24 16" width="20" height="14" xmlns="http://www.w3.org/2000/svg"><path d="M1 10.5H23M5.5 10.5a6.5 6.5 0 0 1 13 0" fill="none" stroke="#FF9A80" stroke-width="1.5" stroke-linecap="round"/><path d="M12 0.8v3M5.1 3.2l1.8 1.9M18.9 3.2l-1.8 1.9M2.5 7.1l2.6 1M21.5 7.1l-2.6 1" stroke="#FF9A80" stroke-width="1.25" stroke-linecap="round"/></svg>',
    'rgba(255,105,91,.42)', 'rgba(255,155,132,.8)'
  );

  function timeText() {
    const text = readout ? readout.textContent.replace(/\s+/g, ' ').trim() : '';
    if (text && text !== '—' && text !== '-') return text;
    // Fallback to the Sun view's visible selected-time/status line, when available.
    const status = document.getElementById('sunSkyStatus');
    const match = status && status.textContent.match(/\b\d{1,2}:\d{2}(?:\s?[AP]M)?\b/i);
    return match ? match[0] : '—';
  }

  function thumbWidth() {
    for (const pseudo of ['::-webkit-slider-thumb', '::-moz-range-thumb']) {
      const width = parseFloat(getComputedStyle(range, pseudo).width);
      if (Number.isFinite(width) && width > 0) return width;
    }
    return 28;
  }

  function update() {
    const panelVisible = !panel.hidden && getComputedStyle(panel).display !== 'none';
    const skyVisible = (() => { const sky = document.getElementById('sunSky'); return !!sky && !sky.hidden; })();
    if (!panelVisible || !skyVisible) { timer.style.display = 'none'; sunrise.style.display = 'none'; sunset.style.display = 'none'; return; }
    const rect = range.getBoundingClientRect();
    if (!rect.width || !rect.height) { timer.style.display = 'none'; sunrise.style.display = 'none'; sunset.style.display = 'none'; return; }
    const startLabel = document.getElementById('sunStartLabel');
    const endLabel = document.getElementById('sunEndLabel');
    const sunriseTime = document.getElementById('sunriseScrollerTime');
    const sunsetTime = document.getElementById('sunsetScrollerTime');
    if (startLabel && startLabel.textContent.trim()) sunriseTime.textContent = startLabel.textContent.trim();
    if (endLabel && endLabel.textContent.trim()) sunsetTime.textContent = endLabel.textContent.trim();
    const sunThumb = thumbWidth();
    const markerY = rect.top + rect.height / 2 - sunThumb / 2 - 17;
    const minX = rect.left + sunThumb / 2;
    const maxX = rect.right - sunThumb / 2;
    sunrise.style.left = `${minX}px`;
    sunrise.style.top = `${markerY}px`;
    sunrise.style.display = 'block';
    sunset.style.left = `${maxX}px`;
    sunset.style.top = `${markerY}px`;
    sunset.style.display = 'block';
    const min = Number(range.min || 0), max = Number(range.max || 100), value = Number(range.value || 0);
    const fraction = max > min ? Math.min(1, Math.max(0, (value - min) / (max - min))) : 0;
    const thumb = thumbWidth();
    const inset = thumb / 2;
    const x = rect.left + inset + fraction * Math.max(0, rect.width - thumb);
    // Anchor to the slider's thumb center, with a 7 px visual gap above it.
    const y = rect.top + rect.height / 2 - thumb / 2 - 7;
    timer.textContent = timeText();
    timer.style.left = `${x}px`;
    timer.style.top = `${y}px`;
    timer.style.display = 'block';
  }

  range.addEventListener('input', update, { passive: true });
  range.addEventListener('change', update, { passive: true });
  window.addEventListener('resize', update, { passive: true });
  window.addEventListener('orientationchange', () => requestAnimationFrame(update), { passive: true });
  window.addEventListener('earthlive:sun-updated', update);
  if (readout) new MutationObserver(update).observe(readout, { childList: true, subtree: true, characterData: true });
  const observer = new MutationObserver(update);
  observer.observe(panel, { attributes: true, attributeFilter: ['hidden', 'class', 'style'] });
  document.addEventListener('click', event => {
    if (event.target && event.target.closest('#sunBtn')) requestAnimationFrame(() => requestAnimationFrame(update));
  });
  requestAnimationFrame(update);
})();

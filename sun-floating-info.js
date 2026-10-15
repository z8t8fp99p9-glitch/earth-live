/* EARTH // LIVE v1.96.9 — compact black sunrise label with ember glow and transparent background anchored to the Sun scroller thumb. */
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

  // Sunrise marker: uses the actual calculated start time supplied by Sun Sky View.
  const sunrise = document.createElement('div');
  sunrise.id = 'sunriseScrollerMarker';
  sunrise.setAttribute('aria-label', 'Sunrise time');
  Object.assign(sunrise.style, {
    position: 'fixed', zIndex: '999', display: 'none', pointerEvents: 'none',
    transform: 'translate(0, -100%)', padding: '0', borderRadius: '0',
    color: '#17100d', background: 'transparent',
    border: 'none',
    boxShadow: 'none',
    font: '800 9px/1.2 -apple-system, BlinkMacSystemFont, sans-serif',
    letterSpacing: '0.035em', whiteSpace: 'nowrap', textAlign: 'center',
    textShadow: '0 0 3px rgba(255, 102, 68, 0.95), 0 0 7px rgba(255, 91, 54, 0.78), 0 0 12px rgba(255, 75, 45, 0.5)'
  });
  sunrise.innerHTML = '<span style="display:block;font-weight:800">SUNRISE</span><span id="sunriseScrollerTime" style="display:block;font-size:10px;font-weight:800;letter-spacing:.02em;margin-top:1px">—</span>';
  document.body.appendChild(sunrise);

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
    if (!panelVisible || !skyVisible) { timer.style.display = 'none'; sunrise.style.display = 'none'; return; }
    const rect = range.getBoundingClientRect();
    if (!rect.width || !rect.height) { timer.style.display = 'none'; sunrise.style.display = 'none'; return; }
    const startLabel = document.getElementById('sunStartLabel');
    const sunriseTime = document.getElementById('sunriseScrollerTime');
    if (startLabel && startLabel.textContent.trim()) sunriseTime.textContent = startLabel.textContent.trim();
    const sunThumb = thumbWidth();
    sunrise.style.left = `${rect.left + sunThumb / 2}px`;
    sunrise.style.top = `${rect.top + rect.height / 2 - sunThumb / 2 - 15}px`;
    sunrise.style.display = 'block';
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

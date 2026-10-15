/* EARTH // LIVE v1.96.6 — amber celestial-time badge anchored to the Sun scroller thumb. */
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
    color: '#ffd28a', background: 'rgba(43, 23, 10, 0.88)',
    border: '1px solid rgba(255, 184, 83, 0.72)',
    boxShadow: '0 0 10px rgba(255, 164, 48, 0.28), inset 0 0 5px rgba(255, 205, 125, 0.08)',
    font: '600 12px/1.2 -apple-system, BlinkMacSystemFont, sans-serif',
    letterSpacing: '0.04em', whiteSpace: 'nowrap', textShadow: '0 0 7px rgba(255, 177, 71, 0.42)'
  });
  document.body.appendChild(timer);

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
    if (!panelVisible || !skyVisible) { timer.style.display = 'none'; return; }
    const rect = range.getBoundingClientRect();
    if (!rect.width || !rect.height) { timer.style.display = 'none'; return; }
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

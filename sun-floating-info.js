/* EARTH // LIVE v1.99 — anchor the floating selected time to the small scroller Sun. */
(() => {
  'use strict';
  const range = document.getElementById('sunTimeRange');
  const panel = document.getElementById('sunPanel');
  const info = panel && panel.querySelector('.sun-floating-info');
  const time = document.getElementById('sunCurrentTimeFloat');
  if (!range || !panel || !info || !time) return;

  function placeTimeOnThumb() {
    if (panel.hidden || !range.getClientRects().length) return;
    const rangeRect = range.getBoundingClientRect();
    const infoRect = info.getBoundingClientRect();
    const width = rangeRect.width;
    if (!width || !infoRect.width) return;
    const min = Number(range.min || 0);
    const max = Number(range.max || 1);
    const value = Number(range.value || min);
    const fraction = max > min ? Math.max(0, Math.min(1, (value - min) / (max - min))) : 0;
    // Native range thumbs stop half a thumb-width inside the input's bounds.
    const thumb = Math.min(39, Math.max(30, rangeRect.height * .89));
    const centerX = rangeRect.left + thumb / 2 + fraction * Math.max(0, width - thumb);
    const labelWidth = time.getBoundingClientRect().width || 42;
    const pad = Math.min(labelWidth / 2 + 2, infoRect.width / 2);
    const localX = Math.max(pad, Math.min(infoRect.width - pad, centerX - infoRect.left));
    time.style.left = `${localX}px`;
  }
  range.addEventListener('input', placeTimeOnThumb, true);
  range.addEventListener('change', placeTimeOnThumb, true);
  window.addEventListener('resize', placeTimeOnThumb, {passive:true});
  window.addEventListener('orientationchange', () => requestAnimationFrame(placeTimeOnThumb), {passive:true});
  window.addEventListener('earthlive:foreground', () => requestAnimationFrame(placeTimeOnThumb));
  const observer = new MutationObserver(() => requestAnimationFrame(placeTimeOnThumb));
  observer.observe(panel, {attributes:true, attributeFilter:['hidden','class']});
  // Opening the panel changes its hidden attribute; the observer repositions the time.
  // User-driven value changes are handled by input/change, avoiding a permanent animation loop.
})();

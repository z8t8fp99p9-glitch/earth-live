/* EARTH // LIVE v1.96 — floating, unboxed Sun time and information labels. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const range = $('sunTimeRange');
  if (!range) return;
  const rise = $('sunRiseTimeFloat'), set = $('sunSetTimeFloat');
  const current = $('sunCurrentTimeFloat'), extra = $('sunExtraInfoFloat');
  const start = $('sunStartLabel'), end = $('sunEndLabel');
  const readout = $('sunTimeReadout'), direction = $('sunSkyDirection'), status = $('sunSkyStatus');
  const tidy = value => (value || '—').replace(/\s+/g, ' ').trim();
  function sync() {
    if (rise && start) rise.textContent = tidy(start.textContent);
    if (set && end) set.textContent = tidy(end.textContent);
    if (current && readout) current.textContent = tidy(readout.textContent || readout.value);
    if (extra) {
      const dir = direction ? tidy(direction.textContent) : '';
      const state = status ? tidy(status.textContent).split('·').pop().trim() : '';
      extra.textContent = [dir, state].filter(Boolean).join('  ·  ');
    }
    const panel = range.closest('.sun-panel');
    if (panel && current) {
      const max = Number(range.max) || 1, min = Number(range.min) || 0;
      const fraction = Math.max(0, Math.min(1, (Number(range.value) - min) / (max - min)));
      const rangeRect = range.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();

      // Track the SMALL Sun thumb using the rendered range input's own bounds.
      // This is UI geometry only; it does not read or alter the astronomical Sun position.
      let thumbSize = 39;
      try {
        const thumbStyle = getComputedStyle(range, '::-webkit-slider-thumb');
        const measured = parseFloat(thumbStyle.width);
        if (Number.isFinite(measured) && measured > 0) thumbSize = measured;
      } catch (_) {}
      const thumbHalf = thumbSize / 2;
      const thumbCenter = rangeRect.left + thumbHalf + (rangeRect.width - thumbSize) * fraction;
      const halfLabel = current.offsetWidth / 2;
      const bounded = Math.max(panelRect.left + halfLabel + 4,
        Math.min(panelRect.right - halfLabel - 4, thumbCenter));
      current.style.left = `${bounded - panelRect.left}px`;
    }
  }
  range.addEventListener('input', () => requestAnimationFrame(sync));
  range.addEventListener('change', sync);
  window.addEventListener('resize', sync, {passive:true});
  const observer = new MutationObserver(sync);
  [start,end,readout,direction,status].filter(Boolean).forEach(el => observer.observe(el,{childList:true,subtree:true,characterData:true,attributes:true}));
  document.addEventListener('click', e => { if (e.target && e.target.closest('#sunBtn')) setTimeout(sync, 80); });
  window.addEventListener('earthlive:sun-updated', sync);
  sync();
})();

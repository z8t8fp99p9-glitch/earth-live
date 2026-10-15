/* EARTH // LIVE v1.102 — floating, unboxed Sun time and information labels. */
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
    const track = range.closest('.sun-timeline');
    const panel = range.closest('.sun-panel');
    if (track && panel && current) {
      const max = Number(range.max) || 1, min = Number(range.min) || 0;
      const fraction = Math.max(0, Math.min(1, (Number(range.value) - min) / (max - min)));
      const thumbHalf = 20;
      const trackRect = track.getBoundingClientRect(), panelRect = panel.getBoundingClientRect();
      const x = trackRect.left + trackRect.width * (.10 + .75 * fraction);
      const half = current.offsetWidth / 2;
      const bounded = Math.max(panelRect.left + half + 4, Math.min(panelRect.right - half - 4, x));
      current.style.left = (bounded - panelRect.left) + 'px';
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
